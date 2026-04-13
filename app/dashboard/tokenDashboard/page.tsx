"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { ReactNode } from "react";

type NavLink = {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: ReactNode;
};

type Props = {
  title?: string;
  links?: NavLink[]; // 👈 make optional
};

export default function DashboardSidebar({ title, links = [] }: Props) {
  const pathname = usePathname();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap');

        .dsb-wrap {
          display: flex;
          flex-direction: column;
          flex: 1;
          padding: 0.75rem 0.75rem 0;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
        }

        .dsb-title {
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #b0a89e;
          padding: 0 0.5rem 0.5rem;
        }

        .dsb-nav {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          flex: 1;
        }

        .dsb-link {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.62rem 0.85rem;
          border-radius: 10px;
          font-size: 0.83rem;
          font-weight: 500;
          color: #5a6378;
          text-decoration: none;
          transition: background 0.13s, color 0.13s;
          position: relative;
        }
        .dsb-link:hover {
          background: #f5f0eb;
          color: #0f1f38;
        }
        .dsb-link.active {
          background: #0f1f38;
          color: #f5f0eb;
        }
        .dsb-link.active svg { color: #c9a84c; }

        .dsb-link-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          position: relative;
        }

        .dsb-link-label { flex: 1; }

        .dsb-badge {
          flex-shrink: 0;
        }

        .dsb-footer {
          padding: 0.75rem;
          border-top: 1px solid #f0ebe4;
          margin-top: auto;
        }
        .dsb-logout {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          width: 100%;
          padding: 0.62rem 0.85rem;
          border-radius: 10px;
          font-size: 0.83rem;
          font-weight: 500;
          color: #9aa3b0;
          background: none;
          border: none;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.13s, color 0.13s;
        }
        .dsb-logout:hover {
          background: #fff5f5;
          color: #c0392b;
        }
      `}</style>

      <div className="dsb-wrap">
        {title && <div className="dsb-title">{title}</div>}

        <nav className="dsb-nav">
          {links.map(link => {
            const isActive =
              pathname === link.href ||
              pathname?.startsWith(link.href + "/");

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`dsb-link${isActive ? " active" : ""}`}
              >
                <span className="dsb-link-icon">
                  {link.icon}
                </span>
                <span className="dsb-link-label">{link.label}</span>
                {link.badge && (
                  <span className="dsb-badge">{link.badge}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="dsb-footer">
          <Link href="/logout" className="dsb-logout">
            <LogOut size={16} />
            Log out
          </Link>
        </div>
      </div>
    </>
  );
}