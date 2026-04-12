"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  MapPin,
  Zap,
  Compass,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Landmark,
  Building2,
  Home,
} from "lucide-react";
import { useEffect, useState } from "react";
import Disclaimer from "../components/Disclaimer";
import { apiMe, getToken, apiLogout } from "../lib/authClient";
import LowBalanceNotice from "../components/LowBalanceNotice";
import { Button, Chip } from "@mui/material";

// ─── Profile Avatar ─────────────────────────────
function ProfileAvatar({
  name,
  balance,
  href,
}: {
  name: string;
  balance: number | null;
  href: string;
}) {
  const initials =
    name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase() || "?";

  return (
    <Link href={href}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: "linear-gradient(135deg, #1e3a8a, #1e40af)",
          border: "2px solid rgba(201,168,76,0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <span style={{ color: "#c9a84c", fontWeight: 700 }}>{initials}</span>

        <span
          style={{
            position: "absolute",
            bottom: -6,
            right: -8,
            background: "#c9a84c",
            color: "#1e3a8a",
            fontSize: "10px",
            fontWeight: 800,
            borderRadius: 10,
            padding: "0 5px",
          }}
        >
          {balance ?? 0}
        </span>
      </div>
    </Link>
  );
}

// ─── Feature Card ─────────────────────────────
function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl bg-white/90 border p-3 flex gap-3 shadow-sm">
      <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-blue-700">
        {icon}
      </div>
      <div>
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs text-gray-600">{desc}</div>
      </div>
    </div>
  );
}

// ─── Stat ─────────────────────────────
function Stat({
  k,
  v,
  icon,
}: {
  k: string;
  v: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <div className="font-bold">{v}</div>
      <div className="text-xs text-gray-600">{k}</div>
    </div>
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

    apiMe()
      .then((me) => {
        if (!me) return;

        setBalance(me.token_balance ?? null);
        setName(me.name || "");
        setRole(me.role || "");
        setAuthed(true);
      })
      .catch(() => {});
  }, []);

  const isAdmin = (role || name).toLowerCase().includes("admin");
  const canExplore = (balance ?? 0) > 0 || isAdmin;
  const dashHref = isAdmin ? "/admin/users" : "/dashboard/reports";

  function enterApp() {
    if (!canExplore) return;
    setLoading(true);
    setTimeout(() => router.push("/?skip=1"), 100);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-200 via-sky-100 to-emerald-100">
      <LowBalanceNotice threshold={3} remindAfterHours={24} />

      {/* HEADER */}
      <header className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <Image
          src="/pictures/FilipinoHomes.png"
          alt="Filipino Homes"
          width={220}
          height={60}
          priority
        />

        <div className="flex items-center gap-3">
          {authed ? (
            <>
              <Button
                component={Link as any}
                href={dashHref}
                variant="outlined"
                size="small"
              >
                Dashboard
              </Button>

              {isAdmin && (
                <Button
                  component={Link as any}
                  href="/admin"
                  variant="outlined"
                  size="small"
                >
                  Admin
                </Button>
              )}

              {balance !== null && !isAdmin && (
                <Chip label={`Tokens: ${balance}`} />
              )}

              <Button
                onClick={async () => {
                  await apiLogout();
                  router.replace("/login");
                }}
                color="error"
                variant="contained"
                size="small"
              >
                Logout
              </Button>

              <ProfileAvatar
                name={name}
                balance={balance}
                href={dashHref}
              />
            </>
          ) : (
            <>
              <Button component={Link as any} href="/register">
                Register
              </Button>
              <Button component={Link as any} href="/login" variant="contained">
                Log in
              </Button>
            </>
          )}
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-10 py-12">
        <div>
          <div className="inline-flex gap-2 bg-blue-50 px-3 py-1 rounded-full text-xs">
            <Sparkles size={12} /> New Feature
          </div>

          <h1 className="text-5xl font-black mt-4">
            Find Zonal Values
            <span className="block text-blue-700">Fast & Precise</span>
          </h1>

          <p className="mt-4 text-gray-700">
            Accurate property zonal values and reports for real estate analysis.
          </p>

          <div className="grid sm:grid-cols-2 gap-3 mt-6">
            <Feature icon={<Compass size={18} />} title="Smart Pinning" desc="Map accuracy" />
            <Feature icon={<ShieldCheck size={18} />} title="Reliable Data" desc="Verified zones" />
            <Feature icon={<TrendingUp size={18} />} title="Insights" desc="Nearby POIs" />
            <Feature icon={<Zap size={18} />} title="Reports" desc="Instant PDF" />
          </div>

          <div className="mt-6">
            <Button
              onClick={enterApp}
              disabled={!canExplore || loading}
              variant="contained"
              startIcon={<MapPin size={18} />}
            >
              {loading ? "Loading..." : "Start Exploring"}
            </Button>
          </div>
        </div>

        {/* IMAGE */}
        <div className="relative h-[400px]">
          <Image
            src="/pictures/phil3.png"
            alt="Map"
            fill
            className="object-contain"
          />
        </div>
      </section>

      {/* STATS */}
      <section className="max-w-7xl mx-auto px-6 grid grid-cols-3 py-6">
        <Stat k="Provinces" v="80+" icon={<Landmark />} />
        <Stat k="Cities" v="1,600+" icon={<Building2 />} />
        <Stat k="Barangays" v="42,000+" icon={<Home />} />
      </section>

      {/* FOOTER */}
      <footer className="max-w-7xl mx-auto px-6 pb-8">
        <Disclaimer className="mb-4" />
        <p className="text-xs text-gray-600">
          © {new Date().getFullYear()} Filipino Homes | Developers
        </p>
      </footer>
    </main>
  );
}