"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { apiLogout } from "../lib/authClient";

export type SidebarLink = { href: string; label: string; disabled?: boolean; icon?: React.ReactNode };

export default function DashboardSidebar({ title, links }: { title: string; links: SidebarLink[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try { await apiLogout(); } finally { router.replace("/login"); }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');

        .dsb-root {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #fff;
          border-radius: 16px;
          border: 1px solid #e8e0d8;
          box-shadow: 0 2px 14px rgba(15,31,56,0.05);
          overflow: hidden;
          font-family: 'DM Sans', sans-serif;
        }

        /* ── Header ── */
        .dsb-header {
          flex-shrink: 0;
          padding: 1.2rem 1.25rem 0.9rem;
          border-bottom: 1px solid #f0ebe4;
        }
        .dsb-title {
          font-size: 0.65rem;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #c9a84c;
        }

        /* ── Nav (scrollable if needed) ── */
        .dsb-nav {
          flex: 1;
          overflow-y: auto;
          padding: 0.75rem 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .dsb-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.6rem 0.75rem;
          border-radius: 10px;
          font-size: 0.85rem;
          font-weight: 400;
          text-decoration: none;
          transition: background 0.14s, color 0.14s;
          color: #4a5568;
        }
        .dsb-link:hover {
          background: #f9f6f2;
          color: #0f1f38;
        }
        .dsb-link.active {
          background: #0f1f38;
          color: #f5f0eb;
          font-weight: 500;
          box-shadow: 0 2px 10px rgba(15,31,56,0.18);
        }
        .dsb-link.disabled {
          opacity: 0.45;
          pointer-events: none;
        }

        .dsb-icon {
          width: 30px; height: 30px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: background 0.14s;
        }
        .dsb-icon.inactive {
          background: #f5f0eb;
          color: #7a8394;
        }
        .dsb-icon.active {
          background: rgba(201,168,76,0.18);
          color: #c9a84c;
        }

        .dsb-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* Active indicator dot */
        .dsb-link.active .dsb-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #c9a84c;
          flex-shrink: 0;
        }

        /* ── Footer (logout always visible) ── */
        .dsb-footer {
          flex-shrink: 0;
          padding: 0.75rem;
          border-top: 1px solid #f0ebe4;
        }

        .dsb-logout {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          width: 100%;
          padding: 0.62rem 0.75rem;
          border-radius: 10px;
          border: 1.5px solid #e8e0d8;
          background: transparent;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.82rem;
          font-weight: 500;
          color: #6b7585;
          cursor: pointer;
          transition: background 0.14s, border-color 0.14s, color 0.14s;
        }
        .dsb-logout:hover:not(:disabled) {
          background: #fff3f3;
          border-color: #f5c6c6;
          color: #c0392b;
        }
        .dsb-logout:disabled { opacity: 0.5; cursor: not-allowed; }

        .dsb-logout-icon {
          width: 28px; height: 28px;
          border-radius: 7px;
          background: #f5f0eb;
          display: flex; align-items: center; justify-content: center;
          color: #9aa3b0;
          flex-shrink: 0;
          transition: background 0.14s, color 0.14s;
        }
        .dsb-logout:hover .dsb-logout-icon {
          background: rgba(192,57,43,0.08);
          color: #c0392b;
        }

        .logout-spinner {
          width: 12px; height: 12px;
          border: 2px solid rgba(192,57,43,0.2);
          border-top-color: #c0392b;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="dsb-root">

        {/* Header */}
        <div className="dsb-header">
          <div className="dsb-title">{title}</div>
        </div>

        {/* Nav links */}
        <nav className="dsb-nav">
          {links.map(l => {
            const active = pathname === l.href || pathname?.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`dsb-link${active ? " active" : ""}${l.disabled ? " disabled" : ""}`}
              >
                <span className={`dsb-icon ${active ? "active" : "inactive"}`}>
                  {l.icon}
                </span>
                <span className="dsb-label">{l.label}</span>
                {active && <span className="dsb-dot" />}
              </Link>
            );
          })}
        </nav>

        {/* Logout — always pinned to bottom */}
        <div className="dsb-footer">
          <button className="dsb-logout" onClick={handleLogout} disabled={loggingOut}>
            <span className="dsb-logout-icon">
              {loggingOut
                ? <span className="logout-spinner" />
                : <LogOut size={14} />}
            </span>
            {loggingOut ? "Signing out…" : "Log out"}
          </button>
        </div>

      </div>
    </>
  );
}