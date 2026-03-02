"use client";

export default function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <div className={[
      "rounded-2xl border border-amber-200 bg-amber-50 text-amber-900",
      "px-4 py-3 text-[12px] leading-relaxed",
      className,
    ].join(" ")}
    >
      <strong className="font-semibold">Disclaimer:</strong> The Zonal Value information provided in this report is
      intended for informational purposes only. It is not an official appraisal report. The values presented are based on
      our data-driven analysis of Filipino homes and should not be used as the sole basis for property valuation, legal,
      or financial decisions. For official appraisal, please consult a licensed appraiser or the appropriate government
      authority (e.g., BIR).
    </div>
  );
}
