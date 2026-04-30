"use client";

import DashboardSidebar from "../components/DashboardSidebar";
import LowBalanceNotice from "../components/LowBalanceNotice";
import { User, Users, ClipboardCheck, FileText, Home, LogOut, Menu, X, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiLogout, apiMe, apiAdminPendingCounts } from "../lib/authClient";
import { useEffect, useMemo, useState } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuClosing, setMobileMenuClosing] = useState(false);

  const openMobileMenu = () => { setMobileMenuOpen(true); setMobileMenuClosing(false); };
  const closeMobileMenu = () => {
    setMobileMenuClosing(true);
    // Wait for CSS slide-out animation, then unmount
    setTimeout(() => { setMobileMenuOpen(false); setMobileMenuClosing(false); }, 250);
  };
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

  // ── Admin badge counts (pending requests/concerns) ───────────────
  const [reqCount, setReqCount] = useState(0);
  const [concernCount, setConcernCount] = useState(0);
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const c = await apiAdminPendingCounts();
        if (!mounted) return;
        setReqCount(c.tokenRequests || 0);
        setConcernCount(c.concerns || 0);
      } catch {}
    };
    load();
    const id = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const CountBadge = ({ n }: { n: number }) => (
    <span style={{
      marginLeft: 8,
      minWidth: 18,
      height: 18,
      padding: '0 6px',
      borderRadius: 10,
      background: '#ef4444',
      color: '#fff',
      fontSize: 11,
      fontWeight: 700,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      lineHeight: 1,
      boxShadow: '0 1px 6px rgba(239,68,68,0.35)'
    }}>{n}</span>
  );

  const desktopLinks = useMemo(() => ([
    { href: "/welcome",          label: "Home",     icon: <Home size={16} /> },
    { href: "/admin/profile",    label: "Profile",  icon: <User size={16} /> },
    { href: "/admin/users",      label: "Users",    icon: <Users size={16} /> },
    { href: "/admin/requests",   label: "Requests", icon: <ClipboardCheck size={16} />, badge: reqCount > 0 ? <CountBadge n={reqCount} /> : undefined },
    { href: "/admin/reports",    label: "Reports",  icon: <FileText size={16} /> },
    { href: "/admin/invitations",label: "Invitations", icon: <Users size={16} /> },
    { href: "/admin/concerns",   label: "Concerns", icon: <AlertTriangle size={16} />, badge: concernCount > 0 ? <CountBadge n={concernCount} /> : undefined },
  ]), [reqCount, concernCount]);
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
          background: #fff;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 1.75rem;
          height: 60px;
          border-bottom: 1px solid #ede8e0;
          margin-left: 260px;
          width: calc(100% - 260px);
        }
        @media (max-width: 860px) {
          .al-topbar { margin-left: 0; width: 100%; }
        }
        .al-topbar-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        /* Hamburger — mobile only */
        .al-hamburger { background: #f5f0eb; border: none; border-radius: 9px; padding: 8px; cursor: pointer; display: none; align-items: center; justify-content: center; transition: background 0.15s; color: #0f1f38; }
        .al-hamburger:hover { background: #ede8e0; }
        @media (max-width:860px) { .al-hamburger { display:flex; } }
        .al-topbar-mark {
          width: 32px; height: 32px;
          background: #0f1f38;
          border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          color: #c9a84c;
          flex-shrink: 0;
        }
        .al-topbar-brand {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
        }
        .al-topbar-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.05rem;
          font-weight: 700;
          color: #0f1f38;
          letter-spacing: 0.01em;
        }
        .al-topbar-sub {
          font-size: 0.63rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #9aa3b0;
        }
        .al-topbar-divider {
          width: 1px;
          height: 28px;
          background: #ede8e0;
        }
        .al-topbar-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        /* Sidebar logout styles */
        .sb-logout-row { padding:0.85rem 0.75rem; border-top:1px solid #f0ebe4; }
        .sb-logout-btn { width:100%; display:flex; align-items:center; gap:0.65rem; padding:0.62rem 1rem; border-radius:10px; background:transparent; border:1.5px solid #ede8e0; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:0.83rem; font-weight:500; color:#6b7585; transition:border-color 0.15s,background 0.15s,color 0.15s; }
        .sb-logout-btn:hover { border-color:#e2d9d0; background:#f9f7f4; color:#0f1f38; }
        /* Admin badge */
        .al-admin-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.28rem 0.75rem;
          background: rgba(201,168,76,0.08);
          border: 1px solid rgba(201,168,76,0.28);
          border-radius: 50px;
          font-size: 0.67rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #8a6d15;
        }
        .al-admin-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 2px rgba(34,197,94,0.2);
        }

        /* ── Body ── */
        .al-body {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: 260px 1fr;
          overflow: visible; /* allow sidebar to extend upward */
        }

        @media (max-width: 860px) {
          .al-body { grid-template-columns: 1fr; }
          .al-sidebar-wrap { display:none; }
        }

        /* ── Sidebar ── */
        .al-sidebar-wrap {
          height: calc(100% + 60px); /* compensate the topbar height */
          overflow: visible;
          padding: 0;
          box-sizing: border-box;
          margin-top: -60px; /* pull sidebar to very top */
        }

        .al-sidebar-card {
          background:#fff;
          border-radius:0; /* Remove rounded corners for full-width feel */
          border:none;     /* No inner border so it meets the edges */
          box-shadow:none; /* No shadow gap around sidebar */
          overflow:hidden;
          display:flex;
          flex-direction:column;
          height:100%;
        }

        .al-logout-row { padding:0.75rem 1rem; border-top:1px solid #f0ebe4; margin-top:auto; }

        /* ── Mobile Drawer Overlay ── */
        .al-mobile-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.45); backdrop-filter:blur(3px); z-index:300; display:flex; animation:alMbFadeIn 0.2s ease; }
        @keyframes alMbFadeIn { from{opacity:0} to{opacity:1} }
        .al-mobile-overlay.closing { animation:alMbFadeOut 0.22s ease forwards; }
        @keyframes alMbFadeOut { from{opacity:1} to{opacity:0} }

        .al-mobile-drawer { width:300px; max-width:85vw; height:100%; background:#fff; display:flex; flex-direction:column; box-shadow:4px 0 32px rgba(30,58,138,0.2); animation:alMbSlideIn 0.25s cubic-bezier(0.22,1,0.36,1); overflow:hidden; position:relative; }
        @keyframes alMbSlideIn { from{transform:translateX(-100%)} to{transform:translateX(0)} }
        .al-mobile-drawer.closing { animation:alMbSlideOut 0.25s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes alMbSlideOut { from{transform:translateX(0)} to{transform:translateX(-100%)} }
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
          <div className="al-topbar-left">
            <button className="al-hamburger" onClick={openMobileMenu} title="Menu">
              <Menu size={18} />
            </button>
            <div className="al-topbar-mark">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 9 12 2 21 9 21 22 3 22" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div className="al-topbar-brand">
              <span className="al-topbar-name">Zonal Value</span>
              <span className="al-topbar-sub">Admin Panel</span>
            </div>
          </div>
          <div className="al-topbar-right">
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
              <DashboardSidebar title="Admin" links={desktopLinks} />
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
      {(mobileMenuOpen || mobileMenuClosing) && (
        <div className={`al-mobile-overlay${mobileMenuClosing ? " closing" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) closeMobileMenu(); }}>
          <div className={`al-mobile-drawer${mobileMenuClosing ? " closing" : ""}`}>
            <button className="al-mobile-drawer-close" onClick={closeMobileMenu} title="Close menu">
              <X size={16} />
            </button>
            <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
              <div className="al-sidebar-card" style={{ boxShadow:'none', border:'none', height:'100%' }}>
                <DashboardSidebar
                  title="Admin"
                  links={desktopLinks.map(l => ({ ...l, onClick: closeMobileMenu }))}
                />
                <div className="sb-logout-row">
                  <button className="sb-logout-btn" onClick={async () => { try { await apiLogout(); } catch {} closeMobileMenu(); router.replace("/login"); }}>
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