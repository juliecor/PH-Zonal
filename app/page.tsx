"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import * as GeoJSON from 'geojson';
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  RefreshCw,
  Ruler,
  FileText,
  ChevronDown,
  Coins,
  Calculator,
  Sparkles,
  Camera,
  Image as ImageIcon,
  Building2,
  Crosshair,
  Scan,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { apiMe } from "./lib/authClient";

import type { Boundary, LatLng, MapType, PoiData, RegionMatch, Row } from "./lib/types";
import { normalizePH, suggestBusinesses } from "./lib/zonal-util";
import { loadHazardProfile, type HazardProfile } from "./lib/pointHazards";
import ReportBuilder from "./components/ReportBuilder";
import ZonalSearchIndicator from "./components/ZonalSearchIndicator";
import PropertyCalculator from "./components/PropertyCalculator";
import InvestmentBrief from "./components/InvestmentBrief";
import ZonalAssistant from "./components/ZonalAssistant";
import MapTools, { type ScanResult } from "./components/MapTools";
import StreetViewModal from "./components/StreetViewModal";
import PropertySnapshot from "./components/PropertySnapshot";

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

// ── Establishment hazard-profile helpers (design: .epx panel) ──────────────────
const SEV_TONE = [
  { color: "#10b981", soft: "#e7f8f0", bd: "#bdeedd" }, // none/safe
  { color: "#ca8a04", soft: "#fdf4d9", bd: "#f3e2a6" }, // low
  { color: "#ea580c", soft: "#fdeee1", bd: "#f7d3b3" }, // moderate
  { color: "#dc2626", soft: "#fde6e6", bd: "#f6c2c2" }, // high
];
function sevTone(level: number) { return SEV_TONE[Math.max(0, Math.min(3, level))]; }
function ScanHazChip({ level, label }: { level: number | null | undefined; label: string }) {
  if (level == null) return null;
  const t = sevTone(level);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, color: t.color, background: t.soft, border: `1px solid ${t.bd}`, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: t.color }} />{label}
    </span>
  );
}
const SEV_CLASS = ["s-none", "s-low", "s-mod", "s-high"];
const SEV_WORD = ["None", "Low", "Moderate", "High"];
function sevClass(level: number) { return level < 0 ? "s-na" : SEV_CLASS[Math.min(3, level)]; }
function sevWord(level: number) { return level < 0 ? "No data" : SEV_WORD[Math.min(3, level)]; }
function hzLabel(level: number, kind: string) { return level <= 0 ? `No ${kind}` : `${SEV_WORD[Math.min(3, level)]} ${kind}`; }

