"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { MapPin, X, Loader2, Scan, Waves, Mountain, Tornado, Activity, Search, Droplets, AlertTriangle, Layers, ChevronDown } from "lucide-react";

const NAVY = "#1e3a8a";
const GOLD = "#c9a84c";

export type ScanResult = {
  lat: number;
  lon: number;
  value_per_sqm: number;
  classification_code?: string;
  street?: string;
  barangay?: string;
  city?: string;
  province?: string;
  floodLevel?: number | null;
  floodLabel?: string | null;
  landslideLevel?: number | null;
  landslideLabel?: string | null;
  stormSurgeLevel?: number | null;
  stormSurgeLabel?: string | null;
  faultLevel?: number | null;
  faultLabel?: string | null;
  faultDistance?: number | null;
  faultName?: string | null;
  matchType?: string | null;
  classes?: { group: string; label: string; value: number; code: string }[]; // land-use breakdown (A/RR/CR…) for the toggle
  pickedGroup?: string; // which land-use the user/auto selected
};

// A hazard legend styled like the scan-results panel (rounded card, navy header,
// gold border) so the overlays feel polished, not boxy.
function LegendCard({ title, icon, items }: { title: string; icon: ReactNode; items: [string, string][] }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ border: `2px solid ${GOLD}` }}>
      <div className="flex items-center gap-1.5 px-3 py-2 text-white" style={{ background: NAVY }}>
        {icon}
        <span className="text-[12px] font-bold">{title}</span>
      </div>
      <div className="space-y-1 px-3 py-2.5">
        {items.map(([c, t]) => (
          <div key={t} className="flex items-center gap-2 text-[11px] font-semibold text-gray-700">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} /> {t}
          </div>
        ))}
      </div>
    </div>
  );
}


