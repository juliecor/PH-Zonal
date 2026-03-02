"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { MapPin, Zap, Compass, ShieldCheck, Sparkles, TrendingUp, Landmark, Building2, Home } from "lucide-react";
import { useState } from "react";

export default function WelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function enterApp() {
    setLoading(true);
    setTimeout(() => router.push("/?skip=1"), 50);
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-gray-800">
      {/* Ambient sunbursts + color wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(600px 400px at 12% 8%, rgba(248, 215, 105, 0.25), transparent 60%), radial-gradient(500px 320px at 88% 12%, rgba(125,211,252,0.28), transparent 60%), radial-gradient(520px 360px at 75% 75%, rgba(167,243,208,0.28), transparent 60%)",
        }}
      />
      {/* Soft decorative blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-sky-200 via-blue-200 to-indigo-200 blur-3xl opacity-30" />
      <div className="pointer-events-none absolute -bottom-28 -right-28 h-[420px] w-[420px] rounded-full bg-gradient-to-tr from-amber-200 via-rose-200 to-pink-200 blur-3xl opacity-30" />

      <header className="relative max-w-7xl mx-auto px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Image src="/pictures/FilipinoHomes.png" alt="Filipino Homes" width={220} height={60} priority />
          <span className="text-sm text-gray-600 hidden sm:block">Zonal Value Explorer</span>
        </div>
        <div className="flex items-center gap-2" />
      </header>

      {/* Hero */}
      <section className="relative max-w-7xl mx-auto px-6 pt-10 pb-16 grid lg:grid-cols-2 gap-10 items-center z-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold px-3 py-1 border border-blue-100 shadow-sm">
            <Sparkles size={12} /> New • Filipino Homes Smart Pin
          </div>
          <h1 className="mt-4 text-4xl sm:text-5xl xl:text-6xl font-black tracking-tight leading-tight text-slate-900">
            Find Zonal Values
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-sky-700 via-blue-600 to-indigo-700">Fast & Precisely</span>
          </h1>
          <p className="mt-5 text-gray-700 text-base sm:text-lg leading-relaxed max-w-xl">
            Pinpoint streets and barangays with Google‑smart geocoding and instant street snapping. Explore nearby facilities
            and build a beautiful report — all in a few clicks.
          </p>

          {/* Feature bullets */}
          <div className="mt-6 grid sm:grid-cols-2 gap-3 max-w-2xl">
            <Feature icon={<Compass size={16} />} title="Smart Pinning" desc="Street‑level accuracy with Google + snap" />
            <Feature icon={<ShieldCheck size={16} />} title="Reliable Filters" desc="Province, city, barangay in seconds" />
            <Feature icon={<TrendingUp size={16} />} title="Instant Insights" desc="Nearby POIs and quick facts" />
            <Feature icon={<Zap size={16} />} title="1‑Click Report" desc="Beautiful PDF with branded layout" />
          </div>

          <div className="mt-8 flex items-center gap-3">
            <button
              onClick={enterApp}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 text-white px-6 py-3 text-sm font-bold hover:bg-blue-700 transition shadow"
            >
              {loading ? (
                <>
                  <Zap size={16} className="animate-spin" /> Loading…
                </>
              ) : (
                <>
                  <MapPin size={16} /> Start Exploring
                </>
              )}
            </button>
          </div>
        </div>

        {/* Hero map image (PH) with bouncing pointer overlay */}
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

      {/* Stats bar */}
      <section className="relative z-10 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-t border-b border-white/60">
        <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-3 gap-2 sm:gap-4 text-center">
          <Stat k="Provinces" v="80+" icon={<Landmark size={18} />} />
          <Stat k="Cities" v="1,600+" icon={<Building2 size={18} />} />
          <Stat k="Barangays" v="42,000+" icon={<Home size={18} />} />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative z-10 max-w-7xl mx-auto px-6 py-14">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900">How it works</h2>
        <p className="text-gray-700 mt-2">Three quick steps to your zonal report.</p>
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          <Step n={1} title="Pick a region" desc="Select province, city, barangay — or type a street." />
          <Step n={2} title="Pinpoint & snap" desc="Google‑smart geocode refined to the street centerline." />
          <Step n={3} title="Generate report" desc="Nearby POIs and a branded PDF in one click." />
        </div>
      </section>

      <footer className="relative z-10 max-w-7xl mx-auto px-6 py-10 text-xs text-gray-600">
        © {new Date().getFullYear()} Filipino Homes | Developers
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

function Stat({ k, v, icon }: { k: string; v: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-slate-50 to-white border border-white/70 p-3 sm:p-4 shadow-sm flex items-center gap-2 sm:gap-3">
      {icon && (
        <div className="hidden sm:grid shrink-0 w-9 h-9 rounded-full place-items-center bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 shadow-sm animate-[pulse_3s_ease-in-out_infinite]">
          {icon}
        </div>
      )}
      <div className="text-left">
        <div className="text-xl sm:text-2xl font-black text-slate-900 leading-none">{v}</div>
        <div className="text-[11px] sm:text-[12px] text-gray-600 mt-0.5 sm:mt-1">{k}</div>
      </div>
    </div>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
          {n}
        </div>
        <div>
          <div className="text-sm font-bold text-gray-900">{title}</div>
          <div className="text-[12px] text-gray-600">{desc}</div>
        </div>
      </div>
    </div>
  );
}

// Lightweight map just for the hero. No interactions; centers on the Philippines.
// Removed interactive HeroMap in favor of a static image
