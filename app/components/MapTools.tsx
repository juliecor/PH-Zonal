"use client";

import { useState } from "react";
import { MapPin, X, Loader2, Scan } from "lucide-react";

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
};

export default function MapTools({
  onLocate,
  scanActive,
  onScanToggle,
  scanResults,
  scanLoading,
  onPickResult,
}: {
  onLocate: (lat: number, lon: number) => void;
  scanActive: boolean;
  onScanToggle: () => void;
  scanResults: ScanResult[];
  scanLoading: boolean;
  onPickResult: (r: ScanResult) => void;
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

  const pill = "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold shadow-lg transition hover:scale-105 active:scale-95";

  return (
    <>
      {/* Top-center toolbar */}
      <div className="fixed left-1/2 top-4 z-[60] flex -translate-x-1/2 items-center gap-2">
        <button onClick={nearMe} className={`${pill} text-white`} style={{ background: NAVY, border: `2px solid ${GOLD}` }}>
          <MapPin size={15} style={{ color: GOLD }} /> Near me
        </button>
        <button
          onClick={onScanToggle}
          className={`${pill} text-white`}
          style={{ background: scanActive ? "#e11d48" : NAVY, border: `2px solid ${GOLD}` }}
          title="Draw a box on the map to find zonal values inside it"
        >
          <Scan size={15} style={{ color: scanActive ? "#fff" : GOLD }} />{" "}
          {scanActive ? "Draw a box…" : "Scan area"}
        </button>
      </div>

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
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
