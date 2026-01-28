"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Map as MapIcon, Satellite as SatelliteIcon, Mountain as TerrainIcon } from "lucide-react";

import type { Boundary, LatLng, MapType, PoiData, RegionMatch, Row } from "./lib/types";
import { isBadStreet, normalizePH, suggestBusinesses } from "./lib/zonal-util";
import ReportBuilder from "./components/ReportBuilder";

const ZonalMap = dynamic(() => import("./components/ZonalMap"), { ssr: false });

type CompsResp =
  | {
      ok: true;
      stats: { min: number | null; median: number | null; max: number | null; count: number };
      rows: any[];
    }
  | null;

// ---- small helper: build a short area description (<= 50 words-ish) ----
function buildAreaDescription(args: {
  geoLabel: string;
  selectedRow: Row | null;
  poi: { counts: PoiData["counts"] } | null;
}) {
  const cls = String(args.selectedRow?.["Classification-"] ?? "").trim();
  const zonalRaw = String(args.selectedRow?.["ZonalValuepersqm.-"] ?? "").replace(/,/g, "");
  const zonal = Number(zonalRaw);
  const priceBand =
    Number.isFinite(zonal) && zonal > 0
      ? zonal >= 80000
        ? "high-value"
        : zonal >= 30000
        ? "mid-range"
        : "budget-friendly"
      : "variable";

  const c = args.poi?.counts;
  const access =
    c
      ? [
          c.schools ? "schools nearby" : "",
          c.hospitals || c.clinics ? "health services nearby" : "",
          c.policeStations || c.fireStations ? "public safety access" : "",
          c.pharmacies ? "pharmacies close" : "",
        ].filter(Boolean)
      : [];

  const clsHint =
    cls.toUpperCase().includes("RES")
      ? "good for residential living"
      : cls.toUpperCase().includes("COMM")
      ? "good for business activity"
      : cls
      ? `suited for ${cls.toLowerCase()} use`
      : "a mixed-use area";

  const label = args.geoLabel ? args.geoLabel.split(",").slice(0, 2).join(",").trim() : "this area";

  const sentence1 = `${label} is a ${priceBand} zone and is ${clsHint}.`;
  const sentence2 = access.length ? `Nearby: ${access.slice(0, 3).join(", ")}.` : "Nearby facilities vary by location.";

  // keep it short
  const out = `${sentence1} ${sentence2}`.trim();

  // safety trim: keep under ~50 words
  const words = out.split(/\s+/).filter(Boolean);
  return words.length <= 50 ? out : words.slice(0, 50).join(" ") + "…";
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

  // Right side fields
  const [idealBusinessText, setIdealBusinessText] = useState("");

  // ✅ NEW: area description shown under map + printed to PDF
  const [areaDescription, setAreaDescription] = useState("");

  // comps
  const [comps, setComps] = useState<CompsResp>(null);

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

  async function fetchCompsForRow(r: Row) {
    try {
      const res = await fetch(
        `/api/comps?domain=${encodeURIComponent(domain)}&city=${encodeURIComponent(
          String(r["City-"] ?? "")
        )}&barangay=${encodeURIComponent(String(r["Barangay-"] ?? ""))}&classification=${encodeURIComponent(
          String(r["Classification-"] ?? "")
        )}&limit=10`
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) return null;
      return data as CompsResp;
    } catch {
      return null;
    }
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
      setComps(null);
      setPoiData(null);
      setAreaDescription("");
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
    setMatchStatus("");
    setComps(null);
    setAreaDescription("");

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

      if (vicinity) candidates.push(`${vicinity}, ${brgy}, ${cty}, ${prov}, Philippines`);

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
            if (match) setMatchStatus(`✓ Fuzzy Match: ${match[1]}% confidence`);
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

      // comps (async)
      fetchCompsForRow(r).then((c) => {
        if (myId !== reqIdRef.current) return;
        if (c?.ok) setComps(c);
      });

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

      // ✅ build the area description now that we have POI
      const desc = buildAreaDescription({ geoLabel: best?.label ?? anchor.label, selectedRow: r, poi });
      setAreaDescription(desc);
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
    setComps(null);
    setAreaDescription("");

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

      // ✅ description for map-picked location (no row/classification)
      const desc = buildAreaDescription({ geoLabel: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, selectedRow: null, poi });
      setAreaDescription(desc);
    } catch (e: any) {
      if (myId !== reqIdRef.current) return;
      setDetailsErr(e?.message ?? "Failed to load POI");
    } finally {
      if (myId !== reqIdRef.current) return;
      setPoiLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (!domain) return;
      searchZonal({ page: 1 });
    }, 350);
    return () => clearTimeout(t);
  }, [domain, city, barangay, classification, q]);

  const showingFrom = totalRows ? (page - 1) * itemsPerPage + 1 : 0;
  const showingTo = totalRows ? Math.min(page * itemsPerPage, totalRows) : rows.length;

  return (
    <main className="min-h-screen bg-slate-50 text-gray-900">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">BIR Zonal Values Lookup</h1>
              <p className="text-sm text-gray-500 mt-1">Advanced property assessment tool with smart geocoding and facility analysis</p>
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
                    setComps(null);
                    setAreaDescription("");

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
                    const provinceName = provinceFromDomain.charAt(0).toUpperCase() + provinceFromDomain.slice(1);
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
                    const provinceName = provinceFromDomain.charAt(0).toUpperCase() + provinceFromDomain.slice(1);
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
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>
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
            {/* LEFT PANEL */}
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
                      <div>
                        <span className="font-medium text-gray-700">City:</span> {String(selectedRow["City-"] ?? "")}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Barangay:</span> {String(selectedRow["Barangay-"] ?? "")}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Street:</span> {String(selectedRow["Street/Subdivision-"] ?? "")}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Classification:</span> {String(selectedRow["Classification-"] ?? "")}
                      </div>
                    </div>

                    {comps?.ok && comps.stats ? (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
                        <p className="font-semibold text-gray-900">Comps (same barangay)</p>
                        <div className="mt-1 space-y-1 text-gray-700">
                          <div>Count: <span className="font-semibold">{comps.stats.count}</span></div>
                          <div>Min: <span className="font-semibold">{comps.stats.min == null ? "-" : comps.stats.min.toLocaleString()}</span></div>
                          <div>Median: <span className="font-semibold">{comps.stats.median == null ? "-" : comps.stats.median.toLocaleString()}</span></div>
                          <div>Max: <span className="font-semibold">{comps.stats.max == null ? "-" : comps.stats.max.toLocaleString()}</span></div>
                        </div>
                      </div>
                    ) : null}

                    {geoLoading && (
                      <p className="text-xs text-gray-500 flex items-center gap-2">
                        <span className="animate-spin">⟳</span> Geocoding…
                      </p>
                    )}
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
                      <div className="font-semibold text-sm text-gray-900">{String(r["Street/Subdivision-"] ?? "").slice(0, 25)}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {String(r["Barangay-"] ?? "")}, {String(r["City-"] ?? "")}
                      </div>
                      <div className="font-bold text-blue-600 text-sm mt-1">₱{String(r["ZonalValuepersqm.-"] ?? "")}</div>
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            {/* CENTER PANEL - Map + description */}
            <div className="flex-1 flex flex-col relative bg-gray-50">
              <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex gap-1">
                <button
                  onClick={() => setMapType("street")}
                  className={`p-2 rounded transition ${mapType === "street" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                  title="Street Map"
                >
                  <MapIcon size={18} />
                </button>
                <button
                  onClick={() => setMapType("terrain")}
                  className={`p-2 rounded transition ${mapType === "terrain" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                  title="Terrain Map"
                >
                  <TerrainIcon size={18} />
                </button>
                <button
                  onClick={() => setMapType("satellite")}
                  className={`p-2 rounded transition ${mapType === "satellite" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                  title="Satellite Map"
                >
                  <SatelliteIcon size={18} />
                </button>
              </div>

              <div className="flex-1">
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

              {/* ✅ new description under the map */}
              <div className="border-t border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold text-gray-900">Area Description</p>
                <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                  {areaDescription || "Select a property or click the map to generate a short description of the area."}
                </p>
              </div>
            </div>

            {/* RIGHT PANEL - Report Builder */}
            <ReportBuilder
              selectedLocation={selectedLocation}
              selectedRow={selectedRow}
              geoLabel={geoLabel}
              poiLoading={poiLoading}
              poiData={poiData}
              idealBusinessText={idealBusinessText}
              setIdealBusinessText={setIdealBusinessText}
              areaDescription={areaDescription}
              mapContainerId="map-container"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
