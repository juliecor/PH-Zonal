"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Receipt, Info } from "lucide-react";

function fmtPeso(n: number) {
  if (!Number.isFinite(n)) return "₱0";
  return `₱${Math.round(n).toLocaleString("en-PH")}`;
}

export default function TaxEstimator({
  open,
  onClose,
  defaultBase,
  zonalPerSqm,
  locationLabel,
}: {
  open: boolean;
  onClose: () => void;
  defaultBase?: number | null;
  zonalPerSqm?: number | null;
  locationLabel?: string;
}) {
  const [baseInput, setBaseInput] = useState("");
  const [transferRate, setTransferRate] = useState(0.0075); // 0.50% province / 0.75% city
  const [withTitleTransfer, setWithTitleTransfer] = useState(true);

  // Prefill the base value whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      const seed = defaultBase && defaultBase > 0 ? Math.round(defaultBase) : 0;
      setBaseInput(seed ? String(seed) : "");
    }
  }, [open, defaultBase]);

  const base = useMemo(() => {
    const n = Number(String(baseInput).replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [baseInput]);

  const cgt = base * 0.06; // Capital Gains Tax (capital asset, individual seller)
  const dst = base * 0.015; // Documentary Stamp Tax
  const transfer = base * transferRate; // Local transfer tax
  const registration = withTitleTransfer ? base * 0.0025 : 0; // LRA registration fee (approx)

  const sellerTotal = cgt;
  const buyerTotal = dst + transfer + registration;
  const grandTotal = cgt + dst + transfer + registration;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] max-h-[88vh] overflow-auto rounded-2xl bg-white shadow-2xl border-2 border-[#c9a84c]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between sticky top-0" style={{ background: "#1e3a8a" }}>
          <div className="flex items-center gap-2 text-[#f5f0eb] font-bold text-sm">
            <Receipt size={16} style={{ color: "#c9a84c" }} /> Taxes &amp; Transfer Fees
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-white/60 hover:text-white transition" title="Close"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-4">
          {locationLabel && (
            <div className="text-[11px] text-gray-500 truncate">For: <span className="font-semibold text-gray-700">{locationLabel}</span></div>
          )}

          {/* Base value */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Taxable Base Value</label>
            <div className="mt-1 flex items-center rounded-xl border border-gray-300 focus-within:ring-2 focus-within:ring-[#1e3a8a] overflow-hidden">
              <span className="px-3 text-gray-500 font-bold">₱</span>
              <input
                inputMode="numeric"
                value={baseInput ? Number(baseInput.replace(/[^0-9.]/g, "")).toLocaleString("en-PH") : ""}
                onChange={(e) => setBaseInput(e.target.value)}
                placeholder="Enter selling price"
                className="flex-1 py-2.5 pr-3 text-lg font-black text-[#1e3a8a] focus:outline-none"
              />
            </div>
            <div className="mt-1 flex items-start gap-1 text-[10px] text-gray-400 leading-snug">
              <Info size={12} className="shrink-0 mt-0.5" />
              <span>BIR computes tax on the <b>higher</b> of the selling price or the zonal value{zonalPerSqm ? `` : ""}. Prefilled with your drawn land value — edit if the actual selling price is higher.</span>
            </div>
          </div>

          {/* Transfer tax rate + registration toggle */}
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold text-gray-600">Local transfer tax rate</div>
            <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: "#f1f0ec" }}>
              {([[0.005, "0.50% (Province)"], [0.0075, "0.75% (City/MM)"]] as Array<[number, string]>).map(([r, lbl]) => (
                <button key={r} onClick={() => setTransferRate(r)} className="px-2 py-1 rounded-md text-[10px] font-bold transition" style={transferRate === r ? { background: "#1e3a8a", color: "#fff" } : { color: "#6b7280" }}>{lbl}</button>
              ))}
            </div>
          </div>

          {/* Breakdown */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <Row label="Capital Gains Tax" sub="6% • usually seller" value={fmtPeso(cgt)} />
            <Row label="Documentary Stamp Tax" sub="1.5% • usually buyer" value={fmtPeso(dst)} />
            <Row label="Transfer Tax" sub={`${(transferRate * 100).toFixed(2)}% • usually buyer`} value={fmtPeso(transfer)} />
            <Row
              label="Registration Fee"
              sub="≈0.25% • buyer (approx)"
              value={fmtPeso(registration)}
              toggle={<input type="checkbox" checked={withTitleTransfer} onChange={(e) => setWithTitleTransfer(e.target.checked)} className="accent-[#1e3a8a]" />}
            />
          </div>

          {/* Totals */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-3 text-center" style={{ background: "#f5f0eb", border: "1px solid #e8e0d8" }}>
              <div className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "#9a7a20" }}>Seller pays</div>
              <div className="text-base font-black" style={{ color: "#1e3a8a" }}>{fmtPeso(sellerTotal)}</div>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: "#f5f0eb", border: "1px solid #e8e0d8" }}>
              <div className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "#9a7a20" }}>Buyer pays</div>
              <div className="text-base font-black" style={{ color: "#1e3a8a" }}>{fmtPeso(buyerTotal)}</div>
            </div>
          </div>
          <div className="rounded-xl p-3 text-center text-white" style={{ background: "linear-gradient(135deg,#1e3a8a,#1e40af)" }}>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#c9a84c" }}>Total Estimated Taxes &amp; Fees</div>
            <div className="text-2xl font-black">{fmtPeso(grandTotal)}</div>
          </div>

          <div className="text-[10px] text-gray-400 leading-snug">
            Estimate only. Assumes sale of a capital asset by an individual. Excludes notarial fees (≈1–2%, negotiable), broker&apos;s commission, and unpaid taxes. Who pays each item is by convention and is negotiable. Always confirm with the BIR, the Registry of Deeds, and a licensed professional.
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, sub, value, toggle }: { label: string; sub: string; value: string; toggle?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 last:border-b-0">
      <div className="min-w-0 flex items-center gap-2">
        {toggle}
        <div>
          <div className="text-[12px] font-bold text-gray-800">{label}</div>
          <div className="text-[10px] text-gray-400">{sub}</div>
        </div>
      </div>
      <div className="text-sm font-black shrink-0" style={{ color: "#1e3a8a" }}>{value}</div>
    </div>
  );
}
