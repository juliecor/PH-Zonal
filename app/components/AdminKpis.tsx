"use client";

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function CoinsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6"/>
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18"/>
      <path d="M7 6h1v4"/>
      <path d="m16.71 13.88.7.71-2.82 2.82"/>
    </svg>
  );
}

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
      icon: <UsersIcon />,
      accent: "#3b82f6",
      iconBg: "rgba(59,130,246,0.1)",
      iconBorder: "rgba(59,130,246,0.2)",
    },
    {
      label: "Pending Requests",
      value: pendingRequests.toLocaleString(),
      note: "Awaiting approval",
      icon: <ClockIcon />,
      accent: "#f59e0b",
      iconBg: "rgba(245,158,11,0.1)",
      iconBorder: "rgba(245,158,11,0.2)",
    },
    {
      label: "Issued Tokens",
      value: totalTokens.toLocaleString(),
      note: "Current balances",
      icon: <CoinsIcon />,
      accent: "#10b981",
      iconBg: "rgba(16,185,129,0.1)",
      iconBorder: "rgba(16,185,129,0.2)",
    },
  ];

  return (
    <>
      <style>{`
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }
        @media (max-width: 640px) {
          .kpi-grid { grid-template-columns: 1fr; }
        }
        @media (min-width: 480px) and (max-width: 640px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr); }
        }
        .kpi-card {
          position: relative;
          background: #fff;
          border-radius: 16px;
          border: 1px solid #eae2d9;
          box-shadow: 0 1px 6px rgba(15,31,56,0.05), 0 4px 20px rgba(15,31,56,0.04);
          padding: 1.4rem 1.5rem 1.3rem;
          overflow: hidden;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .kpi-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 28px rgba(15,31,56,0.1), 0 2px 8px rgba(15,31,56,0.06);
        }
        .kpi-top-bar {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          border-radius: 16px 16px 0 0;
        }
        .kpi-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 1rem;
          margin-top: 0.25rem;
        }
        .kpi-label {
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #9aa3b0;
        }
        .kpi-icon-box {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .kpi-number {
          font-size: 2.15rem;
          font-weight: 700;
          color: #0f1f38;
          line-height: 1;
          letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
        }
        .kpi-note {
          margin-top: 0.45rem;
          font-size: 0.74rem;
          color: #b0b8c4;
        }
      `}</style>
      <div className="kpi-grid">
        {cards.map((c) => (
          <div key={c.label} className="kpi-card">
            <div className="kpi-top-bar" style={{ background: c.accent }} />
            <div className="kpi-header">
              <span className="kpi-label">{c.label}</span>
              <div
                className="kpi-icon-box"
                style={{ background: c.iconBg, color: c.accent, border: `1px solid ${c.iconBorder}` }}
              >
                {c.icon}
              </div>
            </div>
            <div className="kpi-number">{c.value}</div>
            <div className="kpi-note">{c.note}</div>
          </div>
        ))}
      </div>
    </>
  );
}
