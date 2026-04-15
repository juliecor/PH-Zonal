"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiMe } from "../lib/authClient";

export type SidebarLink = {
  href: string;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  title?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

export default function DashboardSidebar({ title, links }: { title: string; links: SidebarLink[] }) {
  const pathname = usePathname();
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    (async () => { try { const u = await apiMe(); setMe(u); } catch {} })();
  }, []);

  const avatarUrl = useMemo(() => {
    if (me?.avatar_path) {
      const p = String(me.avatar_path);
      if (p.startsWith("http")) return p;
      return `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000"}/storage/${p.replace(/^storage\//,'')}`;
    }
    return "";
  }, [me]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');

        .dsb-root {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #fff;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
        }

        .dsb-user {
          flex-shrink: 0;
          padding: 1.1rem 1rem 1rem;
          background: linear-gradient(160deg, #0f1f38 0%, #1e3a8a 80%);
          border-bottom: 1px solid #0b1628;
          display: flex; flex-direction: column; align-items: center; gap: 10px;
        }
        .dsb-avatar { width: 64px; height: 64px; border-radius: 50%; overflow: hidden; position: relative; box-shadow: 0 2px 10px rgba(0,0,0,0.25); }
        .dsb-avatar::after { content:""; position:absolute; inset:-3px; border-radius:50%; border:3px solid #c9a84c; pointer-events:none; }
        .dsb-name { font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:#f5f0eb; font-size:15px; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .dsb-email { color:rgba(245,240,235,0.85); font-size:12px; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

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
        .dsb-link:hover { background: #f9f6f2; color: #0f1f38; }
        .dsb-link.active {
          background: #0f1f38;
          color: #f5f0eb;
          font-weight: 500;
          box-shadow: 0 2px 10px rgba(15,31,56,0.18);
        }
        .dsb-link.disabled { opacity: 0.45; pointer-events: none; }

        .dsb-icon {
          width: 30px; height: 30px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: background 0.14s;
        }
        .dsb-icon.inactive { background: #f5f0eb; color: #7a8394; }
        .dsb-icon.active { background: rgba(201,168,76,0.18); color: #c9a84c; }

        .dsb-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .dsb-link.active .dsb-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #c9a84c;
          flex-shrink: 0;
        }
      `}</style>

      <div className="dsb-root">
        {/* User block (replaces plain title) */}
        <div className="dsb-user">
          <div className="dsb-avatar" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl || "/pictures/default-avatar.png"} alt="avatar" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}} />
          </div>
          <div className="dsb-name">{me?.name || 'Welcome'}</div>
          <div className="dsb-email">{me?.email || ''}</div>
        </div>

        {/* Nav links */}
        <nav className="dsb-nav">
          {links.map(l => {
            const active = pathname === l.href || pathname?.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={l.onClick}
                title={l.title}
                className={`dsb-link${active ? " active" : ""}${l.disabled ? " disabled" : ""}`}
              >
                <span className={`dsb-icon ${active ? "active" : "inactive"}`}>
                  {l.icon}
                </span>
                <span className="dsb-label">{l.label}</span>
                {l.badge && <span>{l.badge}</span>}
                {active && <span className="dsb-dot" />}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}