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
    {
      label: "Users",
      value: totalUsers.toLocaleString(),
      note: "Total registered",
      bg: "from-pink-400 to-rose-500",
    },
    {
      label: "Pending Requests",
      value: pendingRequests.toLocaleString(),
      note: "Awaiting approval",
      bg: "from-sky-400 to-blue-600",
    },
    {
      label: "Issued Tokens",
      value: totalTokens.toLocaleString(),
      note: "Current balances",
      bg: "from-emerald-400 to-teal-600",
    },
  ];

  return (
    <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl p-[1px] bg-gradient-to-br from-black/10 to-black/0">
          <div className={`rounded-xl p-5 text-white bg-gradient-to-br ${c.bg} shadow-md`}> 
            <div className="text-sm/5 opacity-90">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold">{c.value}</div>
            <div className="mt-2 text-xs/5 opacity-80">{c.note}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
