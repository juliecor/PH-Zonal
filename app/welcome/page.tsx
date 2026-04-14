"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Compass, ShieldCheck, TrendingUp, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { apiMe, getToken } from "../lib/authClient";
import LowBalanceNotice from "../components/LowBalanceNotice";

// MUI imports
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

// ── Design tokens ──────────────────────────────────────────
const sansFont = "'DM Sans', sans-serif";

// ══════════════════════════════════
// Profile Avatar
// ══════════════════════════════════
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
    <Link href={href} title="Go to Dashboard" style={{ textDecoration: "none" }}>
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: "14px",
          background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)",
          border: "2px solid rgba(201,168,76,0.55)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          cursor: "pointer",
        }}
      >
        <Typography sx={{ color: "#c9a84c", fontWeight: 700 }}>
          {initials}
        </Typography>
        <Box
          component="span"
          sx={{
            position: "absolute",
            bottom: -6,
            right: -8,
            background: "#c9a84c",
            fontSize: "0.65rem",
            px: "4px",
            borderRadius: "10px",
            color: "#1e3a8a",
            fontWeight: 700,
            lineHeight: "18px",
          }}
        >
          {balance ?? 0}
        </Box>
      </Box>
    </Link>
  );
}

// ══════════════════════════════════
// Feature card
// ══════════════════════════════════
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
    <Box
      sx={{
        background: "rgba(255,255,255,0.9)",
        p: "0.75rem",
        borderRadius: "12px",
        boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
        display: "flex",
        gap: "0.75rem",
        alignItems: "flex-start",
      }}
    >
      <Box sx={{ color: "#2563eb", flexShrink: 0, mt: "2px" }}>{icon}</Box>
      <Box>
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: "0.875rem",
            color: "#1e293b",
            fontFamily: sansFont,
          }}
        >
          {title}
        </Typography>
        <Typography
          sx={{
            fontSize: "0.75rem",
            color: "#4b5563",
            fontFamily: sansFont,
          }}
        >
          {desc}
        </Typography>
      </Box>
    </Box>
  );
}

