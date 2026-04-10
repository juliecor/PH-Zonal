"use client";

import DashboardSidebar from "../components/DashboardSidebar";
import LowBalanceNotice from "../components/LowBalanceNotice";
import { User, Coins, FileText, Home, Bell, X, PenLine } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

// Try to import apiMe, but don't fail if it doesn't exist yet
let apiMe: any = null;
try {
  const authClient = require("../../lib/authClient");
  apiMe = authClient.apiMe;
} catch (e) {
  console.warn("authClient not found, using mock data");
  apiMe = async () => ({
    name: "Test User",
    email: "test@example.com",
    token_balance: 5,
    role: "user"
  });
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [me, setMe] = useState<any>(null);

  /* ── Edit profile modal ── */
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  async function fetchUserData() {
    try {
      const data = await apiMe();
      if (data) {
        setMe(data);
        setTokenBalance(data.token_balance ?? 0);
        setUserName(data.name ?? data.email ?? "User");
      }
    } catch (error) {
      console.error("Failed to fetch user data:", error);
      setTokenBalance(5);
      setUserName("User");
    }
  }

  useEffect(() => { fetchUserData(); }, []);

  function openEdit() {
    setEditName(me?.name ?? "");
    setEditEmail(me?.email ?? "");
    setEditOpen(true);
  }

  async function saveEdit() {
    setEditSaving(true);
    try {
      // TODO: replace with your actual update API call
      // await apiUpdateMe({ name: editName, email: editEmail });
      setMe((prev: any) => ({ ...prev, name: editName, email: editEmail }));
      setUserName(editName || editEmail || "User");
      toast.success("Profile updated");
      setEditOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to update profile");
    } finally {
      setEditSaving(false);
    }
  }

  const initials = ((me?.name ?? me?.email ?? "?"))
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  const isLowBalance = tokenBalance !== null && tokenBalance <= 3;
  const isZeroBalance = tokenBalance !== null && tokenBalance === 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');

        /* Root fills the entire viewport */
        .cl-root {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f5f0eb;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
        }

        /* ── Top bar ── */
        .cl-topbar {
          flex-shrink: 0;
          background: #0f1f38;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 2rem;
          height: 56px;
          box-shadow: 0 2px 16px rgba(15,31,56,0.18);
        }
        .cl-topbar-logo {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          text-decoration: none;
        }
        .cl-topbar-mark {
          width: 30px; height: 30px;
          border: 1.5px solid #c9a84c;
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          color: #c9a84c;
        }
        .cl-topbar-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.1rem;
          font-weight: 600;
          color: #f5f0eb;
          letter-spacing: 0.02em;
        }

        /* ── Body ── */
        .cl-body {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: 260px 1fr;
          overflow: hidden;
        }

        @media (max-width: 860px) {
          .cl-body { grid-template-columns: 1fr; }
        }

        /* ── Sidebar ── */
        .cl-sidebar-wrap {
          height: 100%;
          overflow: hidden;
          padding: 1.5rem 1rem 1.5rem 1.5rem;
          box-sizing: border-box;
        }

        /* ── Main content ── */
        .cl-main {
          height: 100%;
          overflow-y: auto;
          padding: 2rem 1.5rem 2rem 0.75rem;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          min-width: 0;
        }

        /* ── Sidebar profile header ── */
        .sb-profile-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 0.25rem 1rem;
          border-bottom: 1px solid rgba(15,31,56,0.08);
          margin-bottom: 0.75rem;
        }
        .sb-profile-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .sb-profile-av-btn {
          width: 48px; 
          height: 48px;
          border-radius: 14px;
          background: #0f1f38;
          border: 2px solid rgba(201,168,76,0.5);
          display: flex; 
          align-items: center; 
          justify-content: center;
          cursor: pointer;
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.2rem; 
          font-weight: 700; 
          color: #c9a84c;
          text-transform: uppercase; 
          user-select: none;
          transition: border-color 0.16s, transform 0.13s;
          flex-shrink: 0;
          position: relative;
        }
        .sb-profile-av-btn:hover {
          border-color: #c9a84c;
          transform: translateY(-1px);
        }
        /* Small pin icon positioned near the profile icon */
        .sb-edit-icon {
          position: absolute;
          bottom: -2px;
          right: -6px;
          background: #c9a84c;
          border-radius: 50%;
          padding: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1.5px solid #fff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .sb-edit-icon:hover {
          background: #b8922e;
          transform: scale(1.05);
        }
        .sb-profile-info {}
        .sb-profile-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: #0f1f38;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 130px;
        }
        .sb-profile-role {
          font-size: 0.68rem;
          color: #9aa3b0;
          text-transform: capitalize;
          margin-top: 2px;
        }

        /* ── Edit Profile Modal ── */
        .ep-overlay {
          position: fixed; inset: 0;
          background: rgba(15,31,56,0.4);
          backdrop-filter: blur(4px);
          z-index: 200;
          display: flex; align-items: center; justify-content: center;
          padding: 1rem;
          animation: epFadeIn 0.18s ease;
        }
        @keyframes epFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .ep-modal {
          background: #fff;
          border-radius: 18px;
          border: 1px solid #e8e0d8;
          box-shadow: 0 20px 60px rgba(15,31,56,0.2);
          width: 100%; max-width: 440px;
          overflow: hidden;
          animation: epSlideUp 0.2s ease;
        }
        @keyframes epSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .ep-head {
          background: #0f1f38;
          padding: 1.4rem 1.5rem;
          display: flex; align-items: center; justify-content: space-between;
          position: relative; overflow: hidden;
        }
        .ep-head::after {
          content: ''; position: absolute; inset: 0;
          background: repeating-linear-gradient(-55deg, transparent, transparent 32px, rgba(201,168,76,0.025) 32px, rgba(201,168,76,0.025) 33px);
        }
        .ep-head-left {
          display: flex; align-items: center; gap: 0.75rem; z-index: 1;
        }
        .ep-head-av {
          width: 48px; height: 48px; border-radius: 14px;
          background: rgba(201,168,76,0.15);
          border: 2px solid rgba(201,168,76,0.5);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.2rem; font-weight: 700; color: #c9a84c;
        }
        .ep-head-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.2rem; font-weight: 700; color: #f5f0eb;
        }
        .ep-head-sub { font-size: 0.72rem; color: rgba(245,240,235,0.5); margin-top: 0.1rem; }
        .ep-close {
          z-index: 1;
          width: 30px; height: 30px; border-radius: 8px;
          background: rgba(245,240,235,0.1);
          border: 1px solid rgba(245,240,235,0.15);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: rgba(245,240,235,0.7);
          transition: background 0.15s, color 0.15s;
        }
        .ep-close:hover { background: rgba(245,240,235,0.18); color: #f5f0eb; }
        .ep-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.1rem; }
        .ep-field { display: flex; flex-direction: column; gap: 0.4rem; }
        .ep-label {
          font-size: 0.68rem; font-weight: 500;
          letter-spacing: 0.1em; text-transform: uppercase; color: #6b7585;
        }
        .ep-input {
          background: #f9f6f2; border: 1.5px solid #e2d9d0;
          border-radius: 9px; padding: 0.72rem 0.9rem;
          font-size: 0.875rem; font-family: 'DM Sans', sans-serif; color: #0f1f38;
          outline: none; transition: border-color 0.16s, box-shadow 0.16s;
        }
        .ep-input:focus {
          border-color: #c9a84c;
          box-shadow: 0 0 0 3px rgba(201,168,76,0.1); background: #fff;
        }
        .ep-footer {
          padding: 0.75rem 1.5rem 1.5rem;
          display: flex; align-items: center; justify-content: flex-end; gap: 0.65rem;
          border-top: 1px solid #f0ebe4;
        }
        .ep-btn-cancel {
          padding: 0.58rem 1.1rem;
          background: #f9f6f2; border: 1.5px solid #e2d9d0; border-radius: 9px;
          font-family: 'DM Sans', sans-serif; font-size: 0.83rem; font-weight: 500;
          color: #6b7585; cursor: pointer; transition: border-color 0.15s;
        }
        .ep-btn-cancel:hover { border-color: #c9a84c; color: #0f1f38; }
        .ep-btn-save {
          display: flex; align-items: center; gap: 0.4rem;
          padding: 0.58rem 1.2rem; background: #0f1f38;
          color: #f5f0eb; border: none; border-radius: 9px;
          font-family: 'DM Sans', sans-serif; font-size: 0.83rem; font-weight: 500;
          cursor: pointer; transition: background 0.18s, transform 0.13s;
          box-shadow: 0 2px 10px rgba(15,31,56,0.18);
        }
        .ep-btn-save:hover:not(:disabled) { background: #182f52; transform: translateY(-1px); }
        .ep-btn-save:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
        .ep-spinner {
          width: 13px; height: 13px;
          border: 2px solid rgba(245,240,235,0.3);
          border-top-color: #f5f0eb; border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Notification bell ── */
        @keyframes ring {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(15deg); }
          50% { transform: rotate(-15deg); }
          75% { transform: rotate(15deg); }
          100% { transform: rotate(0deg); }
        }
        .bell-ring { animation: ring 0.5s ease-in-out; }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
        }
        .animate-pulse { animation: pulse 1.5s ease-in-out infinite; }
      `}</style>

      <div className="cl-root">

        {/* ── Top bar ── */}
        <header className="cl-topbar">
          <div className="cl-topbar-logo">
            <div className="cl-topbar-mark">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 9 12 2 21 9 21 22 3 22" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className="cl-topbar-name">Zonal Value</span>
          </div>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotificationModal(true)}
              className="bg-white/10 hover:bg-white/20 transition rounded-xl p-2 relative"
              title="Notifications"
            >
              <Bell size={20} className="text-white" />
              {(isLowBalance || isZeroBalance) && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
              )}
            </button>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="cl-body">
          <LowBalanceNotice threshold={3} remindAfterHours={24} />

          {/* ── Sidebar ── */}
          <aside className="cl-sidebar-wrap">
            {/* Profile header with medium profile icon and small pin icon */}
            <div className="sb-profile-header">
              <div className="sb-profile-left">
                {/* Profile avatar - medium size */}
                <div className="sb-profile-av-btn" onClick={openEdit} style={{ position: 'relative', cursor: 'pointer' }}>
                  {me ? initials : <User size={20} />}
                  {/* Small pin icon positioned very near the profile icon */}
                  <div className="sb-edit-icon" onClick={(e) => { e.stopPropagation(); openEdit(); }}>
                    <PenLine size={10} />
                  </div>
                </div>
                <div className="sb-profile-info">
                  <div className="sb-profile-name">{me?.name ?? me?.email ?? "—"}</div>
                  {me?.role && <div className="sb-profile-role">{me.role}</div>}
                </div>
              </div>
            </div>

            <DashboardSidebar
              title=""
              links={[
                { href: "/welcome",           label: "Home",           icon: <Home size={16} /> },
                { href: "/dashboard/request", label: "Request Tokens", icon: <Coins size={16} /> },
                { href: "/dashboard/reports", label: "Reports",        icon: <FileText size={16} /> },
              ]}
            />
          </aside>

          {/* ── Page content ── */}
          <main className="cl-main">
            {children}
          </main>
        </div>
      </div>

      {/* ══════════════════════════════
          EDIT PROFILE MODAL
      ══════════════════════════════ */}
      {editOpen && (
        <div className="ep-overlay" onClick={e => { if (e.target === e.currentTarget) setEditOpen(false); }}>
          <div className="ep-modal">
            <div className="ep-head">
              <div className="ep-head-left">
                <div className="ep-head-av">{initials}</div>
                <div>
                  <div className="ep-head-title">Edit Profile</div>
                  <div className="ep-head-sub">Update your account details</div>
                </div>
              </div>
              <button className="ep-close" onClick={() => setEditOpen(false)}>
                <X size={14} />
              </button>
            </div>

            <div className="ep-body">
              <div className="ep-field">
                <label className="ep-label">Full Name</label>
                <input
                  className="ep-input"
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div className="ep-field">
                <label className="ep-label">Email Address</label>
                <input
                  className="ep-input"
                  type="email"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div className="ep-footer">
              <button className="ep-btn-cancel" onClick={() => setEditOpen(false)}>Cancel</button>
              <button className="ep-btn-save" disabled={editSaving} onClick={saveEdit}>
                {editSaving
                  ? <span className="ep-spinner" />
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                }
                {editSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════
          NOTIFICATION MODAL
      ══════════════════════════════ */}
      {showNotificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className={`px-5 py-4 border-b flex items-center justify-between ${
              isZeroBalance
                ? "bg-red-50 border-red-100"
                : isLowBalance
                ? "bg-amber-50 border-amber-100"
                : "bg-blue-50 border-blue-100"
            }`}>
              <div className="flex items-center gap-2">
                <Bell size={18} className={isZeroBalance ? "text-red-600" : isLowBalance ? "text-amber-600" : "text-blue-600"} />
                <h3 className={`font-bold ${
                  isZeroBalance ? "text-red-800" : isLowBalance ? "text-amber-800" : "text-blue-800"
                }`}>Notifications</h3>
              </div>
              <button onClick={() => setShowNotificationModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              {isZeroBalance ? (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-red-600 text-lg">⚠️</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800 text-sm mb-1">Token Balance Depleted</div>
                    <div className="text-sm text-gray-600">
                      Dear {userName}, your token balance is 0. You cannot access property reports until you subscribe for more tokens.
                    </div>
                    <button
                      onClick={() => { setShowNotificationModal(false); window.location.href = "/dashboard/request"; }}
                      className="mt-3 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition"
                    >
                      Subscribe Now
                    </button>
                  </div>
                </div>
              ) : isLowBalance ? (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-amber-600 text-lg">⚠️</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800 text-sm mb-1">Token Balance Running Low</div>
                    <div className="text-sm text-gray-600">
                      Dear {userName}, you only have {tokenBalance} token{tokenBalance !== 1 ? 's' : ''} left. Please subscribe to purchase additional tokens to continue using our services.
                    </div>
                    <button
                      onClick={() => { setShowNotificationModal(false); window.location.href = "/dashboard/request"; }}
                      className="mt-3 px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition"
                    >
                      Subscribe Now
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600 text-lg">✓</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800 text-sm mb-1">All Good!</div>
                    <div className="text-sm text-gray-600">
                      Dear {userName}, you have {tokenBalance} token{tokenBalance !== 1 ? 's' : ''} remaining. No action needed.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}