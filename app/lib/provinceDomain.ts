// Resolve a reverse-geocoded location → the correct .zonalvalue.com domain.
//
// WHY: location lookups (clicking a building, scanning a box, "near me") used to trust
// the province the DROPDOWN happened to be on. So a free map-search to Davao while the
// dropdown was still on Cebu/Cavite queried the WRONG province → "No zonal value saved".
// This maps the place itself → its real domain, so the lookup always asks the right
// province regardless of the dropdown. Deterministic (no network); returns null when
// unsure so callers can safely fall back to the passed domain.
//
// The domain values here are the SAME canonical domains /api/zonal's domainToProvince
// inverts back to the matching province — so /api/zonal?domain=<this> resolves correctly.

const ZV = (sub: string) => `${sub}.zonalvalue.com`;

// Convert Cebuano/Tagalog place names Google sometimes returns (even with language=en) into
// their English DB forms: "Lungsod ng Dabaw" → "DAVAO CITY", "Dakbayan sa Sugbo" → "CEBU CITY",
// "Lalawigan ng Davao del Sur" → "DAVAO DEL SUR", "Maynila" → "MANILA".
export function anglicizePH(s: any): string {
  let v = String(s || "").toUpperCase().replace(/Ñ/g, "N");
  const isCity = /\b(?:LUNGSOD\s+NG|LUNGSOD|DAKBAYAN\s+SA|DAKBAYAN)\b/.test(v);
  v = v.replace(/\b(?:LUNGSOD\s+NG|LUNGSOD|DAKBAYAN\s+SA|DAKBAYAN)\b/g, " ");                                  // "city of" wrappers
  v = v.replace(/\b(?:BAYAN\s+NG|MUNISIPYO\s+NG|MUNISIPALIDAD\s+NG|LALAWIGAN\s+NG|PROBINSYA\s+NG|LALAWIGAN|PROBINSYA)\b/g, " "); // town/province wrappers
  v = v.replace(/\bDABAW\b/g, "DAVAO").replace(/\bMAYNILA\b/g, "MANILA").replace(/\bSUGBO\b/g, "CEBU");        // local place-name roots
  v = v.replace(/\s+/g, " ").trim();
  if (isCity && v && !/\bCITY$/.test(v)) v += " CITY"; // "Lungsod ng X" means "City of X"
  return v;
}

