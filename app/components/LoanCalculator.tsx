"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Landmark, Info } from "lucide-react";

function fmtPeso(n: number) {
  if (!Number.isFinite(n)) return "₱0";
  return `₱${Math.round(n).toLocaleString("en-PH")}`;
}

export default function LoanCalculator({
  open,
  onClose,
  defaultPrice,
  locationLabel,
}: {
  open: boolean;
  onClose: () => void;
  defaultPrice?: number | null;
  locationLabel?: string;
}) {
  const [priceInput, setPriceInput] = useState("");
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(6.5); // annual %
  const [termYears, setTermYears] = useState(20);

  useEffect(() => {
    if (open) {
      const seed = defaultPrice && defaultPrice > 0 ? Math.round(defaultPrice) : 0;
      setPriceInput(seed ? String(seed) : "");
    }
  }, [open, defaultPrice]);

  const price = useMemo(() => {
    const n = Number(String(priceInput).replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [priceInput]);

  const downPayment = price * (downPct / 100);
  const principal = Math.max(0, price - downPayment);
  const n = Math.max(1, Math.round(termYears * 12));
  const monthlyRate = rate / 100 / 12;

  const monthly = useMemo(() => {
    if (principal <= 0) return 0;
    if (monthlyRate === 0) return principal / n;
    const f = Math.pow(1 + monthlyRate, n);
    return (principal * monthlyRate * f) / (f - 1);
  }, [principal, monthlyRate, n]);

  const totalPay = monthly * n;
  const totalInterest = Math.max(0, totalPay - principal);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-3" onClick={onClose}>
      <div className="w-full max-w-[420px] max-h-[88vh] overflow-auto rounded-2xl bg-white shadow-2xl border-2 border-[#c9a84c]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between sticky top-0" style={{ background: "#1e3a8a" }}>
          <div className="flex items-center gap-2 text-[#f5f0eb] font-bold text-sm">
            <Landmark size={16} style={{ color: "#c9a84c" }} /> Loan Calculator
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-white/60 hover:text-white transition" title="Close"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-4">
          {locationLabel && (
            <div className="text-[11px] text-gray-500 truncate">For: <span className="font-semibold text-gray-700">{locationLabel}</span></div>
          )}

          {/* Price */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Property Price</label>
            <div className="mt-1 flex items-center rounded-xl border border-gray-300 focus-within:ring-2 focus-within:ring-[#1e3a8a] overflow-hidden">
              <span className="px-3 text-gray-500 font-bold">₱</span>
              <input
                inputMode="numeric"
                value={priceInput ? Number(priceInput.replace(/[^0-9.]/g, "")).toLocaleString("en-PH") : ""}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="Enter price"
                className="flex-1 py-2.5 pr-3 text-lg font-black text-[#1e3a8a] focus:outline-none"
              />
            </div>
          </div>

          {/* Down payment */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Down Payment</label>
              <span className="text-xs font-bold text-[#1e3a8a]">{downPct}% · {fmtPeso(downPayment)}</span>
            </div>
            <div className="mt-1 flex items-center gap-1">
              {[10, 20, 30, 40].map((p) => (
                <button key={p} onClick={() => setDownPct(p)} className="px-2.5 py-1 rounded-md text-[11px] font-bold transition" style={downPct === p ? { background: "#1e3a8a", color: "#fff" } : { background: "#f1f0ec", color: "#6b7280" }}>{p}%</button>
              ))}
              <input
                type="range" min={0} max={60} step={5} value={downPct}
                onChange={(e) => setDownPct(Number(e.target.value))}
                className="flex-1 accent-[#1e3a8a] ml-1"
              />
            </div>
          </div>

          {/* Rate + term */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Interest Rate (%/yr)</label>
              <input
                inputMode="decimal"
                value={rate}
                onChange={(e) => { const v = Number(String(e.target.value).replace(/[^0-9.]/g, "")); if (Number.isFinite(v)) setRate(v); }}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-bold text-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Term (years)</label>
              <select
                value={termYears}
                onChange={(e) => setTermYears(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-bold text-[#1e3a8a] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              >
                {[5, 10, 15, 20, 25, 30].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Monthly result */}
          <div className="rounded-xl p-4 text-center text-white" style={{ background: "linear-gradient(135deg,#1e3a8a,#1e40af)" }}>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#c9a84c" }}>Estimated Monthly Payment</div>
            <div className="text-3xl font-black">{fmtPeso(monthly)}</div>
            <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>for {termYears} years ({n} months)</div>
          </div>

          {/* Breakdown */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <Row label="Loan amount (financed)" value={fmtPeso(principal)} />
            <Row label="Down payment" value={fmtPeso(downPayment)} />
            <Row label="Total of payments" value={fmtPeso(totalPay)} />
            <Row label="Total interest" value={fmtPeso(totalInterest)} />
          </div>

          <div className="flex items-start gap-1 text-[10px] text-gray-400 leading-snug">
            <Info size={12} className="shrink-0 mt-0.5" />
            <span>Estimate only, using standard amortization. Actual bank/Pag-IBIG rates, fees, and approval terms vary. Not a loan offer.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 last:border-b-0">
      <div className="text-[12px] font-semibold text-gray-700">{label}</div>
      <div className="text-sm font-black shrink-0" style={{ color: "#1e3a8a" }}>{value}</div>
    </div>
  );
}
