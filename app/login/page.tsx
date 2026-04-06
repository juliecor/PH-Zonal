"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiLogin, setToken } from "../lib/authClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const { token } = await apiLogin({ email, password });
      setToken(token);
      router.replace("/welcome");
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap');

        .login-root {
          min-height: 100vh;
          display: flex;
          font-family: 'DM Sans', sans-serif;
          background: #f5f0eb;
        }

        /* ── Left panel ── */
        .login-panel-left {
          display: none;
          width: 45%;
          background: #0f1f38;
          position: relative;
          overflow: hidden;
          padding: 3rem;
          flex-direction: column;
          justify-content: space-between;
        }
        @media (min-width: 900px) {
          .login-panel-left { display: flex; }
        }

        .left-bg-circle {
          position: absolute;
          border-radius: 50%;
          opacity: 0.07;
          background: #c9a84c;
        }
        .left-bg-circle-1 { width: 420px; height: 420px; top: -120px; right: -140px; }
        .left-bg-circle-2 { width: 260px; height: 260px; bottom: -60px; left: -80px; }
        .left-bg-line {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: repeating-linear-gradient(
            -55deg, transparent, transparent 40px,
            rgba(201,168,76,0.03) 40px, rgba(201,168,76,0.03) 41px
          );
        }

        .left-logo {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          z-index: 1;
        }
        .left-logo-mark {
          width: 40px; height: 40px;
          border: 2px solid #c9a84c;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
        }
        .left-logo-mark svg { color: #c9a84c; }
        .left-logo-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.4rem;
          font-weight: 600;
          color: #f5f0eb;
          letter-spacing: 0.02em;
        }

        .left-body { z-index: 1; }
        .left-headline {
          font-family: 'Cormorant Garamond', serif;
          font-size: 2.9rem;
          font-weight: 700;
          color: #f5f0eb;
          line-height: 1.2;
          margin-bottom: 1.3rem;
        }
        .left-headline span { color: #c9a84c; }
        .left-sub {
          font-size: 1.05rem;
          color: #8fa3bf;
          line-height: 1.75;
          max-width: 320px;
          font-weight: 400;
        }

        .left-stats { z-index: 1; display: flex; gap: 2.5rem; }
        .stat-num {
          font-family: 'Cormorant Garamond', serif;
          font-size: 2rem;
          font-weight: 700;
          color: #c9a84c;
        }
        .stat-label {
          font-size: 0.82rem;
          color: #8fa3bf;
          margin-top: 0.15rem;
          font-weight: 400;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        /* ── Right panel ── */
        .login-panel-right {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2.5rem 2rem;
          background: #f5f0eb;
        }

        .login-card {
          width: 100%;
          max-width: 440px;
        }

        .card-eyebrow {
          font-size: 0.78rem;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #c9a84c;
          margin-bottom: 1rem;
        }

        .card-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 2.8rem;
          font-weight: 700;
          color: #0f1f38;
          margin-bottom: 0.5rem;
          line-height: 1.1;
        }

        .card-sub {
          font-size: 1.05rem;
          color: #4a5568;
          margin-bottom: 2.2rem;
          font-weight: 400;
          line-height: 1.6;
        }

        .divider {
          width: 44px;
          height: 2.5px;
          background: #c9a84c;
          margin-bottom: 2rem;
          border-radius: 2px;
        }

        /* Fields */
        .field + .field { margin-top: 1.4rem; }

        .field-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #0f1f38;
          margin-bottom: 0.55rem;
        }

        .field-input-wrap { position: relative; }

        .field-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: #9aa3b0;
          pointer-events: none;
          display: flex;
          align-items: center;
        }

        .field-input {
          width: 100%;
          box-sizing: border-box;
          background: #fff;
          border: 2px solid #e2d9d0;
          border-radius: 12px;
          padding: 0.9rem 1rem 0.9rem 2.8rem;
          font-size: 1.05rem;
          color: #0f1f38;
          font-family: 'DM Sans', sans-serif;
          font-weight: 400;
          transition: border-color 0.18s, box-shadow 0.18s;
          outline: none;
          -webkit-appearance: none;
        }
        .field-input::placeholder { color: #c0b9b2; }
        .field-input:focus {
          border-color: #c9a84c;
          box-shadow: 0 0 0 4px rgba(201,168,76,0.12);
        }

        /* Error */
        .error-msg {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          margin-top: 1.2rem;
          padding: 0.85rem 1rem;
          background: #fff3f3;
          border: 1.5px solid #f5c6c6;
          border-radius: 10px;
          font-size: 0.95rem;
          color: #c0392b;
          font-weight: 500;
          line-height: 1.5;
        }

        /* Submit button */
        .btn-submit {
          margin-top: 2rem;
          width: 100%;
          padding: 1rem;
          background: #0f1f38;
          color: #f5f0eb;
          font-family: 'DM Sans', sans-serif;
          font-size: 1rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 18px rgba(15,31,56,0.2);
        }
        .btn-submit:hover:not(:disabled) {
          background: #182f52;
          box-shadow: 0 6px 24px rgba(15,31,56,0.28);
          transform: translateY(-1px);
        }
        .btn-submit:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(15,31,56,0.18);
        }
        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
        }

        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(245,240,235,0.3);
          border-top-color: #f5f0eb;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Footer */
        .card-footer {
          margin-top: 1.8rem;
          text-align: center;
          font-size: 0.95rem;
          color: #6b7585;
          font-weight: 400;
        }
        .card-footer a {
          color: #0f1f38;
          font-weight: 600;
          text-decoration: none;
          border-bottom: 2px solid #c9a84c;
          padding-bottom: 1px;
          transition: color 0.15s;
        }
        .card-footer a:hover { color: #c9a84c; }
      `}</style>

      <div className="login-root">

        {/* ── Left decorative panel ── */}
        <div className="login-panel-left">
          <div className="left-bg-circle left-bg-circle-1" />
          <div className="left-bg-circle left-bg-circle-2" />
          <div className="left-bg-line" />

          <div className="left-logo">
            <div className="left-logo-mark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 9 12 2 21 9 21 22 3 22" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className="left-logo-name">Zonal Value</span>
          </div>

          <div className="left-body">
            <div className="left-headline">
              Property insights,<br />
              <span>precisely</span> mapped.
            </div>
            <p className="left-sub">
              Access verified zonal values across all regions — empowering smarter real estate decisions.
            </p>
          </div>

          <div className="left-stats">
            <div>
              <div className="stat-num">12K+</div>
              <div className="stat-label">Zones indexed</div>
            </div>
            <div>
              <div className="stat-num">98%</div>
              <div className="stat-label">Data accuracy</div>
            </div>
            <div>
              <div className="stat-num">Live</div>
              <div className="stat-label">Updates</div>
            </div>
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="login-panel-right">
          <div className="login-card">

            <div className="card-eyebrow">Secure access</div>
            <h1 className="card-title">Welcome back</h1>
            <div className="divider" />
            <p className="card-sub">Sign in to your Zonal Value account to continue.</p>

            <form onSubmit={onSubmit}>
              <div className="field">
                <label className="field-label">Email address</label>
                <div className="field-input-wrap">
                  <span className="field-icon">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="field-input"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="field">
                <label className="field-label">Password</label>
                <div className="field-input-wrap">
                  <span className="field-icon">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="field-input"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {err && (
                <div className="error-msg">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {err}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-submit">
                <span className="btn-inner">
                  {loading && <span className="spinner" />}
                  {loading ? "Signing in…" : "Sign in"}
                  {!loading && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  )}
                </span>
              </button>
            </form>

            <div className="card-footer">
              Don&apos;t have an account?{" "}
              <Link href="/register">Create one</Link>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}