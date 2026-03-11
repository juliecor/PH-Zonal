"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
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
  Zap,
  MapPin,
} from "lucide-react";

import type { Boundary, LatLng, MapType, PoiData, RegionMatch, Row } from "./lib/types";
import { isBadStreet, normalizePH, suggestBusinesses } from "./lib/zonal-util";
import ReportBuilder from "./components/ReportBuilder";
import ZonalSearchIndicator from "./components/ZonalSearchIndicator";

const MapComponent = dynamic(
  async () => {
    if (typeof window !== "undefined" && (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as any)) {
      try {
        return (await import("./components/GMap")).default;
      } catch {
        return (await import("./components/ZonalMap")).default;
      }
    }
    return (await import("./components/ZonalMap")).default;
  },
  { ssr: false }
);

type CompsResp = { ok: true; stats: { min: number | null; median: number | null; max: number | null; count: number }; rows: any[] } | null;

export default function Home() {
  const [regionSearch, setRegionSearch] = useState("");
  const [matches, setMatches] = useState<RegionMatch[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<"province" | "city">("province");
  const [domain, setDomain] = useState("cebu.zonalvalue.com");
  const [selectedProvince, setSelectedProvince] = useState("Cebu");
  const [selectedProvinceCity, setSelectedProvinceCity] = useState("");

  const [facetCities, setFacetCities] = useState<string[]>([]);
  const [facetBarangays, setFacetBarangays] = useState<string[]>([]);
  const [facetsLoading, setFacetsLoading] = useState(false);
  const [barangaysLoading, setBarangaysLoading] = useState(false);

  const [city, setCity] = useState("");
  const [barangay, setBarangay] = useState("");
  const [classification, setClassification] = useState("");
  const [q, setQ] = useState("");

  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(16);
  const [totalRows, setTotalRows] = useState(0);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [hasPrev, setHasPrev] = useState(false);
  const [hasNext, setHasNext] = useState(false);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LatLng | null>(null);
  const [anchorLocation, setAnchorLocation] = useState<LatLng | null>(null);
  const [boundary, setBoundary] = useState<Boundary | null>(null);

  const [mapType, setMapType] = useState<MapType>("street");

  const [geoLabel, setGeoLabel] = useState("");
  const [matchStatus, setMatchStatus] = useState<string>("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [poiLoading, setPoiLoading] = useState(false);
  const [poiData, setPoiData] = useState<PoiData | null>(null);
  const [detailsErr, setDetailsErr] = useState("");
  const [poiRadiusKm, setPoiRadiusKm] = useState(1.5);
  const [areaLabels, setAreaLabels] = useState<Array<{ lat: number; lon: number; name: string }>>([]);

  const [streetGeo, setStreetGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [streetGeoLoading, setStreetGeoLoading] = useState(false);
  const [showStreetHighlight, setShowStreetHighlight] = useState(false);

  const [idealBusinessText, setIdealBusinessText] = useState("");
  const [areaDescription, setAreaDescription] = useState("");
  const [areaDescLoading, setAreaDescLoading] = useState(false);
  const [areaDescErr, setAreaDescErr] = useState("");

  const [comps, setComps] = useState<CompsResp>(null);

  // Improved caching
  const reqIdRef = useRef(0);
  const zonalAbortRef = useRef<AbortController | null>(null);
  const centerCacheRef = useRef<Map<string, { lat: number; lon: number; label: string; boundary?: Boundary | null }>>(new Map());
  const pinpointReqIdRef = useRef(0);
  const filterPinpointRef = useRef(0);
  const noCacheRef = useRef(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // -------- LocalStorage-backed caches --------
  const GEO_LS_KEY = "geoCacheV1";
  const POI_LS_KEY = "poiCacheV1";
  const ZONAL_LS_KEY = "zonalCacheV1";
  const GEO_TTL_MS = 1000 * 60 * 60 * 24 * 14;
  const POI_TTL_MS = 1000 * 60 * 60 * 24 * 7;

  function lsLoad<T = any>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    try {
      const s = window.localStorage.getItem(key);
      if (!s) return fallback;
      return JSON.parse(s) as T;
    } catch {
      return fallback;
    }
  }

  function lsSave<T = any>(key: string, value: T) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  useEffect(() => {
    const bag = lsLoad<Record<string, { ts: number; lat: number; lon: number; label: string; boundary?: Boundary | null }>>(GEO_LS_KEY, {});
    const now = Date.now();
    for (const [k, v] of Object.entries(bag)) {
      if (now - (v?.ts ?? 0) < GEO_TTL_MS && typeof v.lat === "number" && typeof v.lon === "number") {
        centerCacheRef.current.set(k, { lat: v.lat, lon: v.lon, label: v.label || "", boundary: v.boundary ?? null });
      }
    }
  }, []);

  // Allow overriding domain/province via URL query (?domain=negrosoriental.zonalvalue.com&province=NEGROS%20ORIENTAL)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const sp = new URLSearchParams(window.location.search);
      const d = sp.get("domain");
      const p = sp.get("province");
      noCacheRef.current = sp.has("nocache") || sp.get("devNoCache") === "1";
      if (d) {
        setDomain(d);
        setShowRegionPicker(false);
      }
      if (p) {
        setSelectedProvince(p);
      }
    } catch {}
  }, []);

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

  const [leftOpen, setLeftOpen] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [bottomOpen, setBottomOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(true);

  function normalizeCityHint(city: string, province?: string) {
    const c = String(city || "").toUpperCase().trim();
    const p = String(province || "").toUpperCase().trim();
    if (p.includes("CEBU")) {
      if (c.includes("CEBU SOUTH") || c.includes("CEBU NORTH")) return "Cebu City";
    }
    return city;
  }

  // Helper copied from API routes – map hostname subdomain to province name
  function domainToProvince(domain: string): string | null {
    const host = String(domain || "").trim().toLowerCase();
    if (!host) return null;
    const sub = host.split(".")[0] || host;
    if (sub.includes("negrosoriental-siquijor")) return "NEGROS ORIENTAL";
    if (sub.includes("cebu")) return "CEBU";
    if (sub.includes("bohol")) return "BOHOL";
    if (sub.includes("iloilo")) return "ILOILO";
    if (sub.includes("davaodelsur")) return "DAVAO DEL SUR";
    if (sub.includes("davaodelnorte-samal-compostelavalley")) return "DAVAO DEL NORTE";
    if (sub.includes("negrosoriental") || sub.includes("negros-oriental")) return "NEGROS ORIENTAL";
    if (sub.includes("siquijor")) return "SIQUIJOR";
    if (sub.includes("zamboangadelsur")) return "ZAMBOANGA DEL SUR";
    if (sub.includes("agusandelnorte")) return "AGUSAN DEL NORTE";
    if (sub.includes("ncr1stdistrict")) return "NCR";
    if (sub.includes("benguet")) return "BENGUET";
    if (sub.includes("cagayan-batanes")) return "CAGAYAN";
    if (sub.includes("abra")) return "ABRA";
    if (sub.includes("misamisoriental-camiguin")) return "CAMIGUIN-MISAMISORIENTAL";
    if(sub.includes("agusandelsur")) return "AGUSAN DEL SUR";
    if(sub.includes("kalinga-apayao")) return "KALINGA";
    if(sub.includes("aklan")) return "AKLAN";
    if (sub.includes("aurora")) return "AURORA";
    if(sub.includes("laguna")) return "LAGUNA";
    if (sub.includes("lanaodelsur")) return "LANAO DEL SUR";
    if (sub.includes("leyte-bilaran")) return "LEYTE";
    if(sub.includes("mtprovince")) return "MOUNTAIN PROVINCE";
    if(sub.includes("northernsamar")) return "NORTHERN SAMAR";
    if(sub.includes("nuevavizcaya")) return "NUEVA VIZCAYA"; 
    if(sub.includes("quirino")) return "QUIRINO";
    if(sub.includes("southcotabato")) return "SOUTH COTABATO";
    if(sub.includes("tawitawi")) return "TAWI-TAWI";
    if(sub.includes("zamboangadelnorte")) return "ZAMBOANGA DEL NORTE";
    if(sub.includes("zamboangasibugay")) return "ZAMBOANGA SIBUGAY";
    if(sub.includes("zamboangadelsur")) return "ZAMBOANGA DEL SUR";


    return null;
  }

  // keep selectedProvince in sync when domain state is changed programmatically
  useEffect(() => {
    const p = domainToProvince(domain);
    if (p) setSelectedProvince(p);
  }, [domain]);

  function fmtPeso(v: any) {
    const num = parseZonalValueToNumber(v);
    if (!num) return "Not Appraised";
    const s = String(v ?? "").trim();
    return `₱${s}`;
  }

  // Safely parse zonal value strings like "₱15,500.00" or "15,500"
  // Returns null if value is 0, empty, or invalid (treating 0 as missing data)
  function parseZonalValueToNumber(v: any): number | null {
    if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
    const raw = String(v ?? "").trim();
    if (!raw) return null;
    // Remove peso sign, commas, spaces and non-numeric (keep first dot)
    const cleaned = raw
      .replace(/₱/g, "")
      .replace(/,/g, "")
      .replace(/\s+/g, "")
      .replace(/[^0-9.]/g, "");
    if (!cleaned) return null;
    const num = parseFloat(cleaned);
    // Return null if 0 or invalid (0 means no valuation data)
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  function fmtPesoNumber(n: number, opts?: { fractionDigits?: number }) {
    const d = opts?.fractionDigits ?? 0;
    try {
      return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
    } catch {
      return `₱${Math.round(n).toString()}`;
    }
  }

  function fallbackDescribe(payload: { label: string; row?: Row | null; poi?: PoiData | null }) {
    const cityx = String(payload.row?.["City-"] ?? "").trim();
    const brgyx = String(payload.row?.["Barangay-"] ?? "").trim();
    const provx = String(payload.row?.["Province-"] ?? "").trim();
    const cls = String(payload.row?.["Classification-"] ?? "").trim();
    const zvStr = String(payload.row?.["ZonalValuepersqm.-"] ?? "").trim();
    const zv = parseZonalValueToNumber(zvStr);

    const where = [brgyx, cityx, provx].filter(Boolean).join(", ") || payload.label || "Selected location";

    const counts = payload.poi?.counts;
    const lines: string[] = [];
    
    // Location & Classification
    lines.push(`📍 ${where}`);
    if (cls) {
      lines.push(`📋 ${cls}`);
    }

    // Valuation
    if (zv && zv > 0) {
      lines.push(`💰 ₱${zv.toLocaleString()}/sqm (BIR Assessed)`);
    }

    // Market Analysis
    if (counts) {
      const healthcare = (counts.hospitals || 0) + (counts.clinics || 0);
      const education = counts.schools || 0;
      const security = (counts.policeStations || 0) + (counts.fireStations || 0);
      const services = counts.pharmacies || 0;
      const totalServices = healthcare + education + security + services;

      const infraItems: string[] = [];
      if (healthcare > 0) infraItems.push(`${healthcare} healthcare`);
      if (education > 0) infraItems.push(`${education} schools`);
      if (security > 0) infraItems.push(`${security} security`);
      if (services > 0) infraItems.push(`${services} services`);

      if (infraItems.length > 0) {
        lines.push(`🏢 Nearby: ${infraItems.join(", ")}`);
      }

      // Quick investment grade
      let grade = "Limited";
      if (totalServices >= 20) grade = "Excellent";
      else if (totalServices >= 13) grade = "Strong";
      else if (totalServices >= 8) grade = "Moderate";
      else if (totalServices > 0) grade = "Emerging";

      lines.push(`⭐ Investment Grade: ${grade}`);
    }

    return lines.join("\n");
  }

  // Smart search that tries city search first, then province search
  function performSmartSearch(query: string) {
    if (query.length < 2) {
      setMatches([]);
      setSearchMode("province");
      return;
    }

    setSearchLoading(true);
    setErr("");

    // Try city search first (more powerful)
    fetch(`/api/city-search?q=${encodeURIComponent(query)}`)
      .then((res) => res.json())
      .then((data) => {
        const cityMatches = Array.isArray(data?.matches) ? data.matches : [];
        if (cityMatches.length > 0) {
          setSearchMode("city");
          const converted: RegionMatch[] = cityMatches.map((m: any) => ({
            city: m.city,
            province: m.province,
            domain: m.domain,
          }));
          setMatches(converted);
          try {
            const tops = converted.slice(0, 3);
            for (const m of tops) {
              if (m?.domain) loadCities(m.domain).catch(() => {});
            }
          } catch {}
          setSearchLoading(false);
        } else {
          // Fall back to province search
          return fetch(`/api/regions?q=${encodeURIComponent(query)}`);
        }
      })
      .then((res) => res?.json())
      .then((data) => {
        if (data) {
          setSearchMode("province");
          setMatches(data.matches ?? []);
          try {
            const tops = Array.isArray(data.matches) ? data.matches.slice(0, 3) : [];
            for (const m of tops) {
              if (m?.domain) loadCities(m.domain).catch(() => {});
            }
          } catch {}
          setSearchLoading(false);
        }
      })
      .catch((e: any) => {
        setErr(e?.message ?? "Search failed");
        setMatches([]);
        setSearchLoading(false);
      });
  }

  function debouncedSearch(query: string) {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      performSmartSearch(query);
    }, 300);
  }

  // Auto-search as user types
  useEffect(() => {
    if (!regionSearch.trim()) {
      setMatches([]);
      setSearchMode("province");
      return;
    }
    debouncedSearch(regionSearch);
  }, [regionSearch]);

  async function loadCities(forDomain: string) {
    setFacetsLoading(true);
    setErr("");
    try {
      const bag = noCacheRef.current ? {} as Record<string, { ts: number; cities: string[] }> : lsLoad<Record<string, { ts: number; cities: string[] }>>("facetCitiesCacheV1", {});
      const key = String(forDomain || "").toLowerCase();
      const TTL = 1000 * 60 * 60 * 24 * 3;
      const hit = (bag as any)[key];
      if (!noCacheRef.current && hit && Date.now() - (hit.ts ?? 0) < TTL) {
        setFacetCities(hit.cities ?? []);
        return;
      }

      const res = await fetch(`/api/facets?mode=cities&domain=${encodeURIComponent(forDomain)}`);
      if (!res.ok) throw new Error(`Cities failed: ${res.status}`);
      const data = await res.json();
      const cities = Array.isArray(data?.cities) ? data.cities : [];
      setFacetCities(cities);
      try {
        if (!noCacheRef.current) {
          (bag as any)[key] = { ts: Date.now(), cities };
          lsSave("facetCitiesCacheV1", bag);
        }
      } catch {}
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load cities");
      setFacetCities([]);
    } finally {
      setFacetsLoading(false);
    }
  }

  // Ensure facets are loaded for the active domain on mount and whenever domain changes
  useEffect(() => {
    if (!domain) return;
    loadCities(domain).catch(() => {});
  }, [domain]);

  async function loadBarangays(forDomain: string, forCity: string) {
    if (!forCity) {
      setFacetBarangays([]);
      return;
    }
    setBarangaysLoading(true);
    setErr("");
    try {
      const bag = noCacheRef.current ? {} as Record<string, { ts: number; list: string[] }> : lsLoad<Record<string, { ts: number; list: string[] }>>("facetBarangaysCacheV1", {});
      const key = `${String(forDomain || "").toLowerCase()}|${String(forCity || "").toLowerCase()}`;
      const TTL = 1000 * 60 * 60 * 24 * 3;
      const hit = (bag as any)[key];
      if (!noCacheRef.current && hit && Date.now() - (hit.ts ?? 0) < TTL) {
        setFacetBarangays(hit.list ?? []);
        return;
      }

      const res = await fetch(
        `/api/facets?mode=barangays&domain=${encodeURIComponent(forDomain)}&city=${encodeURIComponent(forCity)}`
      );
      if (!res.ok) throw new Error(`Barangays failed: ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data?.barangays) ? data.barangays : [];
      setFacetBarangays(list);
      try {
        if (!noCacheRef.current) {
          (bag as any)[key] = { ts: Date.now(), list };
          lsSave("facetBarangaysCacheV1", bag);
        }
      } catch {}
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

      const cacheKey = params.toString();
      const ZONAL_TTL_MS = 1000 * 60 * 10;
      const bag = noCacheRef.current ? {} as Record<string, { ts: number; payload: any }> : lsLoad<Record<string, { ts: number; payload: any }>>(ZONAL_LS_KEY, {});
      const hit = (bag as any)[cacheKey];
      if (!noCacheRef.current && hit && Date.now() - (hit.ts ?? 0) < ZONAL_TTL_MS) {
        const data = hit.payload;
        setRows(data.rows ?? []);
        setItemsPerPage(Number(data.itemsPerPage ?? 16));
        setTotalRows(Number(data.totalRows ?? 0));
        setPageCount(data.pageCount ?? null);
        setHasPrev(Boolean(data.hasPrev));
        setHasNext(Boolean(data.hasNext));
        if (targetPage !== page) setPage(targetPage);
        return;
      }

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

      try {
        if (!noCacheRef.current) {
          (bag as any)[cacheKey] = { ts: Date.now(), payload: data };
          const keys = Object.keys(bag as any);
          if (keys.length > 80) {
            const sorted = keys
              .map((k) => ({ k, ts: (bag as any)[k]?.ts ?? 0 }))
              .sort((a, b) => a.ts - b.ts)
              .slice(0, Math.max(0, keys.length - 80));
            for (const s of sorted) delete (bag as any)[s.k];
          }
          lsSave(ZONAL_LS_KEY, bag as any);
        }
      } catch {}

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

  async function fetchPoi(lat: number, lon: number, radiusKm?: number) {
    const radius = radiusKm ?? poiRadiusKm;
    const key = `${lat.toFixed(3)}|${lon.toFixed(3)}|${Math.round(radius * 1000)}`;
    const poiBag = lsLoad<Record<string, { ts: number; payload: { ok: true; counts: PoiData["counts"]; items: PoiData["items"] } }>>(POI_LS_KEY, {});
    const hit = poiBag[key];
    if (hit && Date.now() - (hit.ts ?? 0) < POI_TTL_MS) {
      return hit.payload;
    }

    const res = await fetch("/api/poi-counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lon, radius: Math.round(radius * 1000), limit: 120 }),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) throw new Error(data?.error ?? "POI failed");
    const payload = data as { ok: true; counts: PoiData["counts"]; items: PoiData["items"] };
    const updated = { ...poiBag, [key]: { ts: Date.now(), payload } };
    lsSave(POI_LS_KEY, updated);
    return payload;
  }

  async function fetchAreaLabels(lat: number, lon: number) {
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
      const poi = await fetchPoi(selectedLocation.lat, selectedLocation.lon, newKm);
      if (myId !== reqIdRef.current) return;
      setPoiData({ counts: poi.counts, items: poi.items });

      // Try AI-generated business ideas first, fallback to heuristic
      try {
        const aiRes = await fetch("/api/ideal-business", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: String(selectedRow?.["City-"] ?? ""),
            barangay: String(selectedRow?.["Barangay-"] ?? ""),
            province: String(selectedRow?.["Province-"] ?? ""),
            classification: String(selectedRow?.["Classification-"] ?? ""),
            zonalValuePerSqm: String(selectedRow?.["ZonalValuepersqm.-"] ?? ""),
            poiCounts: poi.counts,
          }),
        });
        const aiData = await aiRes.json().catch(() => null);
        if (myId !== reqIdRef.current) return;
        if (aiRes.ok && aiData?.ok && Array.isArray(aiData.businesses) && aiData.businesses.length) {
          // Format detailed business analysis
          const formatted = aiData.businesses.map((biz: any, idx: number) => {
            const lines = [
              `${idx + 1}. ${biz.type || "Business"}`,
              `   Reason: ${biz.reason || "-"}`,
              `   Target Market: ${biz.target_market || "-"}`,
              `   Capital: ${biz.capital_level || "-"}`,
              `   Profit Potential: ${biz.profit_potential || "-"}`,
              `   Suitability: ${biz.suitability_score}/10`,
            ];
            return lines.join("\n");
          }).join("\n\n");
          
          // Append best recommendation if available
          const recommendation = aiData.best_recommendation ? `\n\n✓ BEST OVERALL: ${aiData.best_recommendation}` : "";
          setIdealBusinessText(formatted + recommendation);
        } else {
          const ideas = suggestBusinesses({
            zonalValueText: String(selectedRow?.["ZonalValuepersqm.-"] ?? ""),
            classification: String(selectedRow?.["Classification-"] ?? ""),
            poi,
            barangay: String(selectedRow?.["Barangay-"] ?? ""),
            city: String(selectedRow?.["City-"] ?? ""),
            province: String(selectedRow?.["Province-"] ?? ""),
          });
          setIdealBusinessText(ideas.map((x) => `• ${x}`).join("\n"));
        }
      } catch {
        const ideas = suggestBusinesses({
          zonalValueText: String(selectedRow?.["ZonalValuepersqm.-"] ?? ""),
          classification: String(selectedRow?.["Classification-"] ?? ""),
          poi,
          barangay: String(selectedRow?.["Barangay-"] ?? ""),
          city: String(selectedRow?.["City-"] ?? ""),
          province: String(selectedRow?.["Province-"] ?? ""),
        });
        setIdealBusinessText(ideas.map((x) => `• ${x}`).join("\n"));
      }

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

  // NEW: Pinpoint on filter changes (region/city/barangay)
  async function pinpointFilterLocation(filterCity?: string, filterBarangay?: string, filterProvince?: string) {
    const myId = ++filterPinpointRef.current;

    setGeoLoading(true);
    setSelectedRow(null);
    setPoiData(null);
    setDetailsErr("");
    setAreaDescription("");
    setAreaDescErr("");

    try {
      const query = filterBarangay
        ? `${filterBarangay}, ${filterCity}, ${filterProvince}, Philippines`
        : filterCity
        ? `${filterCity}, ${filterProvince}, Philippines`
        : `${filterProvince}, Philippines`;

      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query,
          hintBarangay: filterBarangay || "",
          hintCity: filterCity || "",
          hintProvince: filterProvince || "",
        }),
      });

      const data = await res.json().catch(() => null);
      if (myId !== filterPinpointRef.current) return;
      if (!res.ok || !data?.ok) {
        console.log("Geocode failed for filter:", query);
        return;
      }

      setSelectedLocation({ lat: Number(data.lat), lon: Number(data.lon) });
      setGeoLabel(data.displayName || query);
      setMatchStatus(`✓ ${filterBarangay ? "Barangay" : filterCity ? "City" : "Province"} center`);
      setBoundary((data.boundary as Boundary | null) ?? null);

      // Pre-warm POI in background
      try {
        await fetchPoi(Number(data.lat), Number(data.lon));
      } catch {}
    } catch (e: any) {
      console.log("Pinpoint filter error:", e?.message);
    } finally {
      if (myId === filterPinpointRef.current) {
        setGeoLoading(false);
      }
    }
  }

  async function geocodeWithZonalData(args: {
    query: string;
    street?: string;
    barangay?: string;
    city?: string;
    province?: string;
    baseLatLon?: { lat: number; lon: number } | null;
  }) {
    const qx = normalizePH(args.query);
    const key = `${qx}|${args.street}|${args.barangay}|${args.city}|${args.province}|${args.baseLatLon?.lat ?? ""},${args.baseLatLon?.lon ?? ""}`.toLowerCase();

    const cached = centerCacheRef.current.get(key);
    if (cached) return cached;

    const res = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: qx,
        street: args.street ?? "",
        hintBarangay: args.barangay ?? "",
        hintCity: args.city ?? "",
        hintProvince: args.province ?? "",
        baseLatLon: args.baseLatLon ?? null,
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
    const bag = lsLoad<Record<string, { ts: number; lat: number; lon: number; label: string; boundary?: Boundary | null }>>(GEO_LS_KEY, {});
    bag[key] = { ts: Date.now(), lat: payload.lat, lon: payload.lon, label: payload.label, boundary: payload.boundary ?? null };
    lsSave(GEO_LS_KEY, bag);
    return payload;
  }

  async function describeArea(payload: { lat: number; lon: number; label: string; row?: Row | null; poi?: PoiData | null }) {
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

      setAreaDescErr("");
      setAreaDescription(String(data.text ?? "").trim());
    } catch {
      setAreaDescErr("");
      setAreaDescription(fallbackDescribe({ label: payload.label, row: payload.row ?? null, poi: payload.poi ?? null }));
    } finally {
      setAreaDescLoading(false);
    }
  }

  async function loadPoiIndependent(lat: number, lon: number, row: Row | null, labelForDesc: string) {
    const myId = reqIdRef.current;
    setPoiLoading(true);
    setDetailsErr("");
    try {
      const poi = await fetchPoi(lat, lon);
      if (myId !== reqIdRef.current) return;
      setPoiData({ counts: poi.counts, items: poi.items });

      // Try AI-generated business ideas first, fallback to heuristic
      try {
        const aiRes = await fetch("/api/ideal-business", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: String(row?.["City-"] ?? ""),
            barangay: String(row?.["Barangay-"] ?? ""),
            province: String(row?.["Province-"] ?? ""),
            classification: String(row?.["Classification-"] ?? ""),
            zonalValuePerSqm: String(row?.["ZonalValuepersqm.-"] ?? ""),
            poiCounts: poi.counts,
          }),
        });
        const aiData = await aiRes.json().catch(() => null);
        if (myId !== reqIdRef.current) return;
        if (aiRes.ok && aiData?.ok && Array.isArray(aiData.businesses) && aiData.businesses.length) {
          // Format detailed business analysis
          const formatted = aiData.businesses.map((biz: any, idx: number) => {
            const lines = [
              `${idx + 1}. ${biz.type || "Business"}`,
              `   Reason: ${biz.reason || "-"}`,
              `   Target Market: ${biz.target_market || "-"}`,
              `   Capital: ${biz.capital_level || "-"}`,
              `   Profit Potential: ${biz.profit_potential || "-"}`,
              `   Suitability: ${biz.suitability_score}/10`,
            ];
            return lines.join("\n");
          }).join("\n\n");
          
          // Append best recommendation if available
          const recommendation = aiData.best_recommendation ? `\n\n✓ BEST OVERALL: ${aiData.best_recommendation}` : "";
          setIdealBusinessText(formatted + recommendation);
        } else {
          const ideas = suggestBusinesses({
            zonalValueText: String(row?.["ZonalValuepersqm.-"] ?? ""),
            classification: String(row?.["Classification-"] ?? ""),
            poi,
            barangay: String(row?.["Barangay-"] ?? ""),
            city: String(row?.["City-"] ?? ""),
            province: String(row?.["Province-"] ?? ""),
          });
          setIdealBusinessText(ideas.map((x) => `• ${x}`).join("\n"));
        }
      } catch {
        const ideas = suggestBusinesses({
          zonalValueText: String(row?.["ZonalValuepersqm.-"] ?? ""),
          classification: String(row?.["Classification-"] ?? ""),
          poi,
          barangay: String(row?.["Barangay-"] ?? ""),
          city: String(row?.["City-"] ?? ""),
          province: String(row?.["Province-"] ?? ""),
        });
        setIdealBusinessText(ideas.map((x) => `• ${x}`).join("\n"));
      }

      describeArea({
        lat,
        lon,
        label: labelForDesc,
        row,
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

    // Sync city and barangay filters to match the selected row
    const rowCity = String(r["City-"] ?? "");
    const rowBarangay = String(r["Barangay-"] ?? "");
    if (rowCity && rowCity !== city) {
      setCity(rowCity);
    }
    if (rowBarangay && rowBarangay !== barangay) {
      setBarangay(rowBarangay);
    }
    // Reload barangays for this city if needed
    if (rowCity && (!facetBarangays.length || rowCity !== city)) {
      loadBarangays(domain, rowCity);
    }

    // On mobile, collapse panels to focus on the map
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      setLeftOpen(false);
      setBottomOpen(true); // keep bottom sheet expanded so value is visible
    } else {
      setBottomOpen(true);
    }

    setGeoLoading(true);
    try {
      // Extract zonal data coordinates
      const zonalLat = (r as any)?.["latitude"] ?? (r as any)?.lat ?? null;
      const zonalLon = (r as any)?.["longitude"] ?? (r as any)?.lon ?? null;
      const baseLatLon = zonalLat != null && zonalLon != null && Number.isFinite(zonalLat) && Number.isFinite(zonalLon)
        ? { lat: Number(zonalLat), lon: Number(zonalLon) }
        : null;

      const rawStreet = String(r["Street/Subdivision-"] ?? "").trim();
      const street = normalizePH(rawStreet);
      const vicinity = normalizePH(r["Vicinity-"]);
      const rawRowBarangay = String(r["Barangay-"] ?? "").trim();
      const isAllAreas = /^(all\s*areas?|all)$/i.test(rawStreet) || /^(all\s*areas?|all)$/i.test(rawRowBarangay);
      // If the row has blank/"ALL AREAS" barangay, fallback to current filter barangay
      const brgy = (rawRowBarangay && !/^(all\s*areas?|all)$/i.test(rawRowBarangay)) ? rawRowBarangay : (barangay || rawRowBarangay);
      const cty = normalizeCityHint(String(r["City-"] ?? ""), String(r["Province-"] ?? ""));
      const prov = r["Province-"];

      // Use Google's smart pinpointing with zonal data as anchor
      const location = await geocodeWithZonalData({
        // When street is empty or "ALL AREAS", query only by barangay/city/province to avoid city-centroid fallbacks
        query: (isAllAreas || !street ? [brgy, cty, prov] : [street, brgy, cty, prov]).filter(Boolean).join(", "),
        street: !isAllAreas && street ? street : undefined,
        barangay: brgy || undefined,
        city: cty || undefined,
        province: prov || undefined,
        baseLatLon,
      });

      if (myId !== reqIdRef.current) return;

      const finalLoc = location || baseLatLon || { lat: 10.3085, lon: 123.8906 };
      setSelectedLocation({ lat: finalLoc.lat, lon: finalLoc.lon });
      setGeoLabel(location?.label || `${street && !isAllAreas ? street : (brgy || cty)}, ${cty}`);
      setMatchStatus(street && !isAllAreas ? "✓ Pinpointed to street" : "✓ Pinpointed to barangay");

      // Load POIs immediately
      loadPoiIndependent(finalLoc.lat, finalLoc.lon, r, location?.label || `${street || brgy}, ${cty}`);
      setAreaLabels([]);
    } catch (e: any) {
      if (myId !== reqIdRef.current) return;
      setDetailsErr(e?.message ?? "Failed to load details");
    } finally {
      if (myId !== reqIdRef.current) return;
      setGeoLoading(false);
    }
  }

  async function selectLocationFromMap(lat: number, lon: number) {
    const myId = ++reqIdRef.current;

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

    setBottomOpen(true);

    try {
      loadPoiIndependent(lat, lon, null, `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      setAreaLabels([]);
    } catch (e: any) {
      if (myId !== reqIdRef.current) return;
      setDetailsErr(e?.message ?? "Failed to load POI");
    } finally {
      if (myId !== reqIdRef.current) return;
    }
  }

  // Trigger search when domain/filters change
  useEffect(() => {
    const t = setTimeout(() => {
      if (!domain) return;
      searchZonal({ page: 1 });
    }, 350);
    return () => clearTimeout(t);
  }, [domain, city, barangay, classification, q]);

  const showingFrom = totalRows ? (page - 1) * itemsPerPage + 1 : 0;
  const showingTo = totalRows ? Math.min(page * itemsPerPage, totalRows) : rows.length;

  const selectedTitle = selectedRow
    ? `${String(selectedRow["Barangay-"] ?? "")}, ${String(selectedRow["City-"] ?? "")}, ${String(selectedRow["Province-"] ?? "")}`
    : geoLabel || "Select a property";



  return (
    <main className="h-screen w-screen overflow-hidden bg-slate-100 text-gray-900">
      <ZonalSearchIndicator visible={loading} />

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

      {/* Top Bar Logo */}
      <div className="absolute top-4 left-16 sm:left-1/3 z-30">
        <Link
          href="/welcome"
          title="Go to Home"
          className="rounded-2xl bg-white/95 backdrop-blur border border-gray-200 shadow-lg px-3 py-2 flex items-center gap-3 hover:shadow-xl transition cursor-pointer"
        >
          <Image
            src="/pictures/FilipinoHomes.png"
            alt="Filipino Homes"
            width={160}
            height={36}
            className="h-8 sm:h-10 w-auto"
            priority
          />
          <div className="hidden md:block text-xs text-gray-500 border-l pl-3">
            <div className="font-semibold text-gray-700 leading-tight">Zonal Value</div>
            <div className="leading-tight">{domain}</div>
          </div>
        </Link>
      </div>

      {/* Map Type Buttons */}
      <div className="absolute top-4 right-4 z-30">
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-gray-200 p-1.5 flex gap-1">
          <button
            onClick={() => setMapType("street")}
            className={`p-2 rounded-xl transition ${
              mapType === "street" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
            title="Street Map"
          >
            <MapIcon size={18} />
          </button>
          <button
            onClick={() => setMapType("terrain")}
            className={`p-2 rounded-xl transition ${
              mapType === "terrain" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
            title="Terrain Map"
          >
            <TerrainIcon size={18} />
          </button>
          <button
            onClick={() => setMapType("satellite")}
            className={`p-2 rounded-xl transition ${
              mapType === "satellite" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
            title="Satellite Map"
          >
            <SatelliteIcon size={18} />
          </button>
        </div>
      </div>

      {/* LEFT DRAWER */}
      <div className="absolute top-0 left-0 z-40 h-full flex">
        <div
          className={[
            "h-full bg-white/95 backdrop-blur border-r border-gray-200 shadow-2xl transition-all duration-300",
            leftOpen ? "w-full sm:w-[400px]" : "w-0",
          ].join(" ")}
        >
          {leftOpen && (
            <div className="h-full flex flex-col">
              {/* Search header */}
              <div className="p-4 pb-3 border-b border-gray-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-sm font-black text-gray-900">🏘️ Property Search</h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-900" size={18} />
                      <input
                        value={regionSearch}
                        onChange={(e) => setRegionSearch(e.target.value)}
                        placeholder="Search city or province…"
                        className="w-full rounded-xl border-2 border-blue-200 bg-white px-10 py-2.5 text-sm text-gray-900 placeholder-gray-500 shadow-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                      />
                      {searchLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin">
                          <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                        </div>
                      )}
                      {regionSearch && !searchLoading && (
                        <button
                          onClick={() => setRegionSearch("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                          title="Clear"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Toolbar */}
                <div className="mt-3 flex items-center justify-between">
                  <button
                    onClick={() => setShowFilters((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <SlidersHorizontal size={16} />
                    Filters
                  </button>

                  {/* cache refresh button for development */}
                  <button
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        localStorage.removeItem('facetCitiesCacheV1');
                        localStorage.removeItem('facetBarangaysCacheV1');
                        localStorage.removeItem('zonalCacheV1');
                        loadCities(domain).catch(() => {});
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    title="Clear cached facet lists and reload"
                  >
                    🔄
                    Refresh
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

                {/* Region picker results */}
                {(showRegionPicker || (regionSearch.length > 0 && matches.length > 0)) && (
                  <div className="mt-3">
                    {searchLoading ? (
                      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-4 w-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                          <span className="text-sm text-gray-600">Searching...</span>
                        </div>
                      </div>
                    ) : matches.length > 0 ? (
                      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                        <div className="px-4 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-700">
                          {searchMode === "city" ? "📍 Cities Found" : "🗺️ Provinces Found"} ({matches.length})
                        </div>
                        <div className="max-h-56 overflow-auto">
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
                                setRegionSearch("");

                                await loadCities(m.domain);
                                searchZonal({ page: 1 });

                                // Pinpoint to region center
                                await pinpointFilterLocation(m.city, "", m.province);

                                setShowRegionPicker(false);
                                setShowFilters(true);
                              }}
                            >
                              <div className="font-semibold text-gray-900">
                                {m.province} {searchMode === "city" ? `→ ${m.city}` : ""}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">{m.domain}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : regionSearch.length >= 2 ? (
                      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 text-center">
                        <div className="text-sm text-gray-600">
                          ❌ No results found for "<strong>{regionSearch}</strong>"
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          Try searching by province or city name
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Filters */}
                {showFilters && (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-2">City</label>
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

                            // Pinpoint to city
                            if (nextCity) {
                              pinpointFilterLocation(nextCity, "", selectedProvince);
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

                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-2">Barangay</label>
                        <select
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={barangay}
                          onChange={(e) => {
                            const nextBrgy = e.target.value;
                            setBarangay(nextBrgy);
                            setShowStreetHighlight(false);
                            setStreetGeo(null);
                            setPage(1);

                            // Pinpoint to barangay
                            if (city && nextBrgy) {
                              pinpointFilterLocation(city, nextBrgy, selectedProvince);
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
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-2">Classification</label>
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
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-2">Street / Vicinity</label>
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
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => searchZonal({ page: 1 })}
                        disabled={loading}
                        className="flex-1 rounded-xl bg-blue-600 text-white px-4 py-2.5 text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <>
                            <Zap size={14} className="animate-spin" />
                            Searching…
                          </>
                        ) : (
                          "Search"
                        )}
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
                <div className="px-4 py-3 sticky top-0 bg-gradient-to-r from-blue-50 to-indigo-50 backdrop-blur border-b border-gray-200 flex items-center justify-between">
                  <div className="text-xs font-black tracking-widest text-gray-900 flex items-center gap-2 uppercase">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm">
                      📊
                    </div>
                    Results {loading && <Zap size={14} className="animate-spin text-orange-500 ml-1" />}
                  </div>
                  <div className="text-[11px] font-semibold text-gray-700 bg-white px-2.5 py-1 rounded-lg border border-blue-200">
                    {totalRows ? (
                      <>
                        <span className="text-blue-600">#{showingFrom.toLocaleString()}–{showingTo.toLocaleString()}</span>
                        <span className="text-gray-600"> of </span>
                        <span className="text-blue-600 font-bold">{totalRows.toLocaleString()}</span>
                      </>
                    ) : (
                      "No results"
                    )}
                  </div>
                </div>

                <div className="space-y-2 px-2">
                  {rows.map((r, i) => {
                    const parsed = parseZonalValueToNumber(r["ZonalValuepersqm.-"]);
                    const pricePerSqm = parsed ?? 0;
                    const priceTier = pricePerSqm > 100000 ? 'prime' : pricePerSqm > 50000 ? 'high' : pricePerSqm > 20000 ? 'mid' : 'value';
                    const tierColor = priceTier === 'prime' ? 'from-amber-500 to-orange-600' : priceTier === 'high' ? 'from-indigo-500 to-violet-600' : priceTier === 'mid' ? 'from-emerald-500 to-green-600' : 'from-slate-500 to-gray-600';
                    const tierLabel = priceTier === 'prime' ? '💎 Prime' : priceTier === 'high' ? '⬆️ High-Value' : priceTier === 'mid' ? '✓ Mid‑Market' : 'Value';

                    return (
                      <button
                        key={`${r.rowIndex}-${i}`}
                        onClick={() => selectRow(r)}
                        className={[
                          "w-full text-left rounded-2xl border-2 p-3 transition-all duration-200",
                          selectedRow?.rowIndex === r.rowIndex 
                            ? `border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 shadow-md` 
                            : `border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm hover:bg-gradient-to-br hover:from-blue-50 hover:to-gray-50`,
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-black text-[13px] text-gray-900 truncate">
                              {String(r["Street/Subdivision-"] ?? "").slice(0, 44) || "Unnamed"}
                            </div>
                            <div className="text-[11px] text-gray-600 mt-0.5">
                              {String(r["Barangay-"] ?? "")}, {String(r["City-"] ?? "")}
                            </div>
                          </div>
                          <div className={`px-2 py-1 rounded-lg text-[10px] font-bold bg-gradient-to-r ${tierColor} text-white whitespace-nowrap`}>
                            {tierLabel}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                          <div className="flex items-baseline gap-1">
                            {parsed != null ? (
                              <>
                                <span className="text-xs text-gray-600">₱</span>
                                <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-800">{pricePerSqm.toLocaleString('en-PH')}</span>
                                <span className="text-[10px] text-gray-500">per sqm</span>
                              </>
                            ) : (
                              <span className="text-[11px] text-gray-500 font-medium">Not Appraised</span>
                            )}
                          </div>
                          <div className="text-[11px] font-semibold text-gray-500">
                            #{i + 1 + (page - 1) * 10}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-gray-200 flex items-center justify-between gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 backdrop-blur">
                  <button
                    onClick={() => searchZonal({ page: Math.max(1, page - 1) })}
                    disabled={loading || !hasPrev}
                    className="flex-1 rounded-xl border-2 border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-blue-100 hover:border-blue-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Previous
                  </button>
                  <div className="text-[11px] text-gray-700 font-semibold px-2 py-1.5 bg-white rounded-lg border border-gray-200">
                    <span className="text-blue-600 font-black">{page}</span>
                    {pageCount ? <> / <span className="text-blue-600 font-black">{pageCount}</span></> : null}
                  </div>
                  <button
                    onClick={() => searchZonal({ page: page + 1 })}
                    disabled={loading || !hasNext}
                    className="flex-1 rounded-xl border-2 border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-blue-100 hover:border-blue-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next →
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

      {/* RIGHT REPORT DRAWER */}
      <div className={["absolute top-0 right-0 z-40 h-full transition-all duration-300", rightOpen ? "w-[360px] sm:w-[420px]" : "w-0"].join(" ")}>
        {rightOpen && (
          <div className="h-full bg-white/95 backdrop-blur border-l border-gray-200 shadow-2xl">
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg">📋</div>
                  <div className="text-sm font-black text-gray-900">Property Report</div>
                </div>
                <button onClick={() => setRightOpen(false)} className="rounded-xl p-2 hover:bg-blue-200 transition text-gray-700" title="Close">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-3">
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

      {/* BOTTOM SHEET */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-[92vw] sm:w-[560px]">
        <div
          className={[
            "rounded-3xl border-2 border-gray-200 bg-white/98 backdrop-blur shadow-2xl overflow-hidden transition-all duration-300",
            bottomOpen ? "max-h-[38vh]" : "max-h-[52px]",
          ].join(" ")}
        >
          <button onClick={() => setBottomOpen((v) => !v)} className="w-full px-4 py-3 flex items-center justify-between hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition">
            <div className="min-w-0 text-left">
              <div className="text-[10px] text-gray-500 font-black uppercase tracking-wider">📌 Selected Property</div>
              <div className="text-sm font-black text-gray-900 truncate">{selectedTitle}</div>
            </div>
            <div className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-lg">{bottomOpen ? "▼" : "▶"}</div>
          </button>

          {bottomOpen && (
            <div className="px-4 pb-3">
              {!selectedRow ? (
                <div className="text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-blue-600" />
                    {geoLoading ? "Finding location..." : "Select a region, city, barangay, or click on a street from the list"}
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white p-4 flex items-center justify-between shadow-lg border border-blue-400/30">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">💰 Zonal Value</div>
                      <div className="text-3xl font-black mt-1 drop-shadow-lg">{fmtPeso(selectedRow["ZonalValuepersqm.-"])}</div>
                      <div className="text-[11px] opacity-90 font-semibold">per square meter</div>
                    </div>
                    <div className="text-right text-[11px] opacity-90 font-semibold">
                      <div className="font-bold text-lg">{String(selectedRow["City-"] ?? "")}</div>
                      <div>{String(selectedRow["Barangay-"] ?? "")}</div>
                      <div className="truncate max-w-[200px] text-xs">{String(selectedRow["Street/Subdivision-"] ?? "")}</div>
                    </div>
                  </div>

                  {/* Directions ONLY */}
                  <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
                    <button
                      onClick={async () => {
                        if (!selectedRow) return;
                        setDetailsErr("");
                        if (showStreetHighlight) {
                          setShowStreetHighlight(false);
                          setStreetGeo(null);
                          return;
                        }
                        const data = await fetchStreetGeometryFromSelectedRow(selectedRow);
                        if (
                          data &&
                          data.geojson &&
                          Array.isArray((data.geojson as any).features) &&
                          (data.geojson as any).features.length > 0
                        ) {
                          setStreetGeo(data.geojson);
                          setShowStreetHighlight(true);
                        } else {
                          setStreetGeo(null);
                          setShowStreetHighlight(false);
                          setDetailsErr("Street line not found near this pin.");
                        }
                      }}
                      disabled={streetGeoLoading}
                      className="shrink-0 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-extrabold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {streetGeoLoading ? "Finding…" : showStreetHighlight ? "Hide Street" : "Highlight Street"}
                    </button>

                    <button
                      onClick={() => setRightOpen(true)}
                      className="shrink-0 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-extrabold text-gray-800 hover:bg-gray-50"
                      title="Open report"
                    >
                      Open Report
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {geoLoading && (
                      <div className="text-xs text-gray-600 flex items-center gap-2">
                        <span className="animate-spin">⟳</span> Pinpointing…
                      </div>
                    )}
                    {matchStatus && (
                      <div className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-2xl px-3 py-2 flex items-center gap-2">
                        <MapPin size={12} />
                        {matchStatus}
                      </div>
                    )}
                    {detailsErr && (
                      <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl px-3 py-2">{detailsErr}</div>
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