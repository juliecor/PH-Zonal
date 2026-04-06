"use client";

import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { backendBase, getToken, apiAdminListTokenRequests } from "../../lib/authClient";
import { toast } from "sonner";
import AdminKpis from "../../components/AdminKpis";

type User = {
  id: number;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  email: string;
  role: string;
  token_balance: number;
};

export default function AdminUsersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const spQ = (searchParams?.get("q") || "").trim();
  const spUid = Number(searchParams?.get("uid") || 0) || null;
  const spPage = Number(searchParams?.get("page") || 1) || 1;
  const spSize = Number(searchParams?.get("size") || 10) || 10;
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState(spQ);
  const [topup, setTopup] = useState<Record<number, number>>({});
  const [pending, setPending] = useState(0);
  const [page, setPage] = useState(spPage);
  const [pageSize, setPageSize] = useState(spSize);
  const [addingFor, setAddingFor] = useState<number | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(spUid);
  const urlSyncRef = useRef<string>("");
  const searchRef = useRef<HTMLInputElement | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  async function load() {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setErr("");
    try {
      const token = getToken();
      const [usersRes, pendingJson] = await Promise.all([
        fetch(`${backendBase}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: ac.signal,
        }),
        apiAdminListTokenRequests("pending").catch(() => null),
      ]);
      if (ac.signal.aborted) return;
      if (!usersRes.ok) throw new Error(`${usersRes.status}`);
      const j = await usersRes.json();
      const list = Array.isArray(j?.data) ? j.data : [];
      startTransition(() => {
        setRows(list);
        setPending(Array.isArray((pendingJson as any)?.data) ? (pendingJson as any).data.length : 0);
      });
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      const msg = e?.message || "Failed to load users";
      setErr(msg);
      try { (await import("sonner")).toast.error(msg); } catch {}
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // After load, if a uid was provided, scroll it into view and briefly highlight
  useEffect(() => {
    if (loading) return;
    if (!highlightId) return;
    const el = document.getElementById(`user-${highlightId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("usr-row-highlight");
      const t = setTimeout(() => el.classList.remove("usr-row-highlight"), 2000);
      return () => clearTimeout(t);
    }
  }, [loading, highlightId]);

  // Persist filters to URL (query, page, size) without scrolling
  useEffect(() => {
    const qs = new URLSearchParams(searchParams?.toString() || "");
    if (query) qs.set("q", query); else qs.delete("q");
    if (page > 1) qs.set("page", String(page)); else qs.delete("page");
    if (pageSize !== 10) qs.set("size", String(pageSize)); else qs.delete("size");
    // keep uid if present
    const next = `${pathname}?${qs.toString()}`;
    if (next !== urlSyncRef.current) {
      urlSyncRef.current = next;
      router.replace(next, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, page, pageSize]);

  // Keyboard shortcut: '/' focuses the search field
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '/' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        const el = searchRef.current;
        if (el) {
          e.preventDefault();
          el.focus();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function addTokens(id: number) {
    const add = Number(topup[id] || 0);
    if (!Number.isFinite(add) || add <= 0) return alert("Enter a valid amount");
    setAddingFor(id);
    try {
      const token = getToken();
      const res = await fetch(`${backendBase}/api/admin/users/${id}/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ add }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setTopup((m) => ({ ...m, [id]: 0 }));
      setRows((list) => list.map((u) => (u.id === id ? { ...u, token_balance: (Number(u.token_balance) || 0) + add } : u)));
      toast.success(`Added ${add} tokens`);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to add tokens");
    } finally {
      setAddingFor(null);
    }
  }

  const filtered = useMemo(() => {
    const base = rows.filter(u => (u.role || "").toLowerCase() !== "admin");
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(u => `${u.first_name || ""} ${u.last_name || ""} ${u.email}`.toLowerCase().includes(q));
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const sliceStart = (currentPage - 1) * pageSize;
  const sliceEnd = sliceStart + pageSize;
  const paged = filtered.slice(sliceStart, sliceEnd);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');

        .usr-wrap {
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* ── Header ── */
        .usr-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .usr-eyebrow {
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #c9a84c;
          margin-bottom: 0.2rem;
        }
        .usr-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.9rem;
          font-weight: 700;
          color: #0f1f38;
          line-height: 1.1;
        }

        /* ── Toolbar ── */
        .usr-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .filter-input-wrap {
          position: relative;
          flex: 1;
          min-width: 200px;
          max-width: 340px;
        }
        .filter-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: #9aa3b0;
          pointer-events: none;
          display: flex;
          align-items: center;
        }
        .filter-input {
          width: 100%;
          box-sizing: border-box;
          background: #fff;
          border: 1.5px solid #e2d9d0;
          border-radius: 9px;
          padding: 0.55rem 0.8rem 0.55rem 2.15rem;
          font-size: 0.825rem;
          font-family: 'DM Sans', sans-serif;
          color: #0f1f38;
          outline: none;
          transition: border-color 0.16s, box-shadow 0.16s;
        }
        .filter-input::placeholder { color: #bbb5ae; }
        .filter-input:focus {
          border-color: #c9a84c;
          box-shadow: 0 0 0 3px rgba(201,168,76,0.1);
        }

        .toolbar-right { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }

        .toolbar-label {
          font-size: 0.75rem;
          color: #9aa3b0;
          font-weight: 300;
        }
        .filter-select {
          background: #fff;
          border: 1.5px solid #e2d9d0;
          border-radius: 9px;
          padding: 0.52rem 0.75rem;
          font-size: 0.825rem;
          font-family: 'DM Sans', sans-serif;
          color: #0f1f38;
          outline: none;
          cursor: pointer;
          transition: border-color 0.16s;
        }
        .filter-select:focus { border-color: #c9a84c; }

        .btn-refresh {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          background: #fff;
          border: 1.5px solid #e2d9d0;
          border-radius: 9px;
          padding: 0.52rem 0.85rem;
          font-size: 0.825rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          color: #0f1f38;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s, transform 0.12s;
        }
        .btn-refresh:hover {
          border-color: #c9a84c;
          background: #fdf9f3;
          transform: translateY(-1px);
        }

        /* ── Card ── */
        .usr-card {
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
          align-items: center;
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
        .usr-error {
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
        .usr-table-wrap { overflow-x: auto; }
        .usr-table {
          width: 100%;
          min-width: 700px;
          border-collapse: collapse;
          font-size: 0.825rem;
        }
        .usr-table thead tr {
          background: #f9f6f2;
          border-bottom: 1.5px solid #e8e0d8;
        }
        .usr-table th {
          padding: 0.8rem 1rem;
          text-align: left;
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #6b7585;
          white-space: nowrap;
        }
        .usr-table th.align-right { text-align: right; }

        .usr-table tbody tr {
          border-bottom: 1px solid #f0ebe4;
          transition: background 0.12s;
        }
        .usr-table tbody tr:last-child { border-bottom: none; }
        .usr-table tbody tr:hover { background: #faf7f4; }
        .usr-table td {
          padding: 0.85rem 1rem;
          color: #2d3748;
          vertical-align: middle;
        }
        .usr-table td.align-right { text-align: right; }

        /* User cell */
        .user-cell { display: flex; align-items: center; gap: 0.65rem; }
        .user-avatar {
          width: 32px; height: 32px;
          border-radius: 8px;
          background: rgba(201,168,76,0.12);
          border: 1.5px solid rgba(201,168,76,0.3);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          font-family: 'Cormorant Garamond', serif;
          font-size: 0.85rem;
          font-weight: 700;
          color: #c9a84c;
          text-transform: uppercase;
        }
        .user-name {
          font-weight: 500;
          color: #0f1f38;
          white-space: nowrap;
        }

        /* Role badge */
        .role-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.2rem 0.6rem;
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 500;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .role-admin {
          background: rgba(15,31,56,0.08);
          color: #0f1f38;
          border: 1px solid rgba(15,31,56,0.15);
        }
        .role-user {
          background: rgba(201,168,76,0.1);
          color: #9a7a20;
          border: 1px solid rgba(201,168,76,0.25);
        }

        /* Token balance */
        .token-balance {
          font-weight: 600;
          color: #0f1f38;
          font-variant-numeric: tabular-nums;
        }

        /* Top-up cell */
        .topup-cell { display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem; }
        .topup-input {
          width: 80px;
          background: #fff;
          border: 1.5px solid #e2d9d0;
          border-radius: 8px;
          padding: 0.42rem 0.6rem;
          font-size: 0.82rem;
          font-family: 'DM Sans', sans-serif;
          color: #0f1f38;
          text-align: right;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .topup-input:focus {
          border-color: #c9a84c;
          box-shadow: 0 0 0 3px rgba(201,168,76,0.1);
        }
        .btn-add {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          background: #0f1f38;
          color: #f5f0eb;
          border: none;
          border-radius: 8px;
          padding: 0.42rem 0.85rem;
          font-size: 0.78rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s, transform 0.12s, box-shadow 0.15s;
          box-shadow: 0 2px 8px rgba(15,31,56,0.16);
        }
        .btn-add:hover:not(:disabled) {
          background: #182f52;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(15,31,56,0.22);
        }
        .btn-add:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        /* ── Pagination ── */
        .usr-pagination {
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
      <style>{`
        .usr-row-highlight { box-shadow: inset 0 0 0 9999px rgba(201,168,76,0.12); transition: box-shadow 1.8s ease; }
      `}</style>

      <div className="usr-wrap">

        {/* ── Header ── */}
        <div className="usr-header">
          <div>
            <div className="usr-eyebrow">Admin panel</div>
            <h1 className="usr-title">Users</h1>
          </div>
        </div>

        {/* ── KPIs ── */}
        <AdminKpis
          totalUsers={rows.length}
          pendingRequests={pending}
          totalTokens={rows.reduce((sum, r) => sum + (Number(r.token_balance) || 0), 0)}
        />

        {/* ── Toolbar ── */}
        <div className="usr-toolbar">
          <div className="filter-input-wrap">
            <span className="filter-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </span>
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search name or email…"
              className="filter-input"
              ref={searchRef}
            />
          </div>

          <div className="toolbar-right">
            <span className="toolbar-label">Rows</span>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="filter-select">
              {[10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button onClick={load} className="btn-refresh">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="usr-card">
            {Array.from({ length: 5 }).map((_, i) => (
              <div className="skel-row" key={i}>
                <div className="skel-bar" style={{ width: 32, height: 32, borderRadius: 8, opacity: 1 - i * 0.1 }} />
                <div className="skel-bar" style={{ width: "18%", opacity: 1 - i * 0.1 }} />
                <div className="skel-bar" style={{ width: "22%", opacity: 1 - i * 0.1 }} />
                <div className="skel-bar" style={{ width: "8%", opacity: 1 - i * 0.1 }} />
                <div className="skel-bar" style={{ width: "6%", marginLeft: "auto", opacity: 1 - i * 0.1 }} />
                <div className="skel-bar" style={{ width: 100, height: 28, borderRadius: 8, opacity: 1 - i * 0.1 }} />
              </div>
            ))}
          </div>
        ) : err ? (
          <div className="usr-error">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {err}
          </div>
        ) : (
          <div className="usr-card">
            <div className="usr-table-wrap">
              <table className="usr-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th className="align-right">Tokens</th>
                    <th className="align-right">Top up</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(u => {
                    const fullName = [u.first_name || u.name, u.last_name].filter(Boolean).join(" ");
                    const initials = fullName.split(" ").slice(0, 2).map(w => w[0]).join("") || "?";
                    return (
                      <tr key={u.id} id={`user-${u.id}`}>
                        <td>
                          <div className="user-cell">
                            <div className="user-avatar">{initials}</div>
                            <span className="user-name">{fullName}</span>
                          </div>
                        </td>
                        <td style={{ color: "#6b7585", fontSize: "0.82rem" }}>{u.email}</td>
                        <td>
                          <span className={`role-badge ${u.role === "admin" ? "role-admin" : "role-user"}`}>
                            {u.role === "admin" && (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                            )}
                            {u.role}
                          </span>
                        </td>
                        <td className="align-right">
                          <span className="token-balance">{(Number(u.token_balance) || 0).toLocaleString()}</span>
                        </td>
                        <td className="align-right">
                          <div className="topup-cell">
                            <input
                              type="number"
                              min={1}
                              value={topup[u.id] ?? ""}
                              onChange={e => setTopup(m => ({ ...m, [u.id]: Number(e.target.value) }))}
                              placeholder="0"
                              className="topup-input"
                            />
                            <button
                              onClick={() => addTokens(u.id)}
                              disabled={addingFor === u.id}
                              className="btn-add"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                              </svg>
                              Add
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: "3rem 1rem", textAlign: "center", color: "#9aa3b0", fontSize: "0.85rem" }}>
                        No users match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Pagination ── */}
        <div className="usr-pagination">
          <span className="pag-info">
            Showing <strong>{sliceStart + 1}–{Math.min(sliceEnd, filtered.length)}</strong> of <strong>{filtered.length}</strong> users
          </span>
          <div className="pag-controls">
            <button
              className="pag-btn"
              disabled={currentPage <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              Prev
            </button>
            <span className="pag-current">{currentPage} / {totalPages}</span>
            <button
              className="pag-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              Next
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
        </div>

      </div>
    </>
  );
}