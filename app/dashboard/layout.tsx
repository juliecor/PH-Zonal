"use client";

import DashboardSidebar from "../components/DashboardSidebar";
import LowBalanceNotice from "../components/LowBalanceNotice";
import { User, Coins, Home, Bell, X, Search, LogOut, Menu, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { apiMe, getCachedUser, getToken, apiLogout } from "../lib/authClient";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [me, setMe] = useState<any>(null);
  const [notifTab, setNotifTab] = useState<"all" | "unread">("all");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function fetchUserData() {
    const cached = getCachedUser();
    if (cached) applyUser(cached);
    if (!getToken()) return;
    try { const data = await apiMe(); applyUser(data); }
    catch { if (!cached) { setTokenBalance(0); setUserName("User"); } }
  }

  function applyUser(data: any) {
    if (!data) return;
    setMe(data);
    const balance = typeof data.token_balance === "number" ? data.token_balance : parseInt(String(data.token_balance ?? "0"), 10);
    setTokenBalance(isNaN(balance) ? 0 : balance);
    const name = data.name || [data.first_name, data.middle_name, data.last_name].filter(Boolean).join(" ") || data.email || "User";
    setUserName(name);
  }

  useEffect(() => { fetchUserData(); }, []);

  const displayName = me?.name || userName || "?";
  const initials = displayName.split(" ").slice(0, 2).map((w: string) => w[0] ?? "").join("").toUpperCase() || "?";
  const isLowBalance  = tokenBalance !== null && tokenBalance <= 3;
  const isZeroBalance = tokenBalance !== null && tokenBalance === 0;

  type NotifItem = { id: string; read: boolean; icon: string; iconBg: string; title: string; body: string; time: string; action: { label: string; href: string; color: string } | null; };
  const notifItems: NotifItem[] = [];
  if (tokenBalance !== null) {
    if (isZeroBalance) {
      notifItems.push({ id: "zero", read: false, icon: "⚠️", iconBg: "#fee2e2", title: "Token Balance Depleted", body: `Dear ${userName}, your token balance is 0. You cannot access property reports until you subscribe.`, time: "Just now", action: { label: "Subscribe Now", href: "/dashboard/request", color: "#dc2626" } });
    } else if (isLowBalance) {
      notifItems.push({ id: "low", read: false, icon: "⚠️", iconBg: "#fef3c7", title: "Token Balance Running Low", body: `Dear ${userName}, you only have ${tokenBalance} token${tokenBalance !== 1 ? "s" : ""} left. Subscribe to continue using our services.`, time: "Just now", action: { label: "Subscribe Now", href: "/dashboard/request", color: "#d97706" } });
    } else {
      notifItems.push({ id: "ok", read: true, icon: "✓", iconBg: "#dcfce7", title: "All Good!", body: `Dear ${userName}, you have ${tokenBalance} token${tokenBalance !== 1 ? "s" : ""} remaining. No action needed.`, time: "Just now", action: null });
    }
  }
  const unreadCount    = notifItems.filter(n => !n.read).length;
  const displayedItems = notifTab === "unread" ? notifItems.filter(n => !n.read) : notifItems;
  const tokenPillBg    = isZeroBalance ? "#ef4444" : isLowBalance ? "#f59e0b" : "#10b981";

  function SidebarContent({ onLinkClick }: { onLinkClick?: () => void }) {
    return (
      <>
        <div onClick={onLinkClick}>
          <DashboardSidebar
            title=""
            links={[
              { href: "/welcome", label: "Home", icon: <Home size={16} /> },
              { href: "/dashboard/profile", label: "Profile", icon: <User size={16} /> },
              { href: "/dashboard/reports", label: "Reports", icon: <Home size={16} /> },
              { href: "/dashboard/concerns", label: "Report a Concern", icon: <AlertTriangle size={16} /> },
              {
                href: "/dashboard/request",
                label: "Request Tokens",
                icon: <Coins size={16} />,
                badge: (
                  <span className="sb-token-pill" style={{ background: tokenBalance === null ? "#d1d5db" : tokenPillBg, minWidth: "22px" }}>
                    {tokenBalance === null ? "\u00A0" : tokenBalance}
                  </span>
                ),
              },
            ]}
          />
        </div>

        {/* Search Zonal button */}
        <div className="sb-search-row">
          <button
            className="sb-search-btn"
            onClick={() => {
              if (tokenBalance === 0) {
                try {
                  toast.error("Your token balance is 0. Request tokens to continue.", {
                    action: { label: "Request Tokens", onClick: () => { window.location.href = "/dashboard/request"; } },
                  });
                } catch {}
                return;
              }
              window.location.href = "/";
            }}
          >
            <Search size={16} />
            <span>Search Zonal</span>
          </button>
        </div>

        {/* Log out row */}
        <div className="sb-logout-row">
          <button className="sb-logout-btn" onClick={async () => { try { await apiLogout(); } catch {} window.location.href = "/login"; }}>
            <LogOut size={15} />
            <span>Log out</span>
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');

        .cl-root { height:100vh; display:flex; flex-direction:column; background:#f5f0eb; font-family:'DM Sans',sans-serif; overflow:hidden; }

        /* ── Top bar ── */
        .cl-topbar { flex-shrink:0; background:#1e3a8a; z-index:50; display:flex; align-items:center; justify-content:space-between; padding:0 1.25rem; height:56px; box-shadow:0 2px 16px rgba(30,58,138,0.18); }
        .cl-topbar-left { display:flex; align-items:center; gap:0.65rem; }
        .cl-topbar-logo { display:flex; align-items:center; gap:0.55rem; text-decoration:none; }
        .cl-topbar-mark { width:30px; height:30px; border:1.5px solid #c9a84c; border-radius:7px; display:flex; align-items:center; justify-content:center; color:#c9a84c; }
        .cl-topbar-name { font-family:'Cormorant Garamond',serif; font-size:1.1rem; font-weight:600; color:#f5f0eb; letter-spacing:0.02em; }

        /* Hamburger — mobile only */
        .cl-hamburger { background:rgba(255,255,255,0.1); border:none; border-radius:10px; padding:8px; cursor:pointer; display:none; align-items:center; justify-content:center; transition:background 0.15s; }
        .cl-hamburger:hover { background:rgba(255,255,255,0.2); }
        @media (max-width:860px) { .cl-hamburger { display:flex; } }

        .cl-topbar-actions { display:flex; align-items:center; gap:0.5rem; }
        .cl-bell-btn { background:rgba(255,255,255,0.1); border:none; border-radius:12px; padding:8px; cursor:pointer; position:relative; display:flex; align-items:center; justify-content:center; transition:background 0.15s; }
        .cl-bell-btn:hover { background:rgba(255,255,255,0.2); }
        .cl-bell-dot { position:absolute; top:-4px; right:-4px; width:12px; height:12px; background:#ef4444; border-radius:50%; border:2px solid #1e3a8a; animation:pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.2);opacity:0.7} }

        /* ── Body ── */
        .cl-body { flex:1; min-height:0; display:grid; grid-template-columns:260px 1fr; overflow:hidden; }
        @media (max-width:860px) { .cl-body { grid-template-columns:1fr; } }

        /* ── Desktop Sidebar ── */
        .cl-sidebar-wrap { height:100%; overflow:hidden; padding:1.5rem 1rem 1.5rem 1.5rem; box-sizing:border-box; display:flex; flex-direction:column; }
        @media (max-width:860px) { .cl-sidebar-wrap { display:none; } }
        .cl-sidebar-card { background:#fff; border-radius:16px; border:1px solid #e8e0d8; box-shadow:0 2px 14px rgba(30,58,138,0.05); overflow:hidden; display:flex; flex-direction:column; flex:1; }

        /* ── Mobile Drawer Overlay ── */
        .cl-mobile-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.45); backdrop-filter:blur(3px); z-index:300; display:flex; animation:mbFadeIn 0.2s ease; }
        @keyframes mbFadeIn { from{opacity:0} to{opacity:1} }
        .cl-mobile-drawer { width:300px; max-width:85vw; height:100%; background:#fff; display:flex; flex-direction:column; box-shadow:4px 0 32px rgba(30,58,138,0.2); animation:mbSlideIn 0.25s cubic-bezier(0.22,1,0.36,1); overflow:hidden; }
        @keyframes mbSlideIn { from{transform:translateX(-100%)} to{transform:translateX(0)} }
        .cl-mobile-drawer-close { position:absolute; top:14px; right:-48px; width:36px; height:36px; border-radius:50%; background:rgba(255,255,255,0.15); border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#fff; transition:background 0.15s; }
        .cl-mobile-drawer-close:hover { background:rgba(255,255,255,0.25); }

        /* ── Profile section ── */
        .sb-profile-section { padding:1.25rem 1.25rem 1rem; border-bottom:1px solid rgba(255,255,255,0.06); background:linear-gradient(135deg,#1e3a8a 0%,#1e40af 100%); display:flex; align-items:center; gap:0.85rem; flex-shrink:0; }
        .sb-profile-av-btn { width:48px; height:48px; border-radius:14px; background:rgba(201,168,76,0.15); border:2px solid rgba(201,168,76,0.5); display:flex; align-items:center; justify-content:center; font-family:'Cormorant Garamond',serif; font-size:1.2rem; font-weight:700; color:#c9a84c; text-transform:uppercase; user-select:none; flex-shrink:0; }
        .sb-profile-name { font-size:0.875rem; font-weight:600; color:#f5f0eb; line-height:1.3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px; }
        .sb-profile-role { font-size:0.68rem; color:rgba(201,168,76,0.85); text-transform:capitalize; margin-top:2px; letter-spacing:0.06em; }

        /* ── Token pill ── */
        .sb-token-pill { display:inline-flex; align-items:center; justify-content:center; min-width:22px; height:20px; padding:0 6px; border-radius:20px; font-size:0.7rem; font-weight:700; letter-spacing:0.02em; line-height:1; color:#fff; flex-shrink:0; }

        /* ── Sidebar nav hover/active ── */
        .cl-sidebar-card a, .cl-sidebar-card [role="link"], .cl-sidebar-card nav a,
        .cl-mobile-nav a, .cl-mobile-nav [role="link"], .cl-mobile-nav nav a {
          transition: background 0.15s, color 0.15s; border-radius: 10px;
        }
        .cl-sidebar-card a:hover, .cl-sidebar-card nav a:hover,
        .cl-mobile-nav a:hover, .cl-mobile-nav nav a:hover {
          background: #dbeafe !important; color: #1e3a8a !important;
        }
        .cl-sidebar-card a:hover svg, .cl-sidebar-card nav a:hover svg,
        .cl-mobile-nav a:hover svg, .cl-mobile-nav nav a:hover svg {
          color: #1e3a8a !important; stroke: #1e3a8a !important;
        }
        .cl-sidebar-card a[aria-current="page"], .cl-sidebar-card a.active, .cl-sidebar-card nav a.active,
        .cl-mobile-nav a[aria-current="page"], .cl-mobile-nav a.active, .cl-mobile-nav nav a.active {
          background: #1e40af !important; color: #fff !important;
        }

        /* ── Logout row ── */
        .sb-logout-row { padding:0.75rem 1rem; border-top:1px solid #f0ebe4; margin-top:auto; flex-shrink:0; }
        .sb-logout-btn { width:100%; display:flex; align-items:center; gap:0.65rem; padding:0.65rem 1rem; border-radius:10px; background:transparent; border:1.5px solid #e2d9d0; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:0.83rem; font-weight:500; color:#6b7585; transition:border-color 0.15s,background 0.15s,color 0.15s; }
        .sb-logout-btn:hover { border-color:#1e40af; background:#dbeafe; color:#1e3a8a; }

        /* ── Search Zonal button (light tone) ── */
        .sb-search-row { padding:0.75rem 1rem 0; }
        .sb-search-btn { width:100%; display:flex; align-items:center; gap:0.55rem; padding:0.6rem 0.9rem; border-radius:10px; border:1.5px solid #e8e0d8; background:#ffffff; color:#0f1f38; font-weight:700; cursor:pointer; }
        .sb-search-btn:hover { background:#fff8e6; border-color:#e6d7b0; }

        /* ── Main content ── */
        .cl-main { height:100%; overflow-y:auto; padding:2rem 1.5rem 2rem 0.75rem; box-sizing:border-box; display:flex; flex-direction:column; gap:1.25rem; min-width:0; }
        @media (max-width:860px) { .cl-main { padding:1.25rem 1rem; } }

        /* ── Hide Philippine map ── */
        .cl-main img[alt*="map"], .cl-main img[alt*="Map"], .cl-main img[alt*="philippines"], .cl-main img[alt*="Philippines"],
        .cl-main .ph-map, .cl-main .philippines-map, .cl-main [class*="map-hero"], .cl-main [class*="mapHero"], .cl-main [class*="hero-map"] { display:none !important; }

        /* ── Start Exploring hover → light navy when zero tokens ── */
        ${isZeroBalance ? `
        .cl-main .start-exploring-btn:hover, .cl-main [class*="startExploring"]:hover, .cl-main [class*="exploreBtn"]:hover {
          background: #1e40af !important; border-color: #1e40af !important; color: #fff !important;
        }` : ""}

        /* ── Notification Modal ── */
        .notif-overlay { position:fixed; inset:0; background:rgba(30,58,138,0.3); backdrop-filter:blur(3px); z-index:400; display:flex; align-items:flex-start; justify-content:flex-end; padding:4.5rem 1.75rem 1rem; animation:epFadeIn 0.15s ease; }
        @keyframes epFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes epSlideUp { from{opacity:0;transform:translateY(16px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        .notif-panel { background:#fff; border-radius:20px; box-shadow:0 20px 60px rgba(30,58,138,0.18); width:100%; max-width:390px; overflow:hidden; animation:epSlideUp 0.18s ease; }
        @media (max-width:480px) { .notif-overlay { padding:4.5rem 0.75rem 1rem; } .notif-panel { max-width:100%; } }
        .notif-head { padding:1.2rem 1.3rem 0; }
        .notif-head-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; }
        .notif-title { font-size:1.05rem; font-weight:700; color:#111; }
        .notif-mark-btn { font-size:0.75rem; font-weight:600; color:#e05c2d; background:none; border:none; cursor:pointer; padding:0; transition:opacity 0.15s; }
        .notif-mark-btn:hover { opacity:0.7; }
        .notif-tabs { display:flex; gap:0; border-bottom:1.5px solid #f0ebe4; margin:0 -1.3rem; padding:0 1.3rem; }
        .notif-tab-btn { padding:0.5rem 0; margin-right:1.2rem; font-size:0.82rem; font-weight:500; color:#9aa3b0; background:none; border:none; cursor:pointer; border-bottom:2.5px solid transparent; margin-bottom:-1.5px; display:flex; align-items:center; gap:0.4rem; transition:color 0.15s,border-color 0.15s; }
        .notif-tab-btn.active { color:#111; font-weight:600; border-bottom-color:#e05c2d; }
        .notif-count-badge { display:inline-flex; align-items:center; justify-content:center; min-width:20px; height:17px; padding:0 5px; background:#f0ebe4; border-radius:20px; font-size:0.65rem; font-weight:700; color:#555; }
        .notif-tab-btn.active .notif-count-badge { background:#fde8df; color:#e05c2d; }
        .notif-list { padding:0.4rem 0; max-height:400px; overflow-y:auto; }
        .notif-item { display:flex; align-items:flex-start; gap:0.9rem; padding:0.9rem 1.3rem; position:relative; transition:background 0.12s; cursor:default; }
        .notif-item:hover { background:#faf8f6; }
        .notif-item + .notif-item { border-top:1px solid #f5f0ea; }
        .notif-avatar { width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0; position:relative; }
        .notif-unread-dot { position:absolute; top:0; right:0; width:10px; height:10px; background:#e05c2d; border-radius:50%; border:1.5px solid #fff; }
        .notif-body { flex:1; min-width:0; }
        .notif-item-title { font-size:0.83rem; font-weight:700; color:#111; margin-bottom:0.2rem; }
        .notif-item-text { font-size:0.78rem; color:#555; line-height:1.5; }
        .notif-item-time { font-size:0.7rem; color:#bbb; margin-top:0.3rem; }
        .notif-action-btn { display:inline-flex; margin-top:0.6rem; padding:0.38rem 0.9rem; border-radius:8px; font-size:0.75rem; font-weight:700; color:#fff; border:none; cursor:pointer; transition:opacity 0.15s,transform 0.12s; }
        .notif-action-btn:hover { opacity:0.88; transform:translateY(-1px); }
        .notif-empty { padding:2.5rem 1.3rem; text-align:center; color:#aaa; font-size:0.83rem; }
      `}</style>

      <div className="cl-root">
        {/* ── Top bar ── */}
        <header className="cl-topbar">
          <div className="cl-topbar-left">
            <button className="cl-hamburger" onClick={() => setMobileMenuOpen(true)} title="Menu">
              <Menu size={20} color="#fff" />
            </button>
            <div className="cl-topbar-logo">
              <div className="cl-topbar-mark">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 9 12 2 21 9 21 22 3 22"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
              <span className="cl-topbar-name">Zonal Value</span>
            </div>
          </div>

          <div className="cl-topbar-actions">
            <button className="cl-bell-btn" onClick={() => setShowNotificationModal(true)} title="Notifications">
              <Bell size={20} color="#fff" />
              {unreadCount > 0 && <span className="cl-bell-dot" />}
            </button>
          </div>
        </header>

        <div className="cl-body">
          <LowBalanceNotice threshold={3} remindAfterHours={24} />

          {/* ── Desktop Sidebar ── */}
          <aside className="cl-sidebar-wrap">
            <div className="cl-sidebar-card">
              <SidebarContent />
            </div>
          </aside>

          <main className="cl-main">{children}</main>
        </div>
      </div>

      {/* ── Mobile Drawer ── */}
      {mobileMenuOpen && (
        <div
          className="cl-mobile-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setMobileMenuOpen(false); }}
        >
          <div className="cl-mobile-drawer" style={{ position: "relative" }}>
            <button
              className="cl-mobile-drawer-close"
              onClick={() => setMobileMenuOpen(false)}
              title="Close menu"
            >
              <X size={16} />
            </button>
            <div className="cl-mobile-nav" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              <SidebarContent onLinkClick={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* ── Notification Modal ── */}
      {showNotificationModal && (
        <div className="notif-overlay" onClick={e => { if (e.target === e.currentTarget) setShowNotificationModal(false); }}>
          <div className="notif-panel">
            <div className="notif-head">
              <div className="notif-head-row">
                <span className="notif-title">Notifications</span>
                <button className="notif-mark-btn">Mark all as read</button>
              </div>
              <div className="notif-tabs">
                <button className={`notif-tab-btn${notifTab === "all" ? " active" : ""}`} onClick={() => setNotifTab("all")}>All <span className="notif-count-badge">{notifItems.length}</span></button>
                <button className={`notif-tab-btn${notifTab === "unread" ? " active" : ""}`} onClick={() => setNotifTab("unread")}>Unread <span className="notif-count-badge">{unreadCount}</span></button>
              </div>
            </div>
            <div className="notif-list">
              {displayedItems.length === 0 ? (
                <div className="notif-empty">No notifications here.</div>
              ) : (
                displayedItems.map(item => (
                  <div className="notif-item" key={item.id}>
                    <div className="notif-avatar" style={{ background: item.iconBg }}>
                      <span>{item.icon}</span>
                      {!item.read && <span className="notif-unread-dot" />}
                    </div>
                    <div className="notif-body">
                      <div className="notif-item-title">{item.title}</div>
                      <div className="notif-item-text">{item.body}</div>
                      <div className="notif-item-time">{item.time}</div>
                      {item.action && (
                        <button className="notif-action-btn" style={{ background: item.action.color }} onClick={() => { setShowNotificationModal(false); window.location.href = item.action!.href; }}>{item.action.label}</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}