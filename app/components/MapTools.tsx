"use client";

import { useState, type ReactNode } from "react";
import { MapPin, X, Loader2, Scan, Waves, Mountain, Tornado } from "lucide-react";

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

const FLOOD_COLOR: Record<number, string> = { 0: "#10b981", 1: "#ca8a04", 2: "#ea580c", 3: "#dc2626" };
const LS_COLOR: Record<number, string> = { 0: "#10b981", 1: "#ca8a04", 2: "#9a3412", 3: "#78350f" };
const SS_COLOR: Record<number, string> = { 0: "#10b981", 1: "#8b5cf6", 2: "#7c3aed", 3: "#6d28d9" };

export default function MapTools({
  onLocate,
  scanActive,
  onScanToggle,
  scanResults,
  scanLoading,
  onPickResult,
  floodOn,
  onFloodToggle,
  landslideOn,
  onLandslideToggle,
  stormSurgeOn,
  onStormSurgeToggle,
  mapType,
}: {
  onLocate: (lat: number, lon: number) => void;
  scanActive: boolean;
  onScanToggle: () => void;
  scanResults: ScanResult[];
  scanLoading: boolean;
  onPickResult: (r: ScanResult) => void;
  floodOn: boolean;
  onFloodToggle: () => void;
  landslideOn: boolean;
  onLandslideToggle: () => void;
  stormSurgeOn: boolean;
  onStormSurgeToggle: () => void;
  mapType?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState("");

  const peso = (v: any) => "₱" + Number(v).toLocaleString("en-PH");

  const nearMe = () => {
    setErr("");
    setResult(null);
    setOpen(true);
    setLoading(true);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErr("Location isn't supported on this device.");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          onLocate(latitude, longitude);
          const res = await fetch(`/api/zonal-nearest?lat=${latitude}&lon=${longitude}&radius=3000`);
          const data = await res.json().catch(() => null);
          if (!data?.ok || !data?.found) {
            setErr("No zonal value saved near you yet. Try scanning an area you've browsed.");
          } else {
            setResult(data);
          }
        } catch {
          setErr("Couldn't fetch the nearest value.");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setErr("Please allow location access.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  // Icon-only on phones (label hidden), full label on >= sm. Keeps one tidy row.
  const pill = "flex items-center gap-1.5 rounded-full p-2.5 sm:px-3.5 sm:py-2 text-[13px] font-bold shadow-lg transition hover:scale-105 active:scale-95";
  const lbl = "hidden sm:inline";

  return (
    <>
      {/* Top-center toolbar */}
      <div className="fixed left-1/2 top-3 z-[60] flex max-w-[96vw] -translate-x-1/2 items-center gap-1.5 sm:top-4 sm:gap-2">
        <button onClick={nearMe} className={`${pill} text-white`} style={{ background: NAVY, border: `2px solid ${GOLD}` }} title="Zonal value near me">
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
        <button
          onClick={onFloodToggle}
          className={`${pill} text-white`}
          style={{ background: floodOn ? "#0ea5e9" : NAVY, border: `2px solid ${GOLD}` }}
          title="Show/hide the 100-yr flood hazard overlay"
        >
          <Waves size={15} style={{ color: floodOn ? "#fff" : GOLD }} /> <span className={lbl}>Flood</span>
        </button>
        <button
          onClick={onLandslideToggle}
          className={`${pill} text-white`}
          style={{ background: landslideOn ? "#92400e" : NAVY, border: `2px solid ${GOLD}` }}
          title="Show/hide the landslide hazard overlay"
        >
          <Mountain size={15} style={{ color: landslideOn ? "#fff" : GOLD }} /> <span className={lbl}>Landslide</span>
        </button>
        <button
          onClick={onStormSurgeToggle}
          className={`${pill} text-white`}
          style={{ background: stormSurgeOn ? "#6d28d9" : NAVY, border: `2px solid ${GOLD}` }}
          title="Show/hide the worst-case (SSA4) storm-surge hazard overlay"
        >
          <Tornado size={15} style={{ color: stormSurgeOn ? "#fff" : GOLD }} /> <span className={lbl}>Storm surge</span>
        </button>
      </div>

      {/* Legends (shown when each overlay is on) — styled like the scan-results panel */}
      {(floodOn || landslideOn || stormSurgeOn) && (
        <div className="fixed bottom-44 left-3 z-[60] w-[150px] space-y-2 sm:bottom-24 sm:left-4">
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
        </div>
      )}

      {/* Scan hint */}
      {scanActive && !scanLoading && scanResults.length === 0 && (
        <div className="fixed left-1/2 top-16 z-[60] -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-[12px] font-medium text-white">
          Drag across the map to scan that area
        </div>
      )}

      {/* Near-me result card */}
      {open && (
        <div
          className="fixed left-1/2 top-16 z-[61] w-[90vw] max-w-[340px] -translate-x-1/2 rounded-2xl bg-white p-4 shadow-2xl"
          style={{ border: `2px solid ${GOLD}` }}
        >
          <button onClick={() => setOpen(false)} className="absolute right-2 top-2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X size={16} />
          </button>
          {loading ? (
            <div className="flex items-center gap-2 py-1 text-sm text-gray-600">
              <Loader2 size={16} className="animate-spin" style={{ color: NAVY }} /> Finding the value near you…
            </div>
          ) : err ? (
            <div className="pr-5 text-[13px] leading-relaxed text-gray-600">{err}</div>
          ) : result ? (
            <div className="pr-5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Nearest zonal value</div>
              <div className="text-2xl font-black leading-tight" style={{ color: NAVY }}>
                {peso(result.value_per_sqm)}<span className="text-sm font-semibold text-gray-500">/sqm</span>
              </div>
              {result.street && <div className="mt-1 text-[13px] font-semibold text-gray-800">{result.street}</div>}
              <div className="text-[12px] text-gray-500">{[result.barangay, result.city, result.province].filter(Boolean).join(", ")}</div>
              <div className="mt-1 text-[11px] text-gray-400">
                {result.classification_code ? `${result.classification_code} · ` : ""}~{result.distance_m}m from you
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Scan results panel */}
      {(scanLoading || scanResults.length > 0) && (
        <div
          className="fixed right-3 top-28 z-[60] flex max-h-[62vh] w-[88vw] max-w-[300px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          style={{ border: `2px solid ${GOLD}` }}
        >
          <div className="flex items-center justify-between px-3 py-2.5 text-white" style={{ background: NAVY }}>
            <span className="text-[13px] font-bold">
              {scanLoading ? "Scanning…" : `Zonal values found (${scanResults.length})`}
            </span>
            {!scanLoading && (
              <button onClick={onScanToggle} className="rounded-full p-1 text-white/70 hover:bg-white/15 hover:text-white" title="Done">
                <X size={15} />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {scanLoading ? (
              <div className="flex items-center gap-2 p-3 text-[13px] text-gray-600">
                <Loader2 size={15} className="animate-spin" style={{ color: NAVY }} /> Reading the area…
              </div>
            ) : scanResults.length === 0 ? (
              <div className="p-3 text-[13px] text-gray-500">No zonal values saved in that area yet.</div>
            ) : (
              scanResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => onPickResult(r)}
                  className="block w-full border-b border-gray-100 px-3 py-2 text-left transition hover:bg-[#f5f7fc]"
                >
                  <div className="text-[14px] font-black" style={{ color: NAVY }}>
                    {peso(r.value_per_sqm)}<span className="text-[10px] font-semibold text-gray-400">/sqm</span>
                  </div>
                  {r.street && <div className="truncate text-[12px] font-semibold text-gray-700">{r.street}</div>}
                  <div className="truncate text-[11px] text-gray-500">
                    {[r.barangay, r.city].filter(Boolean).join(", ")}
                    {r.classification_code ? ` · ${r.classification_code}` : ""}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] font-bold">
                    {r.floodLabel != null && (
                      <span className="inline-flex items-center gap-1" style={{ color: FLOOD_COLOR[r.floodLevel ?? 0] || "#6b7280" }}>
                        🌊 {r.floodLabel} flood
                      </span>
                    )}
                    {r.landslideLabel != null && (
                      <span className="inline-flex items-center gap-1" style={{ color: LS_COLOR[r.landslideLevel ?? 0] || "#6b7280" }}>
                        ⛰️ {r.landslideLabel} landslide
                      </span>
                    )}
                    {r.stormSurgeLabel != null && (
                      <span className="inline-flex items-center gap-1" style={{ color: SS_COLOR[r.stormSurgeLevel ?? 0] || "#6b7280" }}>
                        🌀 {r.stormSurgeLabel} surge
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
