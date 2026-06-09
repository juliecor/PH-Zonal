"use client";

import { useEffect, useRef, useState } from "react";
import { X, Sparkles, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export type BriefPayload = {
  city?: string;
  barangay?: string;
  province?: string;
  classification?: string;
  zonalValue?: string;
  landAreaSqm?: number | null;
  landValue?: number | null;
  comps?: { min: number; max: number; median: number; count: number } | null;
  poiCounts?: any;
  monthly?: number | null;
  downPct?: number;
};

export default function InvestmentBrief({
  open,
  onClose,
  payload,
  locationLabel,
}: {
  open: boolean;
  onClose: () => void;
  payload: BriefPayload;
  locationLabel?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const reqRef = useRef(0);

  const generate = async () => {
    const myId = ++reqRef.current;
    setLoading(true);
    setErr("");
    setText("");
    try {
      const res = await fetch("/api/investment-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (myId !== reqRef.current) return;
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Failed to generate brief");
      setText(String(data.text ?? "").trim());
    } catch (e: any) {
      if (myId !== reqRef.current) return;
      setErr(e?.message ?? "Failed to generate brief");
    } finally {
      if (myId === reqRef.current) setLoading(false);
    }
  };

  // Auto-generate when opened.
  useEffect(() => {
    if (open) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast.success("Brief copied"); } catch { toast.error("Couldn't copy"); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-3" onClick={onClose}>
      <div className="w-full max-w-[440px] max-h-[88vh] overflow-auto rounded-2xl bg-white shadow-2xl border-2 border-[#c9a84c]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between sticky top-0 z-10" style={{ background: "#1e3a8a" }}>
          <div className="flex items-center gap-2 text-[#f5f0eb] font-bold text-sm">
            <Sparkles size={16} style={{ color: "#c9a84c" }} /> AI Property Brief
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-white/60 hover:text-white transition" title="Close"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-3">
          {locationLabel && (
            <div className="text-[11px] text-gray-500 truncate">For: <span className="font-semibold text-gray-700">{locationLabel}</span></div>
          )}

          {loading ? (
            <div className="space-y-2 py-2">
              <div className="flex items-center gap-2 text-sm text-gray-600"><RefreshCw size={14} className="animate-spin" style={{ color: "#1e3a8a" }} /> Analyzing this property…</div>
              <div className="space-y-2 animate-pulse pt-1">
                <div className="h-3 w-1/3 rounded bg-gray-200" />
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="h-3 w-5/6 rounded bg-gray-100" />
                <div className="h-3 w-1/3 rounded bg-gray-200 mt-2" />
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="h-3 w-2/3 rounded bg-gray-100" />
              </div>
            </div>
          ) : err ? (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{err}</div>
          ) : (
            <div className="text-[13px] text-gray-800 leading-relaxed whitespace-pre-line rounded-xl p-3" style={{ background: "#f8f7f5", border: "1px solid #eee" }}>
              {text || "No brief generated."}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button onClick={generate} disabled={loading} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition disabled:opacity-50" style={{ borderColor: "#e2d9d0", background: "#fff", color: "#1e3a8a" }}>
              <RefreshCw size={13} /> Regenerate
            </button>
            <button onClick={copy} disabled={loading || !text} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-white transition disabled:opacity-50" style={{ background: "#1e3a8a" }}>
              <Copy size={13} /> Copy
            </button>
          </div>

          <div className="text-[10px] text-gray-400 leading-snug">AI-generated estimate from the data on screen. Not a formal appraisal or financial advice.</div>
        </div>
      </div>
    </div>
  );
}