// Tidy a displayed address: Google sometimes returns PH place names in Cebuano/Tagalog even
// in EN ("Lungsod ng Dabaw" → "Davao City", "Lalawigan ng Davao del Sur" → "Davao del Sur").
function cleanAddr(s: string): string {
  return String(s || "")
    .replace(/\bLungsod ng Dabaw\b/gi, "Davao City")
    .replace(/\bDakbayan sa Sugbo\b/gi, "Cebu City")
    .replace(/\bMaynila\b/gi, "Manila")
    .replace(/\b(?:Lungsod ng|Dakbayan sa)\s+([A-Za-zÑñ.\-]+)/gi, "$1 City")
    .replace(/\b(?:Lalawigan ng|Probinsya ng|Bayan ng|Munisipyo ng)\s+/gi, "")
    .replace(/\s+,/g, ",").replace(/\s{2,}/g, " ").trim();
}
const HAZ_ICON: Record<string, ReactNode> = {
  flood: (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M3 14c2 0 2-1.5 4.5-1.5S10 14 12 14s2-1.5 4.5-1.5S19 14 21 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M3 19c2 0 2-1.5 4.5-1.5S10 19 12 19s2-1.5 4.5-1.5S19 19 21 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M12 4v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>),
  landslide: (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M3 20 9 9l4 5 3-4 5 10H3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>),
  stormsurge: (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M3 16c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M5 11a3 3 0 1 1 5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>),
  fault: (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 7h6l-3 5h6l-3 5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  liquefaction: (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 18h16M6 18V9m4 9V6m4 12v-7m4 7V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>),
  tsunami: (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M3 17c4 0 4-4 8-4 3 0 3 2.5 6 2.5M3 12c1.5-5 7-7 11-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
};
function HazardRows({ hz }: { hz: HazardProfile }) {
  const order: Array<{ key: keyof HazardProfile; name: string }> = [
    { key: "flood", name: "Flood · 100-year" },
    { key: "landslide", name: "Landslide" },
    { key: "stormsurge", name: "Storm Surge" },
    { key: "fault", name: "Active Fault" },
    { key: "liquefaction", name: "Liquefaction" },
    { key: "tsunami", name: "Tsunami" },
  ];
  const cells = order.map((o) => ({ ...o, c: hz[o.key] }));
  const rated = cells.filter((x) => x.c.level >= 0);
  const avg = rated.length ? rated.reduce((s, x) => s + x.c.level, 0) / rated.length : 0;
  const counts = { low: 0, mod: 0, high: 0 };
  rated.forEach((x) => { if (x.c.level === 1) counts.low++; else if (x.c.level === 2) counts.mod++; else if (x.c.level === 3) counts.high++; });
  const ovWord = avg >= 2.3 ? "High" : avg >= 1.3 ? "Moderate" : avg >= 0.4 ? "Low" : "Minimal";
  const ovColor = avg >= 2.3 ? "var(--high)" : avg >= 1.3 ? "var(--mod)" : avg >= 0.4 ? "var(--low)" : "var(--safe)";
  const C = 169.6; // 2πr, r=27
  const off = C * (1 - Math.min(1, avg / 3));
  return (
    <div className="haz-wrap">
      <div className="haz-overall">
        <div className="gauge" role="img" aria-label={`Overall risk ${avg.toFixed(1)} of 3, ${ovWord}`}>
          <svg width="66" height="66" viewBox="0 0 66 66">
            <circle cx="33" cy="33" r="27" fill="none" stroke="#eef0f5" strokeWidth="7" />
            <circle className="haz-ring" cx="33" cy="33" r="27" fill="none" stroke={ovColor} strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 33 33)" style={{ filter: `drop-shadow(0 0 5px ${ovColor})` }} />
          </svg>
          <div className="gauge-c"><span className="score" style={{ color: ovColor }}>{avg.toFixed(1)}</span><span className="of">/ 3.0</span></div>
        </div>
        <div className="ov-txt">
          <div className="k">Overall Risk</div>
          <div className="lvl" style={{ color: ovColor }}>{ovWord}</div>
          <div className="breakdown">
            {counts.high > 0 && <span className="bd"><span className="d" style={{ background: "var(--high)" }} />{counts.high} high</span>}
            {counts.mod > 0 && <span className="bd"><span className="d" style={{ background: "var(--mod)" }} />{counts.mod} moderate</span>}
            {counts.low > 0 && <span className="bd"><span className="d" style={{ background: "var(--low)" }} />{counts.low} low</span>}
            {counts.high + counts.mod + counts.low === 0 && <span className="bd"><span className="d" style={{ background: "var(--safe)" }} />all clear</span>}
          </div>
        </div>
      </div>
      <div className="haz-grid">
        {cells.map((x) => (
          <div key={x.key} className={`haz-row ${sevClass(x.c.level)}`}>
            <span className="haz-ic">{HAZ_ICON[x.key]}</span>
            <div className="haz-meta"><div className="nm">{x.name}</div><div className="ds">{x.c.label}</div></div>
            <div className="haz-sev">
              <span className="sev-chip">{sevWord(x.c.level)}</span>
              <span className="meter">{[0, 1, 2, 3].map((i) => <i key={i} className={x.c.level >= 0 && i <= x.c.level ? "on" : ""} />)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="haz-foot">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        <span>Geohazard data from PHIVOLCS &amp; Project NOAH. For due-diligence reference only.</span>
      </div>
    </div>
  );
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
  const [nearMePoints, setNearMePoints] = useState<Array<{ lat: number; lon: number; label: string; info?: string }>>([]);
  const [scanMode, setScanMode] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [scanNote, setScanNote] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanHazards, setScanHazards] = useState<HazardProfile | null>(null);
  const [scanHazardsLoading, setScanHazardsLoading] = useState(false);
  const [scanNearby, setScanNearby] = useState<NearbyZonal[]>([]);
  // Clicked establishment (base-map POI) → name + zonal value of that land.
  type NearbyZonal = { lat?: number; lon?: number; value: number; street: string; barangay: string; city: string; province?: string; classification: string; dist?: number };
  const [poiCard, setPoiCard] = useState<null | {
    loading: boolean; name: string; address: string; lat: number; lon: number;
    value: number | null; classification: string; street: string; barangay: string; city: string;
    noData: boolean; scannedCity: string; nearby: NearbyZonal[]; nearbyLoading: boolean;
    hazards: HazardProfile | null; hazardsLoading: boolean; kind?: "establishment" | "nearme";
    cityTypical?: boolean;
  }>(null);
  const poiReqRef = useRef(0);
  const [floodRisk, setFloodRisk] = useState<{ level: number; label: string } | null>(null);
  const [floodOverlayOn, setFloodOverlayOn] = useState(false);
  const [landslideRisk, setLandslideRisk] = useState<{ level: number; label: string } | null>(null);
  const [landslideOverlayOn, setLandslideOverlayOn] = useState(false);
  const [stormSurgeRisk, setStormSurgeRisk] = useState<{ level: number; label: string } | null>(null);
  const [stormSurgeOverlayOn, setStormSurgeOverlayOn] = useState(false);
  const [faultRisk, setFaultRisk] = useState<{ distance_m: number; name: string; level: number; label: string } | null>(null);
  const [faultOverlayOn, setFaultOverlayOn] = useState(false);
  const [liquefactionOn, setLiquefactionOn] = useState(false);
  const [tsunamiOn, setTsunamiOn] = useState(false);
  const [groundRuptureOn, setGroundRuptureOn] = useState(false);
  const [scanFloodOverlay, setScanFloodOverlay] = useState<{ url: string; north: number; south: number; east: number; west: number } | null>(null);
  const boundsReqRef = useRef(0);

  // Static config for the 100-yr flood overlay PNG (bounds from the source raster).
  const FLOOD_OVERLAY = {
    url: "/flood/cebu_flood_100yr.png",
    north: 11.522445, south: 9.411945, east: 124.571104, west: 123.296404,
  };

  // Flood hazard (100-yr NOAH) for the selected location — instant raster lookup.
  useEffect(() => {
    if (!selectedLocation) { setFloodRisk(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/flood-at?lat=${selectedLocation.lat}&lon=${selectedLocation.lon}`);
        const d = await res.json().catch(() => null);
        if (cancelled) return;
        if (d?.ok && d.inCoverage) setFloodRisk({ level: d.level, label: d.label });
        else setFloodRisk(null); // outside coverage → hide
      } catch {
        if (!cancelled) setFloodRisk(null);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedLocation]);

  // Landslide hazard for the selected location.
  useEffect(() => {
    if (!selectedLocation) { setLandslideRisk(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/landslide-at?lat=${selectedLocation.lat}&lon=${selectedLocation.lon}`);
        const d = await res.json().catch(() => null);
        if (cancelled) return;
        if (d?.ok && d.inCoverage) setLandslideRisk({ level: d.level, label: d.label });
        else setLandslideRisk(null);
      } catch {
        if (!cancelled) setLandslideRisk(null);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedLocation]);

  // Storm-surge hazard (worst-case SSA4) for the selected location.
  useEffect(() => {
    if (!selectedLocation) { setStormSurgeRisk(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/stormsurge-at?lat=${selectedLocation.lat}&lon=${selectedLocation.lon}`);
        const d = await res.json().catch(() => null);
        if (cancelled) return;
        if (d?.ok && d.inCoverage) setStormSurgeRisk({ level: d.level, label: d.label });
        else setStormSurgeRisk(null);
      } catch {
        if (!cancelled) setStormSurgeRisk(null);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedLocation]);

  // Distance to the nearest active fault (PHIVOLCS) for the selected location.
  useEffect(() => {
    if (!selectedLocation) { setFaultRisk(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/fault-at?lat=${selectedLocation.lat}&lon=${selectedLocation.lon}`);
        const d = await res.json().catch(() => null);
        if (cancelled) return;
        if (d?.ok && d.found) setFaultRisk({ distance_m: d.distance_m, name: d.name, level: d.level, label: d.label });
        else setFaultRisk(null);
      } catch {
        if (!cancelled) setFaultRisk(null);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedLocation]);
  const [anchorLocation, setAnchorLocation] = useState<LatLng | null>(null);
  const [boundary, setBoundary] = useState<Boundary | null>(null);
  const [mapType, setMapType] = useState<MapType>("street");

  // Recolor the scan flood overlay (blue ↔ warm) when the base map type changes.
  useEffect(() => {
    setScanFloodOverlay((prev) => {
      if (!prev) return prev;
      const sat = mapType === "satellite" ? 1 : 0;
      const url = prev.url.replace(/([?&]sat=)[01]/, `$1${sat}`);
      return url === prev.url ? prev : { ...prev, url };
    });
  }, [mapType]);

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

  const [leftOpen, setLeftOpen] = useState(false); // map-first: open via the "Search Zonal" toolbar button
  const [showFilters, setShowFilters] = useState(false);
  const [bottomOpen, setBottomOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [autoPreview, setAutoPreview] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(true);
  const [mapKey, setMapKey] = useState(0);

  // ── Land drawing / area measurement ──
  const [drawMode, setDrawMode] = useState(false);
  const [landArea, setLandArea] = useState<number | null>(null);
  const [clearDrawSignal, setClearDrawSignal] = useState(0);
  const [clearScanSignal, setClearScanSignal] = useState(0); // bump to erase the drawn scan square
  const [landPath, setLandPath] = useState<Array<{ lat: number; lng: number }> | null>(null);
  const [areaUnit, setAreaUnit] = useState<"sqm" | "ha" | "sqft">("sqm");
  const [calcOpen, setCalcOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [streetViewOpen, setStreetViewOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [areaCardPos, setAreaCardPos] = useState<{ x: number; y: number } | null>(null);
  const [areaCardMin, setAreaCardMin] = useState(false);

  // perimeter + side lengths (meters) from the drawn path
  const landMetrics = useMemo(() => {
    const pts = landPath ?? [];
    if (pts.length < 2) return { perimeterM: 0, sidesM: [] as number[] };
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const seg = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    };
    const sidesM: number[] = [];
    for (let i = 0; i < pts.length; i++) sidesM.push(seg(pts[i], pts[(i + 1) % pts.length]));
    return { perimeterM: sidesM.reduce((a, b) => a + b, 0), sidesM };
  }, [landPath]);

  function fmtArea(sqm: number, unit: "sqm" | "ha" | "sqft") {
    if (unit === "ha") return `${(sqm / 10000).toLocaleString("en-PH", { maximumFractionDigits: 3 })} ha`;
    if (unit === "sqft") return `${Math.round(sqm * 10.76391).toLocaleString("en-PH")} ft²`;
    return `${Math.round(sqm).toLocaleString("en-PH")} sqm`;
  }

  // Distance (m) between the drawn parcel's centroid and the selected pin —
  // used to warn when the drawing is likely outside the selected zonal area.
  const drawDistanceM = useMemo(() => {
    const pts = landPath ?? [];
    if (!selectedLocation || pts.length < 3) return null;
    const cLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const cLng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(selectedLocation.lat - cLat), dLng = toRad(selectedLocation.lon - cLng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(cLat)) * Math.cos(toRad(selectedLocation.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }, [landPath, selectedLocation]);
  function fmtLen(m: number, unit: "sqm" | "ha" | "sqft") {
    if (unit === "sqft") return `${Math.round(m * 3.28084).toLocaleString("en-PH")} ft`;
    return `${m.toLocaleString("en-PH", { maximumFractionDigits: 1 })} m`;
  }

  // Whole-barangay comparables from the stats endpoint (preferred over the
  // loaded-page sample below).
  const [barangayStats, setBarangayStats] = useState<{ min: number; max: number; median: number; mean: number; count: number } | null>(null);

  useEffect(() => {
    if (!selectedRow) { setBarangayStats(null); return; }
    const c = String(selectedRow["City-"] ?? "").trim();
    const b = String(selectedRow["Barangay-"] ?? "").trim();
    if (!c || !b) { setBarangayStats(null); return; }
    let cancelled = false;
    setBarangayStats(null);
    (async () => {
      try {
        const res = await fetch(`/api/zonal-stats?domain=${encodeURIComponent(domain)}&city=${encodeURIComponent(c)}&barangay=${encodeURIComponent(b)}`);
        const data = await res.json().catch(() => null);
        if (!cancelled && data?.ok && data.stats) setBarangayStats(data.stats);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [selectedRow, domain]);

  // Fallback: comparables computed from the currently loaded same-barangay rows.
  const compStats = useMemo(() => {
    const vals = rows
      .map((r) => parseZonalValueToNumber(r["ZonalValuepersqm.-"]))
      .filter((n): n is number => n != null && n > 0);
    if (vals.length < 2) return null;
    const sorted = [...vals].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const mid = sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    return { min, max, median: mid, count: vals.length };
  }, [rows]);

  function startAreaCardDrag(e: React.PointerEvent) {
    const parent = (e.currentTarget as HTMLElement).parentElement;
    if (!parent || typeof window === "undefined") return;
    const rect = parent.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    const w = rect.width || 340;
    const move = (ev: PointerEvent) => {
      const x = Math.max(8, Math.min(window.innerWidth - w - 8, ev.clientX - dx));
      const y = Math.max(8, Math.min(window.innerHeight - 60, ev.clientY - dy));
      setAreaCardPos({ x, y });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function resetToFirstVisit() {
    try { zonalAbortRef.current?.abort(); } catch {}
    // Invalidate any pending async updates
    try { reqIdRef.current++; } catch {}
    try { filterPinpointRef.current = 0; } catch {}
    try { citiesReqGenerationRef.current++; } catch {}
    if (searchDebounceRef.current) { try { clearTimeout(searchDebounceRef.current); } catch {} searchDebounceRef.current = null; }
    // Map + selection
    setSelectedLocation(null);
    setAnchorLocation(null);
    setSelectedRow(null);
    setBoundary(null);
    setGeoLabel("");
    setMatchStatus("");
    setStreetGeo(null);
    setShowStreetHighlight(false);
    setAreaLabels([]);

    // Land drawing
    setDrawMode(false);
    setLandArea(null);
    setLandPath(null);
    setClearDrawSignal((n) => n + 1);
    setAreaCardPos(null);
    setAreaCardMin(false);

    // Details / side effects
    setPoiData(null);
    setDetailsErr("");
    setAreaDescription("");
    setAreaDescErr("");
    setIdealBusinessText("");
    setComps(null);

    // Filters & results
    setCity("");
    setBarangay("");
    setClassification("");
    setQ("");
    setRows([]);
    setTotalRows(0);
    setPage(1);
    setPageCount(null);
    setHasPrev(false);
    setHasNext(false);
    setFacetCities([]);
    setFacetBarangays([]);

    // Search UI
    setRegionSearch("");
    setMatches([]);
    setSearchMode("province");
    setShowRegionPicker(true);

    // Spinners off
    setLoading(false);
    setGeoLoading(false);
    setPoiLoading(false);

    // Panels
    setLeftOpen(true);
    setBottomOpen(true);
    setRightOpen(false);
    setAutoPreview(false);

    // Force remount the map component to reset center/zoom/tiles
    setMapKey((k) => k + 1);
  }

  // Open the zonal search drawer, or close it AND clear the selection so the bottom
  // "Selected Property" card vanishes too (keeps the default map clean).
  function toggleSearchPanel() {
    if (leftOpen) { setLeftOpen(false); setSelectedRow(null); setSelectedLocation(null); }
    else { setLeftOpen(true); }
  }

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
    lines.push(`Location: ${where}`);
    if (cls) lines.push(`Classification: ${cls}`);
    if (zv && zv > 0) lines.push(`Zonal Value: ₱${zv.toLocaleString()}/sqm (BIR Assessed)`);
    if (counts) {
      const healthcare = (counts.hospitals||0)+(counts.clinics||0); const education = counts.schools||0;
      const security = (counts.policeStations||0)+(counts.fireStations||0); const services = counts.pharmacies||0;
      const total = healthcare+education+security+services;
      const infraItems: string[] = [];
      if (healthcare>0) infraItems.push(`${healthcare} healthcare`);
      if (education>0)  infraItems.push(`${education} schools`);
      if (security>0)   infraItems.push(`${security} security`);
      if (services>0)   infraItems.push(`${services} services`);
      if (infraItems.length>0) lines.push(`Nearby: ${infraItems.join(", ")}`);
      let grade = "Limited";
      if (total>=20) grade="Excellent"; else if (total>=13) grade="Strong"; else if (total>=8) grade="Moderate"; else if (total>0) grade="Emerging";
      lines.push(`Investment Grade: ${grade}`);
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
      const bag = noCacheRef.current ? {} as Record<string,{ts:number;cities:string[]}> : lsLoad<Record<string,{ts:number;cities:string[]}>>("facetCitiesCacheV3",{});
      const key = String(forDomain||"").toLowerCase();
      const hit = (bag as any)[key];
      if (!noCacheRef.current && hit && Date.now()-(hit.ts??0)<1000*60*60*24*3) { if (generation===citiesReqGenerationRef.current) setFacetCities(hit.cities??[]); return; }
      const res = await fetch(`/api/facets?mode=cities&domain=${encodeURIComponent(forDomain)}`);
      if (!res.ok) throw new Error(`Cities failed: ${res.status}`);
      const data = await res.json(); const cities = Array.isArray(data?.cities)?data.cities:[];
      if (generation===citiesReqGenerationRef.current) setFacetCities(cities);
      try { if (!noCacheRef.current) { (bag as any)[key]={ts:Date.now(),cities}; lsSave("facetCitiesCacheV3",bag); } } catch {}
    } catch(e:any) { if (generation===citiesReqGenerationRef.current) { setErr(e?.message??"Failed to load cities"); setFacetCities([]); } }
    finally { if (generation===citiesReqGenerationRef.current) setFacetsLoading(false); }
  }

  useEffect(()=>{ if (!domain) return; loadCities(domain).catch(()=>{}); },[domain]);

  async function loadBarangays(forDomain: string, forCity: string) {
    if (!forCity) { setFacetBarangays([]); return; }
    setBarangaysLoading(true); setErr("");
    try {
      const bag = noCacheRef.current ? {} as Record<string,{ts:number;list:string[]}> : lsLoad<Record<string,{ts:number;list:string[]}>>("facetBarangaysCacheV3",{});
      const key = `${String(forDomain||"").toLowerCase()}|${String(forCity||"").toLowerCase()}`;
      const hit = (bag as any)[key];
      if (!noCacheRef.current && hit && Date.now()-(hit.ts??0)<1000*60*60*24*3) { setFacetBarangays(hit.list??[]); return; }
      const res = await fetch(`/api/facets?mode=barangays&domain=${encodeURIComponent(forDomain)}&city=${encodeURIComponent(forCity)}`);
      if (!res.ok) throw new Error(`Barangays failed: ${res.status}`);
      const data = await res.json(); const list = Array.isArray(data?.barangays)?data.barangays:[];
      setFacetBarangays(list);
      try { if (!noCacheRef.current) { (bag as any)[key]={ts:Date.now(),list}; lsSave("facetBarangaysCacheV3",bag); } } catch {}
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
        const aiRes = await fetch("/api/ideal-business",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({city:String(selectedRow?.["City-"]??""),barangay:String(selectedRow?.["Barangay-"]??""),province:String(selectedRow?.["Province-"]??""),classification:String(selectedRow?.["Classification-"]??""),zonalValuePerSqm:String(selectedRow?.["ZonalValuepersqm.-"]??""),poiCounts:poi.counts,lat:selectedLocation?.lat??null,lon:selectedLocation?.lon??null})});
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

  // Combined-domain cities are tagged like "LAZI (SIQUIJOR)" / "BUENAVISTA (GUIMARAS)".
  // For geocoding, that tag is the REAL province — strip it from the city and use it as
  // the province, else the pin lands in the host province (Lazi → Negros, not Siquijor).
  function geoOverride(city?: string, province?: string): { city: string; province: string } {
    const c = String(city || "");
    const m = c.match(/\(([A-Za-z][A-Za-z .]+)\)\s*$/);
    if (m) return { city: c.replace(/\s*\([A-Za-z][A-Za-z .]+\)\s*$/, "").trim(), province: m[1].trim() };
    return { city: c, province: String(province || "") };
  }

  async function pinpointFilterLocation(filterCity?: string, filterBarangay?: string, filterProvince?: string) {
    const myId = ++filterPinpointRef.current;
    setGeoLoading(true); setSelectedRow(null); setPoiData(null); setDetailsErr(""); setAreaDescription(""); setAreaDescErr("");
    try {
      const { city: gCity, province: gProv } = geoOverride(filterCity, filterProvince);
      const query = filterBarangay ? `${filterBarangay}, ${gCity}, ${gProv}, Philippines` : gCity ? `${gCity}, ${gProv}, Philippines` : `${gProv}, Philippines`;
      const res = await fetch("/api/geocode",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,hintBarangay:filterBarangay||"",hintCity:gCity||"",hintProvince:gProv||""})});
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

  async function geocodeWithZonalData(args: { query:string; street?:string; barangay?:string; city?:string; province?:string; baseLatLon?:{lat:number;lon:number}|null; valuePerSqm?:number|null; classification?:string }) {
    const qx = normalizePH(args.query);
    const key = `${qx}|${args.street}|${args.barangay}|${args.city}|${args.province}|${args.baseLatLon?.lat??""},${args.baseLatLon?.lon??""}`.toLowerCase();
    const cached = centerCacheRef.current.get(key); if (cached) return cached;
    const res = await fetch("/api/geocode",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:qx,street:args.street??"",hintBarangay:args.barangay??"",hintCity:args.city??"",hintProvince:args.province??"",baseLatLon:args.baseLatLon??null,valuePerSqm:args.valuePerSqm??null,classification:args.classification??""})});
    const data = await res.json().catch(()=>null);
    if (!res.ok||!data?.ok) return null;
    const payload = {lat:Number(data.lat),lon:Number(data.lon),label:String(data.displayName??qx),boundary:(data.boundary as Boundary|null)??null};
    centerCacheRef.current.set(key,payload);
    const bag = lsLoad<Record<string,{ts:number;lat:number;lon:number;label:string;boundary?:Boundary|null}>>(GEO_LS_KEY,{});
    bag[key]={ts:Date.now(),lat:payload.lat,lon:payload.lon,label:payload.label,boundary:payload.boundary??null};
    lsSave(GEO_LS_KEY,bag); return payload;
  }

  // Hazard-tag a set of zonal points and render them (map pins + results list).
  async function renderScanPoints(found: any[], myId: number) {
    const ptsBody = JSON.stringify({ points: found.map((p)=>({lat:Number(p.lat),lon:Number(p.lon)})) });
    let floods: any[] = [], slides: any[] = [], surges: any[] = [], faults: any[] = [];
    try {
      const [fr, lr, sr, qr] = await Promise.all([
        fetch("/api/flood-at",{method:"POST",headers:{"Content-Type":"application/json"},body:ptsBody}),
        fetch("/api/landslide-at",{method:"POST",headers:{"Content-Type":"application/json"},body:ptsBody}),
        fetch("/api/stormsurge-at",{method:"POST",headers:{"Content-Type":"application/json"},body:ptsBody}),
        fetch("/api/fault-at",{method:"POST",headers:{"Content-Type":"application/json"},body:ptsBody}),
      ]);
      const fd = await fr.json().catch(()=>null);
      const ld = await lr.json().catch(()=>null);
      const sd = await sr.json().catch(()=>null);
      const qd = await qr.json().catch(()=>null);
      if (fd?.ok && Array.isArray(fd.levels)) floods = fd.levels;
      if (ld?.ok && Array.isArray(ld.levels)) slides = ld.levels;
      if (sd?.ok && Array.isArray(sd.levels)) surges = sd.levels;
      if (qd?.ok && Array.isArray(qd.levels)) faults = qd.levels;
    } catch {}
    if (myId !== boundsReqRef.current) return;
    const FCOLOR:any = {0:"#10b981",1:"#ca8a04",2:"#ea580c",3:"#dc2626"};
    const esc = (s:any)=>String(s??"").replace(/[<>&]/g,(c)=>({"<":"&lt;",">":"&gt;","&":"&amp;"} as any)[c]);
    const pts = found.map((p,i)=>{
      const peso = "₱"+Number(p.value_per_sqm).toLocaleString("en-PH");
      const fl = floods[i];
      const floodLine = fl ? `<div style="font-size:11px;color:${FCOLOR[fl.level]||"#6b7280"};margin-top:2px;font-weight:700">🌊 ${fl.label} (100-yr flood)</div>` : "";
      const info = `<div style="font-family:system-ui,sans-serif;max-width:230px;padding:2px 4px">`+
        `<div style="font-weight:800;color:#1e3a8a;font-size:15px">${peso}<span style="font-size:11px;color:#6b7280;font-weight:600">/sqm</span></div>`+
        (p.street?`<div style="font-weight:600;font-size:12px;color:#374151;margin-top:2px">${esc(p.street)}</div>`:"")+
        `<div style="font-size:11px;color:#6b7280">${esc([p.barangay,p.city,p.province].filter(Boolean).join(", "))}</div>`+
        (p.classification_code?`<div style="font-size:11px;color:#9ca3af;margin-top:2px">${esc(p.classification_code)}</div>`:"")+
        floodLine+
        `</div>`;
      return { lat:Number(p.lat), lon:Number(p.lon), label:peso, info };
    });
    const results = found.map((p,i)=>({ ...p, floodLevel: floods[i]?.level ?? null, floodLabel: floods[i]?.label ?? null, landslideLevel: slides[i]?.level ?? null, landslideLabel: slides[i]?.label ?? null, stormSurgeLevel: surges[i]?.level ?? null, stormSurgeLabel: surges[i]?.label ?? null, faultLevel: faults[i]?.level ?? null, faultLabel: faults[i]?.label ?? null, faultDistance: faults[i]?.distance_m ?? null, faultName: faults[i]?.name ?? null }));
    if (myId !== boundsReqRef.current) return;
    setNearMePoints(pts);
    setScanResults(results as ScanResult[]);
  }

  const dedupePoints = (arr: any[]) => {
    const seen = new Set<string>(); const out: any[] = [];
    for (const p of arr) {
      if (!(p?.lat && p?.lon && p?.value_per_sqm)) continue;
      const k = `${Number(p.lat).toFixed(5)},${Number(p.lon).toFixed(5)}`;
      if (seen.has(k)) continue;
      seen.add(k); out.push(p);
    }
    return out;
  };

  // Scan tool: the user drew a box → show zonal values inside it. PHASE 1 shows the
  // already-saved points instantly (one fast DB query). If the area is already
  // well-covered we stop there (so repeat scans are instant). Otherwise PHASE 2
  // auto-geocodes new records for that area in the background and merges them in
  // (and saves them, so the NEXT scan of this area is instant too).
  // Clear the scan-results left panel (and the drawn box on the map). Used so the scan and
  // establishment panels never stack — only one shows on the left rail at a time.
  function clearScanPanel() {
    setScanResults([]); setScanNote(""); setScanLoading(false);
    setScanHazards(null); setScanHazardsLoading(false); setScanNearby([]);
    setScanFloodOverlay(null); setClearScanSignal((s) => s + 1);
  }

  async function onScanComplete(b: { minLat:number; maxLat:number; minLon:number; maxLon:number }) {
    setPoiCard(null); // scan takes over the left rail — close any open establishment panel
    setScanMode(false); // exit draw mode so the map is interactive again
    setScanLoading(true);
    setScanResults([]);
    setScanNote("");
    setScanNearby([]);
    setNearMePoints([]);
    const myId = ++boundsReqRef.current;
    const span = Math.max(b.maxLat - b.minLat, b.maxLon - b.minLon);
    // Guard: a too-large box = slow + many Google geocode calls + an overwhelming list.
    // Ask the user to zoom in. (For a whole city, the Search Zonal panel is the right tool.)
    if (span > 0.05) {
      setScanHazards(null); setScanHazardsLoading(false);
      setScanResults([]);
      setScanNote("Scanned area is too large — zoom in and scan a smaller spot. For a whole city, use Search Zonal.");
      setScanLoading(false);
      return;
    }
    // Hazard profile for the CENTER of the scanned area (uniform with the other panels).
    setScanHazards(null); setScanHazardsLoading(true);
    loadHazardProfile((b.minLat + b.maxLat) / 2, (b.minLon + b.maxLon) / 2)
      .then((hz) => { if (myId === boundsReqRef.current) { setScanHazards(hz); setScanHazardsLoading(false); } })
      .catch(() => { if (myId === boundsReqRef.current) setScanHazardsLoading(false); });
    // (No flood-color fill inside the box — the drawn square stays as a clean outline.)
    try {
      const bounds = `minLat=${b.minLat}&maxLat=${b.maxLat}&minLon=${b.minLon}&maxLon=${b.maxLon}`;

      // BUILDING MODE — a small box = the user pointed at one spot/block. Show ONLY that
      // place's zonal value (matched to its street/barangay), nothing else. Threshold kept in
      // sync with `isTiny` in app/api/scan-area/route.ts so the precise per-spot lookup runs.
      if (span < 0.012) {
        const autoData = await fetch(`/api/scan-area`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ minLat:b.minLat, maxLat:b.maxLat, minLon:b.minLon, maxLon:b.maxLon, domain, mode:"scan" }) }).then((r)=>r.json()).catch(()=>null);
        if (myId !== boundsReqRef.current) return;
        // Surrounding street values from our DB (same list the establishment panel shows).
        const nb: any[] = autoData?.ok && Array.isArray(autoData.nearby) ? autoData.nearby : [];
        setScanNearby(nb
          .map((p: any) => ({ value: Number(p.value_per_sqm), street: String(p.street||""), barangay: String(p.barangay||""), city: String(p.city||""), province: String(p.province||""), classification: String(p.classification||p.classification_code||"") }))
          .filter((p: NearbyZonal) => !!p.value)
          .slice(0, 60));
        const pts: any[] = autoData?.ok && Array.isArray(autoData.points) ? autoData.points : [];
        // No same-city value for this spot → say so instead of borrowing another city's.
        if (autoData?.noData) {
          const where = [autoData.scannedBarangay, autoData.scannedCity].filter(Boolean).join(", ");
          setScanNote(`No zonal value saved for ${where || "this area"} yet.`);
          await renderScanPoints([], myId);
          return;
        }
        // Building lookup → keep just the single matched value; otherwise the nearest one.
        const only = autoData?.building ? pts.slice(0, 1) : dedupePoints(pts).slice(0, 1);
        // carry the land-use breakdown (A/RR/CR) onto the result so the panel can offer a toggle
        if (only[0] && Array.isArray(autoData?.classes)) { only[0].classes = autoData.classes; only[0].pickedGroup = autoData?.defaultGroup || ""; }
        await renderScanPoints(only, myId);
        return;
      }

      // PHASE 1 — saved points (one fast query) → show immediately.
      const cachedData = await fetch(`/api/zonal-in-bounds?${bounds}&limit=300`).then((r)=>r.json()).catch(()=>null);
      if (myId !== boundsReqRef.current) return;
      const cached: any[] = cachedData?.ok && Array.isArray(cachedData.points) ? cachedData.points : [];
      let found = dedupePoints(cached);
      if (found.length) {
        await renderScanPoints(found, myId);
        if (myId !== boundsReqRef.current) return;
        setScanLoading(false); // saved values are on screen now — no waiting
      }

      // Already well-covered → skip the (slower) auto-geocode entirely.
      if (found.length >= 15) return;

      // PHASE 2 — auto-geocode new records for this area, then merge + re-render.
      const autoData = await fetch(`/api/scan-area`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ minLat:b.minLat, maxLat:b.maxLat, minLon:b.minLon, maxLon:b.maxLon, domain, mode:"scan" }) }).then((r)=>r.json()).catch(()=>null);
      if (myId !== boundsReqRef.current) return;
      const auto: any[] = autoData?.ok && Array.isArray(autoData.points) ? autoData.points : [];
      const merged = dedupePoints([...cached, ...auto]);
      if (merged.length !== found.length || found.length === 0) {
        found = merged;
        await renderScanPoints(found, myId);
      }
    } catch {} finally {
      if (myId === boundsReqRef.current) setScanLoading(false);
    }
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
      // ⚡ Fire the area description NOW (fire-and-forget) so it runs in PARALLEL with the
      // ideal-business call below instead of waiting for it to finish (was ~8s sequential → ~5s).
      describeArea({lat,lon,label:labelForDesc,row,poi:{counts:poi.counts,items:poi.items} as any});
      try {
        const aiRes = await fetch("/api/ideal-business",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({city:String(row?.["City-"]??""),barangay:String(row?.["Barangay-"]??""),province:String(row?.["Province-"]??""),classification:String(row?.["Classification-"]??""),zonalValuePerSqm:String(row?.["ZonalValuepersqm.-"]??""),poiCounts:poi.counts,lat,lon})});
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
      // (describeArea already fired above, in parallel)
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
      const ovr = geoOverride(String(r["City-"]??""), String(r["Province-"]??"")); // (SIQUIJOR)/(GUIMARAS) tag → real province for geocoding
      const cty = normalizeCityHint(ovr.city, ovr.province); const prov = ovr.province;
      const location = await geocodeWithZonalData({query:(isAllAreas||!street?[brgy,cty,prov]:[street,brgy,cty,prov]).filter(Boolean).join(", "),street:!isAllAreas&&street?street:undefined,barangay:brgy||undefined,city:cty||undefined,province:prov||undefined,baseLatLon,valuePerSqm:parseZonalValueToNumber(r["ZonalValuepersqm.-"])??null,classification:String(r["Classification-"]??"")});
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

  // Clicked a base-map establishment icon → show its name, the zonal value of that
  // land, and a list of nearby zonal values (click one to fly there).
  async function onPoiClick(placeId: string, lat: number, lon: number) {
    const myId = ++poiReqRef.current;
    clearScanPanel(); // establishment takes the left rail — close any open scan panel
    setPoiCard({ loading: true, name: "", address: "", lat, lon, value: null, classification: "", street: "", barangay: "", city: "", noData: false, scannedCity: "", nearby: [], nearbyLoading: true, hazards: null, hazardsLoading: true });
    // 1) establishment name + address (cheap, cached)
    const det = await fetch(`/api/place-details?placeId=${encodeURIComponent(placeId)}`).then(r=>r.json()).catch(()=>null);
    if (myId !== poiReqRef.current) return;
    const name = det?.ok ? String(det.name||"") : "";
    const address = det?.ok ? String(det.address||"") : "";
    const plat = det?.ok && Number.isFinite(Number(det.lat)) ? Number(det.lat) : lat;
    const plon = det?.ok && Number.isFinite(Number(det.lon)) ? Number(det.lon) : lon;
    setPoiCard(c => c ? { ...c, name, address, lat: plat, lon: plon } : c);
    await hydratePoint(plat, plon, myId);
  }

  // Shared: fill the panel with the zonal value + hazards + nearby for a point.
  // Used by both the establishment click and "Near me" so they look + behave identically.
  async function hydratePoint(plat: number, plon: number, myId: number) {
    // hazard profile for this exact spot (fire-and-forget; fills in when ready)
    loadHazardProfile(plat, plon).then(hz => {
      if (myId !== poiReqRef.current) return;
      setPoiCard(c => c ? { ...c, hazards: hz, hazardsLoading: false } : c);
    }).catch(() => { if (myId === poiReqRef.current) setPoiCard(c => c ? { ...c, hazardsLoading: false } : c); });
    // value of that exact spot + nearby zonals around it, in parallel.
    const dV = 0.0009, dN = 0.006; // ~100m building box, ~1.3km nearby box
    const [sa, nb] = await Promise.all([
      fetch(`/api/scan-area`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ minLat: plat-dV, maxLat: plat+dV, minLon: plon-dV, maxLon: plon+dV, domain }) }).then(r=>r.json()).catch(()=>null),
      fetch(`/api/zonal-in-bounds?minLat=${plat-dN}&maxLat=${plat+dN}&minLon=${plon-dN}&maxLon=${plon+dN}&limit=300`).then(r=>r.json()).catch(()=>null),
    ]);
    if (myId !== poiReqRef.current) return;
    const pt = sa?.ok && Array.isArray(sa.points) ? sa.points[0] : null;
    // PREFER the DB nearby list (the barangay's full street values, straight from our
    // database — rich even where nothing's been geocoded). Fall back to geocoded points.
    const seen = new Set<string>();
    let nearby: NearbyZonal[] = [];
    const dbNearby: any[] = sa?.ok && Array.isArray(sa.nearby) ? sa.nearby : [];
    if (dbNearby.length) {
      nearby = dbNearby
        .map((p: any) => ({
          value: Number(p.value_per_sqm), street: String(p.street||""), barangay: String(p.barangay||""),
          city: String(p.city||""), province: String(p.province||""), classification: String(p.classification||p.classification_code||""),
        }))
        .filter((p: NearbyZonal) => {
          if (!p.value) return false;
          const k = `${p.street}|${p.value}|${p.classification}`.toLowerCase();
          if (seen.has(k)) return false; seen.add(k); return true;
        })
        .slice(0, 60);
    } else {
      nearby = (nb?.ok && Array.isArray(nb.points) ? nb.points : [])
        .map((p: any) => {
          const dx = (Number(p.lon) - plon) * Math.cos((plat * Math.PI) / 180);
          const dy = Number(p.lat) - plat;
          return {
            lat: Number(p.lat), lon: Number(p.lon), value: Number(p.value_per_sqm),
            street: String(p.street||""), barangay: String(p.barangay||""), city: String(p.city||""),
            classification: String(p.classification_code||""), dist: Math.sqrt(dx*dx + dy*dy) * 111000,
          };
        })
        .filter((p: NearbyZonal) => {
          if (!p.value || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return false;
          const k = `${p.street}|${p.value}`.toLowerCase();
          if (seen.has(k)) return false; seen.add(k); return true;
        })
        .sort((a: NearbyZonal, b: NearbyZonal) => (a.dist??0) - (b.dist??0))
        .slice(0, 50);
    }
    setPoiCard(c => c ? {
      ...c, loading: false, nearbyLoading: false, nearby,
      value: pt?.value_per_sqm ?? null,
      classification: pt?.classification_code ?? "",
      street: pt?.street ?? "",
      barangay: pt?.barangay ?? "",
      city: pt?.city ?? "",
      noData: !!sa?.noData,
      scannedCity: String(sa?.scannedCity ?? pt?.city ?? ""),
      cityTypical: !!pt?.cityTypical,
    } : c);
  }

  // "Near me" → GPS → open the SAME panel (relabeled "Your Location") with the zonal
  // value + hazard profile + nearby for the user's current spot. Uniform with clicks.
  function runNearMe() {
    clearScanPanel(); // Near me takes the left rail — close any open scan panel
    const blank = { value: null as number | null, classification: "", street: "", barangay: "", city: "", noData: false, scannedCity: "", nearby: [] as NearbyZonal[], cityTypical: false };
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPoiCard({ loading: false, name: "Location unavailable", address: "This device doesn't support geolocation.", lat: 0, lon: 0, ...blank, noData: true, nearbyLoading: false, hazards: null, hazardsLoading: false, kind: "nearme" });
      return;
    }
    const myId = ++poiReqRef.current;
    setPoiCard({ loading: true, name: "Your location", address: "Locating you…", lat: 0, lon: 0, ...blank, nearbyLoading: true, hazards: null, hazardsLoading: true, kind: "nearme" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude, lon = pos.coords.longitude;
        if (myId !== poiReqRef.current) return;
        setSelectedLocation({ lat, lon });
        setPoiCard(c => c ? { ...c, lat, lon, address: `${lat.toFixed(5)}, ${lon.toFixed(5)}` } : c);
        if (typeof window !== "undefined" && window.innerWidth < 640) setLeftOpen(false);
        await hydratePoint(lat, lon, myId);
      },
      () => {
        if (myId !== poiReqRef.current) return;
        setPoiCard(c => c ? { ...c, loading: false, nearbyLoading: false, hazardsLoading: false, name: "Location unavailable", address: "Please allow location access to use Near me." } : c);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }

  // Fly the map to a nearby zonal item. DB items have no coords → geocode on demand
  // (respecting (SIQUIJOR)/(GUIMARAS) tags), then pan there.
  async function flyToNearby(n: NearbyZonal) {
    if (n.lat != null && n.lon != null) { setSelectedLocation({ lat: n.lat, lon: n.lon }); setBottomOpen(true); return; }
    const ovr = geoOverride(n.city, n.province);
    const q = [n.street, n.barangay, ovr.city || n.city, ovr.province, "Philippines"].filter(Boolean).join(", ");
    try {
      const res = await fetch("/api/geocode", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ query:q, street:n.street, hintBarangay:n.barangay, hintCity:ovr.city||n.city, hintProvince:ovr.province }) });
      const d = await res.json().catch(()=>null);
      if (d?.ok && Number.isFinite(Number(d.lat))) { setSelectedLocation({ lat:Number(d.lat), lon:Number(d.lon) }); setBottomOpen(true); }
    } catch {}
  }

  useEffect(()=>{ const t=setTimeout(()=>{ if (!domain) return; searchZonal({page:1}); },350); return ()=>clearTimeout(t); },[domain,city,barangay,classification,q]);

  const showingFrom   = totalRows ? (page-1)*itemsPerPage+1 : 0;
  const showingTo     = totalRows ? Math.min(page*itemsPerPage,totalRows) : rows.length;
  const selectedTitle = selectedRow ? `${String(selectedRow["Barangay-"]??"")}, ${String(selectedRow["City-"]??"")}, ${String(selectedRow["Province-"]??"")}` : geoLabel||"Select a property";
  const isDev = process.env.NODE_ENV==="development";
  const isAdmin = String(me?.role || "").toLowerCase() === "admin";

  return (
    <main className="fixed inset-0 h-screen w-full overflow-hidden bg-slate-100 text-gray-900">
      <ZonalSearchIndicator visible={loading} />

      <div className="absolute inset-0">
        <MapComponent key={mapKey} selected={selectedLocation} disablePickOnMap={true} onPoiClick={onPoiClick} popupLabel={geoLabel} boundary={boundary} highlightRadiusMeters={80} containerId="map-container" mapType={mapType as "street"|"terrain"|"satellite"} showStreetHighlight={showStreetHighlight} streetGeojson={streetGeo} streetGeojsonEnabled={showStreetHighlight} areaLabels={areaLabels} valuePoints={nearMePoints} scanMode={scanMode} onScanComplete={onScanComplete} floodTilesOn={floodOverlayOn} landslideTilesOn={landslideOverlayOn} stormSurgeTilesOn={stormSurgeOverlayOn} faultsOn={faultOverlayOn} liquefactionOn={liquefactionOn} tsunamiOn={tsunamiOn} groundRuptureOn={groundRuptureOn} scanFloodOverlay={scanFloodOverlay} clearScanBoxSignal={clearScanSignal} drawingMode={drawMode} onAreaMeasured={(info)=>{ setLandArea(info?info.areaSqm:null); setLandPath(info?info.path:null); }} clearDrawingSignal={clearDrawSignal} />
      </div>

      {/* Brand pill */}
      {/* Removed top-left partner header card fo-r a cleaner view */}

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
          <button
            onClick={resetToFirstVisit}
            className="flex items-center gap-2 px-3 py-2.5 text-xs font-semibold transition border-t border-gray-100 text-gray-700 hover:bg-gray-50"
            title="Reset map and selections"
          >
            <RefreshCw size={14} /> <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* LAND MEASUREMENT CARD */}
      {(drawMode || landArea != null) && (() => {
        const zonal = parseZonalValueToNumber(selectedRow?.["ZonalValuepersqm.-"]);
        const estValue = landArea != null && zonal ? landArea * zonal : null;
        const farFromZone = drawDistanceM != null && drawDistanceM > 1000; // >1 km → likely outside selected zone
        const distLabel = drawDistanceM == null ? "" : drawDistanceM >= 1000 ? `${(drawDistanceM/1000).toFixed(1)} km` : `${Math.round(drawDistanceM)} m`;
        return (
          <div
            className="absolute z-50 w-[88vw] sm:w-[340px]"
            style={areaCardPos ? { left: areaCardPos.x, top: areaCardPos.y } : { top: 16, left: 16 }}
          >
            <div className="rounded-2xl border-2 border-[#c9a84c] bg-white/95 backdrop-blur-xl overflow-hidden" style={{boxShadow:"0 26px 50px -16px rgba(15,23,42,0.42), 0 0 22px -6px rgba(201,168,76,0.28)"}}>
              <div
                onPointerDown={startAreaCardDrag}
                className="px-4 py-2.5 flex items-center justify-between cursor-move select-none touch-none"
                style={{background:"#1e3a8a"}}
                title="Drag to move"
              >
                <div className="text-sm font-bold text-[#f5f0eb] flex items-center gap-2 min-w-0">
                  <Ruler size={15} style={{color:"#c9a84c"}}/>
                  <span className="truncate">Land Area</span>
                  {areaCardMin && landArea != null && (
                    <span className="font-extrabold whitespace-nowrap" style={{color:"#c9a84c"}}>· {fmtArea(landArea, areaUnit)}</span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0" onPointerDown={(e)=>e.stopPropagation()}>
                  <button onClick={()=>setAreaCardMin(m=>!m)} className="rounded-lg p-1 text-white/60 hover:text-white transition" title={areaCardMin?"Expand":"Minimize"}>
                    <ChevronDown size={15} style={{transform: areaCardMin ? "rotate(-90deg)" : "none", transition:"transform .2s"}}/>
                  </button>
                  <button onClick={()=>{ setDrawMode(false); setLandArea(null); setClearDrawSignal(n=>n+1); }} className="rounded-lg p-1 text-white/60 hover:text-white transition" title="Close"><X size={15}/></button>
                </div>
              </div>
              {!areaCardMin && (
              <div className="p-4">
                {landArea == null ? (
                  <div className="text-xs text-gray-600 leading-relaxed">
                    <span className="font-bold text-[#1e3a8a]">Click on the map</span> to drop a corner at each edge of the land. Add at least <span className="font-bold">3 points</span> to close the shape. Drag the corners to fine-tune.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {/* unit toggle */}
                    <div className="flex items-center gap-1 rounded-lg p-0.5 w-fit" style={{background:"#f1f0ec"}}>
                      {([["sqm","sqm"],["ha","ha"],["sqft","ft²"]] as Array<["sqm"|"ha"|"sqft",string]>).map(([u,lbl])=>(
                        <button key={u} onClick={()=>setAreaUnit(u)} className="px-2.5 py-1 rounded-md text-[11px] font-bold transition" style={areaUnit===u?{background:"#1e3a8a",color:"#fff"}:{color:"#6b7280"}}>{lbl}</button>
                      ))}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Approx. Area</div>
                      <div className="text-3xl font-black leading-none" style={{color:"#1e3a8a"}}>{fmtArea(landArea, areaUnit)}</div>
                    </div>
                    {/* perimeter + sides */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg px-2.5 py-1.5 bg-gray-50 border border-gray-100">
                        <div className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Perimeter</div>
                        <div className="font-bold text-gray-800">{fmtLen(landMetrics.perimeterM, areaUnit)}</div>
                      </div>
                      <div className="rounded-lg px-2.5 py-1.5 bg-gray-50 border border-gray-100">
                        <div className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Corners</div>
                        <div className="font-bold text-gray-800">{landPath?.length ?? 0} points</div>
                      </div>
                    </div>
                    {landMetrics.sidesM.length > 0 && (
                      <div className="text-[10px] text-gray-500 leading-relaxed">
                        <span className="font-bold text-gray-600">Sides:</span> {landMetrics.sidesM.slice(0,8).map((s)=>fmtLen(s, areaUnit)).join(" · ")}{landMetrics.sidesM.length>8?` · +${landMetrics.sidesM.length-8} more`:""}
                      </div>
                    )}
                    {farFromZone && (
                      <div className="rounded-xl p-2.5 flex items-start gap-2 text-[11px] leading-snug" style={{background:"#fff7ed",border:"1px solid #fed7aa",color:"#9a3412"}}>
                        <span className="text-sm leading-none">⚠️</span>
                        <span>Your drawing is about <b>{distLabel}</b> from the selected property. Zonal values change by street/barangay, so <b>this value may not apply here.</b> Select the property that matches this location for an accurate estimate.</span>
                      </div>
                    )}
                    {estValue != null && (
                      <div className="rounded-xl p-3" style={farFromZone?{background:"#f8f7f5",border:"1px solid #e8e0d8",opacity:0.75}:{background:"#f5f0eb",border:"1px solid #e8e0d8"}}>
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{color:"#9a7a20"}}>Est. Land Value {farFromZone ? "(zonal may not apply)" : "(BIR Zonal)"}</div>
                        <div className="text-xl font-black" style={{color:"#1e3a8a"}}>{fmtPesoNumber(estValue)}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{Math.round(landArea).toLocaleString("en-PH")} sqm × {fmtPesoNumber(zonal!)}/sqm</div>
                      </div>
                    )}
                    <div className="text-[10px] text-gray-400 leading-snug">Approximate estimate from your drawing — not a substitute for a licensed survey or formal appraisal.</div>
                  </div>
                )}
                {landArea != null && (
                  <button
                    onClick={()=>{ setDrawMode(false); setAutoPreview(true); setRightOpen(true); }}
                    className="w-full mt-3 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-bold text-white transition hover:opacity-90"
                    style={{background:"linear-gradient(135deg,#1e3a8a,#1e40af)"}}
                    title="Generate the PDF report — includes this drawn parcel map"
                  >
                    <FileText size={14}/> Generate PDF Report
                  </button>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <button onClick={()=>{ setLandArea(null); setClearDrawSignal(n=>n+1); setDrawMode(true); }} className="flex-1 rounded-full border px-3 py-2 text-xs font-bold transition" style={{borderColor:"#e2d9d0",background:"#fff",color:"#374151"}}>Clear & Redraw</button>
                  <button onClick={()=>setDrawMode(false)} className="flex-1 rounded-full px-3 py-2 text-xs font-bold transition text-[#f5f0eb]" style={{background:"#1e3a8a"}}>Done</button>
                </div>
              </div>
              )}
            </div>
          </div>
        );
      })()}

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
              {/* Mobile-only: close the full-width drawer (the side toggle is off-screen on phones) */}
              <button onClick={()=>setLeftOpen(false)} className="sm:hidden shrink-0 rounded-lg p-1.5 text-white/80 hover:text-white transition" style={{background:"rgba(255,255,255,0.12)"}} title="Close panel" aria-label="Close panel">
                <X size={18} />
              </button>
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
              <input value={regionSearch} onChange={e=>setRegionSearch(e.target.value)} placeholder="Search city or province…" className="zsearch w-full rounded-xl border-0 pl-9 pr-8 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none transition" style={{background:"rgba(255,255,255,0.10)"}} />
              {searchLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2"><span className="zspin" /></div>}
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
                <button onClick={()=>{ if(typeof window!=="undefined"){localStorage.removeItem("facetCitiesCacheV3");localStorage.removeItem("facetBarangaysCacheV3");localStorage.removeItem("zonalCacheV1");loadCities(domain).catch(()=>{});} }} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition" style={{background:"rgba(255,255,255,0.10)",color:"#f5f0eb"}} title="Clear caches (dev only)">
                  <RefreshCw size={13}/> Refresh
                </button>
              )}
              {/* Report toggle removed as requested */}
            </div>
          </div>

          {/* Region picker */}
          {(showRegionPicker||(regionSearch.length>0&&matches.length>0))&&(
            <div className="px-3 pt-3 shrink-0">
              {searchLoading?(
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-3 py-2 bg-[#f5f0eb] border-b border-[#e8e0d8]"><div className="h-3 w-24 rounded bg-[#1e3a8a]/15 animate-pulse"/></div>
                  <div className="divide-y divide-gray-100">
                    {[0,1,2].map(i=>(
                      <div key={i} className="px-3 py-2.5 flex items-center gap-2 animate-pulse">
                        <div className="h-3.5 w-3.5 rounded-full bg-gray-200 shrink-0"/>
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 rounded bg-gray-200" style={{width:`${70-i*12}%`}}/>
                          <div className="h-2.5 w-1/3 rounded bg-gray-100"/>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ):matches.length>0?(
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-3 py-2 bg-[#f5f0eb] border-b border-[#e8e0d8] text-[11px] font-bold text-[#1e3a8a] uppercase tracking-wide flex items-center gap-1.5">{searchMode==="city"?<MapPin size={12}/>:<MapIcon size={12}/>}{searchMode==="city"?"Cities Found":"Provinces Found"} ({matches.length})</div>
                  <div className="max-h-56 overflow-auto">
                    {matches.map((m,idx)=>(
                      <button key={idx} className="w-full text-left px-3 py-2.5 text-sm hover:bg-[#f5f0eb] border-b last:border-b-0 transition"
                        onClick={()=>{
                          citiesReqGenerationRef.current++; setDomain(m.domain); setSelectedProvince(m.province); setSelectedProvinceCity(m.city);
                          setCity(""); setBarangay(""); setClassification(""); setQ(""); setPage(1); setRows([]); setErr("");
                          setSelectedRow(null); setPoiData(null); setDetailsErr(""); setFacetCities([]); setFacetBarangays([]);
                          setBoundary(null); setComps(null); setAreaDescription(""); setAreaDescErr(""); setRegionSearch("");
                          setShowRegionPicker(false); setShowFilters(true);              // close picker instantly (don't wait on geocode)
                          loadCities(m.domain,citiesReqGenerationRef.current);            // load city dropdown (non-blocking)
                          pinpointFilterLocation(m.city,"",m.province);                  // geocode in background (non-blocking)
                          // value query fires once via the debounced [domain] effect — no double-fetch
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
                  <select className="zselect w-full rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold text-gray-800 focus:outline-none transition disabled:opacity-50" value={city}
                    onChange={e=>{ const v=e.target.value; setCity(v); setShowStreetHighlight(false); setStreetGeo(null); setBarangay(""); setPage(1); setFacetBarangays([]); loadBarangays(domain,v); if(v) pinpointFilterLocation(v,"",selectedProvince); }}
                    disabled={facetsLoading||facetCities.length===0}>
                    <option value="">All Cities</option>{facetCities.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wide block mb-1.5">Barangay</label>
                  <select className="zselect w-full rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold text-gray-800 focus:outline-none transition disabled:opacity-50" value={barangay}
                    onChange={e=>{ const v=e.target.value; setBarangay(v); setShowStreetHighlight(false); setStreetGeo(null); setPage(1); if(city&&v) pinpointFilterLocation(city,v,selectedProvince); }}
                    disabled={!city||barangaysLoading}>
                    <option value="">All Barangays</option>{facetBarangays.map(b=><option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wide block mb-1.5">Classification</label>
                  <select className="zselect w-full rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold text-gray-800 focus:outline-none transition" value={classification} onChange={e=>{setClassification(e.target.value);setPage(1);}}>
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
                  {loading?<><Zap size={13} className="animate-spin"/>Searching<span className="zdots"><i/><i/><i/></span></>:"Search"}
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
              {loading&&rows.length===0&&[0,1,2,3,4,5].map(i=>(
                <div key={`sk-${i}`} className="w-full rounded-2xl border-2 border-gray-100 bg-white p-3 animate-pulse">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="h-3.5 rounded bg-gray-200" style={{width:`${78-i*6}%`}}/>
                      <div className="h-2.5 w-1/2 rounded bg-gray-100"/>
                    </div>
                    <div className="h-4 w-16 rounded-full bg-gray-100 shrink-0"/>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="h-5 w-24 rounded bg-gray-200"/>
                    <div className="h-3 w-6 rounded bg-gray-100"/>
                  </div>
                </div>
              ))}
              {rows.map((r,i)=>{
                const parsed = parseZonalValueToNumber(r["ZonalValuepersqm.-"]); const pricePerSqm = parsed??0;
                const tier = getPriceTier(pricePerSqm); const isActive = selectedRow?.rowIndex===r.rowIndex;
                return (
                  <button key={`${r.rowIndex}-${i}`} onClick={()=>selectRow(r)}
                    className={["w-full text-left rounded-2xl border-2 p-3 transition-all duration-200", isActive?"":"border-gray-200 bg-white"].join(" ")}
                    style={isActive?{borderColor:"#c9a84c",background:"linear-gradient(180deg,#f8f3ec,#f2ebdf)",boxShadow:"0 12px 28px -14px rgba(201,168,76,.5), inset 3px 0 0 #c9a84c"}:undefined}
                    onMouseEnter={e=>{ if(!isActive){const t=e.currentTarget as HTMLElement; t.style.borderColor="rgba(201,168,76,0.45)"; t.style.background="rgba(245,240,235,0.6)"; t.style.boxShadow="0 12px 26px -13px rgba(15,23,42,0.22)"; t.style.transform="translateY(-1px)";} }}
                    onMouseLeave={e=>{ if(!isActive){const t=e.currentTarget as HTMLElement; t.style.borderColor=""; t.style.background=""; t.style.boxShadow=""; t.style.transform="";} }}
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

        {/* Drawer toggle — vertically centered on the map's left edge (like Google Maps)
            so it never crowds the top toolbar / search box. */}
        <button onClick={toggleSearchPanel} className="h-16 self-center rounded-r-2xl bg-white/95 backdrop-blur border border-gray-200 border-l-0 shadow-xl px-2.5 flex items-center justify-center hover:bg-white transition z-50" title={leftOpen?"Collapse panel":"Expand panel"} aria-label={leftOpen?"Collapse panel":"Expand panel"}>
          {leftOpen?<ChevronLeft size={20} style={{color:"#1e3a8a"}}/>:<ChevronRight size={20} style={{color:"#1e3a8a"}}/>}
        </button>
      </div>

      {/* RIGHT REPORT DRAWER */}
      <div className={["absolute top-0 right-0 z-40 h-full transition-all duration-300",rightOpen?"w-full sm:w-[440px]":"w-0 overflow-hidden"].join(" ")}>
        {rightOpen&&(
          <div className="h-full bg-white border-l border-gray-200 shadow-2xl flex flex-col">
            <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{background:"#1e3a8a"}}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{background:"#1e40af"}}><FileText size={15}/></div>
                <div className="text-sm font-bold text-[#f5f0eb]">Property Report</div>
              </div>
              <button onClick={()=>setRightOpen(false)} className="rounded-xl p-1.5 transition text-white/50 hover:text-white" style={{background:"rgba(255,255,255,0.08)"}} title="Close"><X size={16}/></button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              <ReportBuilder selectedLocation={selectedLocation} selectedRow={selectedRow} geoLabel={geoLabel} poiLoading={poiLoading} poiData={poiData} poiRadiusKm={poiRadiusKm} onChangePoiRadius={onChangePoiRadius} idealBusinessText={idealBusinessText} setIdealBusinessText={setIdealBusinessText} areaDescription={areaDescription} mapContainerId="map-container" autoPreview={autoPreview} landAreaSqm={landArea} landPerimeterM={landMetrics.perimeterM || null} landZonalApplies={!(drawDistanceM != null && drawDistanceM > 1000)} landPath={landPath} />
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM SHEET — only when the search drawer is open AND a property/zonal is selected
          (keeps the default map clean; vanishes when the drawer is closed). */}
      <div className={["absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-[92vw] sm:w-[560px]", selectedRow ? "" : "hidden"].join(" ")}>
        <div className={["rounded-3xl border-2 border-gray-200 bg-white/98 backdrop-blur shadow-2xl overflow-hidden transition-all duration-300",bottomOpen?"max-h-[38vh]":"max-h-[52px]"].join(" ")}>
          <button onClick={()=>setBottomOpen(v=>!v)} className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 transition border-b border-gray-100">
            <div className="min-w-0 text-left"><div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1.5"><MapPin size={11} style={{color:"#1e3a8a"}}/> Selected Property</div><div className="text-sm font-bold text-gray-900 truncate mt-0.5">{selectedTitle}</div></div>
            <div className="shrink-0 ml-3 text-gray-500 bg-gray-100 p-1.5 rounded-lg transition-transform duration-300" style={{transform: bottomOpen ? "rotate(0deg)" : "rotate(-90deg)"}}><ChevronDown size={15}/></div>
          </button>
          {bottomOpen&&(
            <div className="px-4 pb-3 overflow-auto max-h-[calc(38vh-52px)]">
              {!selectedRow?(
                geoLoading?(
                  <div className="pt-3 space-y-2 animate-pulse">
                    <div className="h-3 w-32 rounded bg-gray-200"/>
                    <div className="h-5 w-48 rounded bg-gray-200"/>
                  </div>
                ):(
                  <div className="pt-3 text-sm text-gray-600"><div className="flex items-center gap-2"><MapPin size={15} style={{color:"#1e3a8a"}} className="shrink-0"/>Select a region, city, barangay, or click on a street from the list</div></div>
                )
              ):(
                <>
                  <div className="mt-3 rounded-2xl overflow-hidden shadow-md ring-1 ring-black/5">
                    <div className="zhero p-4 flex items-center justify-between gap-3" style={{background:"linear-gradient(135deg,#1e3a8a,#1e40af)"}}>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{color:"#c9a84c"}}><Coins size={12}/> Zonal Value</div>
                        <div className="text-3xl font-black text-white leading-none drop-shadow-sm">{parseZonalValueToNumber(selectedRow["ZonalValuepersqm.-"])?fmtPesoNumber(parseZonalValueToNumber(selectedRow["ZonalValuepersqm.-"])!):"Not Appraised"}</div>
                        <div className="text-[11px] font-semibold mt-1.5" style={{color:"rgba(201,168,76,0.85)"}}>per square meter</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-lg text-white truncate max-w-[170px]">{String(selectedRow["City-"]??"")}</div>
                        <div className="text-xs font-semibold truncate max-w-[170px]" style={{color:"rgba(255,255,255,0.7)"}}>{String(selectedRow["Barangay-"]??"")}</div>
                        <div className="truncate max-w-[170px] text-xs font-medium mt-0.5" style={{color:"rgba(201,168,76,0.7)"}}>{String(selectedRow["Street/Subdivision-"]??"")}</div>
                      </div>
                    </div>
                    {String(selectedRow["Classification-"]??"").trim()&&(
                      <div className="px-4 py-1.5 flex items-center gap-2" style={{background:"#f5f0eb",borderTop:"1px solid #e8e0d8"}}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:"#c9a84c"}}/>
                        <span className="text-[11px] font-bold uppercase tracking-wide" style={{color:"#1e3a8a"}}>{String(selectedRow["Classification-"]??"")}</span>
                      </div>
                    )}
                    {floodRisk&&(()=>{
                      const fc=({0:{bg:"#ecfdf5",dot:"#10b981",txt:"No flood"},1:{bg:"#fef9c3",dot:"#ca8a04",txt:"Low flood risk"},2:{bg:"#ffedd5",dot:"#ea580c",txt:"Moderate flood risk"},3:{bg:"#fee2e2",dot:"#dc2626",txt:"High flood risk"}} as any)[floodRisk.level]||{bg:"#f3f4f6",dot:"#9ca3af",txt:floodRisk.label};
                      return (
                        <div className="px-4 py-1.5 flex items-center gap-2" style={{background:fc.bg,borderTop:"1px solid #e8e0d8"}}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:fc.dot}}/>
                          <span className="text-[11px] font-bold uppercase tracking-wide" style={{color:"#1e3a8a"}}>{fc.txt} · 100-yr flood</span>
                        </div>
                      );
                    })()}
                    {landslideRisk&&(()=>{
                      const lc=({0:{bg:"#ecfdf5",dot:"#10b981",txt:"No landslide"},1:{bg:"#fef9c3",dot:"#ca8a04",txt:"Low landslide risk"},2:{bg:"#ffedd5",dot:"#9a3412",txt:"Moderate landslide risk"},3:{bg:"#fee2e2",dot:"#78350f",txt:"High landslide risk"}} as any)[landslideRisk.level]||{bg:"#f3f4f6",dot:"#9ca3af",txt:landslideRisk.label};
                      return (
                        <div className="px-4 py-1.5 flex items-center gap-2" style={{background:lc.bg,borderTop:"1px solid #e8e0d8"}}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:lc.dot}}/>
                          <span className="text-[11px] font-bold uppercase tracking-wide" style={{color:"#1e3a8a"}}>{lc.txt} · landslide</span>
                        </div>
                      );
                    })()}
                    {stormSurgeRisk&&(()=>{
                      const sc=({0:{bg:"#ecfdf5",dot:"#10b981",txt:"No storm surge"},1:{bg:"#ede9fe",dot:"#8b5cf6",txt:"Low storm-surge risk"},2:{bg:"#ddd6fe",dot:"#7c3aed",txt:"Moderate storm-surge risk"},3:{bg:"#e9d5ff",dot:"#6d28d9",txt:"High storm-surge risk"}} as any)[stormSurgeRisk.level]||{bg:"#f3f4f6",dot:"#9ca3af",txt:stormSurgeRisk.label};
                      return (
                        <div className="px-4 py-1.5 flex items-center gap-2" style={{background:sc.bg,borderTop:"1px solid #e8e0d8"}}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:sc.dot}}/>
                          <span className="text-[11px] font-bold uppercase tracking-wide" style={{color:"#1e3a8a"}}>{sc.txt} · worst-case surge</span>
                        </div>
                      );
                    })()}
                    {faultRisk&&(()=>{
                      const qc=({0:{bg:"#ecfdf5",dot:"#10b981"},1:{bg:"#fef9c3",dot:"#ca8a04"},2:{bg:"#ffedd5",dot:"#ea580c"},3:{bg:"#fee2e2",dot:"#dc2626"}} as any)[faultRisk.level]||{bg:"#f3f4f6",dot:"#9ca3af"};
                      const dist = faultRisk.distance_m < 1000 ? `${faultRisk.distance_m} m` : `${(faultRisk.distance_m/1000).toFixed(1)} km`;
                      return (
                        <div className="px-4 py-1.5 flex items-center gap-2" style={{background:qc.bg,borderTop:"1px solid #e8e0d8"}}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:qc.dot}}/>
                          <span className="text-[11px] font-bold uppercase tracking-wide" style={{color:"#1e3a8a"}}>{dist} from {faultRisk.name}</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Nearby zonal comparables (whole-barangay stats, with loaded sample as fallback) */}
                  {(() => {
                    const stats = barangayStats ?? compStats;
                    if (!stats) return null;
                    const whole = !!barangayStats;
                    const sel = parseZonalValueToNumber(selectedRow["ZonalValuepersqm.-"]);
                    const diffPct = sel && stats.median ? (sel / stats.median - 1) * 100 : null;
                    const brgyName = String(selectedRow["Barangay-"] ?? "").trim() || "this area";
                    return (
                      <div className="mt-3 rounded-2xl border border-gray-200 overflow-hidden">
                        <div className="px-3 py-1.5 flex items-center gap-1.5" style={{background:"#f5f0eb",borderBottom:"1px solid #e8e0d8"}}>
                          <Coins size={12} style={{color:"#9a7a20"}}/>
                          <span className="text-[11px] font-bold uppercase tracking-wide" style={{color:"#1e3a8a"}}>Nearby Zonal Values</span>
                          <span className="text-[10px] text-gray-500 ml-auto">{stats.count} {whole ? "in" : "loaded for"} {brgyName}</span>
                        </div>
                        <div className="p-3">
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div><div className="text-[9px] font-bold uppercase text-gray-400">Low</div><div className="text-sm font-black" style={{color:"#1e3a8a"}}>{fmtPesoNumber(stats.min)}</div></div>
                            <div><div className="text-[9px] font-bold uppercase text-gray-400">Median</div><div className="text-sm font-black" style={{color:"#1e3a8a"}}>{fmtPesoNumber(stats.median)}</div></div>
                            <div><div className="text-[9px] font-bold uppercase text-gray-400">High</div><div className="text-sm font-black" style={{color:"#1e3a8a"}}>{fmtPesoNumber(stats.max)}</div></div>
                          </div>
                          {diffPct != null && Number.isFinite(diffPct) && (
                            <div className="mt-2 text-center text-[11px] font-semibold" style={{color: Math.abs(diffPct) < 1 ? "#6b7280" : diffPct > 0 ? "#9a3412" : "#15803d"}}>
                              This property is {Math.abs(diffPct) < 1 ? "at the barangay median" : `${Math.abs(diffPct).toFixed(0)}% ${diffPct > 0 ? "above" : "below"} the barangay median`}
                            </div>
                          )}
                          <div className="mt-1.5 text-[9px] text-gray-400 text-center leading-snug">Based on BIR zonal values across {brgyName} — not market/listing prices.</div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="mt-3 flex items-center gap-2">
                    {/* Primary actions (scrollable) */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-1 min-w-0">
                      <button onClick={()=>{ setAutoPreview(false); setRightOpen(true); }} className="shrink-0 rounded-full px-4 py-2 text-xs font-bold transition text-[#f5f0eb]" style={{background:"#1e3a8a"}}>Open Report</button>
                      <button
                        onClick={()=>{ if(drawMode){ setDrawMode(false); } else { setLandArea(null); setClearDrawSignal(n=>n+1); setAreaCardMin(false); setMapType("satellite"); setDrawMode(true); if(typeof window!=="undefined"&&window.innerWidth<640){ setBottomOpen(false); } } }}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition"
                        style={drawMode?{borderColor:"#c9a84c",background:"#c9a84c",color:"#1e3a8a"}:{borderColor:"#c9a84c",background:"#fff",color:"#1e3a8a"}}
                        title="Draw your land boundary on the map to estimate its area and value"
                      >
                        <Ruler size={13}/> {drawMode?"Drawing…":"Measure Land"}
                      </button>
                      <button
                        onClick={()=>setBriefOpen(true)}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition text-white"
                        style={{background:"linear-gradient(135deg,#1e3a8a,#1e40af)"}}
                        title="Generate an AI investment brief for this property"
                      >
                        <Sparkles size={13}/> AI Brief
                      </button>
                    </div>

                    {/* Tools menu (opens upward, outside the scroll area so it isn't clipped) */}
                    <div className="relative shrink-0">
                      <button
                        onClick={()=>setToolsOpen(v=>!v)}
                        className="inline-flex items-center gap-1 rounded-full border px-3 py-2 text-xs font-bold transition"
                        style={toolsOpen?{borderColor:"#c9a84c",background:"#f5f0eb",color:"#1e3a8a"}:{borderColor:"#e2d9d0",background:"#fff",color:"#1e3a8a"}}
                        title="More tools"
                      >
                        Tools <ChevronDown size={13} style={{transform: toolsOpen?"rotate(180deg)":"none", transition:"transform .2s"}}/>
                      </button>
                      {toolsOpen && (
                        <>
                          <div className="fixed inset-0 z-[55]" onClick={()=>setToolsOpen(false)} />
                          <div className="absolute right-0 bottom-full mb-2 z-[56] w-52 rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
                            <button
                              onClick={async()=>{
                                setToolsOpen(false);
                                if(!selectedRow) return; setDetailsErr("");
                                if(showStreetHighlight){setShowStreetHighlight(false);setStreetGeo(null);return;}
                                const data = await fetchStreetGeometryFromSelectedRow(selectedRow);
                                if(data?.geojson&&Array.isArray((data.geojson as any).features)&&(data.geojson as any).features.length>0){setStreetGeo(data.geojson);setShowStreetHighlight(true);}
                                else{setStreetGeo(null);setShowStreetHighlight(false);setDetailsErr("Street line not found near this pin.");}
                              }}
                              disabled={streetGeoLoading}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-left text-gray-700 hover:bg-[#f5f0eb] transition border-b border-gray-100 disabled:opacity-50"
                            >
                              <MapPin size={14} style={{color:"#1e3a8a"}}/> {streetGeoLoading?"Finding…":showStreetHighlight?"Hide Street":"Highlight Street"}
                            </button>
                            <button
                              onClick={()=>{ setToolsOpen(false); setCalcOpen(true); }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-left text-gray-700 hover:bg-[#f5f0eb] transition border-b border-gray-100"
                            >
                              <Calculator size={14} style={{color:"#1e3a8a"}}/> Cost Calculator
                            </button>
                            <button
                              onClick={()=>{ setToolsOpen(false); setStreetViewOpen(true); }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-left text-gray-700 hover:bg-[#f5f0eb] transition border-b border-gray-100"
                            >
                              <Camera size={14} style={{color:"#1e3a8a"}}/> Street View
                            </button>
                            <button
                              onClick={()=>{ setToolsOpen(false); setSnapshotOpen(true); }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-left text-gray-700 hover:bg-[#f5f0eb] transition"
                            >
                              <ImageIcon size={14} style={{color:"#1e3a8a"}}/> Save Image
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {geoLoading&&<div className="text-xs text-gray-500 flex items-center gap-1.5"><RefreshCw size={12} className="animate-spin"/> Pinpointing…</div>}
                    {matchStatus&&<div className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-2xl px-3 py-1.5 flex items-center gap-2"><MapPin size={11}/>{matchStatus}</div>}
                    {detailsErr&&<div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl px-3 py-1.5">{detailsErr}</div>}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* COST CALCULATOR (taxes + fees + loan, one place) */}
      <PropertyCalculator
        open={calcOpen}
        onClose={()=>setCalcOpen(false)}
        defaultValue={landArea && parseZonalValueToNumber(selectedRow?.["ZonalValuepersqm.-"]) ? landArea * parseZonalValueToNumber(selectedRow?.["ZonalValuepersqm.-"])! : null}
        locationLabel={selectedTitle}
      />

      {/* AI INVESTMENT BRIEF */}
      <InvestmentBrief
        open={briefOpen}
        onClose={()=>setBriefOpen(false)}
        locationLabel={selectedTitle}
        payload={(()=>{
          const z = parseZonalValueToNumber(selectedRow?.["ZonalValuepersqm.-"]);
          const landValue = landArea && z ? landArea * z : null;
          let monthly = 0;
          if (landValue) { const p = landValue*0.8, r = 6.5/100/12, n = 240, f = Math.pow(1+r,n); monthly = p*r*f/(f-1); }
          return {
            city: String(selectedRow?.["City-"] ?? ""),
            barangay: String(selectedRow?.["Barangay-"] ?? ""),
            province: String(selectedRow?.["Province-"] ?? ""),
            classification: String(selectedRow?.["Classification-"] ?? ""),
            zonalValue: String(selectedRow?.["ZonalValuepersqm.-"] ?? ""),
            landAreaSqm: landArea,
            landValue,
            comps: barangayStats ?? compStats,
            poiCounts: poiData?.counts ?? null,
            monthly: monthly || null,
            downPct: 20,
            lat: selectedLocation?.lat ?? null,
            lon: selectedLocation?.lon ?? null,
          };
        })()}
      />

      {/* STREET VIEW */}
      <StreetViewModal
        open={streetViewOpen}
        onClose={()=>setStreetViewOpen(false)}
        lat={selectedLocation?.lat ?? null}
        lon={selectedLocation?.lon ?? null}
        locationLabel={selectedTitle}
      />

      {/* PROPERTY SNAPSHOT (shareable image) */}
      <PropertySnapshot
        open={snapshotOpen}
        onClose={()=>setSnapshotOpen(false)}
        data={(()=>{
          const z = parseZonalValueToNumber(selectedRow?.["ZonalValuepersqm.-"]);
          const landValue = landArea && z ? landArea * z : null;
          let monthly = 0;
          if (landValue) { const p = landValue*0.8, r = 6.5/100/12, n = 240, f = Math.pow(1+r,n); monthly = p*r*f/(f-1); }
          return {
            barangay: String(selectedRow?.["Barangay-"] ?? ""),
            city: String(selectedRow?.["City-"] ?? ""),
            province: String(selectedRow?.["Province-"] ?? ""),
            classification: String(selectedRow?.["Classification-"] ?? ""),
            zonal: z,
            landAreaSqm: landArea,
            landValue,
            comps: barangayStats ?? compStats,
            monthly: monthly || null,
            poiCounts: poiData?.counts ?? null,
            dateLabel: new Date().toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }),
            path: landPath,
          };
        })()}
      />

      {/* ZONAL AI ASSISTANT (bottom-right chat) */}
      <ZonalAssistant
        domain={domain}
        context={selectedRow ? {
          street: String(selectedRow["Street/Subdivision-"] ?? ""),
          barangay: String(selectedRow["Barangay-"] ?? ""),
          city: String(selectedRow["City-"] ?? ""),
          province: String(selectedRow["Province-"] ?? ""),
          classification: String(selectedRow["Classification-"] ?? ""),
          zonalValue: String(selectedRow["ZonalValuepersqm.-"] ?? ""),
          flood: floodRisk?.label,
          landslide: landslideRisk?.label,
          stormSurge: stormSurgeRisk?.label,
        } : null}
      />

      {/* MAP TOOLS: "Near me" (GPS) + "Scan area" (draw a box → zonal values inside) */}
      <MapTools
        onLocate={(lat, lon) => setSelectedLocation({ lat, lon })}
        onNearMe={runNearMe}
        onSearchZonal={toggleSearchPanel}
        searchZonalActive={leftOpen}
        scanActive={scanMode}
        onScanToggle={() => { setPoiCard(null); setScanMode((v) => !v); setScanResults([]); setScanNote(""); setNearMePoints([]); setScanFloodOverlay(null); setScanHazards(null); setScanHazardsLoading(false); setScanNearby([]); setClearScanSignal((s) => s + 1); }}
        scanResults={scanResults}
        scanNote={scanNote}
        scanLoading={scanLoading}
        onPickResult={(r) => setSelectedLocation({ lat: r.lat, lon: r.lon })}
        floodOn={floodOverlayOn}
        onFloodToggle={() => setFloodOverlayOn((v) => !v)}
        landslideOn={landslideOverlayOn}
        onLandslideToggle={() => setLandslideOverlayOn((v) => !v)}
        stormSurgeOn={stormSurgeOverlayOn}
        onStormSurgeToggle={() => setStormSurgeOverlayOn((v) => !v)}
        faultsOn={faultOverlayOn}
        onFaultToggle={() => setFaultOverlayOn((v) => !v)}
        liquefactionOn={liquefactionOn}
        onLiquefactionToggle={() => setLiquefactionOn((v) => !v)}
        tsunamiOn={tsunamiOn}
        onTsunamiToggle={() => setTsunamiOn((v) => !v)}
        groundRuptureOn={groundRuptureOn}
        onGroundRuptureToggle={() => setGroundRuptureOn((v) => !v)}
        mapType={mapType}
        sidebarOpen={leftOpen}
        leftPanelOpen={leftOpen || !!poiCard || scanLoading || scanResults.length > 0 || !!scanNote}
      />

      {/* ESTABLISHMENT PANEL — click a building/business icon on the map → full-height
          sidebar with its name, the zonal value of that land, and nearby zonal values
          (click one to fly there). */}
      {poiCard && (
        <div
          className="epx fixed left-0 top-0 z-[58] h-full w-full sm:w-[380px]"
          style={{ animation: "poiSlideIn 0.25s ease-out" }}
        >
          {/* Header */}
          <header className="header">
            <div className="head-top">
              <div className="brand">
                <span className="logo" aria-hidden="true">Z</span>
                <span className="brand-txt"><b>ZONAL</b>VALUE&nbsp;·&nbsp;PH</span>
              </div>
              <div className="head-actions">
                <button className="iconbtn" onClick={() => setPoiCard(null)} title="Close" aria-label="Close">
                  <X size={15} />
                </button>
              </div>
            </div>
            <span className="head-tag">
              {poiCard.kind === "nearme" ? <><Crosshair size={11} /> Zonal value near you</> : <><Building2 size={11} /> Property Due-Diligence</>}
            </span>
          </header>

          <div className="body">
            {/* Name + address */}
            <div className="title-block">
              <div className="eyebrow">{poiCard.kind === "nearme" ? "Your Location" : "Establishment"}</div>
              {poiCard.loading && !poiCard.name ? (
                <h1 className="estab-name" style={{ opacity: 0.5 }}>Reading this place…</h1>
              ) : (
                <h1 className="estab-name">{poiCard.name || "This location"}</h1>
              )}
              {poiCard.address && (
                <div className="address">
                  <MapPin size={13} /><span>{cleanAddr(poiCard.address)}</span>
                </div>
              )}
            </div>

            {/* Zonal value hero */}
            <section className="hero" aria-label="Zonal value">
              <div className="hero-in">
                <div className="hero-label"><span className="dot" /> Zonal value of this land</div>
                {poiCard.loading ? (
                  <div className="hero-value" style={{ opacity: 0.6 }}><span className="num" style={{ fontSize: 26 }}>…</span></div>
                ) : poiCard.value != null ? (
                  <>
                    <div className="hero-value">
                      <span className="cur">₱</span>
                      <span className="num">{poiCard.value.toLocaleString("en-PH")}</span>
                      <span className="per">/ sqm</span>
                    </div>
                    <div className="hero-meta">
                      {poiCard.classification && <span className="chip"><b>{poiCard.classification}</b></span>}
                      {poiCard.cityTypical
                        ? <span className="chip" style={{ background: "#fffbeb", borderColor: "#fde68a", color: "#92400e" }}>City-typical</span>
                        : <span className="chip">BIR-indexed</span>}
                    </div>
                    {poiCard.cityTypical ? (
                      <div className="hero-applies" style={{ alignItems: "flex-start" }}>
                        <Crosshair size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span><b>Typical value for {[poiCard.barangay, poiCard.city].filter(Boolean).join(", ") || "this city"}.</b> A representative city rate for this area — for a specific lot, search its exact street.</span>
                      </div>
                    ) : (
                      [poiCard.street, poiCard.barangay, poiCard.city].filter(Boolean).length > 0 && (
                        <div className="hero-applies">
                          <Crosshair size={13} />
                          <span>Value applies to <b>{[poiCard.street, poiCard.barangay, poiCard.city].filter(Boolean).join(", ")}</b></span>
                        </div>
                      )
                    )}
                  </>
                ) : (
                  <div className="hero-applies" style={{ borderTop: "none", paddingTop: 6 }}>
                    <span>No zonal value saved for {poiCard.scannedCity || "this area"} yet.</span>
                  </div>
                )}
              </div>
            </section>

            {/* HAZARD PROFILE — above nearby values */}
            <section className="section" aria-label="Hazard profile">
              <div className="sec-head">
                <div className="sec-title">
                  <span className="mark" />
                  <div><h2>Hazard Profile</h2><div className="sub">Risk for this exact spot</div></div>
                </div>
                <span className="pill">6 checks</span>
              </div>
              {poiCard.hazardsLoading || !poiCard.hazards ? (
                <div className="haz-wrap" style={{ padding: 18, display: "flex", alignItems: "center", gap: 10, color: "#64748b", fontSize: 12 }}>
                  <span className="zspin" /> Assessing geohazards<span className="zdots"><i/><i/><i/></span>
                </div>
              ) : (
                <HazardRows hz={poiCard.hazards} />
              )}
            </section>

            {/* Nearby zonal values */}
            <section className="section" aria-label="Nearby zonal values">
              <div className="sec-head">
                <div className="sec-title">
                  <span className="mark" />
                  <div><h2>Nearby Zonal Values</h2><div className="sub">Tap a parcel to fly there</div></div>
                </div>
                {!poiCard.nearbyLoading && poiCard.nearby.length > 0 && <span className="pill">{poiCard.nearby.length} found</span>}
              </div>
              {poiCard.nearbyLoading ? (
                <div className="haz-wrap" style={{ padding: 16, display: "flex", alignItems: "center", gap: 10, color: "#64748b", fontSize: 12 }}>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#1e3a8a]" /> Loading nearby values…
                </div>
              ) : poiCard.nearby.length === 0 ? (
                <div className="haz-wrap" style={{ padding: 16, color: "#64748b", fontSize: 12 }}>No other saved zonal values near here yet.</div>
              ) : (
                <div className="nearby">
                  {poiCard.nearby.map((n, i) => (
                    <button key={i} type="button" className="nb" onClick={() => flyToNearby(n)}>
                      <div className="nb-dist">
                        <div className="d">{n.dist != null ? (n.dist < 1000 ? Math.round(n.dist) : (n.dist / 1000).toFixed(1)) : "—"}</div>
                        <div className="u">{n.dist != null && n.dist >= 1000 ? "km" : "m"}</div>
                      </div>
                      <div className="nb-div" />
                      <div className="nb-mid">
                        <div className="nb-price">₱{n.value.toLocaleString("en-PH")} <small>/ sqm</small></div>
                        <div className="nb-where">{[n.street, n.barangay, n.city].filter(Boolean).join(" · ")}</div>
                      </div>
                      {n.classification && <span className="nb-cls">{n.classification}</span>}
                      <span className="nb-fly"><ChevronRight size={14} /></span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* SCAN RESULTS PANEL — same .epx format as the establishment panel (left rail) */}
      {(scanLoading || scanResults.length > 0 || !!scanNote) && (
        <div className="epx fixed left-0 top-0 z-[57] h-full w-full sm:w-[380px]" style={{ animation: "poiSlideIn 0.25s ease-out" }}>
          <header className="header">
            <div className="head-top">
              <div className="brand">
                <span className="logo" aria-hidden="true"><Scan size={15} style={{ color: "#1a2b56" }} /></span>
                <span className="brand-txt"><b>SCAN</b>&nbsp;RESULTS</span>
              </div>
              <div className="head-actions">
                <button className="iconbtn" onClick={() => { setScanResults([]); setScanNote(""); setScanMode(false); setScanFloodOverlay(null); setScanHazards(null); setScanHazardsLoading(false); setScanNearby([]); setClearScanSignal((s) => s + 1); }} title="Close" aria-label="Close"><X size={15} /></button>
              </div>
            </div>
            <span className="head-tag"><Scan size={11} /> Area Scan</span>
          </header>
          <div className="body">
            <div className="title-block">
              <div className="eyebrow">Area Scan</div>
              <h1 className="estab-name">{scanLoading ? "Scanning…" : scanResults.length ? `${scanResults.length} zonal value${scanResults.length > 1 ? "s" : ""}` : "No data here"}</h1>
              <div className="address">
                <MapPin size={13} />
                <span>{scanResults.length ? "Found inside the area you scanned · tap one to fly there" : (scanNote || "Inside the area you scanned")}</span>
              </div>
            </div>
            <section className="section" aria-label="Zonal values">
              <div className="sec-head">
                <div className="sec-title"><span className="mark" /><div><h2>Zonal Values</h2><div className="sub">Tap a parcel to fly there</div></div></div>
                {!scanLoading && scanResults.length > 0 && <span className="pill">{scanResults.length} found</span>}
              </div>
              {scanLoading ? (
                <div className="haz-wrap" style={{ padding: 18, display: "flex", alignItems: "center", gap: 10, color: "#64748b", fontSize: 12 }}>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#1e3a8a]" /> Reading the area…
                </div>
              ) : scanResults.length === 0 ? (
                <div className="haz-wrap" style={{ padding: 16, color: "#64748b", fontSize: 12 }}>{scanNote || "No zonal values saved in that area yet."}</div>
              ) : (
                <div className="nearby">
                  {scanResults.map((r, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button type="button" className="nb" style={{ flexDirection: "column", alignItems: "stretch", gap: 7 }} onClick={() => setSelectedLocation({ lat: r.lat, lon: r.lon })}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                          <span className="nb-price" style={{ fontSize: 18 }}>₱{Number(r.value_per_sqm).toLocaleString("en-PH")} <small>/ sqm</small></span>
                          {r.matchType === "city typical"
                            ? <span className="nb-cls" style={{ background: "#fffbeb", borderColor: "#fde68a", color: "#92400e" }}>City-typical</span>
                            : (r.classification_code && <span className="nb-cls">{r.classification_code}</span>)}
                        </div>
                        <div className="nb-where" style={{ whiteSpace: "normal" }}>{[r.street, r.barangay, r.city].filter(Boolean).join(" · ")}</div>
                        {r.matchType === "city typical" && <div style={{ fontSize: 10, color: "#92400e", lineHeight: 1.4 }}>Representative city rate for this area.</div>}
                        {(r.floodLabel != null || r.landslideLabel != null || r.stormSurgeLabel != null || r.faultDistance != null) && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 1 }}>
                            {r.floodLevel != null && <ScanHazChip level={r.floodLevel} label={hzLabel(r.floodLevel, "flood")} />}
                            {r.landslideLevel != null && <ScanHazChip level={r.landslideLevel} label={hzLabel(r.landslideLevel, "landslide")} />}
                            {r.stormSurgeLevel != null && <ScanHazChip level={r.stormSurgeLevel} label={hzLabel(r.stormSurgeLevel, "surge")} />}
                            {r.faultDistance != null && <ScanHazChip level={r.faultLevel ?? 0} label={`${r.faultDistance < 1000 ? Math.round(r.faultDistance) + " m" : (r.faultDistance / 1000).toFixed(1) + " km"} to fault`} />}
                          </div>
                        )}
                      </button>
                      {/* land-use toggle: switch A / RR / CR when the auto-guess isn't right for this lot */}
                      {Array.isArray(r.classes) && r.classes.length > 1 && (
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5, padding: "0 2px 2px" }}>
                          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#94a3b8", marginRight: 1 }}>Land use:</span>
                          {r.classes.map((c) => {
                            const active = (r.pickedGroup ? r.pickedGroup === c.group : Number(r.value_per_sqm) === c.value);
                            return (
                              <button key={c.group} type="button"
                                onClick={() => setScanResults((prev) => prev.map((x, idx) => idx === i ? ({ ...x, value_per_sqm: c.value, classification_code: c.code, pickedGroup: c.group }) : x))}
                                style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 100, cursor: "pointer", transition: "all .15s ease", border: `1px solid ${active ? "#c9a84c" : "#e6dec8"}`, background: active ? "linear-gradient(180deg,#f0deaa,#c9a84c)" : "#fff", color: active ? "#1a2b56" : "#64748b" }}
                                title={`Use the ${c.label.toLowerCase()} value`}>
                                {c.label} ₱{Number(c.value).toLocaleString("en-PH")}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Hazard profile for the scanned area — below the zonal values */}
            <section className="section" aria-label="Hazard profile">
              <div className="sec-head">
                <div className="sec-title"><span className="mark" /><div><h2>Hazard Profile</h2><div className="sub">Center of the scanned area</div></div></div>
                <span className="pill">6 checks</span>
              </div>
              {scanHazardsLoading || !scanHazards ? (
                <div className="haz-wrap" style={{ padding: 18, display: "flex", alignItems: "center", gap: 10, color: "#64748b", fontSize: 12 }}>
                  <span className="zspin" /> Assessing geohazards<span className="zdots"><i/><i/><i/></span>
                </div>
              ) : (<HazardRows hz={scanHazards} />)}
            </section>

            {/* Nearby zonal values — surrounding street values from our DB (same as the
                establishment panel). Shown for a focused (building) scan. */}
            {scanNearby.length > 0 && (
              <section className="section" aria-label="Nearby zonal values">
                <div className="sec-head">
                  <div className="sec-title"><span className="mark" /><div><h2>Nearby Zonal Values</h2><div className="sub">Streets around this spot · tap to fly</div></div></div>
                  <span className="pill">{scanNearby.length}</span>
                </div>
                <div className="nearby">
                  {scanNearby.map((n, i) => (
                    <button key={i} type="button" className="nb" onClick={() => flyToNearby(n)}>
                      <div className="nb-dist">
                        <div className="d">{n.dist != null ? (n.dist < 1000 ? Math.round(n.dist) : (n.dist / 1000).toFixed(1)) : "—"}</div>
                        <div className="u">{n.dist != null && n.dist >= 1000 ? "km" : "m"}</div>
                      </div>
                      <div className="nb-div" />
                      <div className="nb-mid">
                        <div className="nb-price">₱{n.value.toLocaleString("en-PH")} <small>/ sqm</small></div>
                        <div className="nb-where">{[n.street, n.barangay, n.city].filter(Boolean).join(" · ")}</div>
                      </div>
                      {n.classification && <span className="nb-cls">{n.classification}</span>}
                      <span className="nb-fly"><ChevronRight size={14} /></span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export function HomePage() {
  // The full-screen map view (Home) renders its own header with the home icon
  // and "Back to Dashboard", so no extra header is needed here. Wrapping it in
  // a fixed full-viewport box prevents any page scroll / empty gaps.
  return <Home />;
}

export default HomePage;