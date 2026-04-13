"use client";

export default function AdminKpis({
  totalUsers,
  pendingRequests,
  totalTokens,
}: {
  totalUsers: number;
  pendingRequests: number;
  totalTokens: number;
}) {
  const cards = [
    { label: "Users",             value: totalUsers.toLocaleString(),      note: "Total registered" },
    { label: "Pending Requests",  value: pendingRequests.toLocaleString(), note: "Awaiting approval" },
    { label: "Issued Tokens",     value: totalTokens.toLocaleString(),     note: "Current balances" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl bg-white border border-[#e8e0d8] shadow-sm p-4 flex items-start justify-between"
        >
          <div>
            <div className="text-[0.72rem] font-semibold tracking-[0.14em] uppercase text-[#1e3a8a]">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold text-[#0f1f38]">{c.value}</div>
            <div className="mt-1 text-xs text-[#6b7585]">{c.note}</div>
          </div>
          <span
            aria-hidden
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#e8e0d8] text-[0.65rem] font-bold text-[#c9a84c]"
            title=""
          >
            •
          </span>
        </div>
      ))}
    </div>
  );
}
