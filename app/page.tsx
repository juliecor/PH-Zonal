"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Map as MapIcon,
  Satellite as SatelliteIcon,
  Mountain as TerrainIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Search,
  SlidersHorizontal,
  List,
  PanelRightOpen,
  PanelRightClose,
} from "lucide-react";

import type { Boundary, LatLng, MapType, PoiData, RegionMatch, Row } from "./lib/types";
import { isBadStreet, normalizePH, suggestBusinesses } from "./lib/zonal-util";
import ReportBuilder from "./components/ReportBuilder";

const MapComponent = dynamic(async () => {
  if (typeof window !== "undefined" && (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as any)) {
    try {
      return (await import("./components/GMap")).default;
    } catch {
      return (await import("./components/ZonalMap")).default;
    }
  }
  return (await import("./components/ZonalMap")).default;
}, { ssr: false });

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
  const [selectedProvince, setSelectedProvince] = useState("Cebu");
  const [selectedProvinceCity, setSelectedProvinceCity] = useState("");

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
  const [poiRadiusKm, setPoiRadiusKm] = useState(1.5);
  const [areaLabels, setAreaLabels] = useState<Array<{ lat: number; lon: number; name: string }>>([]);

  // Street highlight (GeoJSON + toggle)
  const [streetGeo, setStreetGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [streetGeoLoading, setStreetGeoLoading] = useState(false);
  const [showStreetHighlight, setShowStreetHighlight] = useState(false);

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

  // ---------------- UI toggles (NEW - UI only) ----------------
  const [leftOpen, setLeftOpen] = useState(true); // left drawer
  const [showFilters, setShowFilters] = useState(false); // filter row inside drawer
  const [bottomOpen, setBottomOpen] = useState(true); // selected property card
  const [rightOpen, setRightOpen] = useState(false); // report drawer
  const [showRegionPicker, setShowRegionPicker] = useState(true); // first-screen UX

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
      body: JSON.stringify({ lat, lon, radius: Math.round(poiRadiusKm * 1000), limit: 120 }),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) throw new Error(data?.error ?? "POI failed");
    return data as { ok: true; counts: PoiData["counts"]; items: PoiData["items"] };
  }

  async function fetchAreaLabels(lat: number, lon: number) {
    try {
      const res = await fetch("/api/neighborhoods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lon, radius: 2000 }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok && Array.isArray(j.items)) return j.items as Array<{ lat: number; lon: number; name: string }>;
    } catch {}
    return [] as Array<{ lat: number; lon: number; name: string }>;
  }

  async function fetchStreetGeometryFromSelectedRow(r: Row) {
    const streetName = String(r["Street/Subdivision-"] ?? "").trim();
    const cityName = String(r["City-"] ?? "").trim();
    const provName = String(r["Province-"] ?? "").trim();
    const brgyName = String(r["Barangay-"] ?? "").trim();

    const lat = selectedLocation?.lat ?? null;
    const lon = selectedLocation?.lon ?? null;
    if (!streetName || lat == null || lon == null) return null;

    setStreetGeoLoading(true);
    try {
      const res = await fetch("/api/street-geometry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streetName, city: cityName, province: provName, barangay: brgyName, lat, lon }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) return null;
      return data as {
        ok: true;
        geojson: GeoJSON.FeatureCollection;
        meta?: { matched: boolean; bestScore?: number | null; name?: string | null; center?: { lat: number; lon: number } | null };
      };
    } finally {
      setStreetGeoLoading(false);
    }
  }

  async function fetchStreetGeometryAt(r: Row, lat: number, lon: number) {
    const streetName = String(r["Street/Subdivision-"] ?? "").trim();
    const cityName = String(r["City-"] ?? "").trim();
    const provName = String(r["Province-"] ?? "").trim();
    const brgyName = String(r["Barangay-"] ?? "").trim();

    if (!streetName) return null;

    try {
      const res = await fetch("/api/street-geometry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streetName, city: cityName, province: provName, barangay: brgyName, lat, lon }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) return null;
      return data as {
        ok: true;
        geojson: GeoJSON.FeatureCollection;
        meta?: { matched: boolean; bestScore?: number | null; name?: string | null; center?: { lat: number; lon: number } | null };
      };
    } catch {
      return null;
    }
  }

  async function onChangePoiRadius(newKm: number) {
    setPoiRadiusKm(newKm);
    if (!selectedLocation) return;
    const myId = ++reqIdRef.current;
    setPoiLoading(true);
    try {
      const poi = await fetchPoi(selectedLocation.lat, selectedLocation.lon);
      if (myId !== reqIdRef.current) return;
      setPoiData({ counts: poi.counts, items: poi.items });

      const ideas = suggestBusinesses({
        zonalValueText: String(selectedRow?.["ZonalValuepersqm.-"] ?? ""),
        classification: String(selectedRow?.["Classification-"] ?? ""),
        poi,
      });
      setIdealBusinessText(ideas.map((x) => `• ${x}`).join("\n"));

      describeArea({
        lat: selectedLocation.lat,
        lon: selectedLocation.lon,
        label: geoLabel,
        row: selectedRow,
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

  function isPointInPolygon(lat: number, lon: number, boundary: Boundary): boolean {
    const x = lon;
    const y = lat;
    let inside = false;
    for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
      const xi = boundary[i][1];
      const yi = boundary[i][0];
      const xj = boundary[j][1];
      const yj = boundary[j][0];
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

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

  async function describeArea(payload: { lat: number; lon: number; label: string; row?: Row | null; poi?: PoiData | null }) {
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
    setShowStreetHighlight(false);
    setStreetGeo(null);

    // UI feel: open bottom card + keep left list visible
    setBottomOpen(true);

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
          if (anchor.boundary && anchor.boundary.length > 0) {
            const ok = isPointInPolygon(g.lat, g.lon, anchor.boundary as any);
            if (!ok) continue;
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

      let finalCenter = best ?? anchor;
      if (anchor.boundary && anchor.boundary.length > 0) {
        const inside = isPointInPolygon(finalCenter.lat, finalCenter.lon, anchor.boundary as any);
        if (!inside) {
          finalCenter = anchor;
          setMatchStatus("✓ Barangay-locked (centroid)");
        }
      } else {
        const d = getDistanceKm(finalCenter.lat, finalCenter.lon, anchor.lat, anchor.lon);
        if (d > 1.5) {
          finalCenter = anchor;
          setMatchStatus("✓ Locked near barangay");
        }
      }

      setSelectedLocation({ lat: finalCenter.lat, lon: finalCenter.lon });
      setGeoLabel(best?.label ?? anchor.label);
      setBoundary(finalCenter.boundary ?? anchor.boundary ?? null);

      try { setAreaLabels(await fetchAreaLabels(finalCenter.lat, finalCenter.lon)); } catch {}

      try {
        const snapResp = await fetchStreetGeometryAt(r, finalCenter.lat, finalCenter.lon);
        const snap = (snapResp as any)?.meta?.center as { lat: number; lon: number } | undefined;
        if (snap && Number.isFinite(snap.lat) && Number.isFinite(snap.lon)) {
          const bnd = (finalCenter.boundary ?? anchor.boundary) as Boundary | null;
          if (!bnd || bnd.length === 0 || isPointInPolygon(snap.lat, snap.lon, bnd)) {
            setSelectedLocation({ lat: snap.lat, lon: snap.lon });
            const nm = (snapResp as any)?.meta?.name || String(r["Street/Subdivision-"] || "");
            setGeoLabel(`${nm} (snapped to street)`);
          }
        }
      } catch {}

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

    setShowStreetHighlight(false);
    setStreetGeo(null);

    // UI: open bottom card
    setBottomOpen(true);

    setPoiLoading(true);
    try {
      const poi = await fetchPoi(lat, lon);
      if (myId !== reqIdRef.current) return;
      setPoiData({ counts: poi.counts, items: poi.items });
      try { setAreaLabels(await fetchAreaLabels(lat, lon)); } catch {}

      const ideas = suggestBusinesses({ zonalValueText: "", classification: "", poi });
      setIdealBusinessText(ideas.map((x) => `• ${x}`).join(""));

      describeArea({
        lat,
        lon,
        label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
        row: null,
        poi: { counts: poi.counts, items: poi.items } as any,
      });

      try {
        const res = await fetch("/api/street-nearby", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lon }),
        });
        const near = await res.json().catch(() => null);
        if (myId !== reqIdRef.current) return;
        if (res.ok && near?.ok && near?.name) {
          const params = new URLSearchParams({ domain });
          if (city) params.set("city", city);
          if (barangay) params.set("barangay", barangay);
          params.set("q", String(near.name));
          params.set("page", "1");
          const zr = await fetch(`/api/zonal?${params.toString()}`);
          const zdata = await zr.json().catch(() => null);
          if (myId !== reqIdRef.current) return;
          const found = Array.isArray(zdata?.rows) && zdata.rows.length ? zdata.rows[0] : null;
          if (found) {
            setSelectedRow(found);
            setGeoLabel(`${near.name}`);
          }
        }
      } catch {}
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

  // ---------------- Small UI helpers ----------------
  function fmtPeso(v: any) {
    const s = String(v ?? "").trim();
    if (!s) return "-";
    return `₱${s}`;
  }

  const selectedTitle = selectedRow
    ? `${String(selectedRow["Barangay-"] ?? "")}, ${String(selectedRow["City-"] ?? "")}, ${String(selectedRow["Province-"] ?? "")}`
    : geoLabel || "Select a property";

  return (
    <main className="h-screen w-screen overflow-hidden bg-slate-100 text-gray-900">
      {/* Fullscreen Map */}
      <div className="absolute inset-0">
        <MapComponent
          selected={selectedLocation}
          onPickOnMap={selectLocationFromMap}
          popupLabel={geoLabel}
          boundary={boundary}
          highlightRadiusMeters={80}
          containerId="map-container"
          mapType={mapType as "street" | "terrain" | "satellite"}
          showStreetHighlight={showStreetHighlight}
          streetGeojson={streetGeo}
          streetGeojsonEnabled={showStreetHighlight}
          areaLabels={areaLabels}
        />
      </div>

      {/* Top Bar Logo (minimal, Google-like) */}
      <div className="absolute top-4 left-4 z-30">
        <div className="rounded-2xl bg-white/95 backdrop-blur border border-gray-200 shadow-lg px-3 py-2 flex items-center gap-3">
          <Image
            src="/pictures/FilipinoHomes.png"
            alt="Filipino Homes"
            width={180}
            height={40}
            className="h-10 w-auto"
            priority
          />
          <div className="hidden md:block text-xs text-gray-500 border-l pl-3">
            <div className="font-semibold text-gray-700 leading-tight">Zonal Value</div>
            <div className="leading-tight">{domain}</div>
          </div>
        </div>
      </div>

      {/* Map Type Buttons (top-right floating, compact) */}
      <div className="absolute top-4 right-4 z-30">
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-gray-200 p-1.5 flex gap-1">
          <button
            onClick={() => setMapType("street")}
            className={`p-2 rounded-xl transition ${mapType === "street" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"}`}
            title="Street Map"
          >
            <MapIcon size={18} />
          </button>
          <button
            onClick={() => setMapType("terrain")}
            className={`p-2 rounded-xl transition ${mapType === "terrain" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"}`}
            title="Terrain Map"
          >
            <TerrainIcon size={18} />
          </button>
          <button
            onClick={() => setMapType("satellite")}
            className={`p-2 rounded-xl transition ${mapType === "satellite" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"}`}
            title="Satellite Map"
          >
            <SatelliteIcon size={18} />
          </button>
        </div>
      </div>

      {/* LEFT DRAWER (Google Maps style) */}
      <div className="absolute top-0 left-0 z-40 h-full flex">
        {/* Drawer */}
        <div
          className={[
            "h-full bg-white/95 backdrop-blur border-r border-gray-200 shadow-2xl transition-all duration-300",
            leftOpen ? "w-[360px] sm:w-[400px]" : "w-0",
          ].join(" ")}
        >
          {leftOpen && (
            <div className="h-full flex flex-col">
              {/* Search header */}
              <div className="p-4 pb-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <input
                        value={regionSearch}
                        onChange={(e) => setRegionSearch(e.target.value)}
                        placeholder="Enter province (e.g., Cebu, Bohol, Davao)"
                        className="w-full rounded-2xl border border-gray-300 bg-white px-10 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {regionSearch && (
                        <button
                          onClick={() => setRegionSearch("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          title="Clear"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowRegionPicker(true);
                      findRegions();
                    }}
                    className="rounded-2xl bg-blue-600 text-white px-4 py-3 text-sm font-semibold hover:bg-blue-700 transition shadow"
                  >
                    Find
                  </button>
                </div>

                {/* Small toolbar row */}
                <div className="mt-3 flex items-center justify-between">
                  <button
                    onClick={() => setShowFilters((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <SlidersHorizontal size={16} />
                    Filters
                  </button>

                  <button
                    onClick={() => setRightOpen((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    title="Open report panel"
                  >
                    {rightOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                    Report
                  </button>
                </div>

                {/* Region picker (first UX) */}
                {showRegionPicker && matches.length > 0 && (
                  <div className="mt-3 max-h-56 overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
                    {matches.map((m, idx) => (
                      <button
                        key={idx}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-blue-50 border-b last:border-b-0 transition"
                        onClick={async () => {
                          setDomain(m.domain);
                          setSelectedProvince(m.province);
                          setSelectedProvinceCity(m.city);

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

                          // UI: collapse region picker after selection (like Google)
                          setShowRegionPicker(false);
                          setShowFilters(true);
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

                {/* Filters (compact chips) */}
                {showFilters && (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={city}
                        onChange={(e) => {
                          const nextCity = e.target.value;
                          setCity(nextCity);
                          setShowStreetHighlight(false);
                          setStreetGeo(null);
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

                      <select
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={barangay}
                        onChange={(e) => {
                          const nextBrgy = e.target.value;
                          setBarangay(nextBrgy);
                          setShowStreetHighlight(false);
                          setStreetGeo(null);
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
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={classification}
                        onChange={(e) => {
                          setClassification(e.target.value);
                          setPage(1);
                        }}
                      >
                        <option value="">Classification (Optional)</option>
                        <option value="COMMERCIAL REGULAR">COMMERCIAL REGULAR</option>
                        <option value="COMMERCIAL CONDOMINIUM">COMMERCIAL CONDOMINIUM</option>
                        <option value="COMMERCIAL">COMMERCIAL</option>
                        <option value="RESIDENTIAL">RESIDENTIAL</option>
                        <option value="RESIDENTIAL CONDOMINIUM">RESIDENTIAL CONDOMINIUM</option>
                        <option value="INDUSTRIAL">INDUSTRIAL</option>
                        <option value="AGRICULTURAL">AGRICULTURAL</option>
                        <option value="SPECIAL">SPECIAL</option>
                        <option value="MIXED-USE">MIXED-USE</option>
                        <option value="ROAD LOT">ROAD LOT</option>
                        <option value="OPEN SPACE">OPEN SPACE</option>
                      </select>

                      <input
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Street / Vicinity…"
                        value={q}
                        onChange={(e) => {
                          setQ(e.target.value);
                          setPage(1);
                        }}
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => searchZonal({ page: 1 })}
                        disabled={loading}
                        className="flex-1 rounded-xl bg-blue-600 text-white px-4 py-2.5 text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50"
                      >
                        {loading ? "Searching…" : "Search"}
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
                        className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                {err && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {err}
                  </div>
                )}
              </div>

              {/* Results list */}
              <div className="flex-1 overflow-auto">
                <div className="px-4 py-3 sticky top-0 bg-white/95 backdrop-blur border-b border-gray-200 flex items-center justify-between">
                  <div className="text-xs font-extrabold tracking-wide text-gray-700 flex items-center gap-2">
                    <List size={16} />
                    RESULTS
                  </div>
                  <div className="text-[11px] text-gray-600">
                    {totalRows ? (
                      <>
                        {showingFrom.toLocaleString()}–{showingTo.toLocaleString()} of {totalRows.toLocaleString()}
                      </>
                    ) : (
                      "No results"
                    )}
                  </div>
                </div>

                {loading && <p className="text-xs text-gray-500 px-4 py-3">Loading…</p>}

                <div className="divide-y divide-gray-200">
                  {rows.map((r, i) => (
                    <button
                      key={`${r.rowIndex}-${i}`}
                      onClick={() => selectRow(r)}
                      className={[
                        "w-full text-left px-4 py-3 transition",
                        selectedRow?.rowIndex === r.rowIndex
                          ? "bg-blue-50 border-l-4 border-l-blue-600"
                          : "hover:bg-gray-50",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-extrabold text-[13px] text-gray-900">
                            {String(r["Street/Subdivision-"] ?? "").slice(0, 44) || "Unnamed"}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {String(r["Barangay-"] ?? "")}, {String(r["City-"] ?? "")}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[12px] font-black text-blue-700">{fmtPeso(r["ZonalValuepersqm.-"])}</div>
                          <div className="text-[10px] text-gray-500">per sqm</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-gray-200 flex items-center justify-between gap-2 bg-white/95 backdrop-blur">
                  <button
                    onClick={() => searchZonal({ page: Math.max(1, page - 1) })}
                    disabled={loading || !hasPrev}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <div className="text-[11px] text-gray-600">
                    Page <span className="font-bold">{page}</span>
                    {pageCount ? <> / {pageCount}</> : null}
                  </div>
                  <button
                    onClick={() => searchZonal({ page: page + 1 })}
                    disabled={loading || !hasNext}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Toggle Button */}
        <button
          onClick={() => setLeftOpen((v) => !v)}
          className="h-14 mt-6 rounded-r-2xl bg-white/95 backdrop-blur border border-gray-200 shadow-xl px-3 flex items-center justify-center hover:bg-white transition z-50"
          title={leftOpen ? "Collapse panel" : "Expand panel"}
        >
          {leftOpen ? <ChevronLeft /> : <ChevronRight />}
        </button>
      </div>

      {/* RIGHT REPORT DRAWER (overlay, UI only) */}
      <div
        className={[
          "absolute top-0 right-0 z-40 h-full transition-all duration-300",
          rightOpen ? "w-[360px] sm:w-[420px]" : "w-0",
        ].join(" ")}
      >
        {rightOpen && (
          <div className="h-full bg-white/95 backdrop-blur border-l border-gray-200 shadow-2xl">
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="text-sm font-black text-gray-900">Report</div>
                <button
                  onClick={() => setRightOpen(false)}
                  className="rounded-xl p-2 hover:bg-gray-100 text-gray-700"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-auto">
                <ReportBuilder
                  selectedLocation={selectedLocation}
                  selectedRow={selectedRow}
                  geoLabel={geoLabel}
                  poiLoading={poiLoading}
                  poiData={poiData}
                  poiRadiusKm={poiRadiusKm}
                  onChangePoiRadius={onChangePoiRadius}
                  idealBusinessText={idealBusinessText}
                  setIdealBusinessText={setIdealBusinessText}
                  areaDescription={areaDescription}
                  mapContainerId="map-container"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM SHEET — Selected Property (Google Maps card style) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-[92vw] sm:w-[720px]">
        <div
          className={[
            "rounded-3xl border border-gray-200 bg-white/95 backdrop-blur shadow-2xl overflow-hidden transition-all duration-300",
            bottomOpen ? "max-h-[60vh]" : "max-h-[52px]",
          ].join(" ")}
        >
          {/* Header row */}
          <button
            onClick={() => setBottomOpen((v) => !v)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
          >
            <div className="min-w-0 text-left">
              <div className="text-[11px] text-gray-500 font-semibold">Selected Property</div>
              <div className="text-sm font-black text-gray-900 truncate">{selectedTitle}</div>
            </div>
            <div className="text-xs font-bold text-gray-700">
              {bottomOpen ? "Collapse" : "Expand"}
            </div>
          </button>

          {/* Content */}
          {bottomOpen && (
            <div className="px-4 pb-4">
              {!selectedRow ? (
                <div className="text-sm text-gray-600">
                  Click a result on the left panel or click a point on the map.
                </div>
              ) : (
                <>
                  {/* Value card */}
                  <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-4 flex items-center justify-between shadow">
                    <div>
                      <div className="text-[11px] font-semibold opacity-90">Zonal Value</div>
                      <div className="text-2xl font-black mt-1">{fmtPeso(selectedRow["ZonalValuepersqm.-"])}</div>
                      <div className="text-[11px] opacity-90">per square meter</div>
                    </div>
                    <div className="text-right text-[11px] opacity-90">
                      <div>{String(selectedRow["City-"] ?? "")}</div>
                      <div>{String(selectedRow["Barangay-"] ?? "")}</div>
                      <div className="truncate max-w-[220px]">{String(selectedRow["Street/Subdivision-"] ?? "")}</div>
                    </div>
                  </div>

                  {/* Action chips row (your existing flow stays in ReportBuilder — this is only UI) */}
                  <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
                    <button
                      onClick={async () => {
                        // directions = show street highlight (same logic you already use)
                        if (!selectedRow) return;
                        setDetailsErr("");
                        if (showStreetHighlight) {
                          setShowStreetHighlight(false);
                          setStreetGeo(null);
                          return;
                        }
                        const data = await fetchStreetGeometryFromSelectedRow(selectedRow);
                        if (data && data.geojson && Array.isArray((data.geojson as any).features) && (data.geojson as any).features.length > 0) {
                          setStreetGeo(data.geojson);
                          setShowStreetHighlight(true);
                        } else {
                          setStreetGeo(null);
                          setShowStreetHighlight(false);
                          setDetailsErr("Street line not found near this pin.");
                        }
                      }}
                      disabled={streetGeoLoading}
                      className="shrink-0 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-extrabold text-gray-800 hover:bg-gray-50"
                    >
                      {streetGeoLoading ? "Finding…" : showStreetHighlight ? "Hide Directions" : "Directions"}
                    </button>

                    {/* These buttons just open the right report drawer (your ReportBuilder already shows Hotels/Nearby/Restaurants/Download) */}
                    <button
                      onClick={() => setRightOpen(true)}
                      className="shrink-0 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-extrabold text-gray-800 hover:bg-gray-50"
                    >
                      Hotels
                    </button>
                    <button
                      onClick={() => setRightOpen(true)}
                      className="shrink-0 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-extrabold text-gray-800 hover:bg-gray-50"
                    >
                      Nearby
                    </button>
                    <button
                      onClick={() => setRightOpen(true)}
                      className="shrink-0 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-extrabold text-gray-800 hover:bg-gray-50"
                    >
                      Restaurants
                    </button>
                    <button
                      onClick={() => setRightOpen(true)}
                      className="shrink-0 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-extrabold text-gray-800 hover:bg-gray-50"
                    >
                      Download
                    </button>
                  </div>

                  {/* Status + errors */}
                  <div className="mt-3 space-y-2">
                    {geoLoading && (
                      <div className="text-xs text-gray-600 flex items-center gap-2">
                        <span className="animate-spin">⟳</span> Geocoding…
                      </div>
                    )}
                    {matchStatus && (
                      <div className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-2xl px-3 py-2">
                        {matchStatus}
                      </div>
                    )}
                    {detailsErr && (
                      <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl px-3 py-2">
                        {detailsErr}
                      </div>
                    )}
                  </div>

                  {/* Quick facts (OpenAI description) */}
                  <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-black text-gray-900">Quick facts about the place</div>
                      {areaDescLoading && <div className="text-[11px] text-gray-500">Generating…</div>}
                    </div>
                    {areaDescErr ? (
                      <div className="text-xs text-red-600 mt-2">{areaDescErr}</div>
                    ) : (
                      <div className="text-sm text-gray-800 mt-2 leading-relaxed">
                        {areaDescription || "Select a property or click the map to generate a short description."}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
