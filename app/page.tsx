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

type RegionMatch = {
  province: string;
  city: string;
  domain: string;
};

function cleanName(s: string) {
  return String(s ?? "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePH(s: string) {
  return cleanName(s)
    .replace(/\bPOB\b/gi, "Poblacion")
    .replace(/\bSTO\b/gi, "Santo")
    .replace(/\bSTA\b/gi, "Santa")
    .replace(/NIÑO/gi, "Nino")
    .replace(/Ñ/gi, "N");
}

export default function Home() {
  // Region selection
  const [regionSearch, setRegionSearch] = useState("");
  const [matches, setMatches] = useState<RegionMatch[]>([]);
  const [domain, setDomain] = useState("cebu.zonalvalue.com");

  // Facets
  const [facetCities, setFacetCities] = useState<string[]>([]);
  const [facetBarangays, setFacetBarangays] = useState<string[]>([]);
  const [facetsLoading, setFacetsLoading] = useState(false);
  const [barangaysLoading, setBarangaysLoading] = useState(false);

  // Filters
  const [city, setCity] = useState("");
  const [barangay, setBarangay] = useState("");
  const [classification, setClassification] = useState("");
  const [q, setQ] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(16);
  const [totalRows, setTotalRows] = useState(0);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [hasPrev, setHasPrev] = useState(false);
  const [hasNext, setHasNext] = useState(false);

  // Results
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Selection + map
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lon: number } | null>(
    null
  );

  // Labels + POI
  const [geoLabel, setGeoLabel] = useState<string>("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [poiLoading, setPoiLoading] = useState(false);
  const [poiCounts, setPoiCounts] = useState<any | null>(null);
  const [detailsErr, setDetailsErr] = useState<string>("");

  // Prevent race conditions
  const reqIdRef = useRef(0);
  const zonalAbortRef = useRef<AbortController | null>(null);

  // ✅ client cache for geocode (super fast for repeated barangays/cities)
  const centerCacheRef = useRef<Map<string, { lat: number; lon: number; label: string }>>(
    new Map()
  );

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
    if (!res.ok || !data?.ok) throw new Error(data?.error ?? "POI counts failed");
    return data;
  }

  async function geocode(query: string) {
    const key = query.toLowerCase();
    const cached = centerCacheRef.current.get(key);
    if (cached) return cached;

    const res = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return null;

    const payload = {
      lat: Number(data.lat),
      lon: Number(data.lon),
      label: String(data.displayName ?? query),
    };
    centerCacheRef.current.set(key, payload);
    return payload;
  }

  // ✅ This guarantees the map moves even when exact match is impossible
  async function resolveCenter(opts: { barangay?: string; city?: string; province?: string }) {
    const b = normalizePH(opts.barangay ?? "");
    const c = normalizePH(opts.city ?? "");
    const p = normalizePH(opts.province ?? "");

    // priority: barangay + city (your request)
    const q1 = b && c ? `${b}, ${c}, Philippines` : "";
    const q2 = c ? `${c}, Philippines` : "";
    const q3 = p ? `${p}, Philippines` : "Philippines";

    return (q1 && (await geocode(q1))) || (q2 && (await geocode(q2))) || (await geocode(q3)) || {
      lat: 12.8797,
      lon: 121.774,
      label: "Philippines",
    };
  }

  async function selectRow(r: Row) {
    const myId = ++reqIdRef.current;

    setSelectedRow(r);
    setDetailsErr("");
    setPoiCounts(null);

    setGeoLoading(true);
    try {
      const center = await resolveCenter({
        barangay: r["Barangay-"],
        city: r["City-"],
        province: r["Province-"],
      });

      if (myId !== reqIdRef.current) return;

      setSelectedLocation({ lat: center.lat, lon: center.lon });
      setGeoLabel(center.label);

      setPoiLoading(true);
      const poi = await fetchPoi(center.lat, center.lon);
      if (myId !== reqIdRef.current) return;
      setPoiCounts(poi.counts ?? null);
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
    setPoiCounts(null);
    setDetailsErr("");

    setPoiLoading(true);
    try {
      const poi = await fetchPoi(lat, lon);
      if (myId !== reqIdRef.current) return;
      setPoiCounts(poi.counts ?? null);
    } catch (e: any) {
      if (myId !== reqIdRef.current) return;
      setDetailsErr(e?.message ?? "Failed to load POI counts");
    } finally {
      if (myId !== reqIdRef.current) return;
      setPoiLoading(false);
    }
  }

  async function flyToFilters(nextCity: string, nextBarangay: string) {
    const myId = ++reqIdRef.current;
    setGeoLoading(true);
    try {
      const center = await resolveCenter({ city: nextCity, barangay: nextBarangay });
      if (myId !== reqIdRef.current) return;

      setSelectedLocation({ lat: center.lat, lon: center.lon });
      setGeoLabel(center.label);
    } finally {
      if (myId !== reqIdRef.current) return;
      setGeoLoading(false);
    }
  }

  // ✅ Debounced auto search for fast UX
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
              Centering uses Barangay + City (cached). POI counts from Overpass.
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
                  onClick={() => {
                    setDomain(m.domain);
                    setCity("");
                    setBarangay("");
                    setClassification("");
                    setQ("");
                    setPage(1);

                    setRows([]);
                    setErr("");
                    setSelectedRow(null);
                    setPoiCounts(null);
                    setDetailsErr("");

                    loadCities(m.domain);
                    searchZonal({ page: 1 });

                    // fly to region city
                    flyToFilters(m.city, "");
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

                  if (nextCity) flyToFilters(nextCity, "");
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
                  const nextBarangay = e.target.value;
                  setBarangay(nextBarangay);
                  setPage(1);

                  if (city && nextBarangay) flyToFilters(city, nextBarangay);
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
              {barangaysLoading ? (
                <div className="text-[11px] text-gray-500 mt-1">Loading barangays…</div>
              ) : null}
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

            <div className="md:col-span-12 text-xs text-gray-600 pt-2">
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
          </div>
        </section>

        {/* 3 panels */}
        <section className="rounded-xl border bg-white overflow-hidden">
          <div className="flex h-[78vh]">
            {/* LEFT */}
            <aside className="w-[340px] border-r bg-white flex flex-col">
              <div className="p-4 border-b">
                <div className="text-sm font-semibold">Selected Zonal Record</div>

                {!selectedRow ? (
                  <div className="text-sm text-gray-600 mt-2">
                    Click a record below to view details and fly the map.
                  </div>
                ) : (
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="text-xl font-bold">{String(selectedRow["ZonalValuepersqm.-"] ?? "")}</div>
                    <div className="text-gray-700">City: <b>{String(selectedRow["City-"] ?? "")}</b></div>
                    <div className="text-gray-700">Barangay: <b>{String(selectedRow["Barangay-"] ?? "")}</b></div>
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
                            key={i}
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
            <aside className="w-[300px] border-l bg-white p-4 overflow-auto">
              <div className="text-sm font-semibold mb-3">Reports (within 1.5km)</div>

              <div className="rounded-lg border p-3">
                <div className="text-xs text-gray-500 mb-2">Facilities within <b>1500m</b></div>

                {poiLoading ? (
                  <div className="text-sm text-gray-600">Loading POI counts…</div>
                ) : poiCounts ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border p-3">Hospitals<br /><b>{poiCounts.hospitals}</b></div>
                    <div className="rounded-lg border p-3">Schools<br /><b>{poiCounts.schools}</b></div>
                    <div className="rounded-lg border p-3">Police<br /><b>{poiCounts.policeStations}</b></div>
                    <div className="rounded-lg border p-3">Fire<br /><b>{poiCounts.fireStations}</b></div>
                    <div className="rounded-lg border p-3">Pharmacy<br /><b>{poiCounts.pharmacies}</b></div>
                    <div className="rounded-lg border p-3">Clinics<br /><b>{poiCounts.clinics}</b></div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">Select a row or click the map to load counts.</div>
                )}
              </div>

              <div className="text-[11px] text-gray-500 mt-3">
                Note: counts come from OpenStreetMap data (Overpass). Coverage varies by area.
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
