"use client";

import { useEffect, useMemo, useState } from "react";
import { Coins, Info, X, ArrowRight, ShieldCheck, HelpCircle, User as UserIcon } from "lucide-react";
import { apiMe, backendBase, getToken } from "../lib/authClient";
import Link from "next/link";

type Me = {
  name?: string;
  role?: string | number;
  token_balance?: number | null;
};

type Props = {
  threshold?: number;
  remindAfterHours?: number;
};

const STORAGE_KEY_SNOOZE = "zv.lowbalance.snoozeUntil";
const STORAGE_KEY_LAST_SEEN = "zv.lowbalance.lastBalance";

export default function LowBalanceNotice({ threshold = 3, remindAfterHours = 24 }: Props) {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [lowUsers, setLowUsers] = useState<Array<{ id: number; name?: string; first_name?: string | null; last_name?: string | null; email: string; role?: string; token_balance: number }>>([]);

  const isAdmin = useMemo(() => {
    const r = (me?.role ?? "").toString().toLowerCase();
    return r.includes("admin");
  }, [me?.role]);

  const balance = typeof me?.token_balance === "number" ? me!.token_balance! : null;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const info = await apiMe();
        if (!mounted) return;
        setMe(info ?? null);
      } catch {
        if (!mounted) return;
        setMe(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (isAdmin) return;
    if (balance === null || balance === undefined) return;
    const now = Date.now();
    const snoozeUntil = Number(localStorage.getItem(STORAGE_KEY_SNOOZE) || 0);
    const lastSeen = Number(localStorage.getItem(STORAGE_KEY_LAST_SEEN) || -1);
    const below = balance <= threshold;
    const snoozed = now < snoozeUntil;
    const decreasedSinceLast = lastSeen >= 0 && balance < lastSeen;
    if (below && (!snoozed || decreasedSinceLast)) setOpen(true);
    localStorage.setItem(STORAGE_KEY_LAST_SEEN, String(balance));
  }, [loading, balance, threshold, isAdmin]);

  useEffect(() => {
    let ac: AbortController | null = null;
    async function run() {
      if (!isAdmin) return;
      const now = Date.now();
      const snoozeUntil = Number(localStorage.getItem(STORAGE_KEY_SNOOZE) || 0);
      const snoozed = now < snoozeUntil;
      try {
        const token = getToken();
        if (!token) return;
        ac = new AbortController();
        const res = await fetch(`${backendBase}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          signal: ac.signal,
        });
        if (!res.ok) return;
        const j = await res.json();
        const list: any[] = Array.isArray(j?.data) ? j.data : [];
        const lows = list
          .filter(u => (String(u?.role || '').toLowerCase() !== 'admin'))
          .filter(u => (Number(u?.token_balance) || 0) <= threshold)
          .sort((a, b) => (Number(a.token_balance) || 0) - (Number(b.token_balance) || 0));
        setLowUsers(lows.slice(0, 5));
        if (lows.length > 0 && !snoozed) setOpen(true);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    }
    run();
    return () => { ac?.abort(); };
  }, [isAdmin, threshold]);

  if (!open) return null;

  const critical = !isAdmin && (balance ?? Number.POSITIVE_INFINITY) <= 1;
  const snooze = (hours: number) => {
    const until = Date.now() + hours * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEY_SNOOZE, String(until));
    setOpen(false);
  };

  const primaryHref = isAdmin ? "/admin/users" : "/dashboard/request";
  const primaryLabel = isAdmin ? "Open Users" : "Request Tokens";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');

        .lbn-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .lbn-overlay {
          position: absolute;
          inset: 0;
          background: rgba(15,31,56,0.72);
          backdrop-filter: blur(4px);
        }

        /* ── Modal ── */
        .lbn-modal {
          position: relative;
          width: 100%;
          max-width: 560px;
          background: #fff;
          border-radius: 20px;
          box-shadow: 0 28px 72px rgba(15,31,56,0.32);
          overflow: hidden;
          font-family: 'DM Sans', sans-serif;
        }

        .lbn-accent {
          height: 4px;
        }
        .lbn-accent.warning  { background: linear-gradient(90deg, #c9a84c, #e8c96a); }
        .lbn-accent.critical { background: linear-gradient(90deg, #c0392b, #e74c3c); }

        /* ── Header ── */
        .lbn-header {
          padding: 1.75rem 1.75rem 1.1rem;
          display: flex;
          align-items: flex-start;
          gap: 1.1rem;
        }

        .lbn-icon-wrap {
          width: 52px; height: 52px;
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .lbn-icon-wrap.warning {
          background: rgba(201,168,76,0.12);
          border: 2px solid rgba(201,168,76,0.35);
          color: #c9a84c;
        }
        .lbn-icon-wrap.critical {
          background: rgba(192,57,43,0.08);
          border: 2px solid rgba(192,57,43,0.25);
          color: #c0392b;
        }

        .lbn-header-text { flex: 1; min-width: 0; }

        .lbn-eyebrow {
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          margin-bottom: 0.3rem;
        }
        .lbn-eyebrow.warning  { color: #c9a84c; }
        .lbn-eyebrow.critical { color: #c0392b; }

        .lbn-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.75rem;
          font-weight: 700;
          color: #0f1f38;
          line-height: 1.15;
        }

        .lbn-desc {
          margin-top: 0.55rem;
          font-size: 1rem;
          color: #3d4a5c;
          line-height: 1.7;
          font-weight: 400;
        }
        .lbn-desc strong {
          color: #0f1f38;
          font-weight: 700;
        }

        .lbn-close {
          flex-shrink: 0;
          width: 36px; height: 36px;
          border-radius: 10px;
          border: 1.5px solid #e2d9d0;
          background: #f9f6f2;
          display: flex; align-items: center; justify-content: center;
          color: #7a8394;
          cursor: pointer;
          transition: background 0.14s, color 0.14s, border-color 0.14s;
        }
        .lbn-close:hover { background: #f5f0eb; color: #0f1f38; border-color: #c9a84c; }

        /* ── Body ── */
        .lbn-body { padding: 0 1.75rem 1.75rem; }

        /* Users list */
        .lbn-users-card {
          background: #f9f6f2;
          border: 1px solid #e8e0d8;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 1.1rem;
        }
        .lbn-users-header {
          padding: 0.65rem 1rem;
          border-bottom: 1px solid #e8e0d8;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #9aa3b0;
        }
        .lbn-user-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.8rem 1rem;
          border-bottom: 1px solid #f0ebe4;
          transition: background 0.12s;
        }
        .lbn-user-row:last-child { border-bottom: none; }
        .lbn-user-row:hover { background: #f5f0eb; }

        .lbn-user-left { display: flex; align-items: center; gap: 0.7rem; min-width: 0; }
        .lbn-user-avatar {
          width: 36px; height: 36px;
          border-radius: 9px;
          background: rgba(201,168,76,0.12);
          border: 1.5px solid rgba(201,168,76,0.3);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          font-family: 'Cormorant Garamond', serif;
          font-size: 0.9rem;
          font-weight: 700;
          color: #c9a84c;
          text-transform: uppercase;
        }
        .lbn-user-name {
          font-size: 0.95rem;
          font-weight: 600;
          color: #0f1f38;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .lbn-user-email {
          font-size: 0.8rem;
          color: #9aa3b0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .lbn-user-right { display: flex; align-items: center; gap: 0.65rem; flex-shrink: 0; }
        .lbn-balance {
          font-size: 0.95rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .lbn-balance.critical { color: #c0392b; }
        .lbn-balance.warning  { color: #b8860b; }

        .lbn-topup-link {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.82rem;
          font-weight: 600;
          text-decoration: none;
          padding: 0.3rem 0.75rem;
          background: #0f1f38;
          color: #f5f0eb;
          border-radius: 7px;
          transition: background 0.14s;
        }
        .lbn-topup-link:hover { background: #182f52; }

        /* Info tip */
        .lbn-tip {
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          padding: 0.85rem 1rem;
          background: rgba(15,31,56,0.04);
          border-radius: 10px;
          margin-bottom: 1.25rem;
          font-size: 0.92rem;
          color: #3d4a5c;
          line-height: 1.6;
          font-weight: 400;
        }
        .lbn-tip svg { flex-shrink: 0; margin-top: 2px; color: #c9a84c; }

        /* ── Actions ── */
        .lbn-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem;
        }

        .lbn-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.8rem 1.4rem;
          border-radius: 10px;
          border: none;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          letter-spacing: 0.01em;
          transition: transform 0.13s, box-shadow 0.15s, background 0.15s;
        }
        .lbn-btn-primary.warning {
          background: #0f1f38;
          color: #f5f0eb;
          box-shadow: 0 3px 12px rgba(15,31,56,0.22);
        }
        .lbn-btn-primary.warning:hover {
          background: #182f52;
          transform: translateY(-1px);
          box-shadow: 0 5px 16px rgba(15,31,56,0.3);
        }
        .lbn-btn-primary.critical {
          background: #c0392b;
          color: #fff;
          box-shadow: 0 3px 12px rgba(192,57,43,0.28);
        }
        .lbn-btn-primary.critical:hover {
          background: #a93226;
          transform: translateY(-1px);
        }

        .lbn-btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.8rem 1.2rem;
          border-radius: 10px;
          border: 2px solid #e2d9d0;
          background: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.95rem;
          font-weight: 600;
          color: #0f1f38;
          cursor: pointer;
          transition: border-color 0.14s, background 0.14s;
        }
        .lbn-btn-secondary:hover { border-color: #c9a84c; background: #fdf9f3; }

        .lbn-btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.8rem 1rem;
          border-radius: 10px;
          border: none;
          background: transparent;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.92rem;
          font-weight: 500;
          color: #9aa3b0;
          cursor: pointer;
          transition: color 0.14s;
        }
        .lbn-btn-ghost:hover { color: #0f1f38; }

        /* ── Guide ── */
        .lbn-guide {
          margin-top: 1rem;
          background: #f9f6f2;
          border: 1px solid #e8e0d8;
          border-radius: 12px;
          padding: 1.1rem;
        }
        .lbn-guide-list {
          margin: 0; padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
        }
        .lbn-guide-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          font-size: 0.95rem;
          color: #3d4a5c;
          line-height: 1.6;
          font-weight: 400;
        }
        .lbn-guide-num {
          width: 24px; height: 24px;
          border-radius: 50%;
          background: #0f1f38;
          color: #f5f0eb;
          font-size: 0.72rem;
          font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .lbn-guide-item strong { color: #0f1f38; font-weight: 700; }

        .lbn-guide-footer {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.85rem;
          padding-top: 0.8rem;
          border-top: 1px solid #e8e0d8;
          font-size: 0.85rem;
          color: #7a8394;
          font-weight: 400;
        }
        .lbn-guide-footer svg { color: #c9a84c; flex-shrink: 0; }
      `}</style>

      <div className="lbn-backdrop" role="dialog" aria-modal="true" aria-labelledby="lbn-title">
        <div className="lbn-overlay" onClick={() => snooze(remindAfterHours)} />

        <div className="lbn-modal">
          <div className={`lbn-accent ${critical ? "critical" : "warning"}`} />

          {/* Header */}
          <div className="lbn-header">
            <div className={`lbn-icon-wrap ${critical ? "critical" : "warning"}`}>
              <Coins size={24} />
            </div>

            <div className="lbn-header-text">
              <div className={`lbn-eyebrow ${critical ? "critical" : "warning"}`}>
                {isAdmin ? "Admin Notice" : critical ? "Critical" : "Low Balance"}
              </div>
              <h2 id="lbn-title" className="lbn-title">
                {isAdmin
                  ? "Users with low token balance"
                  : critical
                  ? "You're almost out of tokens"
                  : "Low token balance"}
              </h2>
              <p className="lbn-desc">
                {isAdmin ? (
                  lowUsers.length > 0 ? (
                    <>The following user{lowUsers.length > 1 ? "s are" : " is"} running low. Top them up to avoid interruptions.</>
                  ) : (
                    <>Some accounts may be running low on tokens. Open Users to review balances.</>
                  )
                ) : (
                  <>You have <strong>{balance} token{balance === 1 ? "" : "s"}</strong> remaining. Request more to continue generating PDF reports without interruption.</>
                )}
              </p>
            </div>

            <button className="lbn-close" onClick={() => snooze(remindAfterHours)} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="lbn-body">

            {isAdmin && lowUsers.length > 0 && (
              <div className="lbn-users-card">
                <div className="lbn-users-header">Affected Users</div>
                {lowUsers.map(u => {
                  const full = [u.first_name || u.name, u.last_name].filter(Boolean).join(" ") || u.email;
                  const bal = Number(u.token_balance) || 0;
                  const initials = full.split(" ").slice(0, 2).map(w => w[0]).join("") || "?";
                  const href = `/admin/users?q=${encodeURIComponent(full || u.email)}&uid=${u.id}`;
                  return (
                    <div key={u.id} className="lbn-user-row">
                      <div className="lbn-user-left">
                        <div className="lbn-user-avatar">{initials}</div>
                        <div style={{ minWidth: 0 }}>
                          <div className="lbn-user-name">{full}</div>
                          <div className="lbn-user-email">{u.email}</div>
                        </div>
                      </div>
                      <div className="lbn-user-right">
                        <span className={`lbn-balance ${bal <= 1 ? "critical" : "warning"}`}>{bal} left</span>
                        <Link href={href} className="lbn-topup-link">
                          Top up <ArrowRight size={13} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="lbn-tip">
              <Info size={16} />
              Each detailed PDF uses 1 token. Draft previews may also use tokens depending on your settings.
            </div>

            <div className="lbn-actions">
              <Link href={primaryHref} className={`lbn-btn-primary ${critical ? "critical" : "warning"}`}>
                {primaryLabel} <ArrowRight size={16} />
              </Link>
              <button className="lbn-btn-secondary" onClick={() => setShowGuide(s => !s)}>
                <HelpCircle size={16} /> How to top up
              </button>
              <button className="lbn-btn-ghost" onClick={() => snooze(remindAfterHours)}>
                Remind me later
              </button>
            </div>

            {showGuide && (
              <div className="lbn-guide">
                <ol className="lbn-guide-list">
                  {(!isAdmin ? [
                    <>Click <strong>Request Tokens</strong> in the menu.</>,
                    <>Enter the <strong>number of tokens</strong> you need and a short note.</>,
                    <>Submit the request — you will be notified once it is approved.</>,
                    <>Return to the map and continue generating PDF reports.</>,
                  ] : [
                    <>Open <strong>Users</strong> to view all accounts.</>,
                    <>Click <strong>Top up</strong> next to the user who needs tokens.</>,
                    <>Optionally go to <strong>Requests</strong> and approve pending ones.</>,
                    <>Balances update immediately after topping up.</>,
                  ]).map((step, i) => (
                    <li key={i} className="lbn-guide-item">
                      <span className="lbn-guide-num">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <div className="lbn-guide-footer">
                  <ShieldCheck size={15} />
                  All changes are audited for security and compliance.
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}