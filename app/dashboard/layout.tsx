"use client";

import DashboardSidebar from "../components/DashboardSidebar";
import LowBalanceNotice from "../components/LowBalanceNotice";
import { User, Coins, FileText, Home } from "lucide-react";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');

        /* Root fills the entire viewport — nothing overflows */
        .cl-root {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f5f0eb;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
        }

        /* ── Top bar (fixed height, never shrinks) ── */
        .cl-topbar {
          flex-shrink: 0;
          background: #0f1f38;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 2rem;
          height: 56px;
          box-shadow: 0 2px 16px rgba(15,31,56,0.18);
        }
        .cl-topbar-logo {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          text-decoration: none;
        }
        .cl-topbar-mark {
          width: 30px; height: 30px;
          border: 1.5px solid #c9a84c;
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          color: #c9a84c;
        }
        .cl-topbar-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.1rem;
          font-weight: 600;
          color: #f5f0eb;
          letter-spacing: 0.02em;
        }
        .cl-topbar-label {
          font-size: 0.72rem;
          color: #8fa3bf;
          font-weight: 300;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        /* ── Body: takes all remaining height ── */
        .cl-body {
          flex: 1;
          min-height: 0;         /* crucial — lets flex child shrink below content size */
          display: grid;
          grid-template-columns: 260px 1fr;
          overflow: hidden;
        }

        @media (max-width: 860px) {
          .cl-body { grid-template-columns: 1fr; }
        }

        /* ── Sidebar: full remaining height, no scroll ── */
        .cl-sidebar-wrap {
          height: 100%;
          overflow: hidden;      /* sidebar never scrolls — logout always visible */
          padding: 1.5rem 1rem 1.5rem 1.5rem;
          box-sizing: border-box;
        }

        /* ── Main content: only this panel scrolls ── */
        .cl-main {
          height: 100%;
          overflow-y: auto;
          padding: 2rem 1.5rem 2rem 0.75rem;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          min-width: 0;
        }
      `}</style>

      <div className="cl-root">

        {/* ── Top bar ── */}
        <header className="cl-topbar">
          <div className="cl-topbar-logo">
            <div className="cl-topbar-mark">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 9 12 2 21 9 21 22 3 22" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className="cl-topbar-name">Zonal Value</span>
          </div>
          <div>
            <span className="cl-topbar-label">My Account</span>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="cl-body">
          <LowBalanceNotice threshold={3} remindAfterHours={24} />

          {/* Sidebar — never scrolls, logout always visible */}
          <aside className="cl-sidebar-wrap">
            <DashboardSidebar
              title="My Account"
              links={[
                { href: "/map",           label: "Home",           icon: <Home size={16} /> },
                { href: "/dashboard/profile", label: "Profile",        icon: <User size={16} /> },
                { href: "/dashboard/request", label: "Request Tokens", icon: <Coins size={16} /> },
                { href: "/dashboard/reports", label: "Reports",        icon: <FileText size={16} /> },
              ]}
            />
          </aside>

          {/* Page content — only this area scrolls */}
          <main className="cl-main">
            {children}
          </main>

        </div>
      </div>
    </>
  );
}