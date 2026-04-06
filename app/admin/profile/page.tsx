"use client";

import { useEffect, useState } from "react";
import { apiMe } from "../../lib/authClient";

export default function AdminProfilePage() {
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    apiMe().then(setMe).catch(() => setMe(null));
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@300;400;500&display=swap');

        .profile-wrap {
          font-family: 'DM Sans', sans-serif;
        }

        /* ── Card ── */
        .profile-card {
          background: #fff;
          border-radius: 16px;
          border: 1px solid #e8e0d8;
          box-shadow: 0 2px 16px rgba(15,31,56,0.06);
          overflow: hidden;
        }

        /* ── Header band ── */
        .profile-header {
          background: #0f1f38;
          padding: 1.8rem 2rem;
          display: flex;
          align-items: center;
          gap: 1.25rem;
          position: relative;
          overflow: hidden;
        }
        .profile-header::before {
          content: '';
          position: absolute;
          width: 260px; height: 260px;
          border-radius: 50%;
          background: rgba(201,168,76,0.07);
          top: -100px; right: -80px;
        }
        .profile-header::after {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            -55deg, transparent, transparent 32px,
            rgba(201,168,76,0.025) 32px, rgba(201,168,76,0.025) 33px
          );
        }

        .profile-avatar {
          width: 56px; height: 56px;
          border-radius: 14px;
          background: rgba(201,168,76,0.15);
          border: 2px solid rgba(201,168,76,0.5);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          z-index: 1;
        }
        .profile-avatar-initials {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.4rem;
          font-weight: 700;
          color: #c9a84c;
          line-height: 1;
          text-transform: uppercase;
        }

        .profile-header-text { z-index: 1; }
        .profile-header-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.4rem;
          font-weight: 700;
          color: #f5f0eb;
          line-height: 1.2;
        }
        .profile-header-role {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          margin-top: 0.3rem;
          padding: 0.2rem 0.65rem;
          background: rgba(201,168,76,0.15);
          border: 1px solid rgba(201,168,76,0.35);
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #c9a84c;
        }

        /* ── Body ── */
        .profile-body { padding: 1.8rem 2rem; }

        .profile-section-label {
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: rgba(15,31,56,0.4);
          margin-bottom: 1.1rem;
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .profile-section-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(15,31,56,0.08);
        }

        .profile-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1rem;
        }

        .profile-field {
          background: #f9f6f2;
          border: 1px solid #ede5da;
          border-radius: 10px;
          padding: 0.85rem 1rem;
        }
        .profile-field-label {
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #9aa3b0;
          margin-bottom: 0.35rem;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .profile-field-label svg { color: #c9a84c; }
        .profile-field-value {
          font-size: 0.925rem;
          font-weight: 500;
          color: #0f1f38;
          word-break: break-all;
        }

        /* ── Skeleton loader ── */
        .skeleton-header {
          background: #0f1f38;
          padding: 1.8rem 2rem;
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }
        .skel {
          background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 6px;
        }
        .skel-light {
          background: linear-gradient(90deg, #f0ebe4 25%, #e8e0d5 50%, #f0ebe4 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 6px;
        }
        @keyframes shimmer { to { background-position: -200% 0; } }
      `}</style>

      <div className="profile-wrap">
        <div className="profile-card">

          {me ? (
            <>
              {/* Header */}
              <div className="profile-header">
                <div className="profile-avatar">
                  <span className="profile-avatar-initials">
                    {(me.name ?? me.email ?? "?")
                      .split(" ")
                      .slice(0, 2)
                      .map((w: string) => w[0])
                      .join("")}
                  </span>
                </div>
                <div className="profile-header-text">
                  <div className="profile-header-name">{me.name ?? "—"}</div>
                  {me.role && (
                    <div className="profile-header-role">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2zm0 12c5.33 0 8 2.67 8 4v2H4v-2c0-1.33 2.67-4 8-4z"/></svg>
                      {me.role}
                    </div>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="profile-body">
                <div className="profile-section-label">Account details</div>
                <div className="profile-grid">

                  {me.name && (
                    <div className="profile-field">
                      <div className="profile-field-label">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        Full name
                      </div>
                      <div className="profile-field-value">{me.name}</div>
                    </div>
                  )}

                  {me.email && (
                    <div className="profile-field">
                      <div className="profile-field-label">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                        Email address
                      </div>
                      <div className="profile-field-value">{me.email}</div>
                    </div>
                  )}

                  {me.role && (
                    <div className="profile-field">
                      <div className="profile-field-label">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2zM4 20c0-2.67 2.67-4 8-4s8 1.33 8 4"/></svg>
                        Role
                      </div>
                      <div className="profile-field-value">{me.role}</div>
                    </div>
                  )}

                  {me.phone && (
                    <div className="profile-field">
                      <div className="profile-field-label">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.54 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.29 6.29l1.28-1.28a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        Phone
                      </div>
                      <div className="profile-field-value">{me.phone}</div>
                    </div>
                  )}

                </div>
              </div>
            </>
          ) : (
            /* Skeleton */
            <>
              <div className="skeleton-header">
                <div className="skel" style={{ width: 56, height: 56, borderRadius: 14, flexShrink: 0 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div className="skel" style={{ width: 160, height: 20 }} />
                  <div className="skel" style={{ width: 80, height: 14 }} />
                </div>
              </div>
              <div className="profile-body">
                <div className="profile-section-label">Account details</div>
                <div className="profile-grid">
                  {[160, 200, 100].map((w, i) => (
                    <div className="profile-field" key={i}>
                      <div className="skel-light" style={{ width: 60, height: 10, marginBottom: "0.5rem" }} />
                      <div className="skel-light" style={{ width: w, height: 16 }} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}