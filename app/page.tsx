"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
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

export default function Home() {
  // region selection
  const [regionSearch, setRegionSearch] = useState("");
  const [matches, setMatches] = useState<RegionMatch[]>([]);
  const [domain, setDomain] = useState("cebu.zonalvalue.com");
  const [selectedProvince, setSelectedProvince] = useState("Cebu"); // Track selected province name
  const [selectedProvinceCity, setSelectedProvinceCity] = useState(""); // Track the actual city in the province

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

  // ✅ Area description under map (AI)
  const [areaDescription, setAreaDescription] = useState("");
  const [areaDescLoading, setAreaDescLoading] = useState(false);
  const [areaDescErr, setAreaDescErr] = useState("");

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

  // Map BIR display city names to real OSM/Google city names
  function normalizeCityHint(city: string, province?: string) {
    const c = String(city || "").toUpperCase().trim();
    const p = String(province || "").toUpperCase().trim();
    if (p.includes("CEBU")) {
      if (c.includes("CEBU SOUTH") || c.includes("CEBU NORTH")) return "Cebu City";
    }
    return city;
  }

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

  // NOTE: /api/comps not implemented; disable comps fetch to avoid 404 noise
  // async function fetchCompsForRow(r: Row) { return null as any }

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
    const cityHintFixed = normalizeCityHint(next.city ?? "", next.province ?? "");
    const c = normalizePH(cityHintFixed);
    const p = normalizePH(next.province ?? "");

    const q1 = b && c ? `${b}, ${c}, ${p}, Philippines` : "";
    const q2 = c ? `${c}, ${p}, Philippines` : "";
    const q3 = p ? `${p}, Philippines` : "Philippines";

    const center =
      (q1 &&
        (await geocodeLocked({
          query: q1,
          hintBarangay: next.barangay,
          hintCity: cityHintFixed,
          hintProvince: next.province,
          anchor: null,
        }))) ||
      (q2 &&
        (await geocodeLocked({
          query: q2,
          hintCity: cityHintFixed,
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

  // Point-in-polygon test (ray casting). Boundary entries are [lat, lon].
  function isPointInPolygon(lat: number, lon: number, boundary: Boundary): boolean {
    const x = lon;
    const y = lat;
    let inside = false;
    for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
      const xi = boundary[i][1]; // lon
      const yi = boundary[i][0]; // lat
      const xj = boundary[j][1];
      const yj = boundary[j][0];
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Haversine distance (km)
  function getDistanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
    const R = 6371;
    const dLat = ((bLat - aLat) * Math.PI) / 180;
    const dLon = ((bLon - aLon) * Math.PI) / 180;
    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLon / 2);
    const c = s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2;
    return 2 * R * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
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
    } finally {
      if (myId !== reqIdRef.current) return;
      setGeoLoading(false);
    }
  }

  async function describeArea(payload: {
    lat: number;
    lon: number;
    label: string;
    row?: Row | null;
    poi?: PoiData | null;
  }) {
    setAreaDescErr("");
    setAreaDescLoading(true);
    try {
      const res = await fetch("/api/describe-area", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: payload.lat,
          lon: payload.lon,
          label: payload.label,
          city: String(payload.row?.["City-"] ?? ""),
          barangay: String(payload.row?.["Barangay-"] ?? ""),
          province: String(payload.row?.["Province-"] ?? ""),
          classification: String(payload.row?.["Classification-"] ?? ""),
          zonalValuePerSqm: String(payload.row?.["ZonalValuepersqm.-"] ?? ""),
          poiCounts: payload.poi?.counts ?? null,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Failed to describe area");

      setAreaDescription(String(data.text ?? "").trim());
    } catch (e: any) {
      setAreaDescErr(e?.message ?? "Failed to generate description");
      setAreaDescription("");
    } finally {
      setAreaDescLoading(false);
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
    setAreaDescErr("");

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
      const cty = normalizeCityHint(String(r["City-"] ?? ""), String(r["Province-"] ?? ""));
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
          // Strict barangay lock: only accept result if it falls INSIDE the barangay boundary
          if (anchor.boundary && anchor.boundary.length > 0) {
            const ok = isPointInPolygon(g.lat, g.lon, anchor.boundary as any);
            if (!ok) {
              // skip this candidate; try next
              continue;
            }
          }
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

      // Choose final center but enforce barangay lock strictly
      let finalCenter = best ?? anchor;
      if (anchor.boundary && anchor.boundary.length > 0) {
        const inside = isPointInPolygon(finalCenter.lat, finalCenter.lon, anchor.boundary as any);
        if (!inside) {
          // override to barangay center
          finalCenter = anchor;
          setMatchStatus("✓ Barangay-locked (centroid)");
        }
      } else {
        // No boundary available: keep within 1.5km of anchor
        const d = getDistanceKm(finalCenter.lat, finalCenter.lon, anchor.lat, anchor.lon);
        if (d > 1.5) {
          finalCenter = anchor;
          setMatchStatus("✓ Locked near barangay");
        }
      }

      setSelectedLocation({ lat: finalCenter.lat, lon: finalCenter.lon });
      setGeoLabel(best?.label ?? anchor.label);
      setBoundary(finalCenter.boundary ?? anchor.boundary ?? null);

      // comps disabled

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

      // ✅ AI description (after POI so it can use counts)
      describeArea({
        lat: finalCenter.lat,
        lon: finalCenter.lon,
        label: best?.label ?? anchor.label,
        row: r,
        poi: { counts: poi.counts, items: poi.items } as any,
      });
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

    // Enforce barangay lock on map clicks as well
    if (boundary && boundary.length > 0) {
      const inside = isPointInPolygon(lat, lon, boundary);
      if (!inside) {
        setDetailsErr("Please click inside the selected barangay.");
        return;
      }
    }

    setSelectedLocation({ lat, lon });
    setGeoLabel(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    setMatchStatus("");
    setPoiData(null);
    setDetailsErr("");
    setComps(null);
    setAreaDescription("");
    setAreaDescErr("");

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

      setIdealBusinessText(ideas.map((x) => `• ${x}`).join(""));

      // ✅ AI description for clicked point (no row context)
      describeArea({
        lat,
        lon,
        label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
        row: null,
        poi: { counts: poi.counts, items: poi.items } as any,
      });
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
      <header className="border-b bg-white shadow-sm sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-col items-center text-center gap-1">
            <Image
              src="/pictures/FilipinoHomes.png"
              alt="Filipino Homes"
              width={280}
              height={70}
              className="h-16 md:h-20 w-auto"
              priority
            />
          </div>
        </div>
      </header>

      <div className="w-full px-3 sm:px-4 py-4 space-y-4">
        {/* Region Selector */}
        <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow">         <h2 className="text-base font-semibold text-gray-900 mb-4">Select Province/City Database</h2>

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
                    setSelectedProvince(m.province); // Set the selected province
                    setSelectedProvinceCity(m.city); // Store the province's main city
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
                    setAreaDescErr("");

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

        {/* Currently Selected Region Display */}
        {selectedProvince && (
          <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 shadow">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Currently Selected Province</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{selectedProvince}</p>
                <p className="text-sm text-gray-700 mt-2">Database: <span className="font-semibold text-blue-600">{domain}</span></p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Search & Filter Properties</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4">
            {/* City Selection */}
            <div className="sm:col-span-1 lg:col-span-3">
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">City in {selectedProvince}</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
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
              {facetsLoading && <p className="text-xs text-blue-600 mt-1">Loading cities...</p>}
            </div>

            {/* Barangay Selection */}
            <div className="sm:col-span-1 lg:col-span-3">
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Barangay {city && `in ${city}`}</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
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
              {barangaysLoading && <p className="text-xs text-blue-600 mt-1">Loading barangays…</p>}
            </div>

            {/* Classification */}
            <div className="sm:col-span-1 lg:col-span-3">
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Classification</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={classification}
                onChange={(e) => {
                  setClassification(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g., COMMERCIAL"
              />
            </div>

            {/* Search/Street */}
            <div className="sm:col-span-1 lg:col-span-3">
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Search Street/Vicinity</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Type street name..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-5">
            <button
              onClick={() => searchZonal({ page: 1 })}
              disabled={loading}
              className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition disabled:opacity-50 order-1 sm:order-none"
            >
              {loading ? "Searching..." : "Search"}
            </button>
            <button
              onClick={() => {
                setCity("");
                setBarangay("");
                setClassification("");
                setQ("");
                setPage(1);
                setRows([]);
              }}
              className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition order-2 sm:order-none"
            >
              Clear
            </button>
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

        {/* Main Content */}
        <section className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow">
          <div className="flex h-[80vh]">
            {/* LEFT PANEL */}
            <aside className="w-72 lg:w-80 border-r border-gray-200 bg-white flex flex-col overflow-hidden">              <div className="p-4 border-b border-gray-200 flex-shrink-0">
                <h3 className="text-sm font-semibold text-gray-900">Selected Property</h3>

                {!selectedRow ? (
                  <p className="text-xs text-gray-500 mt-2">Select a property or click the map</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-600">Zonal Value</p>
                        <p className="text-2xl font-bold text-gray-900">₱{String(selectedRow["ZonalValuepersqm.-"] ?? "")}</p>
                        <p className="text-xs text-gray-600 mt-1">per square meter</p>
                      </div>
                      <img
                        src="/pictures/land-value.png"
                        alt="Land Value"
                        className="ml-4 w-12 h-12 md:w-14 md:h-14 flex-shrink-0"
                        style={{ filter: 'invert(45%) sepia(12%) saturate(2470%) hue-rotate(90deg) brightness(92%) contrast(92%)' }}
                        loading="lazy"
                      />
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
                          <div>
                            Count: <span className="font-semibold">{comps.stats.count}</span>
                          </div>
                          <div>
                            Min: <span className="font-semibold">{comps.stats.min == null ? "-" : comps.stats.min.toLocaleString()}</span>
                          </div>
                          <div>
                            Median: <span className="font-semibold">{comps.stats.median == null ? "-" : comps.stats.median.toLocaleString()}</span>
                          </div>
                          <div>
                            Max: <span className="font-semibold">{comps.stats.max == null ? "-" : comps.stats.max.toLocaleString()}</span>
                          </div>
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

              <div className="flex-1 overflow-auto bg-gray-50">
                <div className="sticky top-0 p-3 border-b border-gray-200 bg-white">
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">PROPERTIES ({rows.length})</p>
                </div>

                {loading && <p className="text-xs text-gray-500 p-3">Loading...</p>}

                <div className="divide-y divide-gray-200">
                  {rows.map((r, i) => (
                    <button
                      key={`${r.rowIndex}-${i}`}
                      onClick={() => selectRow(r)}
                      className={`w-full text-left p-3 transition border-b border-gray-200 last:border-b-0 ${selectedRow?.rowIndex === r.rowIndex ? "bg-blue-100 border-l-4 border-l-blue-600" : "hover:bg-blue-50"}`}
                    >
                      <div className="font-semibold text-xs text-gray-900">{String(r["Street/Subdivision-"] ?? "").slice(0, 28)}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        {String(r["Barangay-"] ?? "")}, {String(r["City-"] ?? "")}
                      </div>
                      <div className="font-bold text-blue-600 text-sm mt-1.5">₱{String(r["ZonalValuepersqm.-"] ?? "")}</div>
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            {/* CENTER PANEL */}
            <div className="flex-1 flex flex-col relative bg-gray-50">
              <div className="absolute top-4 right-4 z-10 space-y-2">
                {/* Map type buttons */}
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex gap-1">
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

              {/* ✅ Description below map */}
              <div className="border-t border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">Area Description </p>
                  {areaDescLoading && <p className="text-xs text-gray-500">Generating…</p>}
                </div>

                {areaDescErr ? (
                  <p className="text-xs text-red-600 mt-2">{areaDescErr}</p>
                ) : (
                  <p className="text-sm text-gray-800 mt-2 leading-relaxed">
                    {areaDescription || "Select a property or click the map to generate a short description."}
                  </p>
                )}
              </div>
            </div>

            {/* RIGHT PANEL */}
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