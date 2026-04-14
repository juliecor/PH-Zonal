"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Compass, ShieldCheck, TrendingUp, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { apiMe, getToken } from "../lib/authClient";
import LowBalanceNotice from "../components/LowBalanceNotice";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

const sansFont = "'DM Sans', sans-serif";
const NAVY = "#1a2744";
const GOLD = "#c9a84c";

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
        <Typography sx={{ color: GOLD, fontWeight: 700 }}>{initials}</Typography>
        <Box
          component="span"
          sx={{
            position: "absolute",
            bottom: -6,
            right: -8,
            background: GOLD,
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
function FeatureCard({
  icon,
  title,
  desc,
  gradient,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  gradient: string;
}) {
  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "16px",
        p: "1.1rem 0.9rem 1rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "0.45rem",
        background: "#fff",
        flex: 1,
        minWidth: 0,
        boxShadow: "0 2px 16px rgba(26,39,68,0.08)",
        border: "1.5px solid rgba(26,39,68,0.07)",
        transition: "transform 0.2s, box-shadow 0.2s",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: "0 8px 28px rgba(26,39,68,0.13)",
        },
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: gradient,
          borderRadius: "16px 16px 0 0",
        },
      }}
    >
      <Box
        sx={{
          width: 46,
          height: 46,
          borderRadius: "12px",
          background: gradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          mb: "0.2rem",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
      >
        {icon}
      </Box>

      <Typography
        sx={{
          fontWeight: 800,
          fontSize: "0.72rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: NAVY,
          fontFamily: sansFont,
          lineHeight: 1.3,
        }}
      >
        {title}
      </Typography>

      {/* ✅ Hidden on mobile, visible from sm and up */}
      <Typography
        sx={{
          fontSize: "0.73rem",
          color: "#6b7280",
          lineHeight: 1.5,
          fontFamily: sansFont,
          display: { xs: "none", sm: "block" },
        }}
      >
        {desc}
      </Typography>
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

  const features = [
    {
      icon: <Compass size={22} strokeWidth={2} />,
      title: "Smart Pinning",
      desc: "Precise street-level accuracy with integrated satellite and street view.",
      gradient: "linear-gradient(135deg, #1e3a8a, #2563eb)",
    },
    {
      icon: <ShieldCheck size={22} strokeWidth={2} />,
      title: "Reliable Filters",
      desc: "Find specific areas by province, city, and barangay in seconds.",
      gradient: "linear-gradient(135deg, #b45309, #d97706)",
    },
    {
      icon: <TrendingUp size={22} strokeWidth={2} />,
      title: "Instant Insights",
      desc: "Analyze nearby POIs, commercial zones, and quick-fact overlays.",
      gradient: "linear-gradient(135deg, #065f46, #059669)",
    },
    {
      icon: <Zap size={22} strokeWidth={2} />,
      title: "1-Click Reports",
      desc: "Generate professional, branded PDFs in one click.",
      gradient: "linear-gradient(135deg, #7c1d1d, #cc2a2a)",
    },
  ];

  return (
    <Box
      component="main"
      sx={{
        position: "relative",
        // ✅ Desktop: locked full screen. Mobile: scrollable min-height
        minHeight: "100vh",
        height: { lg: "100vh" },
        overflow: { xs: "auto", lg: "hidden" },
        background: "#f5f1e8",
        fontFamily: sansFont,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <LowBalanceNotice threshold={3} remindAfterHours={24} />

      {/* ── Background triangles ── */}
      <Box
        sx={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 340,
          height: 340,
          background: "rgba(201,168,76,0.12)",
          clipPath: "polygon(100% 0, 0 0, 100% 100%)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          bottom: -80,
          left: -80,
          width: 400,
          height: 400,
          background: "rgba(20,184,166,0.08)",
          clipPath: "polygon(0 100%, 100% 100%, 0 0)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          bottom: 40,
          right: 0,
          width: 260,
          height: 260,
          background: "rgba(201,168,76,0.09)",
          clipPath: "polygon(100% 0, 0 100%, 100% 100%)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* ══════════════════════════════════
          HEADER
      ══════════════════════════════════ */}
      <Box
        component="header"
        sx={{
          maxWidth: "1280px",
          width: "100%",
          mx: "auto",
          px: { xs: "1.25rem", md: "2.5rem" },
          py: "0.7rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        <Image
          src="/pictures/FilipinoHomes.png"
          alt="Filipino Homes"
          width={200}
          height={55}
          style={{ objectFit: "contain" }}
        />

        {authed ? (
          <ProfileAvatar name={name} balance={balance} href={dashHref} />
        ) : (
          <Link href="/login" style={{ textDecoration: "none" }}>
            <Box
              sx={{
                border: `2px solid ${NAVY}`,
                borderRadius: "9999px",
                px: "1.6rem",
                py: "0.4rem",
                color: NAVY,
                fontWeight: 700,
                fontSize: "0.95rem",
                fontFamily: sansFont,
                background: "transparent",
                cursor: "pointer",
                transition: "all 0.2s",
                "&:hover": { background: NAVY, color: "#fff" },
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
          flex: 1,
          maxWidth: "1280px",
          width: "100%",
          mx: "auto",
          // ✅ More padding on mobile so content breathes when scrolling
          px: { xs: "1.25rem", md: "2.5rem" },
          py: { xs: "1.5rem", lg: "0" },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          gap: { xs: "1.5rem", lg: "2rem" },
          alignItems: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* ── Left content ── */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>

          <Box>
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: "1.9rem", sm: "2.5rem", xl: "3.2rem" },
                fontWeight: 900,
                lineHeight: 1.12,
                color: NAVY,
                fontFamily: sansFont,
                mb: "0.2rem",
              }}
            >
              Discover Precise Zonal Values
              <br />
              With Filipino Homes
            </Typography>

            <Typography
              sx={{
                fontSize: { xs: "1.2rem", sm: "1.6rem", xl: "1.9rem" },
                fontWeight: 800,
                fontStyle: "italic",
                color: GOLD,
                fontFamily: sansFont,
                lineHeight: 1.2,
              }}
            >
              Accelerate Your Decisions
            </Typography>
          </Box>

          <Typography
            sx={{
              color: "#374151",
              fontSize: { xs: "0.88rem", sm: "0.95rem" },
              lineHeight: 1.7,
              maxWidth: "34rem",
              fontFamily: sansFont,
            }}
          >
            Developed for real estate professionals, the Zonal Finder provides
            instant, accurate zonal values per square meter for every street and
            barangay across the Philippines. Make data-driven property decisions
            faster.
          </Typography>

          {/* Feature cards */}
          <Box
            sx={{
              display: "flex",
              // ✅ On mobile: 2-column grid so cards don't stack too tall
              flexDirection: { xs: "row", sm: "row" },
              flexWrap: { xs: "wrap", sm: "nowrap" },
              gap: "0.6rem",
            }}
          >
            {features.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </Box>

          <Box>
            <Button
              onClick={enterApp}
              disabled={!canExplore}
              sx={{
                px: "2.2rem",
                py: "0.8rem",
                borderRadius: "10px",
                color: "#fff",
                fontFamily: sansFont,
                fontWeight: 800,
                fontSize: "0.95rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                background: canExplore
                  ? `linear-gradient(135deg, ${NAVY}, #2d4a80)`
                  : "#9ca3af",
                boxShadow: canExplore
                  ? `0 6px 22px rgba(26,39,68,0.32)`
                  : "none",
                "&:hover": canExplore
                  ? {
                      background: `linear-gradient(135deg, #0f1f38, ${NAVY})`,
                      boxShadow: "0 8px 28px rgba(26,39,68,0.42)",
                      transform: "translateY(-2px)",
                    }
                  : {},
                "&.Mui-disabled": {
                  color: "#fff",
                  background: "#9ca3af",
                },
                transition: "all 0.2s",
              }}
            >
              {loading ? "Loading..." : "Start Now"}
            </Button>
          </Box>
        </Box>

        {/* ── Right: Map image ── */}
        <Box
          sx={{
            // ✅ Show map on mobile too but smaller
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            position: "relative",
            height: { xs: "280px", sm: "360px", lg: "100%" },
          }}
        >
          <Box
            sx={{
              position: "relative",
              width: "100%",
              height: { xs: "280px", sm: "360px", lg: "105%" },
              mt: { lg: "-5%" },
            }}
          >
            <Image
              src="/pictures/phil3.png"
              alt="Philippines map"
              fill
              style={{ objectFit: "contain", objectPosition: "center top" }}
              priority
            />

            {/* ✅ Pointer shifted left: was left:"55%", now left:"44%" */}
            <Box
              component="img"
              src="/pictures/filipinohomespointer.png"
              alt="Pointer"
              sx={{
                position: "absolute",
                left: "44%",
                top: "36%",
                transform: "translateX(-50%) translateY(-100%)",
                width: { xs: 60, lg: 85 },
                height: { xs: 60, lg: 85 },
                animation: "bounce 1s infinite",
                "@keyframes bounce": {
                  "0%, 100%": {
                    transform: "translateX(-50%) translateY(-100%)",
                    animationTimingFunction: "cubic-bezier(0.8,0,1,1)",
                  },
                  "50%": {
                    transform: "translateX(-50%) translateY(calc(-100% - 14px))",
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
          textAlign: "center",
          py: "0.5rem",
          fontSize: "0.72rem",
          color: "#9ca3af",
          fontFamily: sansFont,
          position: "relative",
          zIndex: 1,
          flexShrink: 0,
        }}
      >
        © {new Date().getFullYear()} Filipino Homes | Developers
      </Box>
    </Box>
  );
}