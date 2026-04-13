"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Zap, Compass, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { apiMe, getToken } from "../lib/authClient";
import LowBalanceNotice from "../components/LowBalanceNotice";

// Avatar
function ProfileAvatar({ name, balance, href }: { name: string; balance: number | null; href: string }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase() || "?";

  return (
    <Link href={href} title="Go to Dashboard">
      <div style={{
        width: 52,
        height: 52,
        borderRadius: 14,
        background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)",
        border: "2px solid rgba(201,168,76,0.55)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative"
      }}>
        <span style={{ color: "#c9a84c", fontWeight: 700 }}>{initials}</span>
        <span style={{
          position: "absolute",
          bottom: -6,
          right: -8,
          background: "#c9a84c",
          fontSize: "0.65rem",
          padding: "0 4px",
          borderRadius: 10,
          color: "#1e3a8a"
        }}>
          {balance ?? 0}
        </span>
      </div>
    </Link>
  );
}

export default function WelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(!!getToken());

    apiMe().then((me) => {
      if (me) {
        setBalance(me.token_balance ?? null);
        setName(me.name || "");
        setRole(me.role || "");
        setAuthed(true);
      }
    });
  }, []);

  const isAdmin = (role || name).toLowerCase().includes("admin");
  const canExplore = (balance ?? 0) > 0 || isAdmin;
  const dashHref = isAdmin ? "/admin/users" : "/dashboard/reports";

  function enterApp() {
    if (!canExplore) return;
    setLoading(true);
    setTimeout(() => router.push("/?skip=1"), 50);
  }

  return (
    <main className="relative h-screen overflow-hidden bg-gradient-to-b from-sky-200 via-sky-100 to-emerald-100 text-gray-800">

      <LowBalanceNotice threshold={3} remindAfterHours={24} />

      {/* Background effects (unchanged) */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-80"
        style={{
          backgroundImage:
            "radial-gradient(600px 400px at 12% 8%, rgba(248,215,105,0.25), transparent 60%), radial-gradient(500px 320px at 88% 12%, rgba(125,211,252,0.35), transparent 60%), radial-gradient(520px 360px at 75% 75%, rgba(167,243,208,0.32), transparent 60%)"
        }}
      />

      {/* HEADER */}
      <header className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between z-10">
        <Image src="/pictures/FilipinoHomes.png" alt="Filipino Homes" width={220} height={60} />

        {authed ? (
          <ProfileAvatar name={name} balance={balance} href={dashHref} />
        ) : (
          <Link href="/login" className="bg-white px-4 py-1.5 rounded-full text-blue-700 font-semibold">
            Login
          </Link>
        )}
      </header>

      {/* HERO */}
      <section className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-10 items-center h-[calc(100vh-90px)]">

        {/* LEFT CONTENT */}
        <div className="-translate-y-6">
          <h1 className="text-4xl sm:text-5xl xl:text-6xl font-black leading-tight text-slate-900">
            Find Zonal Values
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-sky-700 via-blue-600 to-indigo-700">
              Fast & Precisely
            </span>
          </h1>

          <p className="mt-3 text-gray-800 text-base sm:text-lg leading-relaxed max-w-xl">
            Developed for real estate professionals, the Zonal Finder of Filipino Homes provides accurate zonal values per square meter across streets and barangays. Users can evaluate property areas, analyze nearby establishments, and produce detailed reports for reliable property pricing.
          </p>

          <div className="mt-5 grid sm:grid-cols-2 gap-3 max-w-3xl">
            <Feature icon={<Compass size={25} />} title="Smart Pinning" desc="Street-level accuracy with Google + snap" />
            <Feature icon={<ShieldCheck size={25} />} title="Reliable Filters" desc="Province, city, barangay in seconds" />
            <Feature icon={<TrendingUp size={25} />} title="Instant Insights" desc="Nearby POIs and quick facts" />
            <Feature icon={<Zap size={25} />} title="1-Click Report" desc="Beautiful PDF with branded layout" />
          </div>

          <div className="mt-6">
            <button
              onClick={enterApp}
              disabled={!canExplore}
              className="px-6 py-3 rounded-xl text-white font-bold"
              style={{
                background: canExplore
                  ? "linear-gradient(135deg,#1e3a8a,#2563eb)"
                  : "#9ca3af",
              }}
            >
              {loading ? "Loading..." : "Start Exploring"}
            </button>
          </div>
        </div>

        {/* RIGHT IMAGE */}
        <div className="flex justify-center items-center">
          <div className="relative w-full h-[420px] sm:h-[520px] lg:h-[560px] -translate-y-10">

            <Image
              src="/pictures/phil3.png"
              alt="Philippines map"
              fill
              className="object-contain scale-105"
              priority
            />

            <img
              src="/pictures/filipinohomespointer.png"
              alt="Pointer"
              width={110}
              height={110}
              className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-full animate-bounce"
            />
          </div>
        </div>

      </section>

      {/* FOOTER (kept) */}
      <footer className="absolute bottom-2 w-full text-center text-xs text-gray-600">
        © {new Date().getFullYear()} Filipino Homes | Developers
      </footer>
    </main>
  );
}

// Feature
function Feature({ icon, title, desc }: any) {
  return (
    <div className="bg-white/90 p-3 rounded-xl shadow flex gap-3">
      <div className="text-blue-600">{icon}</div>
      <div>
        <div className="font-bold text-sm">{title}</div>
        <div className="text-xs text-gray-600">{desc}</div>
      </div>
    </div>
  );
}