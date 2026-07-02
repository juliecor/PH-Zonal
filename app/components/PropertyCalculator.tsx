"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Calculator, Info } from "lucide-react";

function fmtPeso(n: number) {
  if (!Number.isFinite(n)) return "₱0";
  return `₱${Math.round(n).toLocaleString("en-PH")}`;
}

export default function PropertyCalculator({
  open,
  onClose,
  defaultValue,
  valuePerSqm,
  defaultAreaSqm,
  locationLabel,
}: {
  open: boolean;
  onClose: () => void;
  defaultValue?: number | null;
  valuePerSqm?: number | null;   // ₱/sqm — enables the "Land area" input (price = area × value)
  defaultAreaSqm?: number | null; // seed the area (drawn land, else 250)
  locationLabel?: string;
}) {
  const [priceInput, setPriceInput] = useState("");
  const [areaInput, setAreaInput] = useState("250");
  const [transferRate, setTransferRate] = useState(0.0075);
  const [withRegistration, setWithRegistration] = useState(true);
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(6.5);
  const [termYears, setTermYears] = useState(20);
  const [brokerPct, setBrokerPct] = useState(5); // broker's professional fee (commission) — seller-paid, negotiable

  const hasPerSqm = !!(valuePerSqm && valuePerSqm > 0);

  useEffect(() => {
    if (!open) return;
    const area = defaultAreaSqm && defaultAreaSqm > 0 ? Math.round(defaultAreaSqm) : 250;
    setAreaInput(String(area));
    if (hasPerSqm) {
      setPriceInput(String(Math.round(valuePerSqm! * area)));
    } else {
      const seed = defaultValue && defaultValue > 0 ? Math.round(defaultValue) : 0;
      setPriceInput(seed ? String(seed) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultValue, valuePerSqm, defaultAreaSqm]);

  // Editing the land area recomputes the value from ₱/sqm (the price stays editable to override).
  function onAreaChange(v: string) {
    const clean = v.replace(/[^0-9.]/g, "");
    setAreaInput(clean);
    const a = Number(clean);
    if (hasPerSqm && Number.isFinite(a) && a > 0) setPriceInput(String(Math.round(valuePerSqm! * a)));
  }

  const price = useMemo(() => {
    const n = Number(String(priceInput).replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [priceInput]);

  // ── Taxes & fees ──
  const cgt = price * 0.06;
  const dst = price * 0.015;
  const transfer = price * transferRate;
  const registration = withRegistration ? price * 0.0025 : 0;
  const brokerFee = price * (brokerPct / 100); // seller-paid professional fee (commission)
  const buyerFees = dst + transfer + registration;
  const sellerFees = cgt + brokerFee;          // seller pays CGT + the broker's commission
  const totalFees = cgt + dst + transfer + registration + brokerFee;

  // ── Financing ──
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
  const totalInterest = Math.max(0, monthly * n - principal);

  // Cash a buyer needs upfront if financing = down payment + buyer-side fees
  const cashIfFinanced = downPayment + buyerFees;
  const cashIfFull = price + buyerFees;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-3" onClick={onClose}>
      <div className="w-full max-w-[440px] max-h-[90vh] overflow-auto rounded-2xl bg-white shadow-2xl border-2 border-[#c9a84c]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between sticky top-0 z-10" style={{ background: "#1e3a8a" }}>
          <div className="flex items-center gap-2 text-[#f5f0eb] font-bold text-sm">
            <Calculator size={16} style={{ color: "#c9a84c" }} /> Cost Calculator
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-white/60 hover:text-white transition" title="Close"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-4">
          {locationLabel && (
            <div className="text-[11px] text-gray-500 truncate">For: <span className="font-semibold text-gray-700">{locationLabel}</span></div>
          )}

          {/* Land area (sqm) — recomputes the value from ₱/sqm */}
          {hasPerSqm && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Land Area (sqm)</label>
              <div className="mt-1 flex items-center rounded-xl border border-gray-300 focus-within:ring-2 focus-within:ring-[#1e3a8a] overflow-hidden">
                <input inputMode="numeric" value={areaInput} onChange={(e) => onAreaChange(e.target.value)} placeholder="e.g. 250" className="flex-1 py-2.5 px-3 text-lg font-black text-[#1e3a8a] focus:outline-none" />
                <span className="px-3 text-gray-500 font-bold text-sm">sqm</span>
              </div>
              <div className="mt-1 text-[10px] text-gray-400">≈ ₱{Math.round(valuePerSqm!).toLocaleString("en-PH")}/sqm × {areaInput || "0"} sqm</div>
            </div>
          )}

          {/* Shared value input — drives everything */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{hasPerSqm ? "Estimated / Selling Value" : "Property / Selling Value"}</label>
            <div className="mt-1 flex items-center rounded-xl border border-gray-300 focus-within:ring-2 focus-within:ring-[#1e3a8a] overflow-hidden">
              <span className="px-3 text-gray-500 font-bold">₱</span>
              <input
                inputMode="numeric"
                value={priceInput ? Number(priceInput.replace(/[^0-9.]/g, "")).toLocaleString("en-PH") : ""}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="Enter value"
                className="flex-1 py-2.5 pr-3 text-lg font-black text-[#1e3a8a] focus:outline-none"
              />
            </div>
            <div className="mt-1 flex items-start gap-1 text-[10px] text-gray-400 leading-snug">
              <Info size={12} className="shrink-0 mt-0.5" />
              <span>Enter once — used for both taxes and the loan. Prefilled with your drawn land value; edit to the actual selling price.</span>
            </div>
          </div>

          {/* AT-A-GLANCE summary */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-3 text-center" style={{ background: "#f5f0eb", border: "1px solid #e8e0d8" }}>
              <div className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "#9a7a20" }}>Taxes &amp; Fees</div>
              <div className="text-base font-black" style={{ color: "#1e3a8a" }}>{fmtPeso(totalFees)}</div>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: "#f5f0eb", border: "1px solid #e8e0d8" }}>
              <div className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "#9a7a20" }}>Monthly ({downPct}% down)</div>
              <div className="text-base font-black" style={{ color: "#1e3a8a" }}>{fmtPeso(monthly)}</div>
            </div>
          </div>

          {/* ── TAXES & FEES ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#1e3a8a" }}>Taxes, Fees &amp; Commission</div>
              <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: "#f1f0ec" }}>
                {([[0.005, "0.50%"], [0.0075, "0.75%"]] as Array<[number, string]>).map(([r, lbl]) => (
                  <button key={r} onClick={() => setTransferRate(r)} className="px-2 py-0.5 rounded-md text-[10px] font-bold transition" style={transferRate === r ? { background: "#1e3a8a", color: "#fff" } : { color: "#6b7280" }} title="Local transfer tax rate">{lbl}</button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <Row label="Capital Gains Tax" sub="6% · seller" value={fmtPeso(cgt)} />
              <Row label="Documentary Stamp Tax" sub="1.5% · buyer" value={fmtPeso(dst)} />
              <Row label="Transfer Tax" sub={`${(transferRate * 100).toFixed(2)}% · buyer`} value={fmtPeso(transfer)} />
              <Row
                label="Registration Fee"
                sub="≈0.25% · buyer"
                value={fmtPeso(registration)}
                toggle={<input type="checkbox" checked={withRegistration} onChange={(e) => setWithRegistration(e.target.checked)} className="accent-[#1e3a8a]" />}
              />
              <div className="px-3 py-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-bold text-gray-800">Broker&apos;s Professional Fee</div>
                  <div className="text-sm font-black shrink-0" style={{ color: "#1e3a8a" }}>{fmtPeso(brokerFee)}</div>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: "#f1f0ec" }}>
                    {[0, 3, 4, 5].map((b) => (
                      <button key={b} onClick={() => setBrokerPct(b)} className="px-2 py-0.5 rounded-md text-[10px] font-bold transition" style={brokerPct === b ? { background: "#1e3a8a", color: "#fff" } : { color: "#6b7280" }} title="Broker's commission (negotiable)">{b}%</button>
                    ))}
                  </div>
                  <span className="text-[10px] text-gray-400">seller · negotiable</span>
                </div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <Mini label="Seller pays" value={fmtPeso(sellerFees)} />
              <Mini label="Buyer pays" value={fmtPeso(buyerFees)} />
              <Mini label="Total" value={fmtPeso(totalFees)} highlight />
            </div>
          </div>

          {/* ── FINANCING ── */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "#1e3a8a" }}>Financing</div>

            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Down Payment</label>
              <span className="text-xs font-bold text-[#1e3a8a]">{downPct}% · {fmtPeso(downPayment)}</span>
            </div>
            <div className="mt-1 flex items-center gap-1">
              {[10, 20, 30].map((p) => (
                <button key={p} onClick={() => setDownPct(p)} className="px-2.5 py-1 rounded-md text-[11px] font-bold transition" style={downPct === p ? { background: "#1e3a8a", color: "#fff" } : { background: "#f1f0ec", color: "#6b7280" }}>{p}%</button>
              ))}
              <input type="range" min={0} max={60} step={5} value={downPct} onChange={(e) => setDownPct(Number(e.target.value))} className="flex-1 accent-[#1e3a8a] ml-1" />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Rate (%/yr)</label>
                <input inputMode="decimal" value={rate} onChange={(e) => { const v = Number(String(e.target.value).replace(/[^0-9.]/g, "")); if (Number.isFinite(v)) setRate(v); }} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-bold text-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Term (years)</label>
                <select value={termYears} onChange={(e) => setTermYears(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-bold text-[#1e3a8a] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]">
                  {[5, 10, 15, 20, 25, 30].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-3 rounded-xl p-3 text-center text-white" style={{ background: "linear-gradient(135deg,#1e3a8a,#1e40af)" }}>
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#c9a84c" }}>Estimated Monthly Payment</div>
              <div className="text-2xl font-black">{fmtPeso(monthly)}</div>
              <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.7)" }}>{fmtPeso(principal)} loan · {termYears} yrs · {fmtPeso(totalInterest)} total interest</div>
            </div>
          </div>

          {/* ── CASH NEEDED ── */}
          <div className="rounded-xl p-3" style={{ background: "#f5f0eb", border: "1px solid #e8e0d8" }}>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#9a7a20" }}>Cash a buyer needs upfront</div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-gray-600">If financed ({downPct}% down + buyer fees)</span>
              <span className="font-black" style={{ color: "#1e3a8a" }}>{fmtPeso(cashIfFinanced)}</span>
            </div>
            <div className="flex items-center justify-between text-[12px] mt-0.5">
              <span className="text-gray-600">If paid in full (price + buyer fees)</span>
              <span className="font-black" style={{ color: "#1e3a8a" }}>{fmtPeso(cashIfFull)}</span>
            </div>
          </div>

          <div className="text-[10px] text-gray-400 leading-snug">
            Estimates only. Includes the broker&apos;s professional fee (commission ~5%, seller-paid &amp; negotiable); excludes notarial fees. Taxes assume sale of a capital asset. Loan uses standard amortization; actual bank/Pag-IBIG terms vary. Not a loan offer or official appraisal — confirm with the BIR, Registry of Deeds, and your lender.
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, sub, value, toggle }: { label: string; sub: string; value: string; toggle?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 last:border-b-0">
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

function Mini({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg px-2 py-1.5" style={highlight ? { background: "#1e3a8a" } : { background: "#f1f0ec" }}>
      <div className="text-[8px] font-bold uppercase tracking-wide" style={{ color: highlight ? "#c9a84c" : "#9ca3af" }}>{label}</div>
      <div className="text-[12px] font-black" style={{ color: highlight ? "#fff" : "#1e3a8a" }}>{value}</div>
    </div>
  );
}
