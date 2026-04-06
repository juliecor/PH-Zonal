"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRegister, setToken } from "../lib/authClient";

export default function RegisterPage() {
  const router = useRouter();
  const [first, setFirst] = useState("");
  const [middle, setMiddle] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    setFieldErrors({});
    try {
      const { token } = await apiRegister({
        first_name: first,
        middle_name: middle,
        last_name: last,
        phone,
        email,
        password,
        password_confirmation: confirm,
      });
      setToken(token);
      router.replace("/welcome");
    } catch (e: any) {
      setErr(e?.message || "Register failed");
      if (e?.errors && typeof e.errors === "object") {
        setFieldErrors(e.errors as Record<string, string[]>);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap');

        .reg-root {
          min-height: 100vh;
          display: flex;
          font-family: 'DM Sans', sans-serif;
          background: #f5f0eb;
        }

        /* ── Left panel ── */
        .reg-panel-left {
          display: none;
          width: 38%;
          background: #0f1f38;
          position: relative;
          overflow: hidden;
          padding: 3rem;
          flex-direction: column;
          justify-content: space-between;
        }
        @media (min-width: 960px) {
          .reg-panel-left { display: flex; }
        }

        .left-bg-circle {
          position: absolute;
          border-radius: 50%;
          opacity: 0.07;
          background: #c9a84c;
        }
        .left-bg-circle-1 { width: 380px; height: 380px; top: -100px; right: -120px; }
        .left-bg-circle-2 { width: 240px; height: 240px; bottom: -50px; left: -70px; }
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
          font-size: 2.7rem;
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
          max-width: 300px;
          font-weight: 400;
        }

        /* Steps */
        .left-steps { z-index: 1; display: flex; flex-direction: column; gap: 1.1rem; }
        .step-row { display: flex; align-items: flex-start; gap: 0.9rem; }
        .step-dot-col { display: flex; flex-direction: column; align-items: center; }
        .step-dot {
          width: 28px; height: 28px;
          border-radius: 50%;
          background: rgba(201,168,76,0.15);
          border: 2px solid #c9a84c;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .step-dot span {
          font-size: 0.75rem;
          font-weight: 700;
          color: #c9a84c;
        }
        .step-connector {
          width: 2px;
          flex: 1;
          min-height: 20px;
          background: rgba(201,168,76,0.2);
          margin: 4px 0;
        }
        .step-title {
          font-size: 0.92rem;
          font-weight: 600;
          color: #f5f0eb;
          margin-bottom: 0.15rem;
        }
        .step-desc {
          font-size: 0.82rem;
          color: #8fa3bf;
          font-weight: 400;
        }

        /* ── Right panel ── */
        .reg-panel-right {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2.5rem 2rem;
          background: #f5f0eb;
          overflow-y: auto;
        }

        .reg-card {
          width: 100%;
          max-width: 540px;
          padding: 0.5rem 0;
        }

        .card-eyebrow {
          font-size: 0.78rem;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #c9a84c;
          margin-bottom: 0.9rem;
        }
        .card-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 2.6rem;
          font-weight: 700;
          color: #0f1f38;
          margin-bottom: 0.4rem;
          line-height: 1.1;
        }
        .card-sub {
          font-size: 1.05rem;
          color: #4a5568;
          margin-bottom: 1.8rem;
          font-weight: 400;
          line-height: 1.6;
        }
        .divider {
          width: 44px; height: 2.5px;
          background: #c9a84c;
          margin-bottom: 1.8rem;
          border-radius: 2px;
        }

        /* Section label */
        .section-label {
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #0f1f38;
          opacity: 0.5;
          margin-bottom: 0.9rem;
          margin-top: 1.75rem;
          display: flex;
          align-items: center;
          gap: 0.65rem;
        }
        .section-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(15,31,56,0.1);
        }

        /* Grid */
        .field-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.1rem;
        }
        @media (max-width: 520px) {
          .field-grid { grid-template-columns: 1fr; }
        }
        .field-full { grid-column: 1 / -1; }

        /* Fields */
        .field { display: flex; flex-direction: column; }

        .field-label {
          display: block;
          font-size: 0.82rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #0f1f38;
          margin-bottom: 0.5rem;
        }
        .field-optional {
          font-size: 0.72rem;
          font-weight: 400;
          letter-spacing: 0.02em;
          text-transform: none;
          color: #9aa3b0;
          margin-left: 0.3rem;
        }

        .field-input-wrap { position: relative; }
        .field-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: #9aa3b0;
          pointer-events: none;
          display: flex; align-items: center;
        }
        .field-input {
          width: 100%;
          box-sizing: border-box;
          background: #fff;
          border: 2px solid #e2d9d0;
          border-radius: 12px;
          padding: 0.85rem 1rem 0.85rem 2.75rem;
          font-size: 1rem;
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
        .field-error-text {
          font-size: 0.85rem;
          color: #c0392b;
          font-weight: 500;
          margin-top: 0.35rem;
        }

        /* Error banner */
        .error-banner {
          margin-top: 1.25rem;
          padding: 1rem 1.1rem;
          background: #fff3f3;
          border: 2px solid #f5c6c6;
          border-radius: 12px;
        }
        .error-banner-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.95rem;
          color: #c0392b;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        .error-banner-list {
          margin: 0;
          padding: 0 0 0 1.3rem;
          font-size: 0.9rem;
          color: #c0392b;
          line-height: 1.75;
          font-weight: 400;
        }

        /* Submit */
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
          display: flex; align-items: center;
          justify-content: center; gap: 0.6rem;
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
          margin-top: 1.75rem;
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

      <div className="reg-root">

        {/* ── Left panel ── */}
        <div className="reg-panel-left">
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
              Your account,<br />
              your <span>edge.</span>
            </div>
            <p className="left-sub">
              Join thousands of professionals using Zonal Value for accurate, real-time property data across the Philippines.
            </p>
          </div>

          <div className="left-steps">
            {[
              { n: "1", title: "Create your account", desc: "Fill in your details below" },
              { n: "2", title: "Verify your email",   desc: "Quick confirmation link sent" },
              { n: "3", title: "Start searching",     desc: "Instant access to zonal data" },
            ].map((s, i, arr) => (
              <div className="step-row" key={s.n}>
                <div className="step-dot-col">
                  <div className="step-dot"><span>{s.n}</span></div>
                  {i < arr.length - 1 && <div className="step-connector" />}
                </div>
                <div>
                  <div className="step-title">{s.title}</div>
                  <div className="step-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="reg-panel-right">
          <div className="reg-card">

            <div className="card-eyebrow">New account</div>
            <h1 className="card-title">Create your account</h1>
            <div className="divider" />
            <p className="card-sub">Access zonal searches right after sign up.</p>

            <form onSubmit={onSubmit}>

              <div className="section-label">Personal information</div>
              <div className="field-grid">

                <div className="field">
                  <label className="field-label">First name</label>
                  <div className="field-input-wrap">
                    <span className="field-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </span>
                    <input type="text" required value={first} onChange={e => setFirst(e.target.value)} className="field-input" placeholder="Juan" />
                  </div>
                  {fieldErrors.first_name?.map((m, i) => <span key={i} className="field-error-text">{m}</span>)}
                </div>

                <div className="field">
                  <label className="field-label">Middle name <span className="field-optional">(optional)</span></label>
                  <div className="field-input-wrap">
                    <span className="field-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </span>
                    <input type="text" value={middle} onChange={e => setMiddle(e.target.value)} className="field-input" placeholder="Santos" />
                  </div>
                  {fieldErrors.middle_name?.map((m, i) => <span key={i} className="field-error-text">{m}</span>)}
                </div>

                <div className="field">
                  <label className="field-label">Last name</label>
                  <div className="field-input-wrap">
                    <span className="field-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </span>
                    <input type="text" required value={last} onChange={e => setLast(e.target.value)} className="field-input" placeholder="dela Cruz" />
                  </div>
                  {fieldErrors.last_name?.map((m, i) => <span key={i} className="field-error-text">{m}</span>)}
                </div>

                <div className="field">
                  <label className="field-label">Phone <span className="field-optional">(optional)</span></label>
                  <div className="field-input-wrap">
                    <span className="field-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.54 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.29 6.29l1.28-1.28a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    </span>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="field-input" placeholder="+63 9XX XXX XXXX" />
                  </div>
                  {fieldErrors.phone?.map((m, i) => <span key={i} className="field-error-text">{m}</span>)}
                </div>

              </div>

              <div className="section-label">Account credentials</div>
              <div className="field-grid">

                <div className="field field-full">
                  <label className="field-label">Email address</label>
                  <div className="field-input-wrap">
                    <span className="field-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    </span>
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="field-input" placeholder="you@example.com" />
                  </div>
                  {fieldErrors.email?.map((m, i) => <span key={i} className="field-error-text">{m}</span>)}
                </div>

                <div className="field">
                  <label className="field-label">Password</label>
                  <div className="field-input-wrap">
                    <span className="field-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </span>
                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="field-input" placeholder="••••••••" />
                  </div>
                  {fieldErrors.password?.map((m, i) => <span key={i} className="field-error-text">{m}</span>)}
                </div>

                <div className="field">
                  <label className="field-label">Confirm password</label>
                  <div className="field-input-wrap">
                    <span className="field-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </span>
                    <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} className="field-input" placeholder="••••••••" />
                  </div>
                  {fieldErrors.password_confirmation?.map((m, i) => <span key={i} className="field-error-text">{m}</span>)}
                </div>

              </div>

              {(err || Object.keys(fieldErrors).length > 0) && (
                <div className="error-banner">
                  {err && (
                    <div className="error-banner-title">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {err}
                    </div>
                  )}
                  {Object.keys(fieldErrors).length > 0 && (
                    <ul className="error-banner-list">
                      {Object.entries(fieldErrors).flatMap(([k, vals]) =>
                        (Array.isArray(vals) ? vals : [String(vals)]).map((msg, i) => (
                          <li key={`${k}-${i}`}>{msg}</li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-submit">
                <span className="btn-inner">
                  {loading && <span className="spinner" />}
                  {loading ? "Creating account…" : "Create account"}
                  {!loading && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  )}
                </span>
              </button>
            </form>

            <div className="card-footer">
              Already have an account?{" "}
              <Link href="/login">Sign in</Link>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}