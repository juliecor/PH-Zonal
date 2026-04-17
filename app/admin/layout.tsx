"use client";

import DashboardSidebar from "../components/DashboardSidebar";
import LowBalanceNotice from "../components/LowBalanceNotice";
import { User, Users, ClipboardCheck, FileText, Home, LogOut, Menu, X, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiLogout, apiMe } from "../lib/authClient";
import { useEffect, useState } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const me = await apiMe();
        if (!me) { router.replace("/login"); return; }
        if ((me.role || "").toLowerCase() !== "admin") {
          router.replace("/dashboard");
        }
      } catch {
        // if unable to verify, keep current page; middleware still checks auth
      }
    })();
  }, [router]);
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
          background: #1e3a8a; /* match client */
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 2rem;
          height: 56px;
          box-shadow: 0 2px 16px rgba(30,58,138,0.18);
        }
        .al-topbar-logo {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          text-decoration: none;
        }
        /* Hamburger — mobile only */
        .al-hamburger { background:rgba(255,255,255,0.1); border:none; border-radius:10px; padding:8px; cursor:pointer; display:none; align-items:center; justify-content:center; transition:background 0.15s; margin-right:0.5rem; }
        .al-hamburger:hover { background:rgba(255,255,255,0.2); }
        @media (max-width:860px) { .al-hamburger { display:flex; } }
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
          color: #dbeafe; /* lighter like client */
          font-weight: 300;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        /* Sidebar logout styles — match client dashboard */
        .sb-logout-row { padding:0.75rem 1rem; border-top:1px solid #f0ebe4; margin-top:auto; }
        .sb-logout-btn { width:100%; display:flex; align-items:center; gap:0.65rem; padding:0.65rem 1rem; border-radius:10px; background:transparent; border:1.5px solid #e2d9d0; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:0.83rem; font-weight:500; color:#6b7585; transition:border-color 0.15s,background 0.15s,color 0.15s; }
        .sb-logout-btn:hover { border-color:#1e40af; background:#dbeafe; color:#1e3a8a; }
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
          .al-sidebar-wrap { display:none; }
        }

        /* ── Sidebar ── */
        .al-sidebar-wrap {
          height: 100%;
          overflow: hidden;
          padding: 1.5rem 1rem 1.5rem 1.5rem;
          box-sizing: border-box;
        }

        .al-sidebar-card {
          background:#fff;
          border-radius:16px;
          border:1px solid #e8e0d8;
          box-shadow:0 2px 14px rgba(15,31,56,0.05);
          overflow:hidden;
          display:flex;
          flex-direction:column;
          height:100%;
        }

        .al-logout-row { padding:0.75rem 1rem; border-top:1px solid #f0ebe4; margin-top:auto; }

        /* ── Mobile Drawer Overlay ── */
        .al-mobile-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.45); backdrop-filter:blur(3px); z-index:300; display:flex; animation:alMbFadeIn 0.2s ease; }
        @keyframes alMbFadeIn { from{opacity:0} to{opacity:1} }
        .al-mobile-drawer { width:300px; max-width:85vw; height:100%; background:#fff; display:flex; flex-direction:column; box-shadow:4px 0 32px rgba(30,58,138,0.2); animation:alMbSlideIn 0.25s cubic-bezier(0.22,1,0.36,1); overflow:hidden; position:relative; }
        @keyframes alMbSlideIn { from{transform:translateX(-100%)} to{transform:translateX(0)} }
        .al-mobile-drawer-close { position:absolute; top:14px; right:-48px; width:36px; height:36px; border-radius:50%; background:rgba(255,255,255,0.15); border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#fff; transition:background 0.15s; }
        .al-mobile-drawer-close:hover { background:rgba(255,255,255,0.25); }

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
            <button className="al-hamburger" onClick={() => setMobileMenuOpen(true)} title="Menu">
              <Menu size={20} color="#fff" />
            </button>
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
            <div className="al-sidebar-card">
              <DashboardSidebar
                title="Admin"
                links={[
                  { href: "/welcome",          label: "Home",     icon: <Home size={16} /> },
                  { href: "/admin/profile",    label: "Profile",  icon: <User size={16} /> },
                  { href: "/admin/users",      label: "Users",    icon: <Users size={16} /> },
                  { href: "/admin/requests",   label: "Requests", icon: <ClipboardCheck size={16} /> },
                  { href: "/admin/reports",    label: "Reports",  icon: <FileText size={16} /> },
                  { href: "/admin/invitations",label: "Invitations", icon: <Users size={16} /> },
                  { href: "/admin/concerns",   label: "Concerns", icon: <AlertTriangle size={16} /> },
                ]}
              />
              <div className="sb-logout-row">
                <button className="sb-logout-btn" onClick={async () => { try { await apiLogout(); } catch {} router.replace("/login"); }}>
                  <LogOut size={15} />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          </aside>

          {/* Page content */}
          <main className="al-main">
            {children}
          </main>

        </div>
      </div>

      {/* ── Mobile Drawer ── */}
      {mobileMenuOpen && (
        <div className="al-mobile-overlay" onClick={(e) => { if (e.target === e.currentTarget) setMobileMenuOpen(false); }}>
          <div className="al-mobile-drawer">
            <button className="al-mobile-drawer-close" onClick={() => setMobileMenuOpen(false)} title="Close menu">
              <X size={16} />
            </button>
            <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
              <div className="al-sidebar-card" style={{ boxShadow:'none', border:'none', height:'100%' }}>
                <DashboardSidebar
                  title="Admin"
                  links={[
                    { href: "/welcome",          label: "Home",     icon: <Home size={16} /> },
                    { href: "/admin/profile",    label: "Profile",  icon: <User size={16} /> },
                    { href: "/admin/users",      label: "Users",    icon: <Users size={16} /> },
                    { href: "/admin/requests",   label: "Requests", icon: <ClipboardCheck size={16} /> },
                    { href: "/admin/reports",    label: "Reports",  icon: <FileText size={16} /> },
                    { href: "/admin/invitations",label: "Invitations", icon: <Users size={16} /> },
                    { href: "/admin/concerns",   label: "Concerns", icon: <AlertTriangle size={16} /> },
                  ]}
                />
                <div className="sb-logout-row">
                  <button className="sb-logout-btn" onClick={async () => { try { await apiLogout(); } catch {} setMobileMenuOpen(false); router.replace("/login"); }}>
                    <LogOut size={15} />
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}