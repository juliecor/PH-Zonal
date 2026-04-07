"use client";

import DashboardSidebar from "../components/DashboardSidebar";
import LowBalanceNotice from "../components/LowBalanceNotice";
import { User, Coins, FileText, Home, Bell, X } from "lucide-react";
import { useState, useEffect } from "react";

// Try to import apiMe, but don't fail if it doesn't exist yet
let apiMe: any = null;
try {
  // This will only work if the file exists
  const authClient = require("../../lib/authClient");
  apiMe = authClient.apiMe;
} catch (e) {
  console.warn("authClient not found, using mock data");
  // Mock function for development
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

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const me = await apiMe();
        if (me) {
          setTokenBalance(me.token_balance ?? 0);
          setUserName(me.name ?? me.email ?? "User");
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        // Set default values if API fails
        setTokenBalance(5);
        setUserName("User");
      }
    };
    fetchUserData();
  }, []);

  const isLowBalance = tokenBalance !== null && tokenBalance <= 3;
  const isZeroBalance = tokenBalance !== null && tokenBalance === 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');

        /* Root fills the entire viewport — nothing overflows */
        .cl-root {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f5f0eb;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
        }

        /* ── Top bar (fixed height, never shrinks) ── */
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

        /* ── Body: takes all remaining height ── */
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

        /* ── Sidebar: full remaining height, no scroll ── */
        .cl-sidebar-wrap {
          height: 100%;
          overflow: hidden;
          padding: 1.5rem 1rem 1.5rem 1.5rem;
          box-sizing: border-box;
        }

        /* ── Main content: only this panel scrolls ── */
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

        /* Notification Bell Animation */
        @keyframes ring {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(15deg); }
          50% { transform: rotate(-15deg); }
          75% { transform: rotate(15deg); }
          100% { transform: rotate(0deg); }
        }
        .bell-ring {
          animation: ring 0.5s ease-in-out;
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
        }
        .animate-pulse {
          animation: pulse 1.5s ease-in-out infinite;
        }
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

          {/* ── Notification Bell ── */}
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

          {/* Sidebar — never scrolls, logout always visible */}
          <aside className="cl-sidebar-wrap">
            <DashboardSidebar
              title="My Account"
              links={[
                { href: "/welcome",           label: "Home",           icon: <Home size={16} /> },
                { href: "/dashboard/profile", label: "Profile",        icon: <User size={16} /> },
                { href: "/dashboard/request", label: "Request Tokens", icon: <Coins size={16} /> },
                { href: "/dashboard/reports", label: "Reports",        icon: <FileText size={16} /> },
              ]}
            />
          </aside>

          {/* Page content — only this area scrolls */}
          <main className="cl-main">
            {children}
          </main>

        </div>
      </div>

      {/* ── Notification Modal ── */}
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
              <button 
                onClick={() => setShowNotificationModal(false)} 
                className="text-gray-400 hover:text-gray-600"
              >
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
                      onClick={() => {
                        setShowNotificationModal(false);
                        window.location.href = "/dashboard/request";
                      }}
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
                      onClick={() => {
                        setShowNotificationModal(false);
                        window.location.href = "/dashboard/request";
                      }}
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