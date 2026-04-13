"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Zap, Compass, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { apiMe, getToken } from "../lib/authClient";
import LowBalanceNotice from "../components/LowBalanceNotice";

// ─── Navy + gold profile avatar ───────────────────────────────────────────────
function ProfileAvatar({ name, balance, href }: { name: string; balance: number | null; href: string }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase() || "?";
  return (
    <Link href={href} title="Go to Dashboard">
      <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)", border: "2px solid rgba(201,168,76,0.55)", display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer", boxShadow: "0 2px 12px rgba(30,58,138,0.22)", transition: "box-shadow 0.15s, border-color 0.15s" }}>
        <span style={{ fontFamily: "'Cormorant Garamond', 'Georgia', serif", fontSize: "1.1rem", fontWeight: 700, color: "#c9a84c", letterSpacing: "0.04em", userSelect: "none" }}>{initials}</span>
        <span style={{ position: "absolute", bottom: -6, right: -8, minWidth: 20, height: 20, borderRadius: 10, background: "#c9a84c", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 800, color: "#1e3a8a", padding: "0 4px", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>{balance ?? 0}</span>
      </div>
    </Link>
  );
}

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
    apiMe().then((me) => {
      if (me) {
        setBalance(typeof me.token_balance === "number" ? me.token_balance : null);
        setName(me.name || "");
        setRole((me.role || "").toString());
        setAuthed(true);
        try {
          localStorage.setItem("me.cache.v1", JSON.stringify({ ts: Date.now(), name: me.name, role: me.role, token_balance: me.token_balance }));
        } catch {}
      } else {
        setAuthed(false);
      }
    }).catch(() => {});
  }, []);

  const isAdmin    = (role || name)?.toLowerCase().includes("admin");
  const isAuthed   = authed;
  const canExplore = (balance ?? 0) > 0 || isAdmin;
  const dashHref   = isAdmin ? "/admin/users" : "/dashboard/reports";

  function enterApp() {
    if (!canExplore) return;
    setLoading(true);
    setTimeout(() => router.push("/?skip=1"), 50);
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-sky-200 via-sky-100 to-emerald-100 text-gray-800">
      <LowBalanceNotice threshold={3} remindAfterHours={24} />

      {/* Ambient sunbursts */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-80"
        style={{ backgroundImage: "radial-gradient(600px 400px at 12% 8%, rgba(248,215,105,0.25), transparent 60%), radial-gradient(500px 320px at 88% 12%, rgba(125,211,252,0.35), transparent 60%), radial-gradient(520px 360px at 75% 75%, rgba(167,243,208,0.32), transparent 60%)" }}
      />
      <div className="pointer-events-none absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-sky-300 via-blue-200 to-indigo-200 blur-3xl opacity-40" />
      <div className="pointer-events-none absolute -bottom-28 -right-28 h-[420px] w-[420px] rounded-full bg-gradient-to-tr from-amber-200 via-rose-200 to-pink-200 blur-3xl opacity-40" />

      {/* ── Header ── */}
      <header className="relative max-w-7xl mx-auto px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Image src="/pictures/FilipinoHomes.png" alt="Filipino Homes" width={220} height={60} priority />
        </div>
        <div className="flex items-center gap-3 text-sm">
          {isAuthed && (
            <>
              <ProfileAvatar name={name} balance={balance} href={dashHref} />
              {isAdmin && (
                <Link href="/admin" className="rounded-full bg-white/90 border border-gray-200 px-3 py-1 shadow-sm hover:bg-white text-sm">
                  Admin
                </Link>
              )}
            </>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative max-w-7xl mx-auto px-6 pt-10 pb-16 grid lg:grid-cols-2 gap-10 items-center z-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold px-3 py-1 border border-blue-100 shadow-sm">
            <Sparkles size={12} /> New • Filipino Homes Smart Pin
          </div>

          <h1 className="mt-4 text-4xl sm:text-5xl xl:text-6xl font-black tracking-tight leading-tight text-slate-900">
            Find Zonal Values
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-sky-700 via-blue-600 to-indigo-700">
              Fast & Precisely
            </span>
          </h1>

          <p className="mt-4 text-gray-800 text-base sm:text-lg leading-relaxed max-w-xl">
            Developed for real estate professionals, the Zonal Finder of Filipino Homes provides accurate zonal values per square meter across streets and barangays. Users can evaluate property areas, analyze nearby establishments, and produce detailed reports for reliable property pricing.
          </p>

          <div className="mt-6 grid sm:grid-cols-2 gap-3 max-w-3xl">
            <Feature icon={<Compass size={25} />}     title="Smart Pinning"    desc="Street‑level accuracy with Google + snap" />
            <Feature icon={<ShieldCheck size={25} />} title="Reliable Filters" desc="Province, city, barangay in seconds" />
            <Feature icon={<TrendingUp size={25} />}  title="Instant Insights" desc="Nearby POIs and quick facts" />
            <Feature icon={<Zap size={25} />}         title="1‑Click Report"   desc="Beautiful PDF with branded layout" />
          </div>

          <div className="mt-8 flex items-center gap-3">
            <button
              onClick={enterApp}
              disabled={!canExplore}
              className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold transition shadow disabled:opacity-60 disabled:cursor-not-allowed text-white"
              style={{ background: canExplore ? "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)" : "#9ca3af" }}
              title={!canExplore ? "No tokens left. Request more to continue." : "Start exploring"}
            >
              {loading ? (
                <><Zap size={20} className="animate-spin" /> Loading…</>
              ) : (
                <><MapPin size={20} /> Start Exploring</>
              )}
            </button>
          </div>
        </div>

        {/* Hero map image */}
        <div className="relative h-[380px] sm:h-[460px] lg:h-[600px]">
          <Image
            src="/pictures/phil3.png"
            alt="Philippines map"
            fill
            sizes="(max-width: 1024px) 120vw, 50vw"
            className="object-contain drop-shadow-2xl scale-110 lg:scale-125"
            priority
          />
          <img
            src="/pictures/filipinohomespointer.png"
            alt="Pointer"
            width={120}
            height={120}
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full animate-bounce drop-shadow-xl"
          />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 max-w-7xl mx-auto px-6 pb-8">
        <p className="text-xs text-gray-600">© {new Date().getFullYear()} Filipino Homes | Developers</p>
      </footer>
    </main>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/90 backdrop-blur p-3 flex items-start gap-3 shadow-sm">
      <div className="shrink-0 w-8 h-8 rounded-full bg-sky-100 text-blue-700 flex items-center justify-center">{icon}</div>
      <div>
        <div className="text-sm font-bold text-slate-900">{title}</div>
        <div className="text-[12px] text-gray-600">{desc}</div>
      </div>
    </div>
  );
}