export default function MapTools({
  onLocate,
  onNearMe,
  onSearchZonal,
  searchZonalActive,
  scanActive,
  onScanToggle,
  scanResults,
  scanNote,
  scanLoading,
  onPickResult,
  floodOn,
  onFloodToggle,
  landslideOn,
  onLandslideToggle,
  stormSurgeOn,
  onStormSurgeToggle,
  faultsOn,
  onFaultToggle,
  liquefactionOn,
  onLiquefactionToggle,
  tsunamiOn,
  onTsunamiToggle,
  groundRuptureOn,
  onGroundRuptureToggle,
  mapType,
  sidebarOpen,
  leftPanelOpen,
}: {
  onLocate: (lat: number, lon: number) => void;
  onNearMe: () => void;
  onSearchZonal: () => void;
  searchZonalActive?: boolean;
  scanActive: boolean;
  onScanToggle: () => void;
  scanResults: ScanResult[];
  scanNote?: string;
  scanLoading: boolean;
  onPickResult: (r: ScanResult) => void;
  floodOn: boolean;
  onFloodToggle: () => void;
  landslideOn: boolean;
  onLandslideToggle: () => void;
  stormSurgeOn: boolean;
  onStormSurgeToggle: () => void;
  faultsOn: boolean;
  onFaultToggle: () => void;
  liquefactionOn: boolean;
  onLiquefactionToggle: () => void;
  tsunamiOn: boolean;
  onTsunamiToggle: () => void;
  groundRuptureOn: boolean;
  onGroundRuptureToggle: () => void;
  mapType?: string;
  sidebarOpen?: boolean;
  leftPanelOpen?: boolean;
}) {
  const [hazardsOpen, setHazardsOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState("");
  type Suggestion = { description: string; main: string; secondary: string; placeId: string };
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const suppressFetch = useRef(false); // skip the autocomplete fetch right after a pick/submit

  // Debounced Google-style place suggestions as the user types.
  useEffect(() => {
    const q = searchQ.trim();
    if (suppressFetch.current) { suppressFetch.current = false; return; }
    if (q.length < 2) { setSuggestions([]); setShowSuggest(false); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places-autocomplete?q=${encodeURIComponent(q)}`);
        const data = await res.json().catch(() => null);
        const list: Suggestion[] = data?.ok && Array.isArray(data.suggestions) ? data.suggestions : [];
        setSuggestions(list);
        setShowSuggest(list.length > 0);
        setActiveIdx(-1);
      } catch {
        setSuggestions([]);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [searchQ]);

  // Geocode a place string and fly there (Google-Maps-style search).
  const doSearch = async (overrideQuery?: string) => {
    const raw = (overrideQuery ?? searchQ).trim();
    if (!raw || searching) return;
    setShowSuggest(false);
    setSuggestions([]);
    setSearching(true);
    setSearchErr("");
    try {
      const query = /philippines|,\s*ph$/i.test(raw) ? raw : `${raw}, Philippines`;
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json().catch(() => null);
      if (data?.ok && Number.isFinite(data.lat) && Number.isFinite(data.lon)) {
        onLocate(Number(data.lat), Number(data.lon));
      } else {
        setSearchErr("Place not found. Try adding the city or province.");
      }
    } catch {
      setSearchErr("Couldn't search right now.");
    } finally {
      setSearching(false);
    }
  };

  const pickSuggestion = (s: Suggestion) => {
    suppressFetch.current = true;
    setSearchQ(s.description);
    setShowSuggest(false);
    setActiveIdx(-1);
    doSearch(s.description);
  };

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggest || suggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => (i + 1) % suggestions.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length); }
    else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); pickSuggestion(suggestions[activeIdx]); }
    else if (e.key === "Escape") { setShowSuggest(false); }
  };

  // Icon-only on phones (label hidden), full label on >= sm. Keeps one tidy row.
  const pill = "flex items-center gap-1.5 rounded-full p-2.5 sm:px-3.5 sm:py-2 text-[13px] font-bold shadow-[0_8px_22px_-8px_rgba(15,23,42,0.4)] transition-all duration-200 hover:scale-105 hover:shadow-[0_12px_28px_-10px_rgba(15,23,42,0.5)] active:scale-95";
  const lbl = "hidden sm:inline";

  // All overlay layers, grouped under one "Hazards" dropdown to keep the toolbar tidy.
  const HAZARDS = [
    { label: "Flood", on: floodOn, toggle: onFloodToggle, Icon: Waves, color: "#0ea5e9" },
    { label: "Landslide", on: landslideOn, toggle: onLandslideToggle, Icon: Mountain, color: "#92400e" },
    { label: "Storm surge", on: stormSurgeOn, toggle: onStormSurgeToggle, Icon: Tornado, color: "#6d28d9" },
    { label: "Fault", on: faultsOn, toggle: onFaultToggle, Icon: Activity, color: "#b91c1c" },
    { label: "Liquefaction", on: liquefactionOn, toggle: onLiquefactionToggle, Icon: Droplets, color: "#d97706" },
    { label: "Tsunami", on: tsunamiOn, toggle: onTsunamiToggle, Icon: Waves, color: "#0891b2" },
    { label: "Ground Rupture", on: groundRuptureOn, toggle: onGroundRuptureToggle, Icon: AlertTriangle, color: "#dc2626" },
  ];
  const activeHazards = HAZARDS.filter((h) => h.on).length;

  return (
    <>
      {/* Top-center toolbar */}
      <div className={`fixed top-3 z-[60] flex max-w-[96vw] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 transition-[left] duration-300 sm:top-4 sm:gap-2 ${sidebarOpen ? "left-1/2 lg:left-[calc(50%+200px)]" : "left-1/2"}`}>
        <button onClick={onSearchZonal} className={`${pill} text-white`} style={{ background: searchZonalActive ? "#b5923f" : NAVY, border: `2px solid ${GOLD}`, boxShadow: searchZonalActive ? "0 0 16px rgba(201,168,76,.55), 0 8px 20px -8px rgba(15,23,42,.45)" : undefined }} title="Open the zonal-value search panel">
          <Search size={15} style={{ color: searchZonalActive ? "#fff" : GOLD }} /> <span className={lbl}>Search Zonal</span>
        </button>
        <button onClick={onNearMe} className={`${pill} text-white`} style={{ background: NAVY, border: `2px solid ${GOLD}` }} title="Zonal value near me">
          <MapPin size={15} style={{ color: GOLD }} /> <span className={lbl}>Near me</span>
        </button>
        <button
          onClick={onScanToggle}
          className={`${pill} text-white`}
          style={{ background: scanActive ? "#e11d48" : NAVY, border: `2px solid ${GOLD}` }}
          title="Draw a box on the map to find zonal values inside it"
        >
          <Scan size={15} style={{ color: scanActive ? "#fff" : GOLD }} />{" "}
          <span className={lbl}>{scanActive ? "Draw a box…" : "Scan area"}</span>
        </button>
        {/* Hazards — grouped into one dropdown to keep the toolbar tidy */}
        <div className="relative">
          <button
            onClick={() => setHazardsOpen((v) => !v)}
            className={`${pill} text-white`}
            style={{ background: activeHazards ? "#0f766e" : NAVY, border: `2px solid ${GOLD}` }}
            title="Show/hide hazard overlays (flood, landslide, fault, liquefaction, tsunami…)"
          >
            <Layers size={15} style={{ color: activeHazards ? "#fff" : GOLD }} />
            <span className={lbl}>Hazards</span>
            {activeHazards > 0 && (
              <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-extrabold text-[#0f766e]" style={{ background: GOLD }}>
                {activeHazards}
              </span>
            )}
            <ChevronDown size={13} className={`transition-transform ${hazardsOpen ? "rotate-180" : ""}`} style={{ color: GOLD }} />
          </button>

          {hazardsOpen && (
            <>
              {/* click-away backdrop */}
              <div className="fixed inset-0 z-[65]" onClick={() => setHazardsOpen(false)} />
              <div className="absolute left-1/2 top-[calc(100%+8px)] z-[70] w-56 -translate-x-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ border: `2px solid ${GOLD}` }}>
                <div className="flex items-center justify-between px-3 py-2 text-white" style={{ background: NAVY }}>
                  <span className="text-[12px] font-bold">Hazard overlays</span>
                  {activeHazards > 0 && (
                    <button
                      onClick={() => HAZARDS.forEach((h) => h.on && h.toggle())}
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: "rgba(255,255,255,0.18)" }}
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="py-1">
                  {HAZARDS.map((h) => (
                    <button
                      key={h.label}
                      onClick={h.toggle}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-[#f5f7fc]"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: h.on ? h.color : "#eef1f6" }}>
                        <h.Icon size={14} style={{ color: h.on ? "#fff" : "#64748b" }} />
                      </span>
                      <span className="flex-1 text-[13px] font-semibold" style={{ color: h.on ? "#0f172a" : "#475569" }}>
                        {h.label}
                      </span>
                      <span className="relative inline-flex h-4 w-7 items-center rounded-full transition" style={{ background: h.on ? h.color : "#cbd5e1" }}>
                        <span className={`absolute h-3 w-3 rounded-full bg-white transition-all ${h.on ? "left-[14px]" : "left-0.5"}`} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Google-Maps-style search box, right beside the Hazards button */}
        <div className="relative">
          <form
            onSubmit={(e) => { e.preventDefault(); doSearch(); }}
            className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 shadow-lg"
            style={{ border: `2px solid ${GOLD}` }}
          >
            <Search size={15} style={{ color: NAVY }} />
            <input
              value={searchQ}
              onChange={(e) => { setSearchQ(e.target.value); if (searchErr) setSearchErr(""); }}
              onKeyDown={onSearchKeyDown}
              onFocus={() => { if (suggestions.length) setShowSuggest(true); }}
              onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
              placeholder="Search a place…"
              aria-label="Search a place"
              className="w-28 bg-transparent text-[13px] font-semibold text-gray-800 outline-none placeholder:text-gray-400 sm:w-44"
            />
            {searching ? (
              <Loader2 size={14} className="animate-spin" style={{ color: NAVY }} />
            ) : searchQ ? (
              <button type="button" onClick={() => { setSearchQ(""); setSearchErr(""); setSuggestions([]); setShowSuggest(false); }} title="Clear" className="shrink-0">
                <X size={14} className="text-gray-400 hover:text-gray-600" />
              </button>
            ) : null}
          </form>

          {/* Suggestions dropdown (like Google Maps) */}
          {showSuggest && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-[calc(100%+6px)] z-[70] overflow-hidden rounded-2xl bg-white py-1 shadow-2xl" style={{ border: `2px solid ${GOLD}` }}>
              {suggestions.map((s, i) => (
                <li key={s.placeId}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s); }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left"
                    style={{ background: i === activeIdx ? "#f1f5ff" : "transparent" }}
                  >
                    <MapPin size={14} className="mt-0.5 shrink-0" style={{ color: NAVY }} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-gray-800">{s.main}</span>
                      {s.secondary && <span className="block truncate text-[11px] text-gray-500">{s.secondary}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {searchErr && (
        <div className="fixed left-1/2 top-16 z-[60] -translate-x-1/2 rounded-full bg-red-600 px-3 py-1 text-[12px] font-semibold text-white shadow-lg sm:top-[68px]">
          {searchErr}
        </div>
      )}

      {/* Legends (shown when each overlay is on) — styled like the scan-results panel */}
      {(floodOn || landslideOn || stormSurgeOn || faultsOn || liquefactionOn || tsunamiOn || groundRuptureOn) && (
        <div className={`fixed bottom-44 z-[56] max-h-[60vh] w-[160px] space-y-2 overflow-y-auto transition-[left] duration-300 sm:bottom-24 ${leftPanelOpen ? "left-3 sm:left-[396px]" : "left-3 sm:left-4"}`}>
          {floodOn && (
            <LegendCard
              title="100-yr flood"
              icon={<Waves size={13} style={{ color: GOLD }} />}
              items={mapType === "satellite"
                ? [["#7dd3fc", "Low"], ["#38a5f5", "Moderate"], ["#035aaf", "High"]]
                : [["#ca8a04", "Low"], ["#ea580c", "Moderate"], ["#dc2626", "High"]]}
            />
          )}
          {landslideOn && (
            <LegendCard
              title="Landslide"
              icon={<Mountain size={13} style={{ color: GOLD }} />}
              items={[["#ca8a04", "Low"], ["#9a3412", "Moderate"], ["#78350f", "High"]]}
            />
          )}
          {stormSurgeOn && (
            <LegendCard
              title="Storm surge"
              icon={<Tornado size={13} style={{ color: GOLD }} />}
              items={[["#8b5cf6", "Low"], ["#7c3aed", "Moderate"], ["#6d28d9", "High"]]}
            />
          )}
          {faultsOn && (
            <LegendCard
              title="Active faults"
              icon={<Activity size={13} style={{ color: GOLD }} />}
              items={[["#b91c1c", "Fault line"]]}
            />
          )}
          {liquefactionOn && (
            <LegendCard
              title="Liquefaction"
              icon={<Droplets size={13} style={{ color: GOLD }} />}
              items={[["#e0a23a", "Susceptible area"]]}
            />
          )}
          {tsunamiOn && (
            <LegendCard
              title="Tsunami-prone"
              icon={<Waves size={13} style={{ color: GOLD }} />}
              items={[["#22b8cf", "Prone coastal area"]]}
            />
          )}
          {groundRuptureOn && (
            <LegendCard
              title="Ground rupture"
              icon={<AlertTriangle size={13} style={{ color: GOLD }} />}
              items={[["#dc2626", "Active fault"], ["#a855f7", "Trench"]]}
            />
          )}
          {(liquefactionOn || tsunamiOn || groundRuptureOn) && (
            <div className="rounded-lg bg-white/90 px-2 py-1 text-[9px] font-semibold text-gray-500 shadow" style={{ border: `1px solid ${GOLD}` }}>
              Source: PHIVOLCS / GeoRiskPH
            </div>
          )}
        </div>
      )}

      {/* Scan hint */}
      {scanActive && !scanLoading && scanResults.length === 0 && (
        <div className="fixed left-1/2 top-16 z-[60] -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-[12px] font-medium text-white">
          Drag across the map to scan that area
        </div>
      )}

      {/* Near-me & Scan results now render in the left .epx panel (see page.tsx) for a
          consistent, formal look that matches the Establishment panel. */}
    </>
  );
}
