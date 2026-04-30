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

  useEffect(() => {
    const qs = new URLSearchParams(searchParams?.toString() || "");
    if (query) qs.set("q", query); else qs.delete("q");
    if (page > 1) qs.set("page", String(page)); else qs.delete("page");
    if (pageSize !== 10) qs.set("size", String(pageSize)); else qs.delete("size");
    const next = `${pathname}?${qs.toString()}`;
    if (next !== urlSyncRef.current) {
      urlSyncRef.current = next;
      router.replace(next, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, page, pageSize]);

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
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap');

        .usr-wrap {
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
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
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #c9a84c;
          margin-bottom: 0.4rem;
        }
        .usr-eyebrow::before {
          content: '';
          display: inline-block;
          width: 18px;
          height: 2px;
          background: #c9a84c;
          border-radius: 2px;
        }
        .usr-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 2.2rem;
          font-weight: 700;
          color: #0f1f38;
          line-height: 1.1;
        }
        .usr-desc {
          margin-top: 0.3rem;
          font-size: 0.82rem;
          color: #9aa3b0;
        }
        .usr-count-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.45rem 1.1rem;
          background: rgba(201,168,76,0.08);
          border: 1px solid rgba(201,168,76,0.25);
          border-radius: 50px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #8a6d15;
          white-space: nowrap;
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
          min-width: 220px;
          max-width: 400px;
        }
        .filter-icon {
          position: absolute;
          left: 0.9rem;
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
          border-radius: 50px;
          padding: 0.62rem 1rem 0.62rem 2.5rem;
          font-size: 0.83rem;
          font-family: 'DM Sans', sans-serif;
          color: #0f1f38;
          outline: none;
          box-shadow: 0 1px 4px rgba(15,31,56,0.06);
          transition: border-color 0.16s, box-shadow 0.16s;
        }
        .filter-input::placeholder { color: #c0b8b0; }
        .filter-input:focus {
          border-color: #c9a84c;
          box-shadow: 0 0 0 3px rgba(201,168,76,0.12), 0 1px 4px rgba(15,31,56,0.06);
        }

        .toolbar-right { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .toolbar-label { font-size: 0.75rem; color: #9aa3b0; }
        .filter-select {
          background: #fff;
          border: 1.5px solid #e2d9d0;
          border-radius: 10px;
          padding: 0.58rem 0.8rem;
          font-size: 0.83rem;
          font-family: 'DM Sans', sans-serif;
          color: #0f1f38;
          outline: none;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(15,31,56,0.06);
          transition: border-color 0.16s;
        }
        .filter-select:focus { border-color: #c9a84c; }
        .btn-refresh {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: #fff;
          border: 1.5px solid #e2d9d0;
          border-radius: 10px;
          padding: 0.58rem 1rem;
          font-size: 0.83rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          color: #0f1f38;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(15,31,56,0.06);
          transition: all 0.15s;
        }
        .btn-refresh:hover {
          border-color: #c9a84c;
          background: #fffbf2;
          transform: translateY(-1px);
          box-shadow: 0 3px 10px rgba(201,168,76,0.15);
        }

        /* ── Card ── */
        .usr-card {
          background: #fff;
          border-radius: 16px;
          border: 1px solid #eae2d9;
          box-shadow: 0 2px 12px rgba(15,31,56,0.06), 0 4px 24px rgba(15,31,56,0.04);
          overflow: hidden;
        }

        /* ── Skeleton ── */
        .skel-row {
          display: flex;
          gap: 1rem;
          padding: 1.1rem 1.5rem;
          border-bottom: 1px solid #f5f0eb;
          align-items: center;
        }
        .skel-bar {
          background: linear-gradient(90deg, #f5f0eb 25%, #ede8e0 50%, #f5f0eb 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 6px;
          height: 13px;
          flex-shrink: 0;
        }
        @keyframes shimmer { to { background-position: -200% 0; } }

        /* ── Error ── */
        .usr-error {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 1.1rem 1.4rem;
          background: #fff5f5;
          border: 1px solid #fecaca;
          border-radius: 14px;
          font-size: 0.85rem;
          color: #dc2626;
        }

        /* ── Table ── */
        .usr-table-wrap { overflow-x: auto; }
        .usr-table {
          width: 100%;
          min-width: 680px;
          border-collapse: collapse;
          font-size: 0.835rem;
        }
        .usr-table thead tr {
          border-bottom: 1.5px solid #f0ebe4;
        }
        .usr-table th {
          padding: 0.9rem 1.4rem;
          text-align: left;
          font-size: 0.66rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #9aa3b0;
          background: #faf8f5;
          white-space: nowrap;
        }
        .usr-table th.align-right { text-align: right; }
        .usr-table tbody tr {
          border-bottom: 1px solid #f5f0eb;
          transition: background 0.12s;
        }
        .usr-table tbody tr:last-child { border-bottom: none; }
        .usr-table tbody tr:hover { background: #faf7f3; }
        .usr-table td {
          padding: 0.9rem 1.4rem;
          color: #374151;
          vertical-align: middle;
        }
        .usr-table td.align-right { text-align: right; }

        /* User cell */
        .user-cell { display: flex; align-items: center; gap: 0.8rem; }
        .user-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #0f1f38;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.75rem;
          font-weight: 700;
          color: #fff;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          box-shadow: 0 2px 8px rgba(15,31,56,0.2);
        }
        .user-info { display: flex; flex-direction: column; gap: 0.1rem; }
        .user-name {
          font-weight: 600;
          color: #0f1f38;
          font-size: 0.84rem;
          white-space: nowrap;
        }
        .user-email-sub {
          font-size: 0.74rem;
          color: #9aa3b0;
        }

        /* Role badge */
        .role-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.27rem 0.75rem;
          border-radius: 50px;
          font-size: 0.67rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .role-admin {
          background: rgba(15,31,56,0.08);
          color: #0f1f38;
          border: 1px solid rgba(15,31,56,0.15);
        }
        .role-client {
          background: rgba(59,130,246,0.08);
          color: #2563eb;
          border: 1px solid rgba(59,130,246,0.18);
        }

        /* Token balance */
        .token-wrap {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.28rem 0.7rem;
          background: rgba(201,168,76,0.08);
          border: 1px solid rgba(201,168,76,0.22);
          border-radius: 50px;
          color: #8a6d15;
          font-weight: 600;
          font-size: 0.82rem;
          font-variant-numeric: tabular-nums;
        }

        /* Top-up cell */
        .topup-cell { display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem; }
        .topup-input {
          width: 78px;
          background: #faf8f5;
          border: 1.5px solid #e2d9d0;
          border-radius: 10px;
          padding: 0.46rem 0.65rem;
          font-size: 0.82rem;
          font-family: 'DM Sans', sans-serif;
          color: #0f1f38;
          text-align: right;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .topup-input:focus {
          border-color: #c9a84c;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(201,168,76,0.1);
        }
        .btn-add {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          background: #0f1f38;
          color: #f5f0eb;
          border: none;
          border-radius: 10px;
          padding: 0.46rem 0.95rem;
          font-size: 0.78rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
          box-shadow: 0 2px 8px rgba(15,31,56,0.18);
        }
        .btn-add:hover:not(:disabled) {
          background: #1a3358;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(15,31,56,0.26);
        }
        .btn-add:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

        /* Empty state */
        .usr-empty {
          padding: 3.5rem 1.5rem;
          text-align: center;
        }
        .usr-empty-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: #f5f0eb;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #c0b8b0;
          margin-bottom: 0.85rem;
        }
        .usr-empty-title { font-size: 0.9rem; font-weight: 600; color: #6b7585; margin-bottom: 0.25rem; }
        .usr-empty-sub { font-size: 0.8rem; color: #b0b8c4; }

        /* ── Pagination ── */
        .usr-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .pag-info { font-size: 0.78rem; color: #9aa3b0; }
        .pag-info strong { color: #0f1f38; font-weight: 600; }
        .pag-controls { display: flex; align-items: center; gap: 0.4rem; }
        .pag-btn {
          display: flex; align-items: center; gap: 0.3rem;
          padding: 0.5rem 0.95rem;
          background: #fff;
          border: 1.5px solid #e2d9d0;
          border-radius: 10px;
          font-size: 0.78rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          color: #0f1f38;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(15,31,56,0.06);
          transition: all 0.15s;
        }
        .pag-btn:hover:not(:disabled) {
          border-color: #c9a84c;
          background: #fffbf2;
          transform: translateY(-1px);
        }
        .pag-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
        .pag-current {
          padding: 0.5rem 0.9rem;
          background: #0f1f38;
          color: #f5f0eb;
          border-radius: 10px;
          font-size: 0.78rem;
          font-weight: 600;
          min-width: 44px;
          text-align: center;
          letter-spacing: 0.04em;
        }

        .usr-row-highlight { box-shadow: inset 0 0 0 9999px rgba(201,168,76,0.1); transition: box-shadow 1.8s ease; }
      `}</style>

      <div className="usr-wrap">

        {/* ── Header ── */}
        <div className="usr-header">
          <div>
            <div className="usr-eyebrow">Admin Panel</div>
            <h1 className="usr-title">Users</h1>
            <p className="usr-desc">Manage registered users and token balances</p>
          </div>
          {!loading && (
            <div className="usr-count-badge">
              {filtered.length} {filtered.length === 1 ? "user" : "users"}
            </div>
          )}
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
                <div className="skel-bar" style={{ width: 38, height: 38, borderRadius: "50%", opacity: 1 - i * 0.1 }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <div className="skel-bar" style={{ width: "28%", opacity: 1 - i * 0.1 }} />
                  <div className="skel-bar" style={{ width: "38%", height: 10, opacity: 0.6 - i * 0.08 }} />
                </div>
                <div className="skel-bar" style={{ width: "8%", opacity: 1 - i * 0.1 }} />
                <div className="skel-bar" style={{ width: "7%", opacity: 1 - i * 0.1 }} />
                <div className="skel-bar" style={{ width: 120, height: 30, borderRadius: 10, opacity: 1 - i * 0.1 }} />
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
                    <th>User</th>
                    <th>Role</th>
                    <th className="align-right">Tokens</th>
                    <th className="align-right">Top Up</th>
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
                            <div className="user-info">
                              <span className="user-name">{fullName}</span>
                              <span className="user-email-sub">{u.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`role-badge ${u.role === "admin" ? "role-admin" : "role-client"}`}>
                            {u.role === "admin" && (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                            )}
                            {u.role}
                          </span>
                        </td>
                        <td className="align-right">
                          <span className="token-wrap">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/>
                            </svg>
                            {(Number(u.token_balance) || 0).toLocaleString()}
                          </span>
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
                      <td colSpan={4}>
                        <div className="usr-empty">
                          <div className="usr-empty-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>
                          </div>
                          <div className="usr-empty-title">No users found</div>
                          <div className="usr-empty-sub">Try adjusting your search query</div>
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
        <div className="usr-pagination">
          <span className="pag-info">
            Showing <strong>{sliceStart + 1}–{Math.min(sliceEnd, filtered.length)}</strong> of <strong>{filtered.length}</strong> users
          </span>
          <div className="pag-controls">
            <button className="pag-btn" disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              Prev
            </button>
            <span className="pag-current">{currentPage} / {totalPages}</span>
            <button className="pag-btn" disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
              Next
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
        </div>

      </div>
    </>
  );
}
