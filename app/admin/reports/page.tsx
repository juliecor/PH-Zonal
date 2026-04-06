"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { backendBase, getToken } from "../../lib/authClient";
import { toast } from "sonner";

type R = {
  id: number;
  user?: { id: number; name: string; email: string };
  street?: string | null;
  barangay?: string | null;
  city?: string | null;
  province?: string | null;
  zonal_value?: string | null;
  created_at: string;
  file_path?: string | null;
};

export default function AdminReportsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const spQ = (searchParams?.get("q") || "").trim();
  const spCity = (searchParams?.get("city") || "").trim();
  const spPage = Number(searchParams?.get("page") || 1) || 1;
  const spPer = Number(searchParams?.get("size") || searchParams?.get("per_page") || 20) || 20;

  const [rows, setRows] = useState<R[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState(spQ);
  const [city, setCity] = useState(spCity);
  const [page, setPage] = useState(spPage);
  const [perPage, setPerPage] = useState(spPer);
  const [meta, setMeta] = useState<any>(null);
  const urlSyncRef = useRef<string>("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [exporting, setExporting] = useState(false);

  async function load(p = page) {
    setLoading(true); setErr("");
    try {
      const token = getToken();
      const qs = new URLSearchParams();
      qs.set("page", String(p));
      qs.set("per_page", String(perPage));
      if (q.trim()) qs.set("q", q.trim());
      if (city.trim()) qs.set("city", city.trim());
      const res = await fetch(`${backendBase}/api/admin/reports?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const j = await res.json();
      setRows(Array.isArray(j?.data) ? j.data : []);
      setMeta(j?.meta ?? null);
    } catch (e: any) {
      setErr(e?.message || "Failed to load reports");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(1); setPage(1); }, [perPage]);
  useEffect(() => { load(page); }, [page]);

  // Persist filters to URL
  useEffect(() => {
    const qs = new URLSearchParams(searchParams?.toString() || "");
    if (q) qs.set("q", q); else qs.delete("q");
    if (city) qs.set("city", city); else qs.delete("city");
    if (page > 1) qs.set("page", String(page)); else qs.delete("page");
    if (perPage !== 20) qs.set("size", String(perPage)); else qs.delete("size");
    const next = `${pathname}?${qs.toString()}`;
    if (next !== urlSyncRef.current) {
      urlSyncRef.current = next;
      router.replace(next, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, city, page, perPage]);

  // Keyboard: '/' focuses search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '/' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        const el = searchRef.current;
        if (el) { e.preventDefault(); el.focus(); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const totalPages = meta?.last_page || 1;
  const currentPage = meta?.current_page || page;

  async function exportCsv() {
    try {
      setExporting(true);
      // Ensure we know total pages; if not yet loaded, fetch first page
      let lastPage = totalPages;
      let total = meta?.total as number | undefined;
      const token = getToken();
      const baseQs = new URLSearchParams();
      baseQs.set("per_page", String(Math.max(50, perPage || 50))); // reduce calls; backend may cap
      if (q.trim()) baseQs.set("q", q.trim());
      if (city.trim()) baseQs.set("city", city.trim());

      if (!meta) {
        const res0 = await fetch(`${backendBase}/api/admin/reports?${baseQs.toString()}&page=1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res0.ok) throw new Error(`${res0.status}`);
        const j0 = await res0.json();
        lastPage = j0?.meta?.last_page || 1;
        total = j0?.meta?.total;
      }

      const all: any[] = [];
      for (let p = 1; p <= (lastPage || 1); p++) {
        const res = await fetch(`${backendBase}/api/admin/reports?${baseQs.toString()}&page=${p}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const j = await res.json();
        const rows: any[] = Array.isArray(j?.data) ? j.data : [];
        all.push(...rows);
        if (lastPage > 1) {
          toast.dismiss("export-progress");
          toast.info(`Exporting… ${Math.min(all.length, total ?? all.length)} rows`, { id: "export-progress" });
        }
      }

      // Build CSV
      const header = [
        "Report ID",
        "User Name",
        "Email",
        "Street",
        "Barangay",
        "City",
        "Province",
        "Zonal Value (/sqm)",
        "Created At",
      ];
      const escape = (v: any) => {
        if (v === null || v === undefined) return "";
        const s = String(v).replace(/\r?\n/g, " ").replace(/"/g, '""');
        return `"${s}"`;
      };
      const lines = [header.join(",")];
      for (const r of all) {
        const row = [
          r.id,
          r.user?.name ?? "",
          r.user?.email ?? "",
          r.street ?? "",
          r.barangay ?? "",
          r.city ?? "",
          r.province ?? "",
          r.zonal_value ?? "",
          r.created_at ?? "",
        ].map(escape).join(",");
        lines.push(row);
      }
      const csv = lines.join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0];
      a.href = url;
      a.download = `reports-${ts}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${all.length} report${all.length === 1 ? "" : "s"}`);
    } catch (e: any) {
      toast.error(e?.message || "Export failed");
    } finally {
      toast.dismiss("export-progress");
      setExporting(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');

        .rpt-wrap {
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* ── Top bar ── */
        .rpt-topbar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .rpt-title-group {}
        .rpt-eyebrow {
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #c9a84c;
          margin-bottom: 0.2rem;
        }
        .rpt-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.9rem;
          font-weight: 700;
          color: #0f1f38;
          line-height: 1.1;
        }

        /* ── Filter bar ── */
        .rpt-filters {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
        }

        .filter-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .filter-icon {
          position: absolute;
          left: 0.7rem;
          color: #9aa3b0;
          pointer-events: none;
          display: flex;
          align-items: center;
        }
        .filter-input {
          background: #fff;
          border: 1.5px solid #e2d9d0;
          border-radius: 9px;
          padding: 0.55rem 0.8rem 0.55rem 2.1rem;
          font-size: 0.825rem;
          font-family: 'DM Sans', sans-serif;
          color: #0f1f38;
          outline: none;
          transition: border-color 0.16s, box-shadow 0.16s;
          width: 190px;
        }
        .filter-input::placeholder { color: #bbb5ae; }
        .filter-input:focus {
          border-color: #c9a84c;
          box-shadow: 0 0 0 3px rgba(201,168,76,0.1);
        }

        .filter-select {
          background: #fff;
          border: 1.5px solid #e2d9d0;
          border-radius: 9px;
          padding: 0.55rem 0.75rem;
          font-size: 0.825rem;
          font-family: 'DM Sans', sans-serif;
          color: #0f1f38;
          outline: none;
          cursor: pointer;
          transition: border-color 0.16s;
        }
        .filter-select:focus { border-color: #c9a84c; }

        .btn-apply {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: #0f1f38;
          color: #f5f0eb;
          border: none;
          border-radius: 9px;
          padding: 0.55rem 1rem;
          font-size: 0.825rem;
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
        .btn-apply:active { transform: translateY(0); }

        .btn-export {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: #fff;
          color: #0f1f38;
          border: 1.5px solid #e2d9d0;
          border-radius: 9px;
          padding: 0.55rem 1rem;
          font-size: 0.825rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          cursor: pointer;
          transition: border-color 0.18s, background 0.18s, transform 0.13s, box-shadow 0.18s;
        }
        .btn-export:hover:not(:disabled) {
          border-color: #c9a84c;
          background: #fdf9f3;
          transform: translateY(-1px);
          box-shadow: 0 2px 10px rgba(15,31,56,0.12);
        }
        .btn-export:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        /* ── Card shell ── */
        .rpt-card {
          background: #fff;
          border-radius: 14px;
          border: 1px solid #e8e0d8;
          box-shadow: 0 2px 14px rgba(15,31,56,0.05);
          overflow: hidden;
        }

        /* ── Loading skeleton ── */
        .skel-row {
          display: flex;
          gap: 1rem;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #f0ebe4;
        }
        .skel-cell {
          background: linear-gradient(90deg, #f5f0eb 25%, #ede5da 50%, #f5f0eb 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 5px;
          height: 13px;
        }
        @keyframes shimmer { to { background-position: -200% 0; } }

        /* ── Error ── */
        .rpt-error {
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
        .rpt-table-wrap {
          overflow-x: auto;
        }
        .rpt-table {
          width: 100%;
          min-width: 820px;
          border-collapse: collapse;
          font-size: 0.825rem;
        }

        .rpt-table thead tr {
          background: #f9f6f2;
          border-bottom: 1.5px solid #e8e0d8;
        }
        .rpt-table th {
          padding: 0.8rem 1rem;
          text-align: left;
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #6b7585;
          white-space: nowrap;
        }
        .rpt-table th.align-right { text-align: right; }

        .rpt-table tbody tr {
          border-bottom: 1px solid #f0ebe4;
          transition: background 0.12s;
        }
        .rpt-table tbody tr:last-child { border-bottom: none; }
        .rpt-table tbody tr:hover { background: #faf7f4; }

        .rpt-table td {
          padding: 0.85rem 1rem;
          color: #2d3748;
          vertical-align: middle;
        }
        .rpt-table td.align-right { text-align: right; }
        .rpt-table td.muted { color: #aaa; }

        /* User cell */
        .user-cell { display: flex; align-items: center; gap: 0.6rem; }
        .user-avatar {
          width: 28px; height: 28px;
          border-radius: 7px;
          background: rgba(201,168,76,0.12);
          border: 1px solid rgba(201,168,76,0.3);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          font-family: 'Cormorant Garamond', serif;
          font-size: 0.75rem;
          font-weight: 700;
          color: #c9a84c;
          text-transform: uppercase;
        }
        .user-name {
          font-weight: 500;
          color: #0f1f38;
          white-space: nowrap;
        }

        /* Zonal badge */
        .zonal-badge {
          display: inline-block;
          padding: 0.2rem 0.6rem;
          background: rgba(15,31,56,0.06);
          border: 1px solid rgba(15,31,56,0.1);
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 500;
          color: #0f1f38;
          white-space: nowrap;
        }

        /* Date cell */
        .date-cell { white-space: nowrap; color: #7a8394; font-size: 0.78rem; }

        /* Empty state */
        .rpt-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3.5rem 1rem;
          color: #9aa3b0;
          gap: 0.6rem;
        }
        .rpt-empty svg { opacity: 0.35; }
        .rpt-empty-text { font-size: 0.875rem; }

        /* ── Pagination ── */
        .rpt-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .pag-info {
          font-size: 0.78rem;
          color: #9aa3b0;
          font-weight: 300;
        }
        .pag-info strong { color: #0f1f38; font-weight: 500; }
        .pag-controls { display: flex; align-items: center; gap: 0.4rem; }

        .pag-btn {
          display: flex;
          align-items: center;
          gap: 0.3rem;
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
        .pag-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

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

      <div className="rpt-wrap">

        {/* ── Top bar ── */}
        <div className="rpt-topbar">
          <div className="rpt-title-group">
            <div className="rpt-eyebrow">Admin panel</div>
            <h1 className="rpt-title">Reports</h1>
          </div>

          <div className="rpt-filters">
            {/* Search */}
            <div className="filter-input-wrap">
              <span className="filter-icon">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </span>
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (setPage(1), load(1))}
                placeholder="Name or email…"
                className="filter-input"
                ref={searchRef}
              />
            </div>

            {/* City */}
            <div className="filter-input-wrap">
              <span className="filter-icon">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </span>
              <input
                value={city}
                onChange={e => setCity(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (setPage(1), load(1))}
                placeholder="City…"
                className="filter-input"
                style={{ width: 130 }}
              />
            </div>

            {/* Per page */}
            <select
              value={perPage}
              onChange={e => setPerPage(Number(e.target.value))}
              className="filter-select"
            >
              {[20, 50, 100].map(n => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>

            {/* Apply */}
            <button onClick={() => { setPage(1); load(1); }} className="btn-apply">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Apply
            </button>

            {/* Export */}
            <button onClick={exportCsv} className="btn-export" disabled={exporting || loading} title="Export all matching rows to CSV">
              {exporting ? (
                <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #c9a84c', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              )}
              Export CSV
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="rpt-card">
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="skel-row" key={i}>
                <div className="skel-cell" style={{ width: "14%", opacity: 1 - i * 0.08 }} />
                <div className="skel-cell" style={{ width: "18%", opacity: 1 - i * 0.08 }} />
                <div className="skel-cell" style={{ width: "12%", opacity: 1 - i * 0.08 }} />
                <div className="skel-cell" style={{ width: "10%", opacity: 1 - i * 0.08 }} />
                <div className="skel-cell" style={{ width: "10%", opacity: 1 - i * 0.08 }} />
                <div className="skel-cell" style={{ width: "9%",  opacity: 1 - i * 0.08 }} />
                <div className="skel-cell" style={{ width: "8%",  opacity: 1 - i * 0.08 }} />
                <div className="skel-cell" style={{ width: "10%", marginLeft: "auto", opacity: 1 - i * 0.08 }} />
              </div>
            ))}
          </div>
        ) : err ? (
          <div className="rpt-error">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {err}
          </div>
        ) : (
          <div className="rpt-card">
            <div className="rpt-table-wrap">
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Street</th>
                    <th>Barangay</th>
                    <th>City</th>
                    <th>Province</th>
                    <th>Zonal / sqm</th>
                    <th className="align-right">Created</th>
                    <th className="align-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar">
                            {(r.user?.name ?? r.user?.email ?? "?")
                              .split(" ").slice(0, 2).map(w => w[0]).join("")}
                          </div>
                          <span className="user-name">{r.user?.name || "—"}</span>
                        </div>
                      </td>
                      <td className={r.user?.email ? "" : "muted"}>{r.user?.email || "—"}</td>
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
                      <td className="align-right">
                        {r.file_path ? (
                          <a
                            href={`${backendBase}/storage/${r.file_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-export"
                          >
                            View PDF
                          </a>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={9}>
                        <div className="rpt-empty">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0f1f38" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                          <span className="rpt-empty-text">No reports found for the current filters.</span>
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
          <div className="rpt-pagination">
            <span className="pag-info">
              Showing <strong>{rows.length}</strong> of <strong>{meta.total ?? "—"}</strong> reports
            </span>
            <div className="pag-controls">
              <button
                className="pag-btn"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                Prev
              </button>

              <span className="pag-current">{currentPage}</span>

              <button
                className="pag-btn"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
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