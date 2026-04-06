"use client";

import { useEffect, useState } from "react";
import { apiMyReports } from "../../lib/authClient";

type R = { id: number; street?: string|null; barangay?: string|null; city?: string|null; province?: string|null; zonal_value?: string|null; sqm?: string|null; meta?: any; created_at: string };

export default function ReportsPage() {
  const [rows, setRows] = useState<R[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [city, setCity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [meta, setMeta] = useState<{current_page:number;last_page:number;per_page:number;total:number}|null>(null);

  async function load(p = page) {
    setLoading(true); setErr("");
    try {
      const j = await apiMyReports({ page: p, per_page: perPage, city: city.trim() || undefined, from: from || undefined, to: to || undefined });
      setRows(Array.isArray(j?.data) ? j.data : []);
      setMeta(j?.meta ?? null);
    } catch (e:any) {
      setErr(e?.message || "Failed to load reports");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(1); setPage(1); }, [perPage]);
  useEffect(() => { load(page); }, [page]);

  const totalPages = meta?.last_page || 1;
  const currentPage = meta?.current_page || page;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');

        .crpt-wrap {
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* ── Header ── */
        .crpt-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .crpt-eyebrow {
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #c9a84c;
          margin-bottom: 0.2rem;
        }
        .crpt-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.9rem;
          font-weight: 700;
          color: #0f1f38;
          line-height: 1.1;
        }

        /* ── Filters ── */
        .crpt-filters {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
        }

        .fi-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .fi-icon {
          position: absolute;
          left: 0.7rem;
          color: #9aa3b0;
          pointer-events: none;
          display: flex;
          align-items: center;
        }
        .fi-input {
          background: #fff;
          border: 1.5px solid #e2d9d0;
          border-radius: 9px;
          padding: 0.52rem 0.8rem 0.52rem 2.1rem;
          font-size: 0.82rem;
          font-family: 'DM Sans', sans-serif;
          color: #0f1f38;
          outline: none;
          transition: border-color 0.16s, box-shadow 0.16s;
          width: 130px;
        }
        .fi-input.wide { width: 160px; }
        .fi-input::placeholder { color: #bbb5ae; }
        .fi-input:focus {
          border-color: #c9a84c;
          box-shadow: 0 0 0 3px rgba(201,168,76,0.1);
        }
        .fi-input[type="date"] {
          padding-left: 2.1rem;
          color-scheme: light;
        }

        .fi-select {
          background: #fff;
          border: 1.5px solid #e2d9d0;
          border-radius: 9px;
          padding: 0.52rem 0.75rem;
          font-size: 0.82rem;
          font-family: 'DM Sans', sans-serif;
          color: #0f1f38;
          outline: none;
          cursor: pointer;
          transition: border-color 0.16s;
        }
        .fi-select:focus { border-color: #c9a84c; }

        .btn-apply {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: #0f1f38;
          color: #f5f0eb;
          border: none;
          border-radius: 9px;
          padding: 0.52rem 1rem;
          font-size: 0.82rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.18s, transform 0.13s, box-shadow 0.18s;
          box-shadow: 0 2px 10px rgba(15,31,56,0.16);
          white-space: nowrap;
        }
        .btn-apply:hover {
          background: #182f52;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(15,31,56,0.22);
        }

        /* ── Card ── */
        .crpt-card {
          background: #fff;
          border-radius: 14px;
          border: 1px solid #e8e0d8;
          box-shadow: 0 2px 14px rgba(15,31,56,0.05);
          overflow: hidden;
        }

        /* ── Skeleton ── */
        .skel-row {
          display: flex;
          gap: 1rem;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #f0ebe4;
        }
        .skel-bar {
          background: linear-gradient(90deg, #f5f0eb 25%, #ede5da 50%, #f5f0eb 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 5px;
          height: 12px;
          flex-shrink: 0;
        }
        @keyframes shimmer { to { background-position: -200% 0; } }

        /* ── Error ── */
        .crpt-error {
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

        /* ── Table ── */
        .crpt-table-wrap { overflow-x: auto; }
        .crpt-table {
          width: 100%;
          min-width: 640px;
          border-collapse: collapse;
          font-size: 0.825rem;
        }
        .crpt-table thead tr {
          background: #f9f6f2;
          border-bottom: 1.5px solid #e8e0d8;
        }
        .crpt-table th {
          padding: 0.8rem 1rem;
          text-align: left;
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #6b7585;
          white-space: nowrap;
        }
        .crpt-table th.align-right { text-align: right; }
        .crpt-table tbody tr {
          border-bottom: 1px solid #f0ebe4;
          transition: background 0.12s;
        }
        .crpt-table tbody tr:last-child { border-bottom: none; }
        .crpt-table tbody tr:hover { background: #faf7f4; }
        .crpt-table td {
          padding: 0.85rem 1rem;
          color: #2d3748;
          vertical-align: middle;
        }
        .crpt-table td.muted { color: #aaa; }
        .crpt-table td.align-right { text-align: right; }

        .zonal-badge {
          display: inline-block;
          padding: 0.2rem 0.6rem;
          background: rgba(15,31,56,0.06);
          border: 1px solid rgba(15,31,56,0.1);
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 500;
          color: #0f1f38;
        }
        .date-cell { white-space: nowrap; color: #7a8394; font-size: 0.78rem; }

        /* ── Empty ── */
        .crpt-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3.5rem 1rem;
          color: #9aa3b0;
          gap: 0.6rem;
        }
        .crpt-empty svg { opacity: 0.3; }
        .crpt-empty-text { font-size: 0.875rem; text-align: center; }

        /* ── Pagination ── */
        .crpt-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .pag-info { font-size: 0.78rem; color: #9aa3b0; font-weight: 300; }
        .pag-info strong { color: #0f1f38; font-weight: 500; }
        .pag-controls { display: flex; align-items: center; gap: 0.4rem; }
        .pag-btn {
          display: flex; align-items: center; gap: 0.3rem;
          padding: 0.45rem 0.85rem;
          background: #fff;
          border: 1.5px solid #e2d9d0;
          border-radius: 8px;
          font-size: 0.78rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          color: #0f1f38;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s, transform 0.12s;
        }
        .pag-btn:hover:not(:disabled) {
          border-color: #c9a84c;
          background: #fdf9f3;
          transform: translateY(-1px);
        }
        .pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .pag-current {
          padding: 0.45rem 0.75rem;
          background: #0f1f38;
          color: #f5f0eb;
          border-radius: 8px;
          font-size: 0.78rem;
          font-weight: 500;
          min-width: 36px;
          text-align: center;
        }
      `}</style>

      <div className="crpt-wrap">

        {/* ── Header + filters ── */}
        <div className="crpt-header">
          <div>
            <div className="crpt-eyebrow">My activity</div>
            <h1 className="crpt-title">Reports</h1>
          </div>

          <div className="crpt-filters">
            {/* City */}
            <div className="fi-wrap">
              <span className="fi-icon">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </span>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="City…" className="fi-input" />
            </div>

            {/* From */}
            <div className="fi-wrap">
              <span className="fi-icon">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </span>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="fi-input wide" />
            </div>

            {/* To */}
            <div className="fi-wrap">
              <span className="fi-icon">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="fi-input wide" />
            </div>

            {/* Per page */}
            <select value={perPage} onChange={e => setPerPage(Number(e.target.value))} className="fi-select">
              {[10, 20, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
            </select>

            <button onClick={() => { setPage(1); load(1); }} className="btn-apply">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Apply
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="crpt-card">
            {Array.from({ length: 5 }).map((_, i) => (
              <div className="skel-row" key={i}>
                <div className="skel-bar" style={{ width: "15%", opacity: 1 - i * 0.1 }} />
                <div className="skel-bar" style={{ width: "13%", opacity: 1 - i * 0.1 }} />
                <div className="skel-bar" style={{ width: "12%", opacity: 1 - i * 0.1 }} />
                <div className="skel-bar" style={{ width: "12%", opacity: 1 - i * 0.1 }} />
                <div className="skel-bar" style={{ width: "9%",  opacity: 1 - i * 0.1 }} />
                <div className="skel-bar" style={{ width: "11%", marginLeft: "auto", opacity: 1 - i * 0.1 }} />
              </div>
            ))}
          </div>
        ) : err ? (
          <div className="crpt-error">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {err}
          </div>
        ) : (
          <div className="crpt-card">
            <div className="crpt-table-wrap">
              <table className="crpt-table">
                <thead>
                  <tr>
                    <th>Street</th>
                    <th>Barangay</th>
                    <th>City</th>
                    <th>Province</th>
                    <th>Zonal / sqm</th>
                    <th className="align-right">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td className={r.street ? "" : "muted"}>{r.street || "—"}</td>
                      <td className={r.barangay ? "" : "muted"}>{r.barangay || "—"}</td>
                      <td className={r.city ? "" : "muted"}>{r.city || "—"}</td>
                      <td className={r.province ? "" : "muted"}>{r.province || "—"}</td>
                      <td>
                        {r.zonal_value
                          ? <span className="zonal-badge">₱ {r.zonal_value}</span>
                          : <span className="muted">—</span>}
                      </td>
                      <td className="align-right">
                        <span className="date-cell">
                          {new Date(r.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                          <br />
                          <span style={{ fontSize: "0.72rem" }}>
                            {new Date(r.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <div className="crpt-empty">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0f1f38" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                          <span className="crpt-empty-text">No reports yet. Generate a PDF to record it here.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Pagination ── */}
        {meta && (
          <div className="crpt-pagination">
            <span className="pag-info">
              Showing <strong>{rows.length}</strong> of <strong>{meta.total}</strong> reports
            </span>
            <div className="pag-controls">
              <button className="pag-btn" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                Prev
              </button>
              <span className="pag-current">{currentPage} / {totalPages}</span>
              <button className="pag-btn" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                Next
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}