// ══════════════════════════════════
// Welcome Page
// ══════════════════════════════════
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
    <Box
      component="main"
      sx={{
        position: "relative",
        height: "100vh",
        overflow: "hidden",
        background: "linear-gradient(to bottom, #bae6fd, #e0f2fe, #d1fae5)",
        color: "#1f2937",
        fontFamily: sansFont,
      }}
    >
      <LowBalanceNotice threshold={3} remindAfterHours={24} />

      {/* ── Background radial blobs ── */}
      <Box
        sx={{
          pointerEvents: "none",
          position: "absolute",
          inset: 0,
          zIndex: 0,
          opacity: 0.8,
          backgroundImage: `
            radial-gradient(600px 400px at 12% 8%, rgba(248,215,105,0.25), transparent 60%),
            radial-gradient(500px 320px at 88% 12%, rgba(125,211,252,0.35), transparent 60%),
            radial-gradient(520px 360px at 75% 75%, rgba(167,243,208,0.32), transparent 60%)
          `,
        }}
      />

      {/* ══════════════════════════════════
          HEADER
      ══════════════════════════════════ */}
      <Box
        component="header"
        sx={{
          maxWidth: "80rem",
          mx: "auto",
          px: "1.5rem",
          py: "0.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 10,
          position: "relative",
        }}
      >
        <Image
          src="/pictures/FilipinoHomes.png"
          alt="Filipino Homes"
          width={220}
          height={60}
        />

        {authed ? (
          <ProfileAvatar name={name} balance={balance} href={dashHref} />
        ) : (
          <Link href="/login" style={{ textDecoration: "none" }}>
            <Box
              sx={{
                background: "#fff",
                px: "1rem",
                py: "0.375rem",
                borderRadius: "9999px",
                color: "#1d4ed8",
                fontWeight: 600,
                fontSize: "0.95rem",
                fontFamily: sansFont,
                cursor: "pointer",
                "&:hover": { background: "#f0f4ff" },
              }}
            >
              Login
            </Box>
          </Link>
        )}
      </Box>

      {/* ══════════════════════════════════
          HERO
      ══════════════════════════════════ */}
      <Box
        component="section"
        sx={{
          maxWidth: "80rem",
          mx: "auto",
          px: "1.5rem",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          gap: "2.5rem",
          alignItems: "center",
          height: "calc(100vh - 90px)",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* ── Left content ── */}
        <Box sx={{ transform: "translateY(-24px)" }}>
          {/* Headline */}
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: "2.25rem", sm: "3rem", xl: "3.75rem" },
              fontWeight: 900,
              lineHeight: 1.15,
              color: "#0f172a",
              fontFamily: sansFont,
            }}
          >
            Find Zonal Values
            <Box
              component="span"
              sx={{
                display: "block",
                background: "linear-gradient(to right, #0369a1, #2563eb, #4338ca)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Fast &amp; Precisely
            </Box>
          </Typography>

          {/* Description */}
          <Typography
            sx={{
              mt: "0.75rem",
              color: "#1f2937",
              fontSize: { xs: "1rem", sm: "1.125rem" },
              lineHeight: 1.7,
              maxWidth: "36rem",
              fontFamily: sansFont,
            }}
          >
            Developed for real estate professionals, the Zonal Finder of Filipino
            Homes provides accurate zonal values per square meter across streets
            and barangays. Users can evaluate property areas, analyze nearby
            establishments, and produce detailed reports for reliable property
            pricing.
          </Typography>

          {/* Feature cards grid */}
          <Box
            sx={{
              mt: "1.25rem",
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: "0.75rem",
              maxWidth: "48rem",
            }}
          >
            <Feature
              icon={<Compass size={25} />}
              title="Smart Pinning"
              desc="Street-level accuracy with Google + snap"
            />
            <Feature
              icon={<ShieldCheck size={25} />}
              title="Reliable Filters"
              desc="Province, city, barangay in seconds"
            />
            <Feature
              icon={<TrendingUp size={25} />}
              title="Instant Insights"
              desc="Nearby POIs and quick facts"
            />
            <Feature
              icon={<Zap size={25} />}
              title="1-Click Report"
              desc="Beautiful PDF with branded layout"
            />
          </Box>

          {/* CTA button */}
          <Box sx={{ mt: "1.5rem" }}>
            <Button
              onClick={enterApp}
              disabled={!canExplore}
              sx={{
                px: "1.5rem",
                py: "0.75rem",
                borderRadius: "12px",
                color: "#fff",
                fontFamily: sansFont,
                fontWeight: 700,
                fontSize: "1rem",
                textTransform: "none",
                background: canExplore
                  ? "linear-gradient(135deg, #1e3a8a, #2563eb)"
                  : "#9ca3af",
                boxShadow: canExplore
                  ? "0 4px 18px rgba(37,99,235,0.35)"
                  : "none",
                "&:hover": canExplore
                  ? {
                      background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)",
                      boxShadow: "0 6px 24px rgba(37,99,235,0.45)",
                      transform: "translateY(-1px)",
                    }
                  : {},
                "&.Mui-disabled": {
                  color: "#fff",
                  background: "#9ca3af",
                },
                transition: "all 0.2s",
              }}
            >
              {loading ? "Loading..." : "Start Exploring"}
            </Button>
          </Box>
        </Box>

        {/* ── Right image ── */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Box
            sx={{
              position: "relative",
              width: "100%",
              height: { xs: "420px", sm: "520px", lg: "560px" },
              transform: "translateY(-40px)",
            }}
          >
            <Image
              src="/pictures/phil3.png"
              alt="Philippines map"
              fill
              style={{ objectFit: "contain", transform: "scale(1.05)" }}
              priority
            />

            {/* Bouncing pointer */}
            <Box
              component="img"
              src="/pictures/filipinohomespointer.png"
              alt="Pointer"
              sx={{
                position: "absolute",
                left: "50%",
                top: "45%",
                transform: "translateX(-50%) translateY(-100%)",
                width: 110,
                height: 110,
                animation: "bounce 1s infinite",
                "@keyframes bounce": {
                  "0%, 100%": {
                    transform: "translateX(-50%) translateY(-100%)",
                    animationTimingFunction: "cubic-bezier(0.8,0,1,1)",
                  },
                  "50%": {
                    transform: "translateX(-50%) translateY(calc(-100% - 16px))",
                    animationTimingFunction: "cubic-bezier(0,0,0.2,1)",
                  },
                },
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* ══════════════════════════════════
          FOOTER
      ══════════════════════════════════ */}
      <Box
        component="footer"
        sx={{
          position: "absolute",
          bottom: "0.5rem",
          width: "100%",
          textAlign: "center",
          fontSize: "0.75rem",
          color: "#4b5563",
          fontFamily: sansFont,
        }}
      >
        © {new Date().getFullYear()} Filipino Homes | Developers
      </Box>
    </Box>
  );
}