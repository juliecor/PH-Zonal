"use client";

import { useEffect, useRef, useState } from "react";
import { X, Download, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

const NAVY = "#1e3a8a";
const NAVY2 = "#1e40af";
const GOLD = "#155EEF";
const CREAM = "#f1f5fc";

function peso(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `₱${Math.round(n).toLocaleString("en-PH")}`;
}

export type SnapshotData = {
  barangay?: string;
  city?: string;
  province?: string;
  classification?: string;
  zonal?: number | null; // per sqm
  landAreaSqm?: number | null;
  landValue?: number | null;
  comps?: { min: number; max: number; median: number; count: number } | null;
  monthly?: number | null;
  poiCounts?: any;
  dateLabel?: string;
  path?: Array<{ lat: number; lng: number }> | null; // drawn parcel for the map banner
};

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function grade(poiCounts: any): { label: string; color: string } {
  const c = poiCounts && typeof poiCounts === "object" ? poiCounts : {};
  const total = Object.values(c).reduce((a: number, v: any) => a + (typeof v === "number" ? v : 0), 0);
  if (total >= 20) return { label: "Excellent", color: "#15803d" };
  if (total >= 13) return { label: "Strong", color: "#15803d" };
  if (total >= 8) return { label: "Moderate", color: "#0f49c4" };
  if (total > 0) return { label: "Emerging", color: "#0f49c4" };
  return { label: "Limited", color: "#6b7280" };
}

export default function PropertySnapshot({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: SnapshotData;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [mapImg, setMapImg] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(false);

  // Render the drawn parcel as a satellite static map (server-side) for the banner.
  useEffect(() => {
    if (!open) { setMapImg(null); return; }
    const pts = data.path ?? [];
    if (pts.length < 3) { setMapImg(null); return; }
    let cancelled = false;
    setMapImg(null);
    setMapLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/parcel-map", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points: pts }),
        });
        if (!res.ok) throw new Error("parcel map failed");
        const blob = await res.blob();
        const dataUrl = await blobToDataURL(blob);
        if (!cancelled) setMapImg(dataUrl);
      } catch {
        if (!cancelled) setMapImg(null);
      } finally {
        if (!cancelled) setMapLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, data.path]);

  if (!open) return null;

  const where = [data.barangay, data.city, data.province].filter(Boolean).join(", ") || "Selected location";
  const g = grade(data.poiCounts);

  const download = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      const name = [data.barangay, data.city].filter(Boolean).join("-").replace(/[^\w]+/g, "-").slice(0, 50) || "property";
      a.href = url;
      a.download = `zonal-snapshot-${name}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Image saved — share it on Messenger or Facebook");
    } catch {
      toast.error("Couldn't generate the image");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3" onClick={onClose}>
      <div className="w-full max-w-[440px] max-h-[92vh] overflow-auto rounded-2xl bg-white shadow-2xl border-2 border-[#155EEF]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between sticky top-0 z-10" style={{ background: NAVY }}>
          <div className="flex items-center gap-2 text-[#f1f5fc] font-bold text-sm">
            <ImageIcon size={16} style={{ color: "#8fb4ff" }} /> Property Snapshot
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-white/60 hover:text-white transition" title="Close"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-[11px] text-gray-500">Save this as an image and share it with clients.</div>

          {/* ── The capture card (all inline colors so html2canvas renders cleanly) ── */}
          <div className="overflow-auto">
            <div ref={cardRef} style={{ width: 380, margin: "0 auto", background: "#fff", fontFamily: "Outfit, sans-serif" }}>
              {/* Brand band */}
              <div style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY2})`, padding: "16px 18px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: GOLD, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 40 40" fill="none"><path d="M20 9L8 19.5H11V31H17.5V24H22.5V31H29V19.5H32L20 9Z" fill={NAVY} /></svg>
                </div>
                <div>
                  <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, lineHeight: 1 }}>FH Zonal Finder</div>
                  <div style={{ color: "rgba(21,94,239,0.95)", fontSize: 10, fontWeight: 600, marginTop: 2 }}>BIR Zonal Property Snapshot</div>
                </div>
              </div>

              {/* Parcel map banner (drawn land on satellite) */}
              {(mapImg || mapLoading) && (
                <div style={{ width: "100%", height: 230, background: "#0b1727", position: "relative" }}>
                  {mapImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mapImg} alt="Drawn parcel on map" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)", fontSize: 11 }}>Loading parcel map…</div>
                  )}
                </div>
              )}

              {/* Body */}
              <div style={{ padding: 18 }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: "#9ca3af", textTransform: "uppercase" }}>Location</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginTop: 2 }}>{where}</div>

                {/* Zonal value */}
                <div style={{ marginTop: 14, background: `linear-gradient(135deg, ${NAVY}, ${NAVY2})`, borderRadius: 14, padding: 16 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: "#8fb4ff", textTransform: "uppercase" }}>Zonal Value</div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: "#fff", lineHeight: 1.05 }}>{data.zonal ? peso(data.zonal) : "Not Appraised"}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>per square meter{data.classification ? ` · ${data.classification}` : ""}</div>
                </div>

                {/* Drawn land — featured total value (the headline for selling) */}
                {data.landAreaSqm ? (
                  <div style={{ marginTop: 10, background: CREAM, border: `2px solid ${GOLD}`, borderRadius: 14, padding: 14 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: "#0f49c4", textTransform: "uppercase" }}>Total Land Value (Drawn Area)</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: NAVY, lineHeight: 1.05 }}>{peso(data.landValue)}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginTop: 3 }}>{Math.round(data.landAreaSqm).toLocaleString()} sqm × {peso(data.zonal)}/sqm</div>
                  </div>
                ) : null}

                {/* Monthly + grade */}
                <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                  {data.monthly ? <Stat label="Est. Monthly (20% dn)" value={peso(data.monthly)} /> : null}
                  <div style={{ flex: 1, background: CREAM, border: "1px solid #dde5f0", borderRadius: 12, padding: "8px 10px" }}>
                    <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 0.5, color: "#9ca3af", textTransform: "uppercase" }}>Investment Grade</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: g.color }}>{g.label}</div>
                  </div>
                </div>

                {/* Footer */}
                <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 9, color: "#9ca3af" }}>zonalvalue.ph</div>
                  <div style={{ fontSize: 9, color: "#9ca3af" }}>{data.dateLabel || ""}</div>
                </div>
                <div style={{ fontSize: 8, color: "#c4c4c4", marginTop: 4, lineHeight: 1.4 }}>Estimates from BIR zonal values — not a market price or formal appraisal.</div>
              </div>
            </div>
          </div>

          <button onClick={download} disabled={busy} className="w-full inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: NAVY }}>
            <Download size={15} /> {busy ? "Preparing image…" : "Save as image"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, background: CREAM, border: "1px solid #dde5f0", borderRadius: 12, padding: "8px 10px" }}>
      <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 0.5, color: "#9ca3af", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 900, color: NAVY }}>{value}</div>
    </div>
  );
}

