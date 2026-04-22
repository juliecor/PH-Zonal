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
    if (!me) return "";
    if (me.avatar_url && typeof me.avatar_url === "string") return me.avatar_url;
    if (me.avatar_path) {
      const p = String(me.avatar_path);
      if (p.startsWith("http")) return p;
      // Legacy local storage fallback (kept for dev/local only)
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
          /* Light, modern palette */
          background: linear-gradient(180deg, #ffffff 0%, #faf6f2 100%);
          border-right: 1px solid #e8e0d8;
          position: relative;
          color: #0f1f38;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
        }
        /* Removed stripe overlay for a smoother, eye-friendly background */

        .dsb-user {
          flex-shrink: 0;
          padding: 1.15rem 1rem 1rem;
          background: linear-gradient(180deg, #ffffff 0%, #faf6f2 100%);
          border-bottom: 1px solid #e8e0d8;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
        }
        .dsb-avatar { width: 84px; height: 84px; border-radius: 50%; overflow: hidden; position: relative; box-shadow: 0 8px 22px rgba(15,31,56,0.12); }
        .dsb-avatar::after { content:""; position:absolute; inset:0; border-radius:50%; box-shadow: 0 0 0 2.5px rgba(201,168,76,0.9) inset; pointer-events:none; }
        .dsb-name { font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:#0f1f38; font-size:15px; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .dsb-email { color:#7a8394; font-size:12px; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .dsb-role { display:inline-flex; align-items:center; gap:.35rem; padding:.2rem .55rem; border:1px solid rgba(201,168,76,0.35); background:rgba(201,168,76,0.12); color:#7a5f16; border-radius:999px; font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; }

        .dsb-sec { padding: 0.2rem 0.9rem; font-size: 0.7rem; letter-spacing: 0.12em; color: #9aa3b0; text-transform: uppercase; font-weight: 700; }
        .dsb-nav {
          flex: 1;
          overflow-y: auto;
          padding: 0.9rem 0.75rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .dsb-nav::-webkit-scrollbar { width: 10px; }
        .dsb-nav::-webkit-scrollbar-thumb { background: #e8e0d8; border-radius: 999px; border: 2px solid transparent; background-clip: content-box; }
        .dsb-nav::-webkit-scrollbar-track { background: transparent; }

        .dsb-link {
          position: relative;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.62rem 0.8rem 0.62rem 0.85rem;
          border-radius: 12px;
          font-size: 0.88rem;
          font-weight: 500;
          text-decoration: none;
          transition: background 0.16s ease, color 0.16s ease, transform 0.12s ease;
          color: #4a5568;
        }
        .dsb-link:hover { background: #f9f6f2; color: #0f1f38; transform: translateX(2px); }
        .dsb-link.active { background: #1e40af; color: #ffffff; box-shadow: 0 6px 18px rgba(30,64,175,0.18); }
        .dsb-link.active::before { content:""; position:absolute; left:-6px; top:8px; bottom:8px; width:4px; border-radius:3px; background: linear-gradient(180deg,#e7d8a0,#c9a84c); box-shadow:0 0 18px rgba(201,168,76,0.55); }
        .dsb-link.disabled { opacity: 0.45; pointer-events: none; }

        .dsb-icon {
          width: 30px; height: 30px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: background 0.14s, transform 0.14s, color 0.14s;
        }
        .dsb-icon.inactive { background: #f5f0eb; color: #7a8394; }
        .dsb-icon.active { background: rgba(201,168,76,0.18); color: #c9a84c; transform: scale(1.02); }

        .dsb-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* Hide old dot; we use a left accent bar now */
        .dsb-link .dsb-dot { display:none; }
      `}</style>

      <div className="dsb-root">
        {/* User block (replaces plain title) */}
        <div className="dsb-user">
          <div className="dsb-avatar" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl || "/pictures/profile-icon.png"} alt="avatar" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}} />
          </div>
          <div className="dsb-name">{me?.name || 'Welcome'}</div>
          <div className="dsb-email">{me?.email || ''}</div>
          {(me?.role || title) && <div className="dsb-role">{String(me?.role || title).toUpperCase()}</div>}
        </div>

        {/* Nav links */}
        <nav className="dsb-nav">
          <div className="dsb-sec">Menu</div>
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