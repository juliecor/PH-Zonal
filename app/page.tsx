"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Map as MapIcon, Satellite as SatelliteIcon, Mountain as TerrainIcon } from "lucide-react";

const ZonalMap = dynamic(() => import("./components/ZonalMap"), { ssr: false });

type Row = {
  rowIndex: number;
  route?: string;
  "Street/Subdivision-": string;
  "Vicinity-": string;
  "Barangay-": string;
  "City-": string;
  "Province-": string;
  "Classification-": string;
  "ZonalValuepersqm.-": string;
  __zonal_raw?: number | string;
};

type RegionMatch = { province: string; city: string; domain: string };
type LatLng = { lat: number; lon: number };
type Boundary = Array<[number, number]>;

type PoiItem = { name: string; lat?: number; lon?: number; type?: string };
type PoiData = {
  counts: {
    hospitals: number;
    schools: number;
    policeStations: number;
    fireStations: number;
    pharmacies: number;
    clinics: number;
  };
  items: {
    hospitals: PoiItem[];
    schools: PoiItem[];
    policeStations: PoiItem[];
    fireStations: PoiItem[];
    pharmacies: PoiItem[];
    clinics: PoiItem[];
  };
};

type MapType = "street" | "terrain" | "satellite";

function cleanName(s: any) {
  return String(s ?? "").replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
}

