"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

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

function cleanName(s: any) {
  return String(s ?? "").replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
}
function normalizePH(s: any) {
  return cleanName(s)
    .replace(/\bPOB\b/gi, "Poblacion")
    .replace(/\bSTO\b/gi, "Santo")
    .replace(/\bSTA\b/gi, "Santa")
    .replace(/NIÑO/gi, "Nino")
    .replace(/Ñ/gi, "N");
}

// ignore very generic street labels
function isBadStreet(s: string) {
  const v = normalizePH(s).toUpperCase();
  if (!v) return true;
  if (v.includes("ALL OTHER")) return true;
  if (v === "OTHERS") return true;
  return false;
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
  const [anchorLocation, setAnchorLocation] = useState<LatLng | null>(null); // ✅ barangay/city anchor

  // geo label + POI
  const [geoLabel, setGeoLabel] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [poiLoading, setPoiLoading] = useState(false);
  const [poiData, setPoiData] = useState<PoiData | null>(null);
  const [detailsErr, setDetailsErr] = useState("");

  // guards / cache
  const reqIdRef = useRef(0);
  const zonalAbortRef = useRef<AbortController | null>(null);

  // cache centers so barangay clicks are instant
  const centerCacheRef = useRef<Map<string, { lat: number; lon: number; label: string }>>(new Map());

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

    const payload = { lat: Number(data.lat), lon: Number(data.lon), label: String(data.displayName ?? qx) };
    centerCacheRef.current.set(key, payload);
    return payload;
  }

  // ✅ resolves barangay/city anchor and stores it
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
      };

    setAnchorLocation({ lat: center.lat, lon: center.lon });
    return center;
  }

  // ✅ fly when filters change (city/barangay)
  async function flyToFilters(nextCity: string, nextBarangay: string, nextProvince?: string) {
    const myId = ++reqIdRef.current;
    setGeoLoading(true);
    try {
      const center = await resolveAnchor({ city: nextCity, barangay: nextBarangay, province: nextProvince });
      if (myId !== reqIdRef.current) return;
      setSelectedLocation({ lat: center.lat, lon: center.lon });
      setGeoLabel(center.label);
    } finally {
      if (myId !== reqIdRef.current) return;
      setGeoLoading(false);
    }
  }

  // ✅ MAIN: row click = lock inside barangay anchor, then find street/road/building near it
  async function selectRow(r: Row) {
    const myId = ++reqIdRef.current;

    setSelectedRow(r);
    setDetailsErr("");
    setPoiData(null);

    setGeoLoading(true);
    try {
      // 1) get anchor for this row's barangay/city/province
      const anchor = await resolveAnchor({
        barangay: r["Barangay-"],
        city: r["City-"],
        province: r["Province-"],
      });

      if (myId !== reqIdRef.current) return;

      // 2) try to resolve specific road/building near anchor
      const street = normalizePH(r["Street/Subdivision-"]);
      const vicinity = normalizePH(r["Vicinity-"]);
      const brgy = r["Barangay-"];
      const cty = r["City-"];
      const prov = r["Province-"];

      // candidates focused to avoid jumping to other barangays:
      const candidates: string[] = [];

      // If street exists: search near anchor by name (Overpass inside /api/geocode)
      if (!isBadStreet(street)) {
        // most direct
        candidates.push(`${street}, ${brgy}, ${cty}, ${prov}, Philippines`);
        // sometimes street is enough with hints
        candidates.push(`${street}, ${cty}, ${prov}, Philippines`);
      }

      // if street is empty/too generic, use vicinity keyword (often intersections)
      if (vicinity) {
        candidates.push(`${vicinity}, ${brgy}, ${cty}, ${prov}, Philippines`);
      }

      // final fallback: barangay+city (but still locked)
      candidates.push(`${normalizePH(brgy)}, ${normalizePH(cty)}, ${normalizePH(prov)}, Philippines`);

      let best:
        | { lat: number; lon: number; label: string }
        | null = null;

      for (const query of Array.from(new Set(candidates))) {
        const g = await geocodeLocked({
          query,
          hintBarangay: brgy,
          hintCity: cty,
          hintProvince: prov,
          anchor: { lat: anchor.lat, lon: anchor.lon }, // ✅ LOCK AREA
          street,
          vicinity,
        });

        if (myId !== reqIdRef.current) return;
        if (g) {
          best = g;
          break;
        }
      }

      if (myId !== reqIdRef.current) return;

      // if nothing, at least use barangay anchor (never jump elsewhere)
      const finalCenter = best ?? anchor;

      setSelectedLocation({ lat: finalCenter.lat, lon: finalCenter.lon });
      setGeoLabel(best?.label ?? anchor.label);

      // 3) POI names + counts
      setPoiLoading(true);
      const poi = await fetchPoi(finalCenter.lat, finalCenter.lon);
      if (myId !== reqIdRef.current) return;

      setPoiData({ counts: poi.counts, items: poi.items });
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
    setPoiData(null);
    setDetailsErr("");

    setPoiLoading(true);
    try {
      const poi = await fetchPoi(lat, lon);
      if (myId !== reqIdRef.current) return;
      setPoiData({ counts: poi.counts, items: poi.items });
    } catch (e: any) {
      if (myId !== reqIdRef.current) return;
      setDetailsErr(e?.message ?? "Failed to load POI");
    } finally {
      if (myId !== reqIdRef.current) return;
      setPoiLoading(false);
    }
  }

  // ✅ auto-search (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      if (!domain) return;
      searchZonal({ page: 1 });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, city, barangay, classification, q]);

  const showingFrom = totalRows ? (page - 1) * itemsPerPage + 1 : 0;
  const showingTo = totalRows ? Math.min(page * itemsPerPage, totalRows) : rows.length;

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">BIR Zonal Values Lookup</h1>
            <p className="text-sm text-gray-600">
              ✅ Street/Building search is locked near Barangay anchor (prevents jumping).
            </p>
          </div>

          <div className="text-right">
            <div className="text-xs text-gray-500">Page</div>
            <div className="text-sm font-medium">
              {page}
              {pageCount ? ` / ${pageCount}` : ""}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6 space-y-4">
        {/* Region selector */}
        <section className="rounded-xl border bg-white p-4 space-y-3">
          <div className="text-sm font-medium">Select Province/City Database</div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-9">
              <label className="block text-xs font-medium text-gray-600">Search (province/city)</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={regionSearch}
                onChange={(e) => setRegionSearch(e.target.value)}
                placeholder="Type: cebu, bohol, davao..."
              />
            </div>
            <div className="md:col-span-3 flex gap-2">
              <button
                onClick={findRegions}
                className="w-full rounded-md bg-gray-900 text-white px-4 py-2 text-sm hover:bg-black"
              >
                Find
              </button>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Selected domain: <span className="font-medium text-gray-700">{domain}</span>
            {facetsLoading ? <span className="ml-2">Loading cities…</span> : null}
          </div>

          {matches.length > 0 ? (
            <div className="max-h-56 overflow-auto rounded-md border">
              {matches.map((m, idx) => (
                <button
                  key={idx}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-b-0"
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

                    await loadCities(m.domain);
                    searchZonal({ page: 1 });

                    // fly to region city
                    flyToFilters(m.city, "", m.province);
                  }}
                >
                  <div className="font-medium">
                    {m.province} — {m.city}
                  </div>
                  <div className="text-xs text-gray-500">{m.domain}</div>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        {/* Filters */}
        <section className="rounded-xl border bg-white p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-600">City</label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={city}
                onChange={(e) => {
                  const nextCity = e.target.value;
                  setCity(nextCity);
                  setBarangay("");
                  setPage(1);
                  setFacetBarangays([]);
                  loadBarangays(domain, nextCity);

                  if (nextCity) flyToFilters(nextCity, "", "");
                }}
                disabled={facetsLoading || facetCities.length === 0}
              >
                <option value="">All</option>
                {facetCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-600">Barangay</label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={barangay}
                onChange={(e) => {
                  const nextBrgy = e.target.value;
                  setBarangay(nextBrgy);
                  setPage(1);

                  if (city && nextBrgy) flyToFilters(city, nextBrgy, "");
                }}
                disabled={!city || barangaysLoading}
              >
                <option value="">All</option>
                {facetBarangays.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              {barangaysLoading ? <div className="text-[11px] text-gray-500 mt-1">Loading barangays…</div> : null}
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-600">Classification</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={classification}
                onChange={(e) => {
                  setClassification(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g. COMMERCIAL REGULAR"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-600">Search</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Street / barangay / vicinity / etc."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {err ? (
              <div className="md:col-span-12 mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </div>
            ) : null}

            <div className="md:col-span-12 text-xs text-gray-600 pt-2 flex items-center justify-between">
              <div>
                {totalRows ? (
                  <>
                    Showing{" "}
                    <span className="font-medium text-gray-900">
                      {showingFrom.toLocaleString()}–{showingTo.toLocaleString()}
                    </span>{" "}
                    of <span className="font-medium text-gray-900">{totalRows.toLocaleString()}</span>
                  </>
                ) : null}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => searchZonal({ page: Math.max(1, page - 1) })}
                  disabled={loading || !hasPrev}
                  className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  onClick={() => searchZonal({ page: page + 1 })}
                  disabled={loading || !hasNext}
                  className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 3 panels */}
        <section className="rounded-xl border bg-white overflow-hidden">
          <div className="flex h-[78vh]">
            {/* LEFT */}
            <aside className="w-[360px] border-r bg-white flex flex-col">
              <div className="p-4 border-b">
                <div className="text-sm font-semibold">Selected Zonal Record</div>

                {!selectedRow ? (
                  <div className="text-sm text-gray-600 mt-2">Click a record below to fly the map.</div>
                ) : (
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="text-xl font-bold">{String(selectedRow["ZonalValuepersqm.-"] ?? "")}</div>
                    <div className="text-gray-700">
                      City: <b>{String(selectedRow["City-"] ?? "")}</b>
                    </div>
                    <div className="text-gray-700">
                      Barangay: <b>{String(selectedRow["Barangay-"] ?? "")}</b>
                    </div>
                    <div className="text-gray-700">
                      Street: <b>{String(selectedRow["Street/Subdivision-"] ?? "")}</b>
                    </div>

                    <div className="text-xs text-gray-500 mt-2">{geoLoading ? "Centering…" : geoLabel}</div>

                    {detailsErr ? (
                      <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
                        {detailsErr}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-auto p-3">
                <div className="text-sm text-gray-700 mb-2">Records (click row)</div>
                {loading ? <div className="text-sm text-gray-600 mb-2">Loading rows…</div> : null}

                <div className="rounded-lg border overflow-hidden">
                  <div className="max-h-[60vh] overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50 z-10">
                        <tr>
                          {columns.map((c) => (
                            <th
                              key={c}
                              className="text-left px-3 py-2 border-b font-medium text-gray-700 whitespace-nowrap"
                            >
                              {c === "ZonalValuepersqm.-" ? "Zonal / sqm" : c.replace(/-$/, "")}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody className="divide-y">
                        {rows.map((r, i) => (
                          <tr
                            key={`${r.rowIndex}-${i}`}
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => selectRow(r)}
                          >
                            {columns.map((c) => (
                              <td key={c} className="px-3 py-2 align-top">
                                {String((r as any)[c] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </aside>

            {/* MAP */}
            <div className="flex-1">
              <ZonalMap selected={selectedLocation} onPickOnMap={selectLocationFromMap} popupLabel={geoLabel} />
            </div>

            {/* RIGHT */}
            <aside className="w-[340px] border-l bg-white p-4 overflow-auto">
              <div className="text-sm font-semibold mb-3">Reports (within 1.5km)</div>

              <div className="rounded-lg border p-3">
                <div className="text-xs text-gray-500 mb-2">
                  Facilities within <b>1500m</b>
                </div>

                {poiLoading ? (
                  <div className="text-sm text-gray-600">Loading POI…</div>
                ) : poiData ? (
                  <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border p-2">Hospitals<br /><b>{poiData.counts.hospitals}</b></div>
                      <div className="rounded-lg border p-2">Schools<br /><b>{poiData.counts.schools}</b></div>
                      <div className="rounded-lg border p-2">Police<br /><b>{poiData.counts.policeStations}</b></div>
                      <div className="rounded-lg border p-2">Fire<br /><b>{poiData.counts.fireStations}</b></div>
                      <div className="rounded-lg border p-2">Pharmacy<br /><b>{poiData.counts.pharmacies}</b></div>
                      <div className="rounded-lg border p-2">Clinics<br /><b>{poiData.counts.clinics}</b></div>
                    </div>

                    {/* Names list */}
                    <div className="text-xs text-gray-600">
                      <div className="font-medium text-gray-800 mb-1">Nearest names</div>

                      <div className="space-y-2">
                        {(
                          [
                            ["Hospitals", poiData.items.hospitals],
                            ["Schools", poiData.items.schools],
                            ["Police", poiData.items.policeStations],
                            ["Fire", poiData.items.fireStations],
                            ["Pharmacy", poiData.items.pharmacies],
                            ["Clinics", poiData.items.clinics],
                          ] as const
                        ).map(([label, list]) => (
                          <div key={label}>
                            <div className="font-medium">{label}</div>
                            {list.length ? (
                              <ul className="list-disc pl-4">
                                {list.slice(0, 6).map((x, idx) => (
                                  <li key={idx}>{x.name || "(unnamed)"}</li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-[11px] text-gray-500">None found</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">Select a row or click the map to load POI.</div>
                )}
              </div>

              <div className="text-[11px] text-gray-500 mt-3">
                Note: POI from OpenStreetMap (Overpass). Coverage varies by area.
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
