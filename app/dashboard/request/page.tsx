"use client";

import { useEffect, useRef, useState } from "react";
import { apiMyReports } from "../../lib/authClient";

type R = {
  id: number;
  street?: string | null;
  barangay?: string | null;
  city?: string | null;
  province?: string | null;
  zonal_value?: string | null;
  sqm?: string | null;
  meta?: any;
  created_at: string;
};

export default function ReportsPage() {
  const [rows, setRows] = useState<R[]>([]);
  const [loading, setLoading] = useState(true);
  const [csvLoading, setCsvLoading] = useState(false);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [city, setCity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [meta, setMeta] = useState<{ current_page: number; last_page: number; per_page: number; total: number } | null>(null);
  const didMount = useRef(false);

  async function load(p: number, opts?: { city?: string; from?: string; to?: string; perPage?: number }) {
    setLoading(true); setErr("");
    try {
      const j = await apiMyReports({ page: p, per_page: opts?.perPage ?? perPage, city: (opts?.city ?? city).trim() || undefined, from: (opts?.from ?? from) || undefined, to: (opts?.to ?? to) || undefined });
      setRows(Array.isArray(j?.data) ? j.data : []);
      setMeta(j?.meta ?? null);
    } catch (e: any) { setErr(e?.message || "Failed to load reports"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(1); didMount.current = true; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages  = meta?.last_page || 1;
  const currentPage = meta?.current_page || page;

  function handleApply() { setPage(1); load(1, { city, from, to }); }
  function handlePrev()  { const n = Math.max(1, page - 1); setPage(n); load(n); }
  function handleNext()  { const n = Math.min(totalPages, page + 1); setPage(n); load(n); }
  function handlePerPage(n: number) { setPerPage(n); setPage(1); load(1, { perPage: n }); }

  async function handleDownloadCSV() {
    setCsvLoading(true); setErr("");
    try {
      const totalCount = meta?.total ?? 0;
      const fetchCount = Math.min(totalCount || perPage, 10000);
      const j = await apiMyReports({ page: 1, per_page: fetchCount || 10000, city: city.trim() || undefined, from: from || undefined, to: to || undefined });
      const allRows: R[] = Array.isArray(j?.data) ? j.data : rows;
      if (allRows.length === 0) { setErr("No data to export."); return; }
      const headers = ["ID", "Street", "Barangay", "City", "Province", "Zonal Value (₱/sqm)", "Created At"];
      const csvLines = [headers.join(",")];
      for (const r of allRows) {
        const f = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const d = new Date(r.created_at).toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        csvLines.push([f(r.id), f(r.street), f(r.barangay), f(r.city), f(r.province), f(r.zonal_value), f(d)].join(","));
      }
      const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const dateStr  = new Date().toISOString().slice(0, 10);
      const cityPart = city.trim() ? `_${city.trim().replace(/\s+/g, "-")}` : "";
      const link = document.createElement("a");
      link.href = url; link.setAttribute("download", `reports${cityPart}_${dateStr}.csv`);
      document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
    } catch (e: any) { setErr(e?.message || "Failed to export CSV"); }
    finally { setCsvLoading(false); }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');

        .crpt-wrap { font-family:'DM Sans',sans-serif; display:flex; flex-direction:column; gap:1.25rem; }
        .crpt-header { display:flex; align-items:flex-end; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
        .crpt-title { font-family:'Cormorant Garamond',serif; font-size:1.9rem; font-weight:700; color:#1e3a8a; line-height:1.1; }
        .crpt-filters { display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap; }
        .fi-wrap { position:relative; display:flex; align-items:center; }
        .fi-icon { position:absolute; left:0.7rem; color:#9aa3b0; pointer-events:none; display:flex; align-items:center; }
        .fi-input { background:#fff; border:1.5px solid #e2d9d0; border-radius:9px; padding:0.52rem 0.8rem 0.52rem 2.1rem; font-size:0.82rem; font-family:'DM Sans',sans-serif; color:#1e3a8a; outline:none; transition:border-color 0.16s,box-shadow 0.16s; width:130px; }
        .fi-input.wide { width:160px; }
        .fi-input::placeholder { color:#bbb5ae; }
        .fi-input:focus { border-color:#c9a84c; box-shadow:0 0 0 3px rgba(201,168,76,0.1); }
        .fi-input[type="date"] { padding-left:2.1rem; color-scheme:light; }
        .fi-select { background:#fff; border:1.5px solid #e2d9d0; border-radius:9px; padding:0.52rem 0.75rem; font-size:0.82rem; font-family:'DM Sans',sans-serif; color:#1e3a8a; outline:none; cursor:pointer; transition:border-color 0.16s; }
        .fi-select:focus { border-color:#c9a84c; }

        .btn-apply { display:flex; align-items:center; gap:0.4rem; background:#1e3a8a; color:#f5f0eb; border:none; border-radius:9px; padding:0.52rem 1rem; font-size:0.82rem; font-family:'DM Sans',sans-serif; font-weight:500; cursor:pointer; transition:background 0.18s,transform 0.13s,box-shadow 0.18s; box-shadow:0 2px 10px rgba(30,58,138,0.16); white-space:nowrap; }
        .btn-apply:hover { background:#1e40af; transform:translateY(-1px); box-shadow:0 4px 14px rgba(30,58,138,0.22); }

        .btn-csv { display:flex; align-items:center; gap:0.4rem; background:#fff; color:#1e3a8a; border:1.5px solid #e2d9d0; border-radius:9px; padding:0.52rem 1rem; font-size:0.82rem; font-family:'DM Sans',sans-serif; font-weight:500; cursor:pointer; transition:border-color 0.18s,background 0.18s,transform 0.13s; white-space:nowrap; }
        .btn-csv:hover:not(:disabled) { border-color:#10b981; color:#065f46; background:#f0fdf4; transform:translateY(-1px); }
        .btn-csv:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-csv-spinner { width:12px; height:12px; border:2px solid rgba(30,58,138,0.2); border-top-color:#1e3a8a; border-radius:50%; animation:csvSpin 0.7s linear infinite; }
        @keyframes csvSpin { to{transform:rotate(360deg)} }

        .crpt-card { background:#fff; border-radius:14px; border:1px solid #e8e0d8; box-shadow:0 2px 14px rgba(30,58,138,0.05); overflow:hidden; position:relative; }
        .crpt-loading-bar { position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg,#c9a84c 0%,#e8c96c 50%,#c9a84c 100%); background-size:200% 100%; animation:slideBar 1.2s linear infinite; z-index:10; }
        @keyframes slideBar { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

        .crpt-error { display:flex; align-items:center; gap:0.5rem; padding:1rem 1.25rem; background:#fff3f3; border:1px solid #f5c6c6; border-radius:10px; font-size:0.85rem; color:#c0392b; }
        .crpt-table-wrap { overflow-x:auto; }
        .crpt-table { width:100%; min-width:640px; border-collapse:collapse; font-size:0.825rem; }
        .crpt-table thead tr { background:#f9f6f2; border-bottom:1.5px solid #e8e0d8; }
        .crpt-table th { padding:0.8rem 1rem; text-align:left; font-size:0.68rem; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; color:#6b7585; white-space:nowrap; }
        .crpt-table th.align-right { text-align:right; }
        .crpt-table tbody tr { border-bottom:1px solid #f0ebe4; transition:background 0.12s; }
        .crpt-table tbody tr:last-child { border-bottom:none; }
        .crpt-table tbody tr:hover { background:#faf7f4; }
        .crpt-table td { padding:0.85rem 1rem; color:#2d3748; vertical-align:middle; }
        .crpt-table td.muted { color:#aaa; }
        .crpt-table td.align-right { text-align:right; }

        .skel-td { padding:0.85rem 1rem; }
        .skel-bar { background:linear-gradient(90deg,#f5f0eb 25%,#ede5da 50%,#f5f0eb 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:5px; height:11px; }
        @keyframes shimmer { to{background-position:-200% 0} }

        .zonal-badge { display:inline-block; padding:0.2rem 0.6rem; background:rgba(30,58,138,0.06); border:1px solid rgba(30,58,138,0.1); border-radius:6px; font-size:0.8rem; font-weight:500; color:#1e3a8a; }
        .date-cell { white-space:nowrap; color:#7a8394; font-size:0.78rem; }
        .crpt-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:3.5rem 1rem; color:#9aa3b0; gap:0.6rem; }
        .crpt-empty svg { opacity:0.3; }
        .crpt-empty-text { font-size:0.875rem; text-align:center; }

        .crpt-pagination { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
        .pag-info { font-size:0.78rem; color:#9aa3b0; font-weight:300; }
        .pag-info strong { color:#1e3a8a; font-weight:500; }
        .pag-controls { display:flex; align-items:center; gap:0.4rem; }
        .pag-btn { display:flex; align-items:center; gap:0.3rem; padding:0.45rem 0.85rem; background:#fff; border:1.5px solid #e2d9d0; border-radius:8px; font-size:0.78rem; font-family:'DM Sans',sans-serif; font-weight:500; color:#1e3a8a; cursor:pointer; transition:border-color 0.15s,background 0.15s,transform 0.12s; }
        .pag-btn:hover:not(:disabled) { border-color:#c9a84c; background:#fdf9f3; transform:translateY(-1px); }
        .pag-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .pag-current { padding:0.45rem 0.75rem; background:#1e3a8a; color:#f5f0eb; border-radius:8px; font-size:0.78rem; font-weight:500; min-width:36px; text-align:center; }
      `}</style>

      <div className="crpt-wrap">
        <div className="crpt-header">
          <div><h1 className="crpt-title">Reports</h1></div>
          <div className="crpt-filters">
            <div className="fi-wrap">
              <span className="fi-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></span>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="City…" className="fi-input" onKeyDown={e => e.key === "Enter" && handleApply()} />
            </div>
            <div className="fi-wrap">
              <span className="fi-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="fi-input wide" />
            </div>
            <div className="fi-wrap">
              <span className="fi-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="fi-input wide" />
            </div>
            <select value={perPage} onChange={e => handlePerPage(Number(e.target.value))} className="fi-select">
              {[10, 20, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
            </select>
            <button onClick={handleApply} className="btn-apply">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Apply
            </button>
            <button onClick={handleDownloadCSV} disabled={csvLoading || loading || rows.length === 0} className="btn-csv" title="Download all filtered results as CSV">
              {csvLoading ? <span className="btn-csv-spinner" /> : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              )}
              {csvLoading ? "Exporting…" : "CSV"}
            </button>
          </div>
        </div>

        {err && (
          <div className="crpt-error">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {err}
          </div>
        )}

        {!err && (
          <div className="crpt-card">
            {loading && <div className="crpt-loading-bar" />}
            <div className="crpt-table-wrap">
              <table className="crpt-table">
                <thead>
                  <tr>
                    <th>Street</th><th>Barangay</th><th>City</th><th>Province</th><th>Zonal / sqm</th>
                    <th className="align-right">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={`skel-${i}`} style={{ opacity: 1 - i * 0.12 }}>
                          {[38, 28, 22, 22, 18, 14].map((w, j) => (
                            <td key={j} className="skel-td"><div className="skel-bar" style={{ width: `${w}%` }} /></td>
                          ))}
                        </tr>
                      ))
                    : rows.length > 0
                    ? rows.map(r => (
                        <tr key={r.id}>
                          <td className={r.street ? "" : "muted"}>{r.street || "—"}</td>
                          <td className={r.barangay ? "" : "muted"}>{r.barangay || "—"}</td>
                          <td className={r.city ? "" : "muted"}>{r.city || "—"}</td>
                          <td className={r.province ? "" : "muted"}>{r.province || "—"}</td>
                          <td>{r.zonal_value ? <span className="zonal-badge">₱ {r.zonal_value}</span> : <span className="muted">—</span>}</td>
                          <td className="align-right">
                            <span className="date-cell">
                              {new Date(r.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                              <br /><span style={{ fontSize: "0.72rem" }}>{new Date(r.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</span>
                            </span>
                          </td>
                        </tr>
                      ))
                    : (
                        <tr><td colSpan={6}>
                          <div className="crpt-empty">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1e3a8a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                            <span className="crpt-empty-text">No reports found. Generate a PDF to record it here.</span>
                          </div>
                        </td></tr>
                      )
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}

        {meta && !loading && (
          <div className="crpt-pagination">
            <span className="pag-info">Showing <strong>{rows.length}</strong> of <strong>{meta.total}</strong> reports</span>
            <div className="pag-controls">
              <button className="pag-btn" disabled={page <= 1} onClick={handlePrev}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>Prev
              </button>
              <span className="pag-current">{currentPage} / {totalPages}</span>
              <button className="pag-btn" disabled={page >= totalPages} onClick={handleNext}>
                Next<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}