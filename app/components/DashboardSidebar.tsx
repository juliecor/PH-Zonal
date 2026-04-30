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
      return `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000"}/storage/${p.replace(/^storage\//, "")}`;
    }
    return "";
  }, [me]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');

        .dsb-root {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #fff;
          border-right: 1px solid #ede8e0;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
        }

        /* ── Profile ── */
        .dsb-user {
          flex-shrink: 0;
          padding: 1.6rem 1.25rem 1.3rem;
          border-bottom: 1px solid #f0ebe4;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.55rem;
        }
        .dsb-avatar-wrap {
          position: relative;
          width: 86px;
          height: 86px;
          margin-bottom: 0.1rem;
        }
        .dsb-avatar {
          width: 86px;
          height: 86px;
          border-radius: 50%;
          overflow: hidden;
          border: 2.5px solid rgba(201,168,76,0.6);
          box-shadow: 0 4px 14px rgba(15,31,56,0.12);
        }
        .dsb-avatar-online {
          position: absolute;
          bottom: 4px;
          right: 4px;
          width: 13px;
          height: 13px;
          border-radius: 50%;
          background: #22c55e;
          border: 2.5px solid #fff;
        }
        .dsb-name {
          font-size: 0.88rem;
          font-weight: 700;
          color: #0f1f38;
          letter-spacing: 0.01em;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        .dsb-email {
          font-size: 0.72rem;
          color: #9aa3b0;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        .dsb-role {
          display: inline-flex;
          align-items: center;
          padding: 0.2rem 0.65rem;
          border: 1px solid rgba(201,168,76,0.3);
          background: rgba(201,168,76,0.07);
          color: #8a6d15;
          border-radius: 50px;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        /* ── Nav ── */
        .dsb-nav {
          flex: 1;
          overflow-y: auto;
          padding: 1rem 0.75rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }
        .dsb-nav::-webkit-scrollbar { width: 4px; }
        .dsb-nav::-webkit-scrollbar-thumb { background: #ede8e0; border-radius: 999px; }
        .dsb-nav::-webkit-scrollbar-track { background: transparent; }

        .dsb-sec {
          font-size: 0.63rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #c5bfb8;
          padding: 0.2rem 0.6rem 0.65rem;
        }

        /* Nav link */
        .dsb-link {
          position: relative;
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.58rem 0.8rem 0.58rem 1rem;
          border-radius: 10px;
          font-size: 0.855rem;
          font-weight: 500;
          text-decoration: none;
          color: #6b7585;
          transition: background 0.13s, color 0.13s;
          overflow: hidden;
        }
        .dsb-link::before {
          content: '';
          position: absolute;
          left: 0;
          top: 7px;
          bottom: 7px;
          width: 3px;
          border-radius: 0 3px 3px 0;
          background: transparent;
          transition: background 0.13s;
        }
        .dsb-link:hover {
          background: #f9f7f4;
          color: #0f1f38;
        }
        .dsb-link.active {
          background: #fdf8f0;
          color: #0f1f38;
          font-weight: 600;
        }
        .dsb-link.active::before {
          background: #c9a84c;
        }
        .dsb-link.disabled {
          opacity: 0.4;
          pointer-events: none;
        }

        /* Icon */
        .dsb-icon {
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #9aa3b0;
          transition: color 0.13s;
        }
        .dsb-link:hover .dsb-icon { color: #4a5568; }
        .dsb-link.active .dsb-icon { color: #c9a84c; }

        .dsb-label {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>

      <div className="dsb-root">

        {/* ── Profile ── */}
        <div className="dsb-user">
          <div className="dsb-avatar-wrap">
            <div className="dsb-avatar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl || "/pictures/profile-icon.png"}
                alt="avatar"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
            <div className="dsb-avatar-online" />
          </div>
          <div className="dsb-name">{me?.name || "Welcome"}</div>
          <div className="dsb-email">{me?.email || ""}</div>
          {(me?.role || title) && (
            <div className="dsb-role">{String(me?.role || title).toUpperCase()}</div>
          )}
        </div>

        {/* ── Nav ── */}
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
                <span className="dsb-icon">{l.icon}</span>
                <span className="dsb-label">{l.label}</span>
                {l.badge && <span>{l.badge}</span>}
              </Link>
            );
          })}
        </nav>

      </div>
    </>
  );
}
