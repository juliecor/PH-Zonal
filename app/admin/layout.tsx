"use client";

import DashboardSidebar from "../components/DashboardSidebar";
import LowBalanceNotice from "../components/LowBalanceNotice";
import { User, Users, ClipboardCheck, FileText, Home } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');

        .al-root {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f5f0eb;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
        }

        /* ── Top bar ── */
        .al-topbar {
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
        .al-topbar-logo {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          text-decoration: none;
        }
        .al-topbar-mark {
          width: 30px; height: 30px;
          border: 1.5px solid #c9a84c;
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          color: #c9a84c;
        }
        .al-topbar-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.1rem;
          font-weight: 600;
          color: #f5f0eb;
          letter-spacing: 0.02em;
        }
        .al-topbar-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .al-topbar-label {
          font-size: 0.72rem;
          color: #8fa3bf;
          font-weight: 300;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        /* Subtle admin badge to distinguish from client layout */
        .al-admin-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.2rem 0.6rem;
          background: rgba(201,168,76,0.15);
          border: 1px solid rgba(201,168,76,0.3);
          border-radius: 20px;
          font-size: 0.65rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #c9a84c;
        }
        .al-admin-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #c9a84c;
        }

        /* ── Body ── */
        .al-body {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: 260px 1fr;
          overflow: hidden;
        }

        @media (max-width: 860px) {
          .al-body { grid-template-columns: 1fr; }
        }

        /* ── Sidebar ── */
        .al-sidebar-wrap {
          height: 100%;
          overflow: hidden;
          padding: 1.5rem 1rem 1.5rem 1.5rem;
          box-sizing: border-box;
        }

        /* ── Main ── */
        .al-main {
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

      <div className="al-root">

        {/* ── Top bar ── */}
        <header className="al-topbar">
          <div className="al-topbar-logo">
            <div className="al-topbar-mark">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 9 12 2 21 9 21 22 3 22" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className="al-topbar-name">Zonal Value</span>
          </div>
          <div className="al-topbar-right">
            <span className="al-topbar-label">Admin Panel</span>
            <span className="al-admin-badge">
              <span className="al-admin-dot" />
              Admin
            </span>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="al-body">
          <LowBalanceNotice threshold={3} remindAfterHours={24} />

          {/* Sidebar */}
          <aside className="al-sidebar-wrap">
            <DashboardSidebar
              title="Admin"
              links={[
                { href: "/welcome",          label: "Home",     icon: <Home size={16} /> },
                { href: "/admin/profile",    label: "Profile",  icon: <User size={16} /> },
                { href: "/admin/users",      label: "Users",    icon: <Users size={16} /> },
                { href: "/admin/requests",   label: "Requests", icon: <ClipboardCheck size={16} /> },
                { href: "/admin/reports",    label: "Reports",  icon: <FileText size={16} /> },
              ]}
            />
          </aside>

          {/* Page content */}
          <main className="al-main">
            {children}
          </main>

        </div>
      </div>
    </>
  );
}