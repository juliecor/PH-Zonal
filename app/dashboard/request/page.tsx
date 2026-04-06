"use client";

import { useEffect, useState } from "react";
import { apiCreateTokenRequest, apiMe, apiMyTokenRequests } from "../../lib/authClient";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  pending:  { bg: "rgba(201,168,76,0.1)",  color: "#9a7a20", border: "rgba(201,168,76,0.3)",  dot: "#c9a84c" },
  approved: { bg: "rgba(15,31,56,0.07)",   color: "#0f1f38", border: "rgba(15,31,56,0.15)",   dot: "#0f1f38" },
  denied:   { bg: "rgba(192,57,43,0.07)",  color: "#c0392b", border: "rgba(192,57,43,0.2)",   dot: "#c0392b" },
};

export default function ClientRequestPage() {
  const [me, setMe] = useState<any>(null);
  const [qty, setQty] = useState(10);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [err, setErr] = useState("");

  async function refresh() {
    const u = await apiMe();
    setMe(u);
    try {
      const r = await apiMyTokenRequests();
      setRequests(Array.isArray(r?.data) ? r.data : []);
    } catch { setRequests([]); }
  }

  useEffect(() => { refresh(); }, []);

  async function submit() {
    setErr("");
    setLoading(true);
    try {
      await apiCreateTokenRequest({ quantity: qty, message });
      setQty(10); setMessage("");
      await refresh();
      toast.success("Token request submitted");
    } catch (e: any) {
      const msg = e?.message || "Failed";
      setErr(msg);
      toast.error(msg);
    } finally { setLoading(false); }
  }

  const isAdmin = (me?.role || "").toLowerCase() === "admin";

  if (isAdmin) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');
          .admin-notice {
            font-family: 'DM Sans', sans-serif;
            display: flex;
            align-items: center;
            gap: 0.7rem;
            padding: 1rem 1.25rem;
            background: #f9f6f2;
            border: 1px solid #e8e0d8;
            border-radius: 12px;
            font-size: 0.85rem;
            color: #6b7585;
          }
          .admin-notice svg { color: #c9a84c; flex-shrink: 0; }
        `}</style>
        <div className="admin-notice">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Admins do not request tokens. Open the Admin console from Profile.
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');

        .clreq-wrap {
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        /* ── Page header ── */
        .clreq-eyebrow {
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #c9a84c;
          margin-bottom: 0.2rem;
        }
        .clreq-page-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.9rem;
          font-weight: 700;
          color: #0f1f38;
          line-height: 1.1;
        }

        /* ── Balance chip (if me has token_balance) ── */
        .balance-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.3rem 0.85rem;
          background: rgba(15,31,56,0.06);
          border: 1px solid rgba(15,31,56,0.1);
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 500;
          color: #0f1f38;
          align-self: flex-start;
        }
        .balance-chip svg { color: #c9a84c; }

        /* ── Card ── */
        .clreq-card {
          background: #fff;
          border-radius: 14px;
          border: 1px solid #e8e0d8;
          box-shadow: 0 2px 14px rgba(15,31,56,0.05);
          overflow: hidden;
        }

        .clreq-card-header {
          padding: 1.2rem 1.5rem;
          border-bottom: 1px solid #f0ebe4;
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .clreq-card-header svg { color: #c9a84c; }
        .clreq-card-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.15rem;
          font-weight: 700;
          color: #0f1f38;
        }

        .clreq-card-body { padding: 1.5rem; }

        /* ── Request form ── */
        .req-form-row {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .req-field { display: flex; flex-direction: column; gap: 0.4rem; }
        .req-field-label {
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: #0f1f38;
        }

        .req-input-wrap { position: relative; display: flex; align-items: center; }
        .req-input-icon {
          position: absolute;
          left: 0.75rem;
          color: #9aa3b0;
          pointer-events: none;
          display: flex;
          align-items: center;
        }
        .req-input {
          background: #fff;
          border: 1.5px solid #e2d9d0;
          border-radius: 9px;
          padding: 0.62rem 0.8rem 0.62rem 2.2rem;
          font-size: 0.875rem;
          font-family: 'DM Sans', sans-serif;
          color: #0f1f38;
          outline: none;
          transition: border-color 0.16s, box-shadow 0.16s;
        }
        .req-input.qty { width: 100px; }
        .req-input.msg { width: 280px; max-width: 100%; }
        .req-input::placeholder { color: #bbb5ae; }
        .req-input:focus {
          border-color: #c9a84c;
          box-shadow: 0 0 0 3px rgba(201,168,76,0.1);
        }

        .btn-submit {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: #0f1f38;
          color: #f5f0eb;
          border: none;
          border-radius: 9px;
          padding: 0.65rem 1.2rem;
          font-size: 0.85rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          cursor: pointer;
          align-self: flex-end;
          transition: background 0.18s, transform 0.13s, box-shadow 0.18s;
          box-shadow: 0 2px 10px rgba(15,31,56,0.16);
          white-space: nowrap;
        }
        .btn-submit:hover:not(:disabled) {
          background: #182f52;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(15,31,56,0.22);
        }
        .btn-submit:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

        .spinner {
          width: 13px; height: 13px;
          border: 2px solid rgba(245,240,235,0.3);
          border-top-color: #f5f0eb;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .req-error {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          margin-top: 0.9rem;
          padding: 0.65rem 0.9rem;
          background: #fff3f3;
          border: 1px solid #f5c6c6;
          border-radius: 8px;
          font-size: 0.8rem;
          color: #c0392b;
        }

        /* ── Requests list ── */
        .req-list { display: flex; flex-direction: column; gap: 0; }

        .req-list-item {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #f0ebe4;
          transition: background 0.12s;
        }
        .req-list-item:last-child { border-bottom: none; }
        .req-list-item:hover { background: #faf7f4; }

        .req-list-left { display: flex; align-items: flex-start; gap: 0.85rem; flex: 1; min-width: 0; }

        .req-list-icon {
          width: 36px; height: 36px;
          border-radius: 9px;
          background: rgba(201,168,76,0.1);
          border: 1.5px solid rgba(201,168,76,0.25);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          color: #c9a84c;
        }

        .req-list-info {}
        .req-list-qty {
          font-weight: 500;
          color: #0f1f38;
          font-size: 0.875rem;
        }
        .req-list-msg {
          margin-top: 0.25rem;
          padding: 0.3rem 0.6rem;
          background: #f9f6f2;
          border-left: 2px solid #c9a84c;
          border-radius: 0 5px 5px 0;
          font-size: 0.75rem;
          color: #6b7585;
          font-style: italic;
          display: inline-block;
        }

        .req-list-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem; flex-shrink: 0; }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.2rem 0.65rem;
          border-radius: 20px;
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          border: 1px solid;
        }
        .status-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
        }

        .req-list-date { font-size: 0.72rem; color: #b0b8c4; white-space: nowrap; }

        /* ── Empty ── */
        .req-list-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 1rem;
          color: #9aa3b0;
          gap: 0.6rem;
        }
        .req-list-empty svg { opacity: 0.3; }
        .req-list-empty-text { font-size: 0.85rem; }
      `}</style>

      <div className="clreq-wrap">

        {/* ── Page heading ── */}
        <div>
          <div className="clreq-eyebrow">My account</div>
          <h1 className="clreq-page-title">Token Requests</h1>
        </div>

        {/* ── Balance chip ── */}
        {me?.token_balance !== undefined && (
          <div className="balance-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            {(Number(me.token_balance) || 0).toLocaleString()} tokens available
          </div>
        )}

        {/* ── Request form ── */}
        <div className="clreq-card">
          <div className="clreq-card-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            <span className="clreq-card-title">Request tokens</span>
          </div>
          <div className="clreq-card-body">
            <div className="req-form-row">
              {/* Quantity */}
              <div className="req-field">
                <label className="req-field-label">Quantity</label>
                <div className="req-input-wrap">
                  <span className="req-input-icon">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="12" r="4"/>
                      <circle cx="15" cy="12" r="4"/>
                    </svg>
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={e => setQty(parseInt(e.target.value || "1", 10))}
                    className="req-input qty"
                  />
                </div>
              </div>

              {/* Message */}
              <div className="req-field" style={{ flex: 1 }}>
                <label className="req-field-label">Message <span style={{ fontSize: "0.65rem", fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#9aa3b0" }}>(optional)</span></label>
                <div className="req-input-wrap">
                  <span className="req-input-icon">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Reason for request…"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="req-input msg"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              {/* Submit */}
              <button disabled={loading || qty < 1} onClick={submit} className="btn-submit">
                {loading ? <span className="spinner" /> : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                )}
                {loading ? "Submitting…" : "Submit"}
              </button>
            </div>

            {err && (
              <div className="req-error">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {err}
              </div>
            )}
          </div>
        </div>

        {/* ── My requests list ── */}
        <div className="clreq-card">
          <div className="clreq-card-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span className="clreq-card-title">My Requests</span>
          </div>

          <div className="req-list">
            {requests.length === 0 ? (
              <div className="req-list-empty">
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#0f1f38" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                <span className="req-list-empty-text">No requests yet.</span>
              </div>
            ) : (
              requests.map(r => {
                const s = STATUS_STYLES[r.status?.toLowerCase()] ?? STATUS_STYLES.pending;
                return (
                  <div key={r.id} className="req-list-item">
                    <div className="req-list-left">
                      <div className="req-list-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="9" cy="12" r="4"/>
                          <circle cx="15" cy="12" r="4"/>
                        </svg>
                      </div>
                      <div className="req-list-info">
                        <div className="req-list-qty">{r.quantity} token{r.quantity !== 1 ? "s" : ""} requested</div>
                        {r.message && <div className="req-list-msg">"{r.message}"</div>}
                      </div>
                    </div>

                    <div className="req-list-right">
                      <span
                        className="status-badge"
                        style={{ background: s.bg, color: s.color, borderColor: s.border }}
                      >
                        <span className="status-dot" style={{ background: s.dot }} />
                        {r.status}
                      </span>
                      <span className="req-list-date">
                        {new Date(r.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                        {" · "}
                        {new Date(r.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </>
  );
}