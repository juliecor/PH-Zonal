"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiAdminApproveTokenRequest, apiAdminDenyTokenRequest, apiAdminListTokenRequests } from "../../lib/authClient";
import { toast } from "sonner";

export default function AdminRequestsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [acting, setActing] = useState<number | null>(null);
  const spQ = (searchParams?.get("q") || "").trim();
  const [q, setQ] = useState(spQ);
  const urlSyncRef = useRef<string>("");
  const searchRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await apiAdminListTokenRequests("pending");
      setRequests(Array.isArray(r?.data) ? r.data : []);
    } catch (e: any) {
      const msg = e?.message || "Failed to load requests";
      setErr(msg);
      try { (await import("sonner")).toast.error(msg); } catch {}
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // URL sync for q
  useEffect(() => {
    const qs = new URLSearchParams(searchParams?.toString() || "");
    if (q) qs.set("q", q); else qs.delete("q");
    const next = `${pathname}?${qs.toString()}`;
    if (next !== urlSyncRef.current) {
      urlSyncRef.current = next;
      router.replace(next, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // '/' focuses search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '/' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        const el = searchRef.current; if (el) { e.preventDefault(); el.focus(); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return requests;
    return requests.filter((r: any) => `${r.user?.first_name || r.user?.name || ''} ${r.user?.last_name || ''} ${r.user?.email || ''}`.toLowerCase().includes(s));
  }, [requests, q]);

  // ── Derived KPIs ──
  const kpiPending = filtered.length;
  const kpiTotalQty = filtered.reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0), 0);
  const kpiOldestAge = (() => {
    if (filtered.length === 0) return "—";
    const oldest = filtered.reduce((min: number, r: any) => Math.min(min, new Date(r.created_at).getTime()), Date.now());
    const diffMs = Date.now() - oldest;
    const hrs = Math.floor(diffMs / 3_600_000);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  })();

  async function approve(id: number) {
    setActing(id);
    setRequests((r) => r.filter((x: any) => x.id !== id));
    try { await apiAdminApproveTokenRequest(id); toast.success("Request approved"); }
    catch { toast.error("Approve failed"); await load(); }
    finally { setActing(null); }
  }

  async function deny(id: number) {
    setActing(id);
    setRequests((r) => r.filter((x: any) => x.id !== id));
    try { await apiAdminDenyTokenRequest(id); toast.success("Request denied"); }
    catch { toast.error("Deny failed"); await load(); }
    finally { setActing(null); }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');

        .req-wrap {
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* ── Header ── */
        .req-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .req-eyebrow {
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #c9a84c;
          margin-bottom: 0.2rem;
        }
        .req-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.9rem;
          font-weight: 700;
          color: #0f1f38;
          line-height: 1.1;
        }
        .req-count-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.35rem 0.8rem;
          background: rgba(201,168,76,0.12);
          border: 1px solid rgba(201,168,76,0.3);
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 500;
          color: #c9a84c;
          white-space: nowrap;
          align-self: center;
        }
        .req-count-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #c9a84c;
          animation: pulse 1.8s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.7); }
        }

        /* ── List card ── */
        .req-list-card {
          background: #fff;
          border-radius: 14px;
          border: 1px solid #e8e0d8;
          box-shadow: 0 2px 14px rgba(15,31,56,0.05);
          overflow: hidden;
        }

        /* ── Skeleton ── */
        .skel-item {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #f0ebe4;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }
        .skel-left { display: flex; flex-direction: column; gap: 0.5rem; flex: 1; }
        .skel-bar {
          background: linear-gradient(90deg, #f5f0eb 25%, #ede5da 50%, #f5f0eb 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 5px;
          height: 12px;
        }
        .skel-btns { display: flex; gap: 0.5rem; }
        .skel-btn {
          width: 72px; height: 32px;
          background: linear-gradient(90deg, #f5f0eb 25%, #ede5da 50%, #f5f0eb 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 8px;
        }
        @keyframes shimmer { to { background-position: -200% 0; } }

        /* ── Error ── */
        .req-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem 1.25rem;
          background: #fff3f3;
          border: 1px solid #f5c6c6;
          border-radius: 10px;
          font-size: 0.85rem;
          color: #c0392b;
        }

        /* ── Request item ── */
        .req-item {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1.25rem;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #f0ebe4;
          transition: background 0.14s;
        }
        .req-item:last-child { border-bottom: none; }
        .req-item:hover { background: #faf7f4; }

        /* Left content */
        .req-item-left { display: flex; align-items: flex-start; gap: 0.9rem; flex: 1; min-width: 0; }

        .req-avatar {
          width: 40px; height: 40px;
          border-radius: 10px;
          background: rgba(201,168,76,0.12);
          border: 1.5px solid rgba(201,168,76,0.3);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          font-family: 'Cormorant Garamond', serif;
          font-size: 1rem;
          font-weight: 700;
          color: #c9a84c;
          text-transform: uppercase;
        }

        .req-info { min-width: 0; }
        .req-name {
          font-weight: 500;
          color: #0f1f38;
          font-size: 0.9rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .req-email {
          font-size: 0.78rem;
          color: #9aa3b0;
          margin-top: 0.1rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .req-meta {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin-top: 0.55rem;
          flex-wrap: wrap;
        }
        .req-qty-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.18rem 0.6rem;
          background: #0f1f38;
          color: #f5f0eb;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.04em;
        }
        .req-date {
          font-size: 0.75rem;
          color: #b0b8c4;
        }
        .req-message {
          margin-top: 0.5rem;
          padding: 0.45rem 0.7rem;
          background: #f9f6f2;
          border-left: 2px solid #c9a84c;
          border-radius: 0 6px 6px 0;
          font-size: 0.78rem;
          color: #6b7585;
          font-style: italic;
        }

        /* Action buttons */
        .req-actions {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          flex-shrink: 0;
        }
        @media (min-width: 560px) {
          .req-actions { flex-direction: row; align-items: center; }
        }

        .btn-approve, .btn-deny {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.78rem;
          font-weight: 500;
          cursor: pointer;
          transition: transform 0.13s, box-shadow 0.15s, opacity 0.15s;
          white-space: nowrap;
        }
        .btn-approve {
          background: #0f1f38;
          color: #f5f0eb;
          box-shadow: 0 2px 8px rgba(15,31,56,0.18);
        }
        .btn-approve:hover:not(:disabled) {
          background: #182f52;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(15,31,56,0.24);
        }
        .btn-deny {
          background: #fff;
          color: #c0392b;
          border: 1.5px solid #f5c6c6;
          box-shadow: 0 1px 4px rgba(192,57,43,0.08);
        }
        .btn-deny:hover:not(:disabled) {
          background: #fff5f5;
          border-color: #e8a0a0;
          transform: translateY(-1px);
        }
        .btn-approve:disabled, .btn-deny:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        /* ── Empty ── */
        .req-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 1rem;
          gap: 0.7rem;
          color: #9aa3b0;
        }
        .req-empty svg { opacity: 0.3; }
        .req-empty-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.1rem;
          font-weight: 600;
          color: #0f1f38;
          opacity: 0.5;
        }
        .req-empty-sub { font-size: 0.8rem; font-weight: 300; }
      `}</style>

      <div className="req-wrap">

        {/* ── Header ── */}
        <div className="req-header">
          <div>
            <div className="req-eyebrow">Admin panel</div>
            <h1 className="req-title">Token Requests</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {/* Search */}
            <div className="filter-input-wrap" style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#9aa3b0' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </span>
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search name or email…"
                className="filter-input"
                ref={searchRef}
                style={{ paddingLeft: '2.1rem', border: '1.5px solid #e2d9d0', borderRadius: 9, height: 34, fontSize: 13 }}
              />
            </div>
            {!loading && !err && (
            <div className="req-count-badge">
              <span className="req-count-dot" />
              {filtered.length} pending
            </div>
            )}
          </div>
        </div>

        {/* ── Summary Band ── */}
        <div className="req-list-card" style={{ padding: '0.9rem 1rem' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:'0.75rem' }}>
            <Kpi label="Pending Requests" value={kpiPending.toLocaleString()} note="Matching filters" colSpan={4} />
            <Kpi label="Total Tokens Asked" value={kpiTotalQty.toLocaleString()} note="Across pending" colSpan={4} />
            <Kpi label="Oldest Age" value={kpiOldestAge} note="Queue age" colSpan={4} />
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="req-list-card">
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="skel-item" key={i}>
                <div className="skel-left">
                  <div className="skel-bar" style={{ width: "45%", opacity: 1 - i * 0.1 }} />
                  <div className="skel-bar" style={{ width: "28%", opacity: 1 - i * 0.1 }} />
                  <div className="skel-bar" style={{ width: "60%", height: 9, opacity: 0.5 - i * 0.08 }} />
                </div>
                <div className="skel-btns">
                  <div className="skel-btn" />
                  <div className="skel-btn" />
                </div>
              </div>
            ))}
          </div>
        ) : err ? (
          <div className="req-error">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {err}
          </div>
        ) : (
          <div className="req-list-card">
            {filtered.length === 0 ? (
              <div className="req-empty">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#0f1f38" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <div className="req-empty-title">All caught up</div>
                <div className="req-empty-sub">No pending token requests at the moment.</div>
              </div>
            ) : (
              filtered.map((r: any) => {
                const fullName = [r.user?.first_name || r.user?.name, r.user?.last_name].filter(Boolean).join(" ");
                const initials = fullName.split(" ").slice(0, 2).map((w: string) => w[0]).join("") || "?";
                const isActing = acting === r.id;

                return (
                  <div key={r.id} className="req-item">
                    <div className="req-item-left">
                      <div className="req-avatar">{initials}</div>
                      <div className="req-info">
                        <div className="req-name">{fullName || "Unknown user"}</div>
                        <div className="req-email">{r.user?.email || "—"}</div>
                        <div className="req-meta">
                          <span className="req-qty-badge">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                            {r.quantity} token{r.quantity !== 1 ? "s" : ""}
                          </span>
                          <span className="req-date">
                            {new Date(r.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                            {" · "}
                            {new Date(r.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {r.message && (
                          <div className="req-message">"{r.message}"</div>
                        )}
                      </div>
                    </div>

                    <div className="req-actions">
                      <button
                        className="btn-approve"
                        disabled={isActing}
                        onClick={() => approve(r.id)}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Approve
                      </button>
                      <button
                        className="btn-deny"
                        disabled={isActing}
                        onClick={() => deny(r.id)}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Deny
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>
    </>
  );
}

function Kpi({ label, value, note, colSpan = 4 }: { label: string; value: string; note?: string; colSpan?: number }) {
  return (
    <div style={{ gridColumn: `span ${colSpan} / span ${colSpan}` }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.75rem', padding:'0.9rem 0.9rem', background:'#fff', border:'1px solid #e8e0d8', borderRadius:12 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'.14em', color:'#1e3a8a' }}>{label}</div>
          <div style={{ marginTop:4, fontSize:22, fontWeight:700, color:'#0f1f38' }}>{value}</div>
          {note && <div style={{ marginTop:4, fontSize:12, color:'#6b7585' }}>{note}</div>}
        </div>
        <span aria-hidden style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:24, height:24, borderRadius:999, border:'1px solid #e8e0d8', color:'#c9a84c', fontWeight:800 }}>•</span>
      </div>
    </div>
  );
}