function norm(s: any): string {
  return anglicizePH(s)
    .replace(/\bPROVINCE OF\b/g, " ")
    .replace(/\bCITY OF\b/g, " ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Independent/HUC cities stored under their OWN province value (= their own domain).
// These MUST win over the surrounding province (Davao City data is province "DAVAO CITY",
// not "DAVAO DEL SUR"), so we check the city first.
const CITY_DOMAIN: Record<string, string> = {
  "DAVAO CITY": ZV("davaocity"),
  "GENERAL SANTOS CITY": ZV("generalsantos"),
  "GENERAL SANTOS": ZV("generalsantos"),
};

// Every province present in /api/zonal's domainToProvince → its canonical domain.
const PROVINCE_DOMAIN: Record<string, string> = {
  "NEGROS OCCIDENTAL": ZV("negrosoccidental"),
  "NEGROS ORIENTAL": ZV("negrosoriental-siquijor"),
  "CEBU": ZV("cebu"),
  "BOHOL": ZV("bohol"),
  "ILOILO": ZV("iloilo"),
  "DAVAO DEL SUR": ZV("davaodelsur"),
  "DAVAO DEL NORTE": ZV("davaodelnorte-samal-compostelavalley"),
  "DAVAO DE ORO": ZV("davaodeoro"),
  "DAVAO OCCIDENTAL": ZV("davaooccidental"),
  "DAVAO ORIENTAL": ZV("davaooriental"),
  "DAVAO CITY": ZV("davaocity"),
  "ZAMBOANGA DEL SUR": ZV("zamboangadelsur"),
  "ZAMBOANGA DEL NORTE": ZV("zamboangadelnorte"),
  "ZAMBOANGA SIBUGAY": ZV("zamboangasibugay"),
  "AGUSAN DEL NORTE": ZV("agusandelnorte"),
  "AGUSAN DEL SUR": ZV("agusandelsur"),
  "NCR": ZV("ncr1stdistrict"),
  "BENGUET": ZV("benguet"),
  "IFUGAO": ZV("ifugao"),
  "CAGAYAN": ZV("cagayan-batanes"),
  "BATANES": ZV("batanes"),
  "ISABELA": ZV("isabela"),
  "ABRA": ZV("abra"),
  "MISAMIS ORIENTAL": ZV("misamisoriental-camiguin"),
  "MISAMIS OCCIDENTAL": ZV("misamisoccidental"),
  "CAMIGUIN": ZV("camiguin"),
  "BUKIDNON": ZV("bukidnon"),
  "LANAO DEL NORTE": ZV("lanaodelnorte"),
  "LANAO DEL SUR": ZV("lanaodelsur"),
  "SURIGAO DEL NORTE": ZV("surigaodelnorte"),
  "SURIGAO DEL SUR": ZV("surigaodelsur"),
  "DINAGAT ISLANDS": ZV("dinagat"),
  "KALINGA": ZV("kalinga-apayao"),
  "APAYAO": ZV("apayao"),
  "AKLAN": ZV("aklan"),
  "CAPIZ": ZV("capiz"),
  "ANTIQUE": ZV("antique"),
  "CAMARINES NORTE": ZV("camarinesnorte"),
  "CAMARINES SUR": ZV("camarinessur"),
  "ALBAY": ZV("albay"),
  "SORSOGON": ZV("sorsogon"),
  "CATANDUANES": ZV("catanduanes"),
  "MASBATE": ZV("masbate"),
  "OCCIDENTAL MINDORO": ZV("occidentalmindoro"),
  "ORIENTAL MINDORO": ZV("orientalmindoro"),
  "MARINDUQUE": ZV("marinduque"),
  "ROMBLON": ZV("romblon"),
  "PALAWAN": ZV("palawan"),
  "CAVITE": ZV("cavite"),
  "LAGUNA": ZV("laguna"),
  "BATANGAS": ZV("batangas"),
  "RIZAL": ZV("rizal"),
  "QUEZON": ZV("quezon"),
  "AURORA": ZV("aurora"),
  "BATAAN": ZV("bataan"),
  "BULACAN": ZV("bulacan"),
  "NUEVA ECIJA": ZV("nuevaecija"),
  "PAMPANGA": ZV("pampanga"),
  "TARLAC": ZV("tarlac"),
  "ZAMBALES": ZV("zambales"),
  "MAGUINDANAO": ZV("maguindanao"),
  "BASILAN": ZV("basilan"),
  "SULU": ZV("sulu"),
  "SOUTHERN LEYTE": ZV("southernleyte"),
  "LEYTE": ZV("leyte-bilaran"),
  "BILIRAN": ZV("biliran"),
  "MOUNTAIN PROVINCE": ZV("mtprovince"),
  "NORTHERN SAMAR": ZV("northernsamar"),
  "EASTERN SAMAR": ZV("easternsamar"),
  "WESTERN SAMAR": ZV("westernsamar"),
  "NUEVA VIZCAYA": ZV("nuevavizcaya"),
  "QUIRINO": ZV("quirino"),
  "ILOCOS NORTE": ZV("ilocosnorte"),
  "ILOCOS SUR": ZV("ilocossur"),
  "LA UNION": ZV("launion"),
  "PANGASINAN": ZV("pangasinan"),
  "SOUTH COTABATO": ZV("southcotabato"),
  "NORTH COTABATO": ZV("northcotabato"),
  "SULTAN KUDARAT": ZV("sultankudarat"),
  "GENERAL SANTOS": ZV("generalsantos"),
  "SARANGANI": ZV("sarangani"),
  "TAWI TAWI": ZV("tawitawi"),
};

// Google sometimes returns a region/old/split name instead of our province key.
const PROVINCE_ALIAS: Record<string, string> = {
  "METRO MANILA": "NCR",
  "NATIONAL CAPITAL REGION": "NCR",
  "KALAKHANG MAYNILA": "NCR",      // Google returns the Tagalog region name even in EN
  "KAMAYNILAAN": "NCR",
  "COMPOSTELA VALLEY": "DAVAO DE ORO",
  "COTABATO": "NORTH COTABATO",
  "COTABATO PROVINCE": "NORTH COTABATO",
  "SAMAR": "WESTERN SAMAR",
  "MAGUINDANAO DEL NORTE": "MAGUINDANAO",
  "MAGUINDANAO DEL SUR": "MAGUINDANAO",
};

/**
 * Resolve the correct domain for a reverse-geocoded (city, province).
 * Returns null when it can't confidently map — callers should fall back to the
 * domain they already have (so behavior is never worse than before).
 */
export function resolveDomainFromLocation(city?: string | null, province?: string | null): string | null {
  const c = norm(city);
  if (c && CITY_DOMAIN[c]) return CITY_DOMAIN[c]; // HUC city wins (Davao City, GenSan)

  let p = norm(province);
  if (!p) return null;
  if (PROVINCE_ALIAS[p]) p = PROVINCE_ALIAS[p];
  if (PROVINCE_DOMAIN[p]) return PROVINCE_DOMAIN[p];

  // Google sometimes puts an HUC city in the province slot ("Davao City").
  if (CITY_DOMAIN[p]) return CITY_DOMAIN[p];

  return null;
}

/** Normalize a place name the same way this module does (exported for the city index). */
export function normName(s: any): string {
  return norm(s);
}

/** Map a province name (our DB form, or a Google form via aliases) → its domain. */
export function provinceToDomain(province?: string | null): string | null {
  let p = norm(province);
  if (!p) return null;
  if (PROVINCE_ALIAS[p]) p = PROVINCE_ALIAS[p];
  return PROVINCE_DOMAIN[p] ?? CITY_DOMAIN[p] ?? null;
}
