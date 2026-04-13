"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Zap, Compass, ShieldCheck, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { apiLogout, apiMe, getToken } from "../lib/authClient";
import LowBalanceNotice from "../components/LowBalanceNotice";

export default function WelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [name, setName] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [authed, setAuthed] = useState<boolean>(false);

  useEffect(() => {
    setAuthed(!!getToken());
    try {
      const raw = localStorage.getItem("me.cache.v1");
      if (raw) {
        const cached = JSON.parse(raw) as { ts: number; name?: string; role?: string; token_balance?: number };
        if (cached && Date.now() - (cached.ts || 0) < 60_000) {
          setName(cached.name || "");
          setRole((cached.role || "").toString());
          if (typeof cached.token_balance === "number") setBalance(cached.token_balance);
          setAuthed(true);
        }
      }
    } catch {}

    apiMe()
      .then((me) => {
        if (me) {
          setBalance(typeof me.token_balance === "number" ? me.token_balance : null);
          setName(me.name || "");
          setRole((me.role || "").toString());
          setAuthed(true);
          try {
            localStorage.setItem(
              "me.cache.v1",
              JSON.stringify({ ts: Date.now(), name: me.name, role: me.role, token_balance: me.token_balance })
            );
          } catch {}
        } else {
          setAuthed(false);
        }
      })
      .catch(() => {});
  }, []);

  const isAdmin = (role || name)?.toLowerCase().includes("admin");
  const isAuthed = authed;
  const canExplore = (balance ?? 0) > 0 || isAdmin;
  const dashHref = isAdmin ? "/admin/users" : "/dashboard/profile";

  function enterApp() {
    if (!canExplore) return;
    setLoading(true);
    setTimeout(() => router.push("/?skip=1"), 50);
  }

  return (
    <main className="relative h-screen w-full overflow-hidden bg-gradient-to-b from-sky-200 via-sky-100 to-emerald-100 text-gray-800 flex flex-col">
      <LowBalanceNotice threshold={3} remindAfterHours={24} />

      {/* Ambient sunbursts */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-80"
        style={{
          backgroundImage:
            "radial-gradient(600px 400px at 12% 8%, rgba(248,215,105,0.25), transparent 60%), radial-gradient(500px 320px at 88% 12%, rgba(125,211,252,0.35), transparent 60%), radial-gradient(520px 360px at 75% 75%, rgba(167,243,208,0.32), transparent 60%)",
        }}
      />
      <div className="pointer-events-none absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-sky-300 via-blue-200 to-indigo-200 blur-3xl opacity-40" />
      <div className="pointer-events-none absolute -bottom-28 -right-28 h-[420px] w-[420px] rounded-full bg-gradient-to-tr from-amber-200 via-rose-200 to-pink-200 blur-3xl opacity-40" />

      {/* Header */}
      <header className="relative max-w-7xl mx-auto w-full px-6 py-3 flex items-center justify-between z-10 shrink-0">
        <Image src="/pictures/FilipinoHomes.png" alt="Filipino Homes" width={180} height={48} priority />
        <div className="flex items-center gap-2 text-sm">
          {isAuthed ? (
            <>
              <Link href={dashHref} className="rounded-full bg-white/90 border border-gray-200 px-3 py-1 shadow-sm hover:bg-white">
                Dashboard
              </Link>
              {isAdmin && (
                <Link href="/admin" className="rounded-full bg-white/90 border border-gray-200 px-3 py-1 shadow-sm hover:bg-white">
                  Admin
                </Link>
              )}
              {balance !== null && !isAdmin && (
                <span className="rounded-full bg-white/90 border border-gray-200 px-3 py-1 shadow-sm">
                  Tokens: <span className="font-semibold">{balance}</span>
                </span>
              )}
              <button
                onClick={async () => {
                  await apiLogout();
                  router.replace("/login");
                }}
                className="rounded-full bg-rose-600 text-white px-4 py-1.5 hover:bg-rose-700 shadow"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              
              <Link href="/login" className="rounded-full bg-blue-600 text-white px-4 py-1.5 shadow hover:bg-blue-700">
                Log in
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero — takes all remaining space */}
      <section className="relative flex-1 max-w-7xl mx-auto w-full px-6 grid lg:grid-cols-2 gap-6 items-center z-10 min-h-0">
        {/* Left: Text content */}
        <div className="flex flex-col justify-center">
          <h1 className="text-3xl sm:text-4xl xl:text-5xl font-black tracking-tight leading-tight text-slate-900">
            Find Zonal Values
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-sky-700 via-blue-600 to-indigo-700">
              Fast & Precisely
            </span>
          </h1>
          <p className="mt-3 text-gray-800 text-sm sm:text-base leading-relaxed max-w-xl">
            Developed for real estate professionals, the Zonal Finder of Filipino Homes provides accurate zonal values
            per square meter across streets and barangays. Users can evaluate property areas, analyze nearby
            establishments, and produce detailed reports for reliable property pricing.
          </p>

          <div className="mt-4 grid sm:grid-cols-2 gap-2 max-w-3xl">
            <Feature icon={<Compass size={18} />} title="Smart Pinning" desc="Street‑level accuracy with Google + snap" />
            <Feature icon={<ShieldCheck size={18} />} title="Reliable Filters" desc="Province, city, barangay in seconds" />
            <Feature icon={<TrendingUp size={18} />} title="Instant Insights" desc="Nearby POIs and quick facts" />
            <Feature icon={<Zap size={18} />} title="1‑Click Report" desc="Beautiful PDF with branded layout" />
          </div>

          <div className="mt-5">
            <button
              onClick={enterApp}
              disabled={!canExplore}
              className="inline-flex items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-bold transition shadow disabled:opacity-60 disabled:cursor-not-allowed bg-blue-600 text-white hover:bg-blue-700"
              title={!canExplore ? "No tokens left. Request more to continue." : "Start exploring"}
            >
              {loading ? (
                <>
                  <Zap size={18} className="animate-spin" /> Loading…
                </>
              ) : (
                <>
                  <MapPin size={18} /> Start Exploring
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Hero map image */}
        <div className="relative h-full min-h-0 flex items-center justify-center">
          <div className="relative w-full h-[420px] sm:h-[520px] lg:h-[600px]">
            <Image
              src="/pictures/phil3.png"
              alt="Philippines map"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-contain drop-shadow-2xl scale-110"
              priority
            />
            <img
              src="/pictures/filipinohomespointer.png"
              alt="Pointer"
              width={110}
              height={110}
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full animate-bounce drop-shadow-xl"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl mx-auto w-full px-6 py-2 text-xs text-gray-600 shrink-0">
        © {new Date().getFullYear()} Filipino Homes | Developers
      </footer>
    </main>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/90 backdrop-blur p-2.5 flex items-start gap-2.5 shadow-sm">
      <div className="shrink-0 w-7 h-7 rounded-full bg-sky-100 text-blue-700 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-xs font-bold text-slate-900">{title}</div>
        <div className="text-[11px] text-gray-600">{desc}</div>
      </div>
    </div>
  );
}