import type { PoiData } from "./types";

export function cleanName(s: any) {
  return String(s ?? "").replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
}

export function normalizePH(s: any) {
  return cleanName(s)
    .replace(/\bPOB\b/gi, "Poblacion")
    .replace(/\bSTO\b/gi, "Santo")
    .replace(/\bSTA\b/gi, "Santa")
    .replace(/NIÑO/gi, "Nino")
    .replace(/Ñ/gi, "N")
    .replace(/\bST\.?\b/gi, "Street")
    .replace(/\bRD\.?\b/gi, "Road")
    .replace(/\bAVE\.?\b/gi, "Avenue")
    .replace(/\bBLVD\.?\b/gi, "Boulevard")
    .replace(/\bDR\.?\b/gi, "Drive")
    .replace(/\bLN\.?\b/gi, "Lane")
    .replace(/\bBRGY\.?\b/gi, "Barangay");
}

export function isBadStreet(s: string) {
  const v = normalizePH(s).toUpperCase();
  if (!v) return true;
  if (v.includes("ALL OTHER")) return true;
  if (v === "OTHERS") return true;
  // Generic or non-street descriptors often found in datasets
  if (/(CONDO(MINIUM)?|HIGH\s*END|LOW\s*END|APARTMENT|BLDG|BUILDING|TOWN\s*CENTER|TOWN\s*CENTRE|PHASE|BLOCK|BLK|CLUSTER)/i.test(v))
    return true;
  return false;
}

// Levenshtein distance-based fuzzy matching for street names
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

// Find best matches for incomplete street names
// Canonicalize street strings for loose matching
function canonicalStreetLoose(s: string) {
  let t = normalizePH(s || "").toLowerCase();
  // remove dots and punctuation to catch initials like "v. urgello" => "v urgello"
  t = t.replace(/[\.,]/g, " ");
  // expand common road-type abbreviations
  t = t.replace(/\bave\b/g, "avenue")
       .replace(/\bblvd\b/g, "boulevard")
       .replace(/\brd\b/g, "road")
       .replace(/\bst\b/g, "street")
       .replace(/\bdr\b/g, "drive")
       .replace(/\bln\b/g, "lane");
  // collapse multiple spaces
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function bigrams(s: string) {
  const arr: string[] = [];
  for (let i = 0; i < s.length - 1; i++) arr.push(s.slice(i, i + 2));
  return arr;
}

function diceCoeff(a: string, b: string) {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.length || !B.length) return 0;
  const setB = new Map<string, number>();
  for (const x of B) setB.set(x, (setB.get(x) || 0) + 1);
  let inter = 0;
  for (const x of A) {
    const c = setB.get(x) || 0;
    if (c > 0) { inter++; setB.set(x, c - 1); }
  }
  return (2 * inter) / (A.length + B.length);
}

export function fuzzyMatchStreets(query: string, streets: string[], maxDistance: number = 3): string[] {
  if (!query.trim()) return streets;

  // canonical forms (handle abbreviations and initials)
  const q = canonicalStreetLoose(query);

  const results = streets
    .map((street) => {
      const cs = canonicalStreetLoose(street);
      const exactSub = cs.includes(q) || q.includes(cs);
      // levenshtein on canonical
      const d = levenshteinDistance(q.toUpperCase(), cs.toUpperCase());
      // bigram similarity for noisy inputs (initials, swapped types)
      const dice = diceCoeff(q, cs);

      // combined score: higher is better
      const score = (exactSub ? 1 : 0) + Math.max(0, 1 - d / Math.max(q.length, cs.length)) * 0.7 + dice * 0.8;
      return { street, cs, exactSub, d, dice, score };
    })
    .filter((x) => x.exactSub || x.d <= maxDistance || x.dice >= 0.45)
    .sort((a, b) => b.score - a.score);

  return results.map((r) => r.street);
}


export function parseZonalNumber(v: string) {
  const s = String(v ?? "").replace(/,/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function waitForZonalMapIdle(opts?: { minEvents?: number; timeoutMs?: number }) {
  const minEvents = Math.max(1, opts?.minEvents ?? 2);
  const timeoutMs = Math.max(500, opts?.timeoutMs ?? 4000);

  return new Promise<void>((resolve) => {
    let seen = 0;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("zonalmap:idle", onIdle as any);
      clearTimeout(t);
      resolve();
    };

    const onIdle = () => {
      seen += 1;
      if (seen >= minEvents) finish();
    };

    const t = setTimeout(finish, timeoutMs);
    window.addEventListener("zonalmap:idle", onIdle as any);
  });
}

export function suggestBusinesses(args: {
  zonalValueText: string;
  classification?: string;
  poi?: PoiData | null;
}) {
  const zonal = parseZonalNumber(args.zonalValueText);
  const cls = String(args.classification ?? "").toUpperCase();
  const poi = args.poi;

  const ideas: string[] = [];

  if (cls.includes("COMMERCIAL")) ideas.push("Retail / Convenience Store", "Food & Beverage (Cafe / Quick Service)");
  if (cls.includes("RESIDENTIAL")) ideas.push("Apartment / Boarding House", "Small Grocery / Laundry Shop");
  if (cls.includes("INDUSTRIAL")) ideas.push("Warehouse / Logistics", "Hardware / Building Supplies");

  if (zonal != null) {
    if (zonal >= 25000) ideas.push("Premium Retail", "Clinics / Professional Services", "Franchise Food");
    else if (zonal >= 12000) ideas.push("Mid-scale Restaurant", "Pharmacy", "Salon / Wellness");
    else ideas.push("Sari-sari / Micro-retail", "Motorcycle Services", "Basic Food Stall");
  }

  if (poi) {
    if (poi.counts.schools >= 3) ideas.push("School Supplies / Printing", "Snacks / Milk Tea near schools");
    if (poi.counts.hospitals + poi.counts.clinics >= 2) ideas.push("Pharmacy / Medical Supplies", "Convenience near clinics");
    if (poi.counts.policeStations + poi.counts.fireStations >= 1) ideas.push("24/7 Convenience / Safe-area services");
  }

  return Array.from(new Set(ideas)).slice(0, 6);
}

export function defaultRisks() {
  return [
    "Flood: Unknown (needs hazard layer)",
    "Landslide: Unknown (needs hazard layer)",
    "Liquefaction: Unknown (needs hazard layer)",
  ];
}
