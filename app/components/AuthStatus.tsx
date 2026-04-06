"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiLogout, apiMe } from "../lib/authClient";

export default function AuthStatus() {
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  async function refresh() {
    try {
      const me = await apiMe();
      setBalance(typeof me?.token_balance === "number" ? me!.token_balance : null);
      setRole(me?.role || null);
    } catch {}
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed top-3 right-4 z-[1000] flex items-center gap-3">
      <Link href="/dashboard" className="rounded-full bg-white/90 border border-gray-200 px-3 py-1 shadow-sm text-sm hover:bg-white">Dashboard</Link>
      {role === 'admin' && (
        <Link href="/admin" className="rounded-full bg-white/90 border border-gray-200 px-3 py-1 shadow-sm text-sm hover:bg-white">Admin</Link>
      )}
      {balance !== null && role !== 'admin' && (
        <button
          onClick={refresh}
          className="rounded-full bg-white/90 border border-gray-200 px-3 py-1 shadow-sm text-sm"
          title="Click to refresh"
        >
          Tokens: <span className="font-semibold">{balance}</span>
        </button>
      )}
      <button
        onClick={async () => { await apiLogout(); router.replace("/login"); }}
        className="rounded-full bg-rose-600 text-white px-4 py-1.5 hover:bg-rose-700 shadow text-sm"
      >
        Logout
      </button>
    </div>
  );
}
