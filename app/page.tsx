"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import * as GeoJSON from 'geojson';
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
import { useRouter } from "next/navigation";
import { apiMe } from "./lib/authClient";

import type { Boundary, LatLng, MapType, PoiData, RegionMatch, Row } from "./lib/types";
import { normalizePH, suggestBusinesses } from "./lib/zonal-util";
import ReportBuilder from "./components/ReportBuilder";
import ZonalSearchIndicator from "./components/ZonalSearchIndicator";

// ─── Golden house icon (cobalt bg + gold house) ───────────────────────────────
function ZonalHouseIcon({ size = 30, onClick }: { size?: number; onClick?: () => void }) {
  return (
    <button onClick={onClick} title="Go to Dashboard" style={{ background: "none", border: "none", padding: 0, cursor: onClick ? "pointer" : "default", display: "flex", alignItems: "center", flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="8" fill="#1e3a8a" />
        <path d="M20 9L8 19.5H11V31H17.5V24H22.5V31H29V19.5H32L20 9Z" fill="#c9a84c" stroke="#c9a84c" strokeWidth="0.5" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

const MapComponent = dynamic(
  async () => {
    if (typeof window !== "undefined" && (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as any)) {
      try { return (await import("./components/GMap")).default; }
      catch { return (await import("./components/ZonalMap")).default; }
    }
    return (await import("./components/ZonalMap")).default;
  },
  { ssr: false }
);

type CompsResp = { ok: true; stats: { min: number | null; median: number | null; max: number | null; count: number }; rows: any[] } | null;

function getPriceTier(p: number) {
  if (p > 100_000) return { label: "Prime",      bg: "bg-amber-100",   text: "text-amber-800",   dot: "bg-amber-400"   };
  if (p > 50_000)  return { label: "High-value", bg: "bg-violet-100",  text: "text-violet-800",  dot: "bg-violet-400"  };
  if (p > 20_000)  return { label: "Mid-market", bg: "bg-emerald-100", text: "text-emerald-800", dot: "bg-emerald-400" };
  return                  { label: "Value",      bg: "bg-[#c9a84c]/10", text: "text-[#9a7a20]",  dot: "bg-[#c9a84c]"  };
}

export function Home() {
  const router = useRouter();

  const [me, setMe] = useState<any>(null);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const u = await apiMe();
        setMe(u);
        if (u && typeof u.token_balance !== "undefined") {
          const b = Number(u.token_balance);
          setTokenBalance(Number.isFinite(b) ? b : 0);
        }
      } catch {}
    })();
  }, []);

  const [emailOpen, setEmailOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
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

  const reqIdRef = useRef(0);
  const zonalAbortRef = useRef<AbortController | null>(null);
  const centerCacheRef = useRef<Map<string, { lat: number; lon: number; label: string; boundary?: Boundary | null }>>(new Map());
  const pinpointReqIdRef = useRef(0);
  const filterPinpointRef = useRef(0);
  const noCacheRef = useRef(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const citiesReqGenerationRef = useRef(0);

  const GEO_LS_KEY   = "geoCacheV1";
  const POI_LS_KEY   = "poiCacheV1";
  const ZONAL_LS_KEY = "zonalCacheV1";
  const GEO_TTL_MS   = 1000 * 60 * 60 * 24 * 14;
  const POI_TTL_MS   = 1000 * 60 * 60 * 24 * 7;

  function lsLoad<T = any>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    try { const s = window.localStorage.getItem(key); if (!s) return fallback; return JSON.parse(s) as T; }
    catch { return fallback; }
  }
  function lsSave<T = any>(key: string, value: T) {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const sp = new URLSearchParams(window.location.search);
      const d = sp.get("domain"); const p = sp.get("province");
      noCacheRef.current = sp.has("nocache") || sp.get("devNoCache") === "1";
      if (d) { setDomain(d); setShowRegionPicker(false); }
      if (p) setSelectedProvince(p);
      if (sp.has("openBuilder")) {
        const lat = Number(sp.get("lat") || ""); const lon = Number(sp.get("lon") || "");
        const label = sp.get("label") || "Selected location";
        if (Number.isFinite(lat) && Number.isFinite(lon)) { setSelectedLocation({ lat, lon }); setAnchorLocation({ lat, lon }); setGeoLabel(label!); }
        else if (sp.get("q")) setQ(sp.get("q") || "");
        setRightOpen(true);
        setAutoPreview(sp.get("autopreview") === "1" || sp.get("autopreview") === "true");
      }
    } catch {}
  }, []);

  const columns = useMemo(() => ["Street/Subdivision-","Vicinity-","Barangay-","City-","Province-","Classification-","ZonalValuepersqm.-"], []);

  const [leftOpen, setLeftOpen] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [bottomOpen, setBottomOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [autoPreview, setAutoPreview] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(true);

  function normalizeCityHint(city: string, province?: string) {
    const c = String(city || "").toUpperCase().trim();
    const p = String(province || "").toUpperCase().trim();
    if (p.includes("CEBU") && (c.includes("CEBU SOUTH") || c.includes("CEBU NORTH"))) return "Cebu City";
    return city;
  }

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
    if (sub.includes("agusandelsur")) return "AGUSAN DEL SUR";
    if (sub.includes("kalinga-apayao")) return "KALINGA";
    if (sub.includes("aklan")) return "AKLAN";
    if (sub.includes("aurora")) return "AURORA";
    if (sub.includes("laguna")) return "LAGUNA";
    if (sub.includes("lanaodelsur")) return "LANAO DEL SUR";
    if (sub.includes("leyte-bilaran")) return "LEYTE";
    if (sub.includes("mtprovince")) return "MOUNTAIN PROVINCE";
    if (sub.includes("northernsamar")) return "NORTHERN SAMAR";
    if (sub.includes("nuevavizcaya")) return "NUEVA VIZCAYA";
    if (sub.includes("quirino")) return "QUIRINO";
    if (sub.includes("southcotabato")) return "SOUTH COTABATO";
    if (sub.includes("tawitawi")) return "TAWI-TAWI";
    if (sub.includes("zamboangadelnorte")) return "ZAMBOANGA DEL NORTE";
    if (sub.includes("zamboangasibugay")) return "ZAMBOANGA SIBUGAY";
    if (sub.includes("zamboangadelsur")) return "ZAMBOANGA DEL SUR";
    return null;
  }

  useEffect(() => { const p = domainToProvince(domain); if (p) setSelectedProvince(p); }, [domain]);

  function fmtPeso(v: any) { const num = parseZonalValueToNumber(v); if (!num) return "Not Appraised"; return `₱${String(v ?? "").trim()}`; }

  function parseZonalValueToNumber(v: any): number | null {
    if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
    const raw = String(v ?? "").trim(); if (!raw) return null;
    const cleaned = raw.replace(/₱/g,"").replace(/,/g,"").replace(/\s+/g,"").replace(/[^0-9.]/g,"");
    if (!cleaned) return null;
    const num = parseFloat(cleaned);
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  function fmtPesoNumber(n: number, opts?: { fractionDigits?: number }) {
    const d = opts?.fractionDigits ?? 0;
    try { return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: d, maximumFractionDigits: d })}`; }
    catch { return `₱${Math.round(n).toString()}`; }
  }

  function fallbackDescribe(payload: { label: string; row?: Row | null; poi?: PoiData | null }) {
    const cityx = String(payload.row?.["City-"] ?? "").trim();
    const brgyx = String(payload.row?.["Barangay-"] ?? "").trim();
    const provx = String(payload.row?.["Province-"] ?? "").trim();
    const cls   = String(payload.row?.["Classification-"] ?? "").trim();
    const zv    = parseZonalValueToNumber(String(payload.row?.["ZonalValuepersqm.-"] ?? "").trim());
    const where = [brgyx, cityx, provx].filter(Boolean).join(", ") || payload.label || "Selected location";
    const counts = payload.poi?.counts;
    const lines: string[] = [];
    lines.push(`📍 ${where}`);
    if (cls) lines.push(`📋 ${cls}`);
    if (zv && zv > 0) lines.push(`💰 ₱${zv.toLocaleString()}/sqm (BIR Assessed)`);
    if (counts) {
      const healthcare = (counts.hospitals||0)+(counts.clinics||0); const education = counts.schools||0;
      const security = (counts.policeStations||0)+(counts.fireStations||0); const services = counts.pharmacies||0;
      const total = healthcare+education+security+services;
      const infraItems: string[] = [];
      if (healthcare>0) infraItems.push(`${healthcare} healthcare`);
      if (education>0)  infraItems.push(`${education} schools`);
      if (security>0)   infraItems.push(`${security} security`);
      if (services>0)   infraItems.push(`${services} services`);
      if (infraItems.length>0) lines.push(`🏢 Nearby: ${infraItems.join(", ")}`);
      let grade = "Limited";
      if (total>=20) grade="Excellent"; else if (total>=13) grade="Strong"; else if (total>=8) grade="Moderate"; else if (total>0) grade="Emerging";
      lines.push(`⭐ Investment Grade: ${grade}`);
    }
    return lines.join("\n");
  }

  function performSmartSearch(query: string) {
    if (query.length < 2) { setMatches([]); setSearchMode("province"); return; }
    setSearchLoading(true); setErr("");
    fetch(`/api/city-search?q=${encodeURIComponent(query)}`).then(res=>res.json()).then(data=>{
      const cityMatches = Array.isArray(data?.matches) ? data.matches : [];
      if (cityMatches.length > 0) {
        setSearchMode("city");
        const converted: RegionMatch[] = cityMatches.map((m: any)=>({ city:m.city, province:m.province, domain:m.domain }));
        setMatches(converted);
        try { const gen=citiesReqGenerationRef.current; for (const m of converted.slice(0,3)) { if (m?.domain) loadCities(m.domain,gen).catch(()=>{}); } } catch {}
        setSearchLoading(false);
      } else { return fetch(`/api/regions?q=${encodeURIComponent(query)}`); }
    }).then(res=>res?.json()).then(data=>{
      if (data) {
        setSearchMode("province"); setMatches(data.matches??[]);
        try { const gen=citiesReqGenerationRef.current; for (const m of (Array.isArray(data.matches)?data.matches.slice(0,3):[])) { if (m?.domain) loadCities(m.domain,gen).catch(()=>{}); } } catch {}
        setSearchLoading(false);
      }
    }).catch((e:any)=>{ setErr(e?.message??"Search failed"); setMatches([]); setSearchLoading(false); });
  }

  function debouncedSearch(query: string) {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(()=>performSmartSearch(query), 300);
  }

  useEffect(()=>{ if (!regionSearch.trim()){setMatches([]);setSearchMode("province");return;} debouncedSearch(regionSearch); }, [regionSearch]);

  async function loadCities(forDomain: string, forGeneration?: number) {
    setFacetsLoading(true); setErr("");
    const generation = forGeneration ?? citiesReqGenerationRef.current;
    try {
      const bag = noCacheRef.current ? {} as Record<string,{ts:number;cities:string[]}> : lsLoad<Record<string,{ts:number;cities:string[]}>>("facetCitiesCacheV1",{});
      const key = String(forDomain||"").toLowerCase();
      const hit = (bag as any)[key];
      if (!noCacheRef.current && hit && Date.now()-(hit.ts??0)<1000*60*60*24*3) { if (generation===citiesReqGenerationRef.current) setFacetCities(hit.cities??[]); return; }
      const res = await fetch(`/api/facets?mode=cities&domain=${encodeURIComponent(forDomain)}`);
      if (!res.ok) throw new Error(`Cities failed: ${res.status}`);
      const data = await res.json(); const cities = Array.isArray(data?.cities)?data.cities:[];
      if (generation===citiesReqGenerationRef.current) setFacetCities(cities);
      try { if (!noCacheRef.current) { (bag as any)[key]={ts:Date.now(),cities}; lsSave("facetCitiesCacheV1",bag); } } catch {}
    } catch(e:any) { if (generation===citiesReqGenerationRef.current) { setErr(e?.message??"Failed to load cities"); setFacetCities([]); } }
    finally { if (generation===citiesReqGenerationRef.current) setFacetsLoading(false); }
  }

  useEffect(()=>{ if (!domain) return; loadCities(domain).catch(()=>{}); },[domain]);

  async function loadBarangays(forDomain: string, forCity: string) {
    if (!forCity) { setFacetBarangays([]); return; }
    setBarangaysLoading(true); setErr("");
    try {
      const bag = noCacheRef.current ? {} as Record<string,{ts:number;list:string[]}> : lsLoad<Record<string,{ts:number;list:string[]}>>("facetBarangaysCacheV1",{});
      const key = `${String(forDomain||"").toLowerCase()}|${String(forCity||"").toLowerCase()}`;
      const hit = (bag as any)[key];
      if (!noCacheRef.current && hit && Date.now()-(hit.ts??0)<1000*60*60*24*3) { setFacetBarangays(hit.list??[]); return; }
      const res = await fetch(`/api/facets?mode=barangays&domain=${encodeURIComponent(forDomain)}&city=${encodeURIComponent(forCity)}`);
      if (!res.ok) throw new Error(`Barangays failed: ${res.status}`);
      const data = await res.json(); const list = Array.isArray(data?.barangays)?data.barangays:[];
      setFacetBarangays(list);
      try { if (!noCacheRef.current) { (bag as any)[key]={ts:Date.now(),list}; lsSave("facetBarangaysCacheV1",bag); } } catch {}
    } catch(e:any) { setErr(e?.message??"Failed to load barangays"); setFacetBarangays([]); }
    finally { setBarangaysLoading(false); }
  }

  async function searchZonal(overrides?: { page?: number }) {
    const targetPage = overrides?.page ?? page;
    zonalAbortRef.current?.abort(); const ac = new AbortController(); zonalAbortRef.current = ac;
    setLoading(true); setErr("");
    try {
      const params = new URLSearchParams({ domain, page: String(targetPage), city, barangay, classification, q });
      const cacheKey = params.toString();
      const bag = noCacheRef.current ? {} as Record<string,{ts:number;payload:any}> : lsLoad<Record<string,{ts:number;payload:any}>>(ZONAL_LS_KEY,{});
      const hit = (bag as any)[cacheKey];
      if (!noCacheRef.current && hit && Date.now()-(hit.ts??0)<1000*60*10) {
        const data=hit.payload; setRows(data.rows??[]); setItemsPerPage(Number(data.itemsPerPage??16)); setTotalRows(Number(data.totalRows??0));
        setPageCount(data.pageCount??null); setHasPrev(Boolean(data.hasPrev)); setHasNext(Boolean(data.hasNext));
        if (targetPage!==page) setPage(targetPage); return;
      }
      const res = await fetch(`/api/zonal?${params.toString()}`, { signal: ac.signal });
      if (!res.ok) { const t=await res.text().catch(()=>""); throw new Error(`Zonal failed: ${res.status}${t?` — ${t}`:""}`); }
      const data = await res.json();
      setRows(data.rows??[]); setItemsPerPage(Number(data.itemsPerPage??16)); setTotalRows(Number(data.totalRows??0));
      setPageCount(data.pageCount??null); setHasPrev(Boolean(data.hasPrev)); setHasNext(Boolean(data.hasNext));
      try {
        if (!noCacheRef.current) {
          (bag as any)[cacheKey]={ts:Date.now(),payload:data};
          const keys=Object.keys(bag as any);
          if (keys.length>80) { const sorted=keys.map(k=>({k,ts:(bag as any)[k]?.ts??0})).sort((a,b)=>a.ts-b.ts).slice(0,Math.max(0,keys.length-80)); for (const s of sorted) delete (bag as any)[s.k]; }
          lsSave(ZONAL_LS_KEY,bag as any);
        }
      } catch {}
      if (targetPage!==page) setPage(targetPage);
    } catch(e:any) {
      if (e?.name==="AbortError") return;
      setErr(e?.message??"Unknown error"); setRows([]); setTotalRows(0); setPageCount(null); setHasPrev(false); setHasNext(false);
    } finally { setLoading(false); }
  }

  async function fetchPoi(lat: number, lon: number, radiusKm?: number) {
    const radius = radiusKm ?? poiRadiusKm;
    const key = `${lat.toFixed(3)}|${lon.toFixed(3)}|${Math.round(radius*1000)}`;
    const poiBag = lsLoad<Record<string,{ts:number;payload:{ok:true;counts:PoiData["counts"];items:PoiData["items"]}}>>(POI_LS_KEY,{});
    const hit = poiBag[key];
    if (hit && Date.now()-(hit.ts??0)<POI_TTL_MS) return hit.payload;
    const res = await fetch("/api/poi-counts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lat,lon,radius:Math.round(radius*1000),limit:120})});
    const data = await res.json();
    if (!res.ok||!data?.ok) throw new Error(data?.error??"POI failed");
    const payload = data as {ok:true;counts:PoiData["counts"];items:PoiData["items"]};
    lsSave(POI_LS_KEY,{...poiBag,[key]:{ts:Date.now(),payload}});
    return payload;
  }

  async function fetchAreaLabels(lat: number, lon: number) { return [] as Array<{lat:number;lon:number;name:string}>; }

  async function fetchStreetGeometryFromSelectedRow(r: Row) {
    const streetName = String(r["Street/Subdivision-"]??"").trim();
    const lat = selectedLocation?.lat??null; const lon = selectedLocation?.lon??null;
    if (!streetName||lat==null||lon==null) return null;
    setStreetGeoLoading(true);
    try {
      const res = await fetch("/api/street-geometry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({streetName,city:String(r["City-"]??"").trim(),province:String(r["Province-"]??"").trim(),barangay:String(r["Barangay-"]??"").trim(),lat,lon})});
      const data = await res.json().catch(()=>null);
      if (!res.ok||!data?.ok) return null;
      return data as {ok:true;geojson:GeoJSON.FeatureCollection;meta?:{matched:boolean;bestScore?:number|null;name?:string|null;center?:{lat:number;lon:number}|null}};
    } finally { setStreetGeoLoading(false); }
  }

  async function fetchStreetGeometryAt(r: Row, lat: number, lon: number) {
    if (!String(r["Street/Subdivision-"]??"").trim()) return null;
    try {
      const res = await fetch("/api/street-geometry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({streetName:String(r["Street/Subdivision-"]??"").trim(),city:String(r["City-"]??"").trim(),province:String(r["Province-"]??"").trim(),barangay:String(r["Barangay-"]??"").trim(),lat,lon})});
      const data = await res.json().catch(()=>null);
      if (!res.ok||!data?.ok) return null;
      return data as {ok:true;geojson:GeoJSON.FeatureCollection;meta?:{matched:boolean;bestScore?:number|null;name?:string|null;center?:{lat:number;lon:number}|null}};
    } catch { return null; }
  }

  async function onChangePoiRadius(newKm: number) {
    setPoiRadiusKm(newKm); if (!selectedLocation) return;
    const myId = ++reqIdRef.current; setPoiLoading(true);
    try {
      const poi = await fetchPoi(selectedLocation.lat, selectedLocation.lon, newKm);
      if (myId!==reqIdRef.current) return; setPoiData({counts:poi.counts,items:poi.items});
      try {
        const aiRes = await fetch("/api/ideal-business",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({city:String(selectedRow?.["City-"]??""),barangay:String(selectedRow?.["Barangay-"]??""),province:String(selectedRow?.["Province-"]??""),classification:String(selectedRow?.["Classification-"]??""),zonalValuePerSqm:String(selectedRow?.["ZonalValuepersqm.-"]??""),poiCounts:poi.counts})});
        const aiData = await aiRes.json().catch(()=>null);
        if (myId!==reqIdRef.current) return;
        if (aiRes.ok&&aiData?.ok&&Array.isArray(aiData.businesses)&&aiData.businesses.length) {
          const formatted = aiData.businesses.map((biz:any,idx:number)=>[`${idx+1}. ${biz.type||"Business"}`,`   Reason: ${biz.reason||"-"}`,`   Target Market: ${biz.target_market||"-"}`,`   Capital: ${biz.capital_level||"-"}`,`   Profit Potential: ${biz.profit_potential||"-"}`,`   Suitability: ${biz.suitability_score}/10`].join("\n")).join("\n\n");
          setIdealBusinessText(formatted+(aiData.best_recommendation?`\n\n✓ BEST OVERALL: ${aiData.best_recommendation}`:""));
        } else {
          setIdealBusinessText(suggestBusinesses({zonalValueText:String(selectedRow?.["ZonalValuepersqm.-"]??""),classification:String(selectedRow?.["Classification-"]??""),poi,barangay:String(selectedRow?.["Barangay-"]??""),city:String(selectedRow?.["City-"]??""),province:String(selectedRow?.["Province-"]??"")}).map(x=>`• ${x}`).join("\n"));
        }
      } catch {
        setIdealBusinessText(suggestBusinesses({zonalValueText:String(selectedRow?.["ZonalValuepersqm.-"]??""),classification:String(selectedRow?.["Classification-"]??""),poi,barangay:String(selectedRow?.["Barangay-"]??""),city:String(selectedRow?.["City-"]??""),province:String(selectedRow?.["Province-"]??"")}).map(x=>`• ${x}`).join("\n"));
      }
      describeArea({lat:selectedLocation.lat,lon:selectedLocation.lon,label:geoLabel,row:selectedRow,poi:{counts:poi.counts,items:poi.items} as any});
    } catch(e:any) { if (myId!==reqIdRef.current) return; setDetailsErr(e?.message??"Failed to load POI"); }
    finally { if (myId!==reqIdRef.current) return; setPoiLoading(false); }
  }

  async function pinpointFilterLocation(filterCity?: string, filterBarangay?: string, filterProvince?: string) {
    const myId = ++filterPinpointRef.current;
    setGeoLoading(true); setSelectedRow(null); setPoiData(null); setDetailsErr(""); setAreaDescription(""); setAreaDescErr("");
    try {
      const query = filterBarangay ? `${filterBarangay}, ${filterCity}, ${filterProvince}, Philippines` : filterCity ? `${filterCity}, ${filterProvince}, Philippines` : `${filterProvince}, Philippines`;
      const res = await fetch("/api/geocode",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,hintBarangay:filterBarangay||"",hintCity:filterCity||"",hintProvince:filterProvince||""})});
      const data = await res.json().catch(()=>null);
      if (myId!==filterPinpointRef.current) return;
      if (!res.ok||!data?.ok) { console.log("Geocode failed for filter:", query); return; }
      setSelectedLocation({lat:Number(data.lat),lon:Number(data.lon)}); setGeoLabel(data.displayName||query);
      setMatchStatus(`✓ ${filterBarangay?"Barangay":filterCity?"City":"Province"} center`);
      setBoundary((data.boundary as Boundary|null)??null);
      try { await fetchPoi(Number(data.lat),Number(data.lon)); } catch {}
    } catch(e:any) { console.log("Pinpoint filter error:", e?.message); }
    finally { if (myId===filterPinpointRef.current) setGeoLoading(false); }
  }

  async function geocodeWithZonalData(args: { query:string; street?:string; barangay?:string; city?:string; province?:string; baseLatLon?:{lat:number;lon:number}|null }) {
    const qx = normalizePH(args.query);
    const key = `${qx}|${args.street}|${args.barangay}|${args.city}|${args.province}|${args.baseLatLon?.lat??""},${args.baseLatLon?.lon??""}`.toLowerCase();
    const cached = centerCacheRef.current.get(key); if (cached) return cached;
    const res = await fetch("/api/geocode",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:qx,street:args.street??"",hintBarangay:args.barangay??"",hintCity:args.city??"",hintProvince:args.province??"",baseLatLon:args.baseLatLon??null})});
    const data = await res.json().catch(()=>null);
    if (!res.ok||!data?.ok) return null;
    const payload = {lat:Number(data.lat),lon:Number(data.lon),label:String(data.displayName??qx),boundary:(data.boundary as Boundary|null)??null};
    centerCacheRef.current.set(key,payload);
    const bag = lsLoad<Record<string,{ts:number;lat:number;lon:number;label:string;boundary?:Boundary|null}>>(GEO_LS_KEY,{});
    bag[key]={ts:Date.now(),lat:payload.lat,lon:payload.lon,label:payload.label,boundary:payload.boundary??null};
    lsSave(GEO_LS_KEY,bag); return payload;
  }

  async function describeArea(payload: { lat:number; lon:number; label:string; row?:Row|null; poi?:PoiData|null }) {
    setAreaDescLoading(true);
    try {
      const res = await fetch("/api/describe-area",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lat:payload.lat,lon:payload.lon,label:payload.label,city:String(payload.row?.["City-"]??""),barangay:String(payload.row?.["Barangay-"]??""),province:String(payload.row?.["Province-"]??""),classification:String(payload.row?.["Classification-"]??""),zonalValuePerSqm:String(payload.row?.["ZonalValuepersqm.-"]??""),poiCounts:payload.poi?.counts??null})});
      const data = await res.json().catch(()=>null);
      if (!res.ok||!data?.ok) throw new Error(data?.error??"Failed to describe area");
      setAreaDescErr(""); setAreaDescription(String(data.text??"").trim());
    } catch { setAreaDescErr(""); setAreaDescription(fallbackDescribe({label:payload.label,row:payload.row??null,poi:payload.poi??null})); }
    finally { setAreaDescLoading(false); }
  }

  async function loadPoiIndependent(lat: number, lon: number, row: Row|null, labelForDesc: string) {
    const myId = reqIdRef.current; setPoiLoading(true); setDetailsErr("");
    try {
      const poi = await fetchPoi(lat,lon); if (myId!==reqIdRef.current) return;
      setPoiData({counts:poi.counts,items:poi.items});
      try {
        const aiRes = await fetch("/api/ideal-business",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({city:String(row?.["City-"]??""),barangay:String(row?.["Barangay-"]??""),province:String(row?.["Province-"]??""),classification:String(row?.["Classification-"]??""),zonalValuePerSqm:String(row?.["ZonalValuepersqm.-"]??""),poiCounts:poi.counts})});
        const aiData = await aiRes.json().catch(()=>null);
        if (myId!==reqIdRef.current) return;
        if (aiRes.ok&&aiData?.ok&&Array.isArray(aiData.businesses)&&aiData.businesses.length) {
          const formatted = aiData.businesses.map((biz:any,idx:number)=>[`${idx+1}. ${biz.type||"Business"}`,`   Reason: ${biz.reason||"-"}`,`   Target Market: ${biz.target_market||"-"}`,`   Capital: ${biz.capital_level||"-"}`,`   Profit Potential: ${biz.profit_potential||"-"}`,`   Suitability: ${biz.suitability_score}/10`].join("\n")).join("\n\n");
          setIdealBusinessText(formatted+(aiData.best_recommendation?`\n\n✓ BEST OVERALL: ${aiData.best_recommendation}`:""));
        } else {
          setIdealBusinessText(suggestBusinesses({zonalValueText:String(row?.["ZonalValuepersqm.-"]??""),classification:String(row?.["Classification-"]??""),poi,barangay:String(row?.["Barangay-"]??""),city:String(row?.["City-"]??""),province:String(row?.["Province-"]??"")}).map(x=>`• ${x}`).join("\n"));
        }
      } catch {
        setIdealBusinessText(suggestBusinesses({zonalValueText:String(row?.["ZonalValuepersqm.-"]??""),classification:String(row?.["Classification-"]??""),poi,barangay:String(row?.["Barangay-"]??""),city:String(row?.["City-"]??""),province:String(row?.["Province-"]??"")}).map(x=>`• ${x}`).join("\n"));
      }
      describeArea({lat,lon,label:labelForDesc,row,poi:{counts:poi.counts,items:poi.items} as any});
    } catch(e:any) { if (myId!==reqIdRef.current) return; setDetailsErr(e?.message??"Failed to load POI"); }
    finally { if (myId!==reqIdRef.current) return; setPoiLoading(false); }
  }

  async function selectRow(r: Row) {
    const myId = ++reqIdRef.current;
    setSelectedRow(r); setDetailsErr(""); setPoiData(null); setMatchStatus(""); setComps(null);
    setAreaDescription(""); setAreaDescErr(""); setShowStreetHighlight(false); setStreetGeo(null);
    const rowCity = String(r["City-"]??""); const rowBarangay = String(r["Barangay-"]??"");
    if (rowCity&&rowCity!==city) setCity(rowCity);
    if (rowBarangay&&rowBarangay!==barangay) setBarangay(rowBarangay);
    if (rowCity&&(!facetBarangays.length||rowCity!==city)) loadBarangays(domain,rowCity);
    if (typeof window!=="undefined"&&window.innerWidth<640) { setLeftOpen(false); setBottomOpen(true); } else { setBottomOpen(true); }
    setGeoLoading(true);
    try {
      const zonalLat=(r as any)?.["latitude"]??(r as any)?.lat??null; const zonalLon=(r as any)?.["longitude"]??(r as any)?.lon??null;
      const baseLatLon = zonalLat!=null&&zonalLon!=null&&Number.isFinite(zonalLat)&&Number.isFinite(zonalLon) ? {lat:Number(zonalLat),lon:Number(zonalLon)} : null;
      const rawStreet = String(r["Street/Subdivision-"]??"").trim(); const street = normalizePH(rawStreet);
      const vicinity = normalizePH(r["Vicinity-"]); const rawRowBarangay = String(r["Barangay-"]??"").trim();
      const isAllAreas = /^(all\s*areas?|all)$/i.test(rawStreet)||/^(all\s*areas?|all)$/i.test(rawRowBarangay);
      const brgy = (rawRowBarangay&&!/^(all\s*areas?|all)$/i.test(rawRowBarangay))?rawRowBarangay:(barangay||rawRowBarangay);
      const cty = normalizeCityHint(String(r["City-"]??""),String(r["Province-"]??"")); const prov = r["Province-"];
      const location = await geocodeWithZonalData({query:(isAllAreas||!street?[brgy,cty,prov]:[street,brgy,cty,prov]).filter(Boolean).join(", "),street:!isAllAreas&&street?street:undefined,barangay:brgy||undefined,city:cty||undefined,province:prov||undefined,baseLatLon});
      if (myId!==reqIdRef.current) return;
      const finalLoc = location||baseLatLon||{lat:10.3085,lon:123.8906};
      setSelectedLocation({lat:finalLoc.lat,lon:finalLoc.lon});
      setGeoLabel(location?.label||`${street&&!isAllAreas?street:(brgy||cty)}, ${cty}`);
      setMatchStatus(street&&!isAllAreas?"✓ Pinpointed to street":"✓ Pinpointed to barangay");
      loadPoiIndependent(finalLoc.lat,finalLoc.lon,r,location?.label||`${street||brgy}, ${cty}`);
      setAreaLabels([]);
    } catch(e:any) { if (myId!==reqIdRef.current) return; setDetailsErr(e?.message??"Failed to load details"); }
    finally { if (myId!==reqIdRef.current) return; setGeoLoading(false); }
  }

  async function selectLocationFromMap(lat: number, lon: number) {
    const myId = ++reqIdRef.current;
    setSelectedLocation({lat,lon}); setGeoLabel(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    setMatchStatus(""); setPoiData(null); setDetailsErr(""); setComps(null);
    setAreaDescription(""); setAreaDescErr(""); setShowStreetHighlight(false); setStreetGeo(null); setBottomOpen(true);
    try { loadPoiIndependent(lat,lon,null,`${lat.toFixed(5)}, ${lon.toFixed(5)}`); setAreaLabels([]); }
    catch(e:any) { if (myId!==reqIdRef.current) return; setDetailsErr(e?.message??"Failed to load POI"); }
    finally { if (myId!==reqIdRef.current) return; }
  }

  useEffect(()=>{ const t=setTimeout(()=>{ if (!domain) return; searchZonal({page:1}); },350); return ()=>clearTimeout(t); },[domain,city,barangay,classification,q]);

  const showingFrom   = totalRows ? (page-1)*itemsPerPage+1 : 0;
  const showingTo     = totalRows ? Math.min(page*itemsPerPage,totalRows) : rows.length;
  const selectedTitle = selectedRow ? `${String(selectedRow["Barangay-"]??"")}, ${String(selectedRow["City-"]??"")}, ${String(selectedRow["Province-"]??"")}` : geoLabel||"Select a property";
  const isDev = process.env.NODE_ENV==="development";
  const isAdmin = String(me?.role || "").toLowerCase() === "admin";

  return (
    <main className="h-screen w-screen overflow-hidden bg-slate-100 text-gray-900">
      <ZonalSearchIndicator visible={loading} />

      <div className="absolute inset-0">
        <MapComponent selected={selectedLocation} onPickOnMap={selectLocationFromMap} popupLabel={geoLabel} boundary={boundary} highlightRadiusMeters={80} containerId="map-container" mapType={mapType as "street"|"terrain"|"satellite"} showStreetHighlight={showStreetHighlight} streetGeojson={streetGeo} streetGeojsonEnabled={showStreetHighlight} areaLabels={areaLabels} />
      </div>

      {/* Brand pill */}
      {/* Removed top-left partner header card for a cleaner view */}

      {/* Map type controls */}
      <div className="absolute top-4 right-4 z-30">
        <div className="bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col">
          {(["street","terrain","satellite"] as MapType[]).map(type=>{
            const Icon = type==="street"?MapIcon:type==="terrain"?TerrainIcon:SatelliteIcon;
            const labels: Record<string,string> = {street:"Street",terrain:"Terrain",satellite:"Satellite"};
            return (
              <button key={type} onClick={()=>setMapType(type)} className={["flex items-center gap-2 px-3 py-2.5 text-xs font-semibold transition border-b border-gray-100 last:border-b-0", mapType===type?"text-[#f5f0eb]":"text-gray-600 hover:bg-gray-50"].join(" ")} style={mapType===type?{background:"#1e3a8a"}:undefined}>
                <Icon size={14} /><span className="hidden sm:inline">{labels[type]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* LEFT DRAWER */}
      <div className="absolute top-0 left-0 z-40 h-full flex">
        <div className={["h-full bg-white border-r border-gray-200 shadow-2xl transition-all duration-300 flex flex-col", leftOpen?"w-full sm:w-[400px]":"w-0 overflow-hidden"].join(" ")}>

          {/* Navy header */}
          <div className="px-4 pt-4 pb-3 shrink-0" style={{ background: "#1e3a8a" }}>
            <div className="flex items-center justify-between gap-2.5 mb-3">
              <div className="flex items-center gap-2.5">
              <ZonalHouseIcon
                size={32}
                onClick={async () => {
                  try {
                    const me = await apiMe();
                    if (me?.role === "admin") router.push("/admin");
                    else if (me) router.push("/dashboard");
                    else router.push("/login");
                  } catch {
                    router.push("/dashboard");
                  }
                }}
              />
              <button
                onClick={()=>{ const r=String(me?.role||'').toLowerCase(); router.push(r==='admin'? '/admin' : '/dashboard'); }}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold border border-[#e8e0d8] bg-white text-[#1e3a8a] hover:bg-[#fff8e6]"
                title="Back to Dashboard"
              >
                <ChevronLeft size={12} /> Back to Dashboard
              </button>
              </div>
              {/* Token pill + request (hidden for admin) */}
              {!isAdmin && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-1 rounded-full" style={{ color: "#0f1f38", background: "#f5f0eb" }} title="Zonal tokens available">
                  Tokens: {tokenBalance === null ? "—" : tokenBalance}
                </span>
                {tokenBalance === 0 && (
                  <button onClick={()=>router.push('/dashboard/request')} className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-[#e8e0d8] bg-white text-[#1e3a8a] hover:bg-[#fff8e6]">
                    Request Tokens
                  </button>
                )}
              </div>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" size={15} style={{color:"#c9a84c"}} />
              <input value={regionSearch} onChange={e=>setRegionSearch(e.target.value)} placeholder="Search city or province…" className="w-full rounded-xl border-0 pl-9 pr-8 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 transition" style={{background:"rgba(255,255,255,0.10)"}} />
              {searchLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin"><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full" /></div>}
              {regionSearch&&!searchLoading&&<button onClick={()=>setRegionSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition"><X size={15} /></button>}
            </div>
            {/* Mobile tokens bar (clear and visible) — hidden for admin */}
            {!isAdmin && (
            <div className="mt-2 flex items-center justify-between sm:hidden">
              <span className="text-[11px] font-extrabold px-2 py-1 rounded-lg border border-[#e8e0d8] bg-white text-[#1e3a8a]" title="Zonal tokens available">
                Tokens: {tokenBalance === null ? "—" : tokenBalance}
              </span>
              {tokenBalance === 0 && (
                <button onClick={()=>router.push('/dashboard/request')} className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-[#e8e0d8] bg-white text-[#1e3a8a] hover:bg-[#fff8e6]">
                  Request Tokens
                </button>
              )}
            </div>
            )}
            <div className="mt-2.5 flex items-center gap-2">
              <button onClick={()=>setShowFilters(v=>!v)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition" style={showFilters?{background:"#f5f0eb",color:"#1e3a8a"}:{background:"rgba(255,255,255,0.10)",color:"#f5f0eb"}}>
                <SlidersHorizontal size={13} />Filters
              </button>
              {isDev&&(
                <button onClick={()=>{ if(typeof window!=="undefined"){localStorage.removeItem("facetCitiesCacheV1");localStorage.removeItem("facetBarangaysCacheV1");localStorage.removeItem("zonalCacheV1");loadCities(domain).catch(()=>{});} }} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition" style={{background:"rgba(255,255,255,0.10)",color:"#f5f0eb"}} title="Clear caches (dev only)">
                  🔄 Refresh
                </button>
              )}
              <button onClick={()=>setRightOpen(v=>!v)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ml-auto" style={rightOpen?{background:"#f5f0eb",color:"#1e3a8a"}:{background:"rgba(255,255,255,0.10)",color:"#f5f0eb"}} title="Open report panel">
                {rightOpen?<PanelRightClose size={13}/>:<PanelRightOpen size={13}/>}Report
              </button>
            </div>
          </div>

          {/* Region picker */}
          {(showRegionPicker||(regionSearch.length>0&&matches.length>0))&&(
            <div className="px-3 pt-3 shrink-0">
              {searchLoading?(
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center">
                  <div className="flex items-center justify-center gap-2"><div className="h-4 w-4 border-2 border-[#c9a84c]/40 border-t-[#c9a84c] rounded-full animate-spin"/><span className="text-sm text-gray-600">Searching...</span></div>
                </div>
              ):matches.length>0?(
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-3 py-2 bg-[#f5f0eb] border-b border-[#e8e0d8] text-[11px] font-bold text-[#1e3a8a] uppercase tracking-wide">{searchMode==="city"?"📍 Cities Found":"🗺️ Provinces Found"} ({matches.length})</div>
                  <div className="max-h-56 overflow-auto">
                    {matches.map((m,idx)=>(
                      <button key={idx} className="w-full text-left px-3 py-2.5 text-sm hover:bg-[#f5f0eb] border-b last:border-b-0 transition"
                        onClick={async()=>{
                          citiesReqGenerationRef.current++; setDomain(m.domain); setSelectedProvince(m.province); setSelectedProvinceCity(m.city);
                          setCity(""); setBarangay(""); setClassification(""); setQ(""); setPage(1); setRows([]); setErr("");
                          setSelectedRow(null); setPoiData(null); setDetailsErr(""); setFacetCities([]); setFacetBarangays([]);
                          setBoundary(null); setComps(null); setAreaDescription(""); setAreaDescErr(""); setRegionSearch("");
                          await loadCities(m.domain,citiesReqGenerationRef.current); searchZonal({page:1});
                          await pinpointFilterLocation(m.city,"",m.province); setShowRegionPicker(false); setShowFilters(true);
                        }}>
                        <div className="font-semibold text-gray-900 text-xs">{m.province} {searchMode==="city"?`→ ${m.city}`:""}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{m.domain}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ):regionSearch.length>=2?(
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center"><div className="text-sm text-gray-600">No results for "<strong>{regionSearch}</strong>"</div><div className="text-xs text-gray-500 mt-1">Try a province or city name</div></div>
              ):null}
            </div>
          )}

          {/* Filters */}
          {showFilters&&(
            <div className="px-3 pt-3 pb-2 border-b border-gray-100 shrink-0 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wide block mb-1.5">City</label>
                  <select className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold text-gray-800 focus:outline-none transition disabled:opacity-50" value={city}
                    onChange={e=>{ const v=e.target.value; setCity(v); setShowStreetHighlight(false); setStreetGeo(null); setBarangay(""); setPage(1); setFacetBarangays([]); loadBarangays(domain,v); if(v) pinpointFilterLocation(v,"",selectedProvince); }}
                    disabled={facetsLoading||facetCities.length===0}>
                    <option value="">All Cities</option>{facetCities.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wide block mb-1.5">Barangay</label>
                  <select className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold text-gray-800 focus:outline-none transition disabled:opacity-50" value={barangay}
                    onChange={e=>{ const v=e.target.value; setBarangay(v); setShowStreetHighlight(false); setStreetGeo(null); setPage(1); if(city&&v) pinpointFilterLocation(city,v,selectedProvince); }}
                    disabled={!city||barangaysLoading}>
                    <option value="">All Barangays</option>{facetBarangays.map(b=><option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wide block mb-1.5">Classification</label>
                  <select className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold text-gray-800 focus:outline-none transition" value={classification} onChange={e=>{setClassification(e.target.value);setPage(1);}}>
                    <option value="">All Types</option>
                    <option value="COMMERCIAL REGULAR">COMMERCIAL REGULAR</option><option value="COMMERCIAL CONDOMINIUM">COMMERCIAL CONDOMINIUM</option><option value="COMMERCIAL">COMMERCIAL</option>
                    <option value="RESIDENTIAL">RESIDENTIAL</option><option value="RESIDENTIAL CONDOMINIUM">RESIDENTIAL CONDOMINIUM</option><option value="INDUSTRIAL">INDUSTRIAL</option>
                    <option value="AGRICULTURAL">AGRICULTURAL</option><option value="SPECIAL">SPECIAL</option><option value="MIXED-USE">MIXED-USE</option>
                    <option value="ROAD LOT">ROAD LOT</option><option value="OPEN SPACE">OPEN SPACE</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wide block mb-1.5">Street / Vicinity</label>
                  <input className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold text-gray-800 placeholder-gray-400 focus:outline-none transition" placeholder="Street / Vicinity…" value={q} onChange={e=>{setQ(e.target.value);setPage(1);}} />
                </div>
              </div>
              <div className="flex gap-2 pt-0.5">
                <button onClick={()=>searchZonal({page:1})} disabled={loading} className="flex-1 rounded-xl px-4 py-2 text-xs font-bold transition disabled:opacity-50 flex items-center justify-center gap-2 text-[#f5f0eb]" style={{background:"#1e3a8a"}}>
                  {loading?<><Zap size={13} className="animate-spin"/>Searching…</>:"Search"}
                </button>
                <button onClick={()=>{setCity("");setBarangay("");setClassification("");setQ("");setPage(1);setRows([]);}} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition">Clear</button>
              </div>
            </div>
          )}

          {err&&<div className="mx-3 mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shrink-0">{err}</div>}

          {/* Results header */}
          <div className="px-4 py-2.5 sticky top-0 bg-gray-50 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">Results</span>
              {loading&&<Zap size={12} className="animate-spin text-[#c9a84c]"/>}
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{color:"#9a7a20",background:"rgba(201,168,76,0.12)"}}>
              {totalRows?<>#{showingFrom.toLocaleString()}–{showingTo.toLocaleString()} of {totalRows.toLocaleString()}</>:"No results"}
            </span>
          </div>

          {/* Results list */}
          <div className="flex-1 overflow-auto">
            <div className="p-2 flex flex-col gap-1.5">
              {rows.map((r,i)=>{
                const parsed = parseZonalValueToNumber(r["ZonalValuepersqm.-"]); const pricePerSqm = parsed??0;
                const tier = getPriceTier(pricePerSqm); const isActive = selectedRow?.rowIndex===r.rowIndex;
                return (
                  <button key={`${r.rowIndex}-${i}`} onClick={()=>selectRow(r)}
                    className={["w-full text-left rounded-2xl border-2 p-3 transition-all duration-150", isActive?"shadow-md":"border-gray-200 bg-white"].join(" ")}
                    style={isActive?{borderColor:"#c9a84c",background:"#f5f0eb"}:undefined}
                    onMouseEnter={e=>{ if(!isActive){(e.currentTarget as HTMLElement).style.borderColor="rgba(201,168,76,0.4)";(e.currentTarget as HTMLElement).style.background="rgba(245,240,235,0.4)";} }}
                    onMouseLeave={e=>{ if(!isActive){(e.currentTarget as HTMLElement).style.borderColor="";(e.currentTarget as HTMLElement).style.background="";} }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-[13px] text-gray-900 truncate leading-tight">{String(r["Street/Subdivision-"]??"").slice(0,44)||"Unnamed"}</div>
                        <div className="text-[11px] text-gray-600 font-medium mt-0.5 truncate">{String(r["Barangay-"]??"")}, {String(r["City-"]??"")}</div>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${tier.bg} ${tier.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${tier.dot}`}/>{tier.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div className="flex items-baseline gap-1">
                        {parsed!=null?(<><span className="text-xs text-gray-500">₱</span><span className="text-lg font-black" style={{color:"#1e3a8a"}}>{pricePerSqm.toLocaleString("en-PH")}</span><span className="text-[10px] text-gray-500 font-semibold">per sqm</span></>):<span className="text-[11px] text-gray-500 font-medium">Not Appraised</span>}
                      </div>
                      <div className="text-[11px] font-semibold text-gray-500">#{i+1+(page-1)*10}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Pagination */}
            <div className="sticky bottom-0 p-3 border-t border-gray-100 bg-white flex items-center justify-between gap-2">
              <button onClick={()=>searchZonal({page:Math.max(1,page-1)})} disabled={loading||!hasPrev} className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed">← Previous</button>
              <div className="text-xs text-gray-500 px-2 shrink-0"><span className="font-bold text-gray-800">{page}</span>{pageCount?<> / <span className="font-bold text-gray-800">{pageCount}</span></>:null}</div>
              <button onClick={()=>searchZonal({page:page+1})} disabled={loading||!hasNext} className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed">Next →</button>
            </div>
          </div>
        </div>

        {/* Drawer toggle */}
        <button onClick={()=>setLeftOpen(v=>!v)} className="h-14 mt-6 rounded-r-2xl bg-white/95 backdrop-blur border border-gray-200 shadow-xl px-3 flex items-center justify-center hover:bg-white transition z-50" title={leftOpen?"Collapse panel":"Expand panel"}>
          {leftOpen?<ChevronLeft/>:<ChevronRight/>}
        </button>
      </div>

      {/* RIGHT REPORT DRAWER */}
      <div className={["absolute top-0 right-0 z-40 h-full transition-all duration-300",rightOpen?"w-[360px] sm:w-[420px]":"w-0 overflow-hidden"].join(" ")}>
        {rightOpen&&(
          <div className="h-full bg-white border-l border-gray-200 shadow-2xl flex flex-col">
            <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{background:"#1e3a8a"}}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-base" style={{background:"#1e40af"}}>📋</div>
                <div className="text-sm font-bold text-[#f5f0eb]">Property Report</div>
              </div>
              <button onClick={()=>setRightOpen(false)} className="rounded-xl p-1.5 transition text-white/50 hover:text-white" style={{background:"rgba(255,255,255,0.08)"}} title="Close"><X size={16}/></button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              <ReportBuilder selectedLocation={selectedLocation} selectedRow={selectedRow} geoLabel={geoLabel} poiLoading={poiLoading} poiData={poiData} poiRadiusKm={poiRadiusKm} onChangePoiRadius={onChangePoiRadius} idealBusinessText={idealBusinessText} setIdealBusinessText={setIdealBusinessText} areaDescription={areaDescription} mapContainerId="map-container" autoPreview={autoPreview} />
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM SHEET */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-[92vw] sm:w-[560px]">
        <div className={["rounded-3xl border-2 border-gray-200 bg-white/98 backdrop-blur shadow-2xl overflow-hidden transition-all duration-300",bottomOpen?"max-h-[38vh]":"max-h-[52px]"].join(" ")}>
          <button onClick={()=>setBottomOpen(v=>!v)} className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition border-b border-gray-100">
            <div className="min-w-0 text-left"><div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">📌 Selected Property</div><div className="text-sm font-bold text-gray-900 truncate">{selectedTitle}</div></div>
            <div className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">{bottomOpen?"▼":"▶"}</div>
          </button>
          {bottomOpen&&(
            <div className="px-4 pb-3 overflow-auto max-h-[calc(38vh-52px)]">
              {!selectedRow?(
                <div className="pt-3 text-sm text-gray-600"><div className="flex items-center gap-2"><MapPin size={15} style={{color:"#1e3a8a"}} className="shrink-0"/>{geoLoading?"Finding location...":"Select a region, city, barangay, or click on a street from the list"}</div></div>
              ):(
                <>
                  <div className="mt-3 rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-4 flex items-center justify-between" style={{background:"linear-gradient(to right,#1e3a8a,#1e40af)"}}>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{color:"#c9a84c"}}>💰 Zonal Value</div>
                        <div className="text-3xl font-black text-white leading-none drop-shadow-sm">{parseZonalValueToNumber(selectedRow["ZonalValuepersqm.-"])?fmtPesoNumber(parseZonalValueToNumber(selectedRow["ZonalValuepersqm.-"])!):"Not Appraised"}</div>
                        <div className="text-[11px] font-semibold mt-1" style={{color:"rgba(201,168,76,0.8)"}}>per square meter</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-white">{String(selectedRow["City-"]??"")}</div>
                        <div className="text-xs font-semibold" style={{color:"rgba(255,255,255,0.7)"}}>{String(selectedRow["Barangay-"]??"")}</div>
                        <div className="truncate max-w-[200px] text-xs font-medium mt-0.5" style={{color:"rgba(201,168,76,0.7)"}}>{String(selectedRow["Street/Subdivision-"]??"")}</div>
                      </div>
                    </div>
                    {String(selectedRow["Classification-"]??"").trim()&&(
                      <div className="px-4 py-1.5 flex items-center gap-2" style={{background:"#f5f0eb",borderTop:"1px solid #e8e0d8"}}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:"#c9a84c"}}/>
                        <span className="text-[11px] font-bold uppercase tracking-wide" style={{color:"#1e3a8a"}}>{String(selectedRow["Classification-"]??"")}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
                    <button
                      onClick={async()=>{
                        if(!selectedRow) return; setDetailsErr("");
                        if(showStreetHighlight){setShowStreetHighlight(false);setStreetGeo(null);return;}
                        const data = await fetchStreetGeometryFromSelectedRow(selectedRow);
                        if(data?.geojson&&Array.isArray((data.geojson as any).features)&&(data.geojson as any).features.length>0){setStreetGeo(data.geojson);setShowStreetHighlight(true);}
                        else{setStreetGeo(null);setShowStreetHighlight(false);setDetailsErr("Street line not found near this pin.");}
                      }}
                      disabled={streetGeoLoading}
                      className="shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition disabled:opacity-50"
                      style={showStreetHighlight?{borderColor:"#c9a84c",background:"#f5f0eb",color:"#1e3a8a"}:{borderColor:"#e2d9d0",background:"#fff",color:"#374151"}}
                    >
                      {streetGeoLoading?"Finding…":showStreetHighlight?"Hide Street":"Highlight Street"}
                    </button>
                    <button onClick={()=>setRightOpen(true)} className="shrink-0 rounded-full px-4 py-2 text-xs font-bold transition text-[#f5f0eb]" style={{background:"#1e3a8a"}}>Open Report</button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {geoLoading&&<div className="text-xs text-gray-500 flex items-center gap-1.5"><span className="animate-spin">⟳</span> Pinpointing…</div>}
                    {matchStatus&&<div className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-2xl px-3 py-1.5 flex items-center gap-2"><MapPin size={11}/>{matchStatus}</div>}
                    {detailsErr&&<div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl px-3 py-1.5">{detailsErr}</div>}
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

export function HomePage() {
  const router = useRouter();
  async function handleHomeClick() {
    try {
      const me = await apiMe();
      if (me?.role === "admin") router.push("/admin");
      else if (me) router.push("/dashboard/reports");
      else router.push("/login");
    } catch {
      router.push("/dashboard/reports");
    }
  }
  return (
    <>
      <div className="property-search-header">
        <button onClick={handleHomeClick} className="home-icon-button"><img src="/pictures/home-icon.png" alt="Home Icon" /></button>
        <h1>Property Search</h1>
      </div>
      <Home />
    </>
  );
}

export default HomePage;