function normalizePH(s: any) {
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

function isBadStreet(s: string) {
  const v = normalizePH(s).toUpperCase();
  if (!v) return true;
  if (v.includes("ALL OTHER")) return true;
  if (v === "OTHERS") return true;
  return false;
}

function parseZonalNumber(v: string) {
  const s = String(v ?? "").replace(/,/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function waitForZonalMapIdle(opts?: { minEvents?: number; timeoutMs?: number }) {
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

function suggestBusinesses(args: {
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

function defaultRisks() {
  return [
    "Flood: Unknown (needs hazard layer)",
    "Landslide: Unknown (needs hazard layer)",
    "Liquefaction: Unknown (needs hazard layer)",
  ];
}

export default function Home() {
  // region selection
  const [regionSearch, setRegionSearch] = useState("");
  const [matches, setMatches] = useState<RegionMatch[]>([]);
  const [domain, setDomain] = useState("cebu.zonalvalue.com");

  // facets
  const [facetCities, setFacetCities] = useState<string[]>([]);
  const [facetBarangays, setFacetBarangays] = useState<string[]>([]);
  const [facetsLoading, setFacetsLoading] = useState(false);
  const [barangaysLoading, setBarangaysLoading] = useState(false);

  // filters
  const [city, setCity] = useState("");
  const [barangay, setBarangay] = useState("");
  const [classification, setClassification] = useState("");
  const [q, setQ] = useState("");

  // pagination
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(16);
  const [totalRows, setTotalRows] = useState(0);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [hasPrev, setHasPrev] = useState(false);
  const [hasNext, setHasNext] = useState(false);

  // results
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // selection + map
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LatLng | null>(null);
  const [anchorLocation, setAnchorLocation] = useState<LatLng | null>(null);
  const [boundary, setBoundary] = useState<Boundary | null>(null);

  // map type selection
  const [mapType, setMapType] = useState<MapType>("street");

  // geo label + POI + MATCH STATUS
  const [geoLabel, setGeoLabel] = useState("");
  const [matchStatus, setMatchStatus] = useState<string>("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [poiLoading, setPoiLoading] = useState(false);
  const [poiData, setPoiData] = useState<PoiData | null>(null);
  const [detailsErr, setDetailsErr] = useState("");

  // PDF preview
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfErr, setPdfErr] = useState("");
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const pdfFilenameRef = useRef<string>("zonal-report.pdf");

  // "Right side" PDF fields
  const [idealBusinessText, setIdealBusinessText] = useState("");
  const [riskText, setRiskText] = useState("");

  // guards / cache
  const reqIdRef = useRef(0);
  const zonalAbortRef = useRef<AbortController | null>(null);

  const centerCacheRef = useRef<
    Map<string, { lat: number; lon: number; label: string; boundary?: Boundary | null }>
  >(new Map());

  const columns = useMemo(
    () => [
      "Street/Subdivision-",
      "Vicinity-",
      "Barangay-",
      "City-",
      "Province-",
      "Classification-",
      "ZonalValuepersqm.-",
    ],
    []
  );

  async function findRegions() {
    setErr("");
    try {
      const res = await fetch(`/api/regions?q=${encodeURIComponent(regionSearch)}`);
      if (!res.ok) throw new Error(`Regions failed: ${res.status}`);
      const data = await res.json();
      setMatches(data.matches ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error");
      setMatches([]);
    }
  }

  async function loadCities(forDomain: string) {
    setFacetsLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/facets?mode=cities&domain=${encodeURIComponent(forDomain)}`);
      if (!res.ok) throw new Error(`Cities failed: ${res.status}`);
      const data = await res.json();
      setFacetCities(data.cities ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load cities");
      setFacetCities([]);
    } finally {
      setFacetsLoading(false);
    }
  }

  async function loadBarangays(forDomain: string, forCity: string) {
    if (!forCity) {
      setFacetBarangays([]);
      return;
    }
    setBarangaysLoading(true);
    setErr("");
    try {
      const res = await fetch(
        `/api/facets?mode=barangays&domain=${encodeURIComponent(forDomain)}&city=${encodeURIComponent(forCity)}`
      );
      if (!res.ok) throw new Error(`Barangays failed: ${res.status}`);
      const data = await res.json();
      setFacetBarangays(data.barangays ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load barangays");
      setFacetBarangays([]);
    } finally {
      setBarangaysLoading(false);
    }
  }

  async function searchZonal(overrides?: { page?: number }) {
    const targetPage = overrides?.page ?? page;

    zonalAbortRef.current?.abort();
    const ac = new AbortController();
    zonalAbortRef.current = ac;

    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams({
        domain,
        page: String(targetPage),
        city,
        barangay,
        classification,
        q,
      });

      const res = await fetch(`/api/zonal?${params.toString()}`, { signal: ac.signal });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Zonal failed: ${res.status}${t ? ` — ${t}` : ""}`);
      }
      const data = await res.json();

      setRows(data.rows ?? []);
      setItemsPerPage(Number(data.itemsPerPage ?? 16));
      setTotalRows(Number(data.totalRows ?? 0));
      setPageCount(data.pageCount ?? null);
      setHasPrev(Boolean(data.hasPrev));
      setHasNext(Boolean(data.hasNext));

      if (targetPage !== page) setPage(targetPage);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setErr(e?.message ?? "Unknown error");
      setRows([]);
      setTotalRows(0);
      setPageCount(null);
      setHasPrev(false);
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPoi(lat: number, lon: number) {
    const res = await fetch("/api/poi-counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lon, radius: 1500 }),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) throw new Error(data?.error ?? "POI failed");
    return data as { ok: true; counts: PoiData["counts"]; items: PoiData["items"] };
  }

  async function geocodeLocked(args: {
    query: string;
    hintBarangay?: string;
    hintCity?: string;
    hintProvince?: string;
    anchor?: LatLng | null;
    street?: string;
    vicinity?: string;
  }) {
    const qx = normalizePH(args.query);
    const key = `${qx}|${normalizePH(args.hintBarangay)}|${normalizePH(args.hintCity)}|${normalizePH(
      args.hintProvince
    )}|${args.anchor?.lat ?? ""},${args.anchor?.lon ?? ""}`.toLowerCase();

    const cached = centerCacheRef.current.get(key);
    if (cached) return cached;

    const res = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: qx,
        hintBarangay: args.hintBarangay,
        hintCity: args.hintCity,
        hintProvince: args.hintProvince,
        anchorLat: args.anchor?.lat ?? null,
        anchorLon: args.anchor?.lon ?? null,
        street: args.street ?? "",
        vicinity: args.vicinity ?? "",
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return null;

    const payload = {
      lat: Number(data.lat),
      lon: Number(data.lon),
      label: String(data.displayName ?? qx),
      boundary: (data.boundary as Boundary | null) ?? null,
    };

    centerCacheRef.current.set(key, payload);
    return payload;
  }

  async function resolveAnchor(next: { barangay?: string; city?: string; province?: string }) {
    const b = normalizePH(next.barangay ?? "");
    const c = normalizePH(next.city ?? "");
    const p = normalizePH(next.province ?? "");

    const q1 = b && c ? `${b}, ${c}, ${p}, Philippines` : "";
    const q2 = c ? `${c}, ${p}, Philippines` : "";
    const q3 = p ? `${p}, Philippines` : "Philippines";

    const center =
      (q1 &&
        (await geocodeLocked({
          query: q1,
          hintBarangay: next.barangay,
          hintCity: next.city,
          hintProvince: next.province,
          anchor: null,
        }))) ||
      (q2 &&
        (await geocodeLocked({
          query: q2,
          hintCity: next.city,
          hintProvince: next.province,
          anchor: null,
        }))) ||
      (await geocodeLocked({ query: q3, hintProvince: next.province, anchor: null })) || {
        lat: 12.8797,
        lon: 121.774,
        label: "Philippines",
        boundary: null as Boundary | null,
      };

    setAnchorLocation({ lat: center.lat, lon: center.lon });
    setBoundary(center.boundary ?? null);
    return center;
  }

  async function flyToFilters(nextCity: string, nextBarangay: string, nextProvince?: string) {
    const myId = ++reqIdRef.current;
    setGeoLoading(true);
    try {
      const center = await resolveAnchor({ city: nextCity, barangay: nextBarangay, province: nextProvince });
      if (myId !== reqIdRef.current) return;
      setSelectedLocation({ lat: center.lat, lon: center.lon });
      setGeoLabel(center.label);
      setMatchStatus("");
    } finally {
      if (myId !== reqIdRef.current) return;
      setGeoLoading(false);
    }
  }

  async function selectRow(r: Row) {
    const myId = ++reqIdRef.current;

    setSelectedRow(r);
    setDetailsErr("");
    setPoiData(null);
    setPdfErr("");
    setMatchStatus("");

    setGeoLoading(true);
    try {
      const anchor = await resolveAnchor({
        barangay: r["Barangay-"],
        city: r["City-"],
        province: r["Province-"],
      });

      if (myId !== reqIdRef.current) return;

      const street = normalizePH(r["Street/Subdivision-"]);
      const vicinity = normalizePH(r["Vicinity-"]);
      const brgy = r["Barangay-"];
      const cty = r["City-"];
      const prov = r["Province-"];

      const candidates: string[] = [];

      if (!isBadStreet(street)) {
        candidates.push(`${street}, ${brgy}, ${cty}, ${prov}, Philippines`);
        candidates.push(`${street}, ${cty}, ${prov}, Philippines`);
        const parts = street.split(" ").filter(Boolean);
        if (parts.length >= 1) candidates.push(`${parts.slice(0, 1).join(" ")}, ${brgy}, ${cty}, ${prov}, Philippines`);
        if (parts.length >= 2) candidates.push(`${parts.slice(0, 2).join(" ")}, ${brgy}, ${cty}, ${prov}, Philippines`);
      }

      if (vicinity) {
        candidates.push(`${vicinity}, ${brgy}, ${cty}, ${prov}, Philippines`);
      }

      candidates.push(`${normalizePH(brgy)}, ${normalizePH(cty)}, ${normalizePH(prov)}, Philippines`);

      let best: { lat: number; lon: number; label: string; boundary?: Boundary | null } | null = null;

      for (const query of Array.from(new Set(candidates))) {
        const g = await geocodeLocked({
          query,
          hintBarangay: brgy,
          hintCity: cty,
          hintProvince: prov,
          anchor: { lat: anchor.lat, lon: anchor.lon },
          street,
          vicinity,
        });

        if (myId !== reqIdRef.current) return;
        if (g) {
          best = g;
          if (g.label.includes("fuzzy match:")) {
            const match = g.label.match(/fuzzy match: (\d+)%/);
            if (match) {
              setMatchStatus(`✓ Fuzzy Match: ${match[1]}% confidence`);
            }
          } else if (g.label.includes("inside")) {
            setMatchStatus("✓ Exact Match (inside barangay)");
          } else {
            setMatchStatus("✓ Matched");
          }
          break;
        }
      }

      if (myId !== reqIdRef.current) return;

      const finalCenter = best ?? anchor;

      setSelectedLocation({ lat: finalCenter.lat, lon: finalCenter.lon });
      setGeoLabel(best?.label ?? anchor.label);
      setBoundary(finalCenter.boundary ?? anchor.boundary ?? null);

      setPoiLoading(true);
      const poi = await fetchPoi(finalCenter.lat, finalCenter.lon);
      if (myId !== reqIdRef.current) return;

      setPoiData({ counts: poi.counts, items: poi.items });

      const ideas = suggestBusinesses({
        zonalValueText: String(r["ZonalValuepersqm.-"] ?? ""),
        classification: String(r["Classification-"] ?? ""),
        poi,
      });
      setIdealBusinessText(ideas.map((x) => `• ${x}`).join("\n"));
      setRiskText(defaultRisks().map((x) => `• ${x}`).join("\n"));
    } catch (e: any) {
      if (myId !== reqIdRef.current) return;
      setDetailsErr(e?.message ?? "Failed to load details");
    } finally {
      if (myId !== reqIdRef.current) return;
      setGeoLoading(false);
      setPoiLoading(false);
    }
  }

  async function selectLocationFromMap(lat: number, lon: number) {
    const myId = ++reqIdRef.current;

    setSelectedRow(null);
    setSelectedLocation({ lat, lon });
    setGeoLabel(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    setMatchStatus("");
    setPoiData(null);
    setDetailsErr("");
    setPdfErr("");

    setPoiLoading(true);
    try {
      const poi = await fetchPoi(lat, lon);
      if (myId !== reqIdRef.current) return;
      setPoiData({ counts: poi.counts, items: poi.items });

      const ideas = suggestBusinesses({
        zonalValueText: "",
        classification: "",
        poi,
      });
      setIdealBusinessText(ideas.map((x) => `• ${x}`).join("\n"));
      setRiskText(defaultRisks().map((x) => `• ${x}`).join("\n"));
    } catch (e: any) {
      if (myId !== reqIdRef.current) return;
      setDetailsErr(e?.message ?? "Failed to load POI");
    } finally {
      if (myId !== reqIdRef.current) return;
      setPoiLoading(false);
    }
  }

  function closePreview() {
    setPdfPreviewOpen(false);
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
  }

  function downloadPreviewPdf() {
    if (!pdfPreviewUrl) return;
    const a = document.createElement("a");
    a.href = pdfPreviewUrl;
    a.download = pdfFilenameRef.current || "zonal-report.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function buildPdfBlob(mapDataUrl: string) {
    const { jsPDF } = await import("jspdf");

    const locationName =
      selectedRow
        ? `${String(selectedRow["Street/Subdivision-"] ?? "").trim()} — ${String(selectedRow["Barangay-"] ?? "").trim()}, ${String(
            selectedRow["City-"] ?? ""
          ).trim()}`
        : geoLabel || "Selected location";

    const zonalValue = selectedRow ? String(selectedRow["ZonalValuepersqm.-"] ?? "") : "-";
    const cls = selectedRow ? String(selectedRow["Classification-"] ?? "") : "";

    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 36;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("FILIPINO HOMES ZONAL FINDER", margin, 48);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`Location: ${locationName}`, margin, 70);
    if (cls) pdf.text(`Classification: ${cls}`, margin, 86);

    const priceY = 125;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(28);
    const priceText = zonalValue ? `₱ ${zonalValue} / sqm` : "₱ - / sqm";
    const priceW = pdf.getTextWidth(priceText);
    pdf.text(priceText, (pageW - priceW) / 2, priceY);

    const topY = 150;
    const colGap = 14;
    const leftW = Math.floor((pageW - margin * 2 - colGap) * 0.58);
    const rightW = (pageW - margin * 2 - colGap) - leftW;

    const leftX = margin;
    const rightX = margin + leftW + colGap;

    const mapBoxH = 290;
    pdf.setDrawColor(30);
    pdf.setLineWidth(1);
    pdf.roundedRect(leftX, topY, leftW, mapBoxH, 10, 10);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("Map", leftX + 12, topY + 20);

    const imgMargin = 10;
    const imgX = leftX + imgMargin;
    const imgY = topY + 28;
    const imgW = leftW - imgMargin * 2;
    const imgH = mapBoxH - 38;
    pdf.addImage(mapDataUrl, "PNG", imgX, imgY, imgW, imgH);

    const boxGapY = 12;
    const noteBoxH = 140;
    pdf.roundedRect(rightX, topY, rightW, noteBoxH, 10, 10);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("Ideal for this place", rightX + 12, topY + 20);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    let y = topY + 40;
    const maxRightTextW = rightW - 24;
    const idealLines = pdf.splitTextToSize(idealBusinessText || "• (Add notes here)", maxRightTextW);
    for (const line of idealLines.slice(0, 10)) {
      pdf.text(line, rightX + 12, y);
      y += 12;
      if (y > topY + noteBoxH - 12) break;
    }

    const riskY = topY + noteBoxH + boxGapY;
    const riskBoxH = 138;
    pdf.roundedRect(rightX, riskY, rightW, riskBoxH, 10, 10);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("Risk / Hazards", rightX + 12, riskY + 20);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    let ry = riskY + 40;
    const riskLines = pdf.splitTextToSize(riskText || "• (Add notes here)", maxRightTextW);
    for (const line of riskLines.slice(0, 10)) {
      pdf.text(line, rightX + 12, ry);
      ry += 12;
      if (ry > riskY + riskBoxH - 12) break;
    }

    const sigBaseY = pageH - 70;
    const sigX = pageW - margin - 220;

    pdf.setDrawColor(50);
    pdf.setLineWidth(1);
    pdf.line(sigX, sigBaseY, sigX + 200, sigBaseY);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("ANTHONY LEUTERIO", sigX, sigBaseY + 18);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text("CEO / FOUNDER", sigX, sigBaseY + 34);
    pdf.text("FILIPINO HOMES", sigX, sigBaseY + 48);

    pdf.addPage();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("Nearby Facilities / POIs (within 1.5km)", margin, 56);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);

    let py = 82;

    const groups: Array<[string, PoiItem[]]> = poiData
      ? [
          ["Hospitals", poiData.items.hospitals],
          ["Schools", poiData.items.schools],
          ["Police Stations", poiData.items.policeStations],
          ["Fire Stations", poiData.items.fireStations],
          ["Pharmacies", poiData.items.pharmacies],
          ["Clinics", poiData.items.clinics],
        ]
      : [];

    if (!groups.length) {
      pdf.text("No POI data loaded. Select a row first to load POIs.", margin, py);
    } else {
      for (const [title, list] of groups) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.text(`${title} (${list.length})`, margin, py);
        py += 16;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);

        const names = list.slice(0, 28).map((x) => `• ${x.name || "(unnamed)"}`);
        if (!names.length) {
          pdf.text("• None found", margin, py);
          py += 14;
        } else {
          for (const line of names) {
            const wrapped = pdf.splitTextToSize(line, pageW - margin * 2);
            for (const wLine of wrapped) {
              if (py > pageH - 60) {
                pdf.addPage();
                py = 60;
              }
              pdf.text(wLine, margin, py);
              py += 12;
            }
          }
        }

        py += 12;
        if (py > pageH - 60) {
          pdf.addPage();
          py = 60;
        }
      }
    }

    const blob = pdf.output("blob");
    return { blob, filename: `zonal-report-${String(locationName).replace(/[^\w]+/g, "-").slice(0, 60)}.pdf` };
  }

  async function generatePdfPreview() {
    setPdfErr("");
    if (!selectedLocation) {
      setPdfErr("Select a row or click on the map first.");
      return;
    }

    setPdfLoading(true);
    try {
      const { default: html2canvas } = await import("html2canvas-pro");

      await waitForZonalMapIdle({ minEvents: 2, timeoutMs: 4500 });
      await new Promise((r) => setTimeout(r, 80));

      const mapEl = document.getElementById("map-container");
      if (!mapEl) throw new Error("Map container not found (map-container)");

      const canvas = await html2canvas(mapEl as HTMLElement, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
        removeContainer: true,
        onclone: (clonedDoc) => {
          const all = clonedDoc.querySelectorAll<HTMLElement>("*");
          for (const el of Array.from(all)) {
            const style = el.getAttribute("style");
            if (style && (style.includes("oklch(") || style.includes("lab(") || style.includes("lch("))) {
              el.setAttribute(
                "style",
                style
                  .replace(/oklch\([^)]+\)/g, "rgb(0,0,0)")
                  .replace(/lab\([^)]+\)/g, "rgb(0,0,0)")
                  .replace(/lch\([^)]+\)/g, "rgb(0,0,0)")
              );
            }
          }

          const s = clonedDoc.createElement("style");
          s.textContent = `* { color-scheme: light !important; }`;
          clonedDoc.head.appendChild(s);
        },
      });

      const mapDataUrl = canvas.toDataURL("image/png");

      const { blob, filename } = await buildPdfBlob(mapDataUrl);
      pdfFilenameRef.current = filename;

      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      const url = URL.createObjectURL(blob);
      setPdfPreviewUrl(url);
      setPdfPreviewOpen(true);
    } catch (e: any) {
      setPdfErr(e?.message ?? "Failed to generate PDF preview");
    } finally {
      setPdfLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (!domain) return;
      searchZonal({ page: 1 });
    }, 350);
    return () => clearTimeout(t);
  }, [domain, city, barangay, classification, q]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  const showingFrom = totalRows ? (page - 1) * itemsPerPage + 1 : 0;
  const showingTo = totalRows ? Math.min(page * itemsPerPage, totalRows) : rows.length;

  return (
    <main className="min-h-screen bg-slate-50 text-gray-900">
      {/* PDF Preview Modal */}
      {pdfPreviewOpen && pdfPreviewUrl ? (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-5xl h-[85vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b bg-white flex items-center justify-between">
              <h2 className="text-base font-semibold">PDF Preview</h2>
              <div className="flex gap-2">
                <button
                  onClick={downloadPreviewPdf}
                  className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition"
                >
                  Download PDF
                </button>
                <button
                  onClick={closePreview}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 transition"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100">
              <iframe title="pdf-preview" src={pdfPreviewUrl} className="w-full h-full" />
            </div>
          </div>
        </div>
      ) : null}

      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">BIR Zonal Values Lookup</h1>
              <p className="text-sm text-gray-500 mt-1">
                Advanced property assessment tool with smart geocoding and facility analysis
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium text-gray-500">Page</div>
              <div className="text-2xl font-bold text-gray-900">
                {page}
                {pageCount ? `/${pageCount}` : ""}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Region Selector */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Select Province/City Database</h2>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
            <div className="md:col-span-9">
              <label className="block text-xs font-medium text-gray-700 mb-2">Search</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={regionSearch}
                onChange={(e) => setRegionSearch(e.target.value)}
                placeholder="Type: cebu, bohol, davao..."
              />
            </div>
            <div className="md:col-span-3 flex gap-2 items-end">
              <button
                onClick={findRegions}
                className="w-full rounded-lg bg-blue-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-blue-700 transition"
              >
                Find Regions
              </button>
            </div>
          </div>

          {matches.length > 0 && (
            <div className="max-h-56 overflow-auto rounded-lg border border-gray-200">
              {matches.map((m, idx) => (
                <button
                  key={idx}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-blue-50 border-b last:border-b-0 transition"
                  onClick={async () => {
                    setDomain(m.domain);
                    setCity("");
                    setBarangay("");
                    setClassification("");
                    setQ("");
                    setPage(1);

                    setRows([]);
                    setErr("");
                    setSelectedRow(null);
                    setPoiData(null);
                    setDetailsErr("");
                    setFacetCities([]);
                    setFacetBarangays([]);
                    setBoundary(null);

                    await loadCities(m.domain);
                    searchZonal({ page: 1 });

                    flyToFilters(m.city, "", m.province);
                  }}
                >
                  <div className="font-semibold text-gray-900">
                    {m.province} — {m.city}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{m.domain}</div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Filters */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Filters & Search</h2>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-700 mb-2">City</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={city}
                onChange={(e) => {
                  const nextCity = e.target.value;
                  setCity(nextCity);
                  setBarangay("");
                  setPage(1);
                  setFacetBarangays([]);
                  loadBarangays(domain, nextCity);

                  if (nextCity) {
                        const provinceFromDomain = domain.split(".")[0];
                        const provinceName = provinceFromDomain.charAt(0).toUpperCase() + 
                                            provinceFromDomain.slice(1);
                        flyToFilters(nextCity, "", provinceName);
}
                }}
                disabled={facetsLoading || facetCities.length === 0}
              >
                <option value="">All Cities</option>
                {facetCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-700 mb-2">Barangay</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={barangay}
                onChange={(e) => {
                  const nextBrgy = e.target.value;
                  setBarangay(nextBrgy);
                  setPage(1);

                  if (city && nextBrgy) {
                                    const provinceFromDomain = domain.split(".")[0];
                                    const provinceName = provinceFromDomain.charAt(0).toUpperCase() + 
                                    provinceFromDomain.slice(1);
                flyToFilters(city, nextBrgy, provinceName);
}
                }}
                disabled={!city || barangaysLoading}
              >
                <option value="">All Barangays</option>
                {facetBarangays.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              {barangaysLoading && <p className="text-xs text-gray-500 mt-1">Loading barangays…</p>}
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-700 mb-2">Classification</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={classification}
                onChange={(e) => {
                  setClassification(e.target.value);
                  setPage(1);
                }}
                placeholder="COMMERCIAL, RESIDENTIAL..."
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-700 mb-2">Search</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Street / vicinity..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          {err && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-600">
              {totalRows ? (
                <>
                  Showing <span className="font-semibold">{showingFrom.toLocaleString()}</span> to{" "}
                  <span className="font-semibold">{showingTo.toLocaleString()}</span> of{" "}
                  <span className="font-semibold">{totalRows.toLocaleString()}</span> results
                </>
              ) : (
                "No results"
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => searchZonal({ page: Math.max(1, page - 1) })}
                disabled={loading || !hasPrev}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition"
              >
                Previous
              </button>
              <button
                onClick={() => searchZonal({ page: page + 1 })}
                disabled={loading || !hasNext}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        {/* Main Content - 3 Panels */}
        <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="flex h-[80vh]">
            {/* LEFT PANEL - Records & Details */}
            <aside className="w-80 border-r border-gray-200 bg-white flex flex-col">
              <div className="p-5 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">Selected Property</h3>

                {!selectedRow ? (
                  <p className="text-sm text-gray-500 mt-3">Select a record to view details</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4">
                      <p className="text-xs font-medium text-gray-600">Zonal Value</p>
                      <p className="text-2xl font-bold text-gray-900">₱{String(selectedRow["ZonalValuepersqm.-"] ?? "")}</p>
                      <p className="text-xs text-gray-600 mt-1">per square meter</p>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium text-gray-700">City:</span> {String(selectedRow["City-"] ?? "")}</div>
                      <div><span className="font-medium text-gray-700">Barangay:</span> {String(selectedRow["Barangay-"] ?? "")}</div>
                      <div><span className="font-medium text-gray-700">Street:</span> {String(selectedRow["Street/Subdivision-"] ?? "")}</div>
                      <div><span className="font-medium text-gray-700">Classification:</span> {String(selectedRow["Classification-"] ?? "")}</div>
                    </div>

                    {geoLoading && <p className="text-xs text-gray-500 flex items-center gap-2"><span className="animate-spin">⟳</span> Geocoding…</p>}
                    {geoLabel && <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">{geoLabel}</p>}

                    {matchStatus && (
                      <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-2.5">
                        {matchStatus}
                      </div>
                    )}

                    {detailsErr && (
                      <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                        {detailsErr}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-auto">
                <div className="p-3 border-b border-gray-200">
                  <p className="text-xs font-semibold text-gray-600">RECORDS ({rows.length})</p>
                </div>

                {loading && <p className="text-xs text-gray-500 p-3">Loading records…</p>}

                <div className="divide-y divide-gray-200">
                  {rows.map((r, i) => (
                    <button
                      key={`${r.rowIndex}-${i}`}
                      onClick={() => selectRow(r)}
                      className="w-full text-left p-3 hover:bg-blue-50 transition border-b border-gray-200 last:border-b-0"
                    >
                      <div className="font-semibold text-sm text-gray-900">
                        {String(r["Street/Subdivision-"] ?? "").slice(0, 25)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {String(r["Barangay-"] ?? "")}, {String(r["City-"] ?? "")}
                      </div>
                      <div className="font-bold text-blue-600 text-sm mt-1">
                        ₱{String(r["ZonalValuepersqm.-"] ?? "")}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            {/* CENTER PANEL - Map */}
            <div className="flex-1 flex flex-col relative bg-gray-50">
              {/* Map Type Selector */}
              <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex gap-1">
                <button
                  onClick={() => setMapType("street")}
                  className={`p-2 rounded transition ${
                    mapType === "street"
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                  title="Street Map"
                >
                  <MapIcon size={18} />
                </button>
                <button
                  onClick={() => setMapType("terrain")}
                  className={`p-2 rounded transition ${
                    mapType === "terrain"
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                  title="Terrain Map"
                >
                  <TerrainIcon size={18} />
                </button>
                <button
                  onClick={() => setMapType("satellite")}
                  className={`p-2 rounded transition ${
                    mapType === "satellite"
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                  title="Satellite Map"
                >
                  <SatelliteIcon size={18} />
                </button>
              </div>

              <ZonalMap
                selected={selectedLocation}
                onPickOnMap={selectLocationFromMap}
                popupLabel={geoLabel}
                boundary={boundary}
                highlightRadiusMeters={80}
                containerId="map-container"
                mapType={mapType as "street" | "terrain" | "satellite"}
              />
            </div>

            {/* RIGHT PANEL - Report Builder */}
            <aside className="w-80 border-l border-gray-200 bg-white p-5 overflow-auto">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Report Builder</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Ideal Business Uses</label>
                  <textarea
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={idealBusinessText}
                    onChange={(e) => setIdealBusinessText(e.target.value)}
                    placeholder="• Cafe&#10;• Retail Shop&#10;• Clinic"
                    rows={5}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Risks & Hazards</label>
                  <textarea
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={riskText}
                    onChange={(e) => setRiskText(e.target.value)}
                    placeholder="• Flood Risk: Low&#10;• Landslide: Minimal"
                    rows={4}
                  />
                </div>

                <button
                  onClick={generatePdfPreview}
                  disabled={pdfLoading || !selectedLocation}
                  className="w-full rounded-lg bg-blue-600 text-white px-4 py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {pdfLoading ? "Generating PDF…" : "Preview PDF Report"}
                </button>

                {pdfErr && (
                  <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                    {pdfErr}
                  </div>
                )}

                <div className="border-t border-gray-200 pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Nearby Facilities (1.5km)</h4>

                  {poiLoading ? (
                    <p className="text-sm text-gray-500">Loading facilities…</p>
                  ) : poiData ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-gray-200 p-3 text-center">
                          <p className="text-xs text-gray-600">Hospitals</p>
                          <p className="text-lg font-bold text-gray-900">{poiData.counts.hospitals}</p>
                        </div>
                        <div className="rounded-lg border border-gray-200 p-3 text-center">
                          <p className="text-xs text-gray-600">Schools</p>
                          <p className="text-lg font-bold text-gray-900">{poiData.counts.schools}</p>
                        </div>
                        <div className="rounded-lg border border-gray-200 p-3 text-center">
                          <p className="text-xs text-gray-600">Police</p>
                          <p className="text-lg font-bold text-gray-900">{poiData.counts.policeStations}</p>
                        </div>
                        <div className="rounded-lg border border-gray-200 p-3 text-center">
                          <p className="text-xs text-gray-600">Fire</p>
                          <p className="text-lg font-bold text-gray-900">{poiData.counts.fireStations}</p>
                        </div>
                        <div className="rounded-lg border border-gray-200 p-3 text-center">
                          <p className="text-xs text-gray-600">Pharmacy</p>
                          <p className="text-lg font-bold text-gray-900">{poiData.counts.pharmacies}</p>
                        </div>
                        <div className="rounded-lg border border-gray-200 p-3 text-center">
                          <p className="text-xs text-gray-600">Clinics</p>
                          <p className="text-lg font-bold text-gray-900">{poiData.counts.clinics}</p>
                        </div>
                      </div>

                      <div className="text-xs space-y-2 max-h-40 overflow-auto">
                        {[
                          ["Hospitals", poiData.items.hospitals] as const,
                          ["Schools", poiData.items.schools] as const,
                          ["Police", poiData.items.policeStations] as const,
                          ["Fire", poiData.items.fireStations] as const,
                          ["Pharmacy", poiData.items.pharmacies] as const,
                          ["Clinics", poiData.items.clinics] as const,
                        ].map(([label, list], idx) => (
                          <div key={`poi-${idx}`}>
                            {list.length > 0 && (
                              <>
                                <p className="font-semibold text-gray-900">{label}</p>
                                <ul className="list-disc pl-4 text-gray-600 text-[11px]">
                                  {list.slice(0, 3).map((x: PoiItem, i: number) => (
                                    <li key={`${idx}-${i}`}>{x.name || "(unnamed)"}</li>
                                  ))}
                                </ul>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Select a property to load facilities</p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}