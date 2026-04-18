"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Compass, ShieldCheck, TrendingUp, Zap, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { apiMe, getToken } from "../lib/authClient";
import LowBalanceNotice from "../components/LowBalanceNotice";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";

const FONT_TITLE = "'Urbanist', sans-serif";
const FONT_TEXT = "'Outfit', sans-serif";

const C = {
  blue: "#4cc9f0",
  blueDeep: "#4361ee",
  glass: "rgba(255, 255, 255, 0.03)",
  glassBorder: "rgba(255, 255, 255, 0.12)",
  textMain: "#ffffff",
  textMuted: "rgba(255, 255, 255, 0.6)",
  bgDark: "#050b14",
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Urbanist:wght@700;800;900&family=Outfit:wght@300;400;500;600&display=swap');

  @keyframes shimmer-glow {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 10px currentColor; }
    50% { box-shadow: 0 0 25px currentColor, 0 0 40px currentColor; }
  }
  @keyframes card-glow {
    0%, 100% { box-shadow: 0 0 15px var(--card-color); }
    50% { box-shadow: 0 0 25px var(--card-color), 0 0 40px var(--card-color); }
  }
  @keyframes btn-bg-waves {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  /* ── Entrance animations ── */
  @keyframes fade-slide-up {
    from { opacity: 0; transform: translateY(40px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fade-slide-left {
    from { opacity: 0; transform: translateX(60px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Video background fade in ── */
  @keyframes video-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .video-bg {
    opacity: 0;
    animation: video-fade-in 2.5s ease 0.3s forwards;
  }

  .enter-up {
    opacity: 0;
    animation: fade-slide-up 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  .enter-left {
    opacity: 0;
    animation: fade-slide-left 1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  .enter-fade {
    opacity: 0;
    animation: fade-in 1s ease forwards;
  }
`;


function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <Box sx={{
      px: { xs: 1.5, md: 2.5 }, py: 1.2, borderRadius: "14px",
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${C.glassBorder}`,
      backdropFilter: "blur(4px)",
      minWidth: "80px",
      cursor: "default",
      transition: "all 0.3s ease",
      "&:hover": {
        background: "rgba(255,255,255,0.1)",
        transform: "translateY(-2px)",
        boxShadow: "0 8px 25px rgba(76, 201, 240, 0.2)",
        borderColor: C.blue,
      }
    }}>
      <Typography sx={{
        fontFamily: FONT_TITLE, fontWeight: 800, fontSize: { xs: "1.3rem", md: "1.7rem" }, color: "#fff",
        textShadow: "0 2px 15px rgba(0,0,0,0.4)",
        transition: "all 0.3s ease",
      }}>{value}</Typography>
      <Typography sx={{
        fontFamily: FONT_TEXT, fontSize: { xs: "0.75rem", md: "1rem" }, color: "rgba(255,255,255,0.8)",
        textTransform: "unset", letterSpacing: "0.6px",
        textShadow: "0 1px 5px rgba(0,0,0,0.3)",
      }}>{label}</Typography>
    </Box>
  );
}

function FeatureGlassCard({ icon, title, desc, delay, color }: { icon: React.ReactNode; title: string; desc: string; delay: string; color: string }) {
  return (
    <Box sx={{
      "--card-color": color,
      p: 2, borderRadius: "16px",
      background: "rgba(255, 255, 255, 0.08)",
      border: `1px solid ${C.glassBorder}`,
      backdropFilter: "blur(4px)",
      WebkitBackdropFilter: "blur(4px)",
      transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      animation: `slide-up 0.9s cubic-bezier(0.22, 1, 0.36, 1) ${delay} both`,
      cursor: "pointer",
      "&:hover": {
        background: "rgba(255, 255, 255, 0.12)",
        transform: "translateY(-5px) scale(1.02)",
        borderColor: color,
        boxShadow: `0 15px 40px ${color}30, 0 0 20px ${color}15`,
        "& .card-icon": {
          transform: "scale(1.1) rotate(5deg)",
          boxShadow: `0 6px 20px ${color}50`,
        },
        "& .card-title": {
          textShadow: `0 0 20px ${color}80`,
        },
      }
    }}>
      <Box className="card-icon" sx={{
        width: { xs: 45, md: 55 }, height: { xs: 45, md: 55 }, borderRadius: "12px",
        background: `${color}25`,
        border: `1px solid ${color}40`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: color, mb: 1.5,
        boxShadow: `0 4px 15px ${color}40`,
        transition: "all 0.3s ease",
      }}>
        {icon}
      </Box>
      <Typography className="card-title" sx={{
        fontFamily: FONT_TITLE, fontWeight: 700, fontSize: { xs: "1rem", md: "1.3rem" }, color: "#fff", mb: 0.5, letterSpacing: "0.5px",
        textShadow: "0 2px 10px rgba(0,0,0,0.5)",
        transition: "all 0.3s ease",
      }}>
        {title}
      </Typography>
      <Typography sx={{
        fontFamily: FONT_TEXT, fontSize: { xs: "0.85rem", md: "1rem" }, color: "rgba(255,255,255,0.9)", lineHeight: 1.6,
        textShadow: "0 1px 5px rgba(0,0,0,0.3)",
      }}>
        {desc}
      </Typography>
    </Box>
  );
}

export default function WelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(!!getToken());
    apiMe().then((me) => {
      if (me) {
        setBalance(me.token_balance ?? null);
        setName(me.name || "");
        setAuthed(true);
      }
    });
  }, []);

  const enterApp = () => {
    setLoading(true);
    router.push("/?skip=1");
  };

  return (
    <Box sx={{
      minHeight: "100vh", bgcolor: C.bgDark, color: "#fff",
      position: "relative", overflow: "hidden", display: "flex", flexDirection: "column"
    }}>
      <style>{STYLES}</style>
      <LowBalanceNotice threshold={3} remindAfterHours={24} />

      {/* ── Background video with fade-in ── */}
      <Box sx={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <video
          className="video-bg"
          src="/video/map_vid.mov"
          autoPlay
          loop
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        {/* Overlay fades in slightly after video */}
        <Box
          className="enter-fade"
          sx={{
            animationDelay: "0.6s",
            position: "absolute", inset: 0,
            background: `radial-gradient(circle at 20% 50%, rgba(5, 11, 20, 0.72) 0%, ${C.bgDark} 100%)`
          }}
        />
      </Box>

      {/* ── Navbar ── */}
      <Box
        className="enter-fade"
        sx={{
          animationDelay: "0.8s",
          position: "relative", zIndex: 10,
          px: { xs: 2, md: 6 }, py: 2,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap"
        }}
      >
        <Box sx={{ width: { xs: 180, md: 260 } }}>
          <Image src="/pictures/fh.png" alt="Filipino Homes" width={260} height={35} style={{ width: "100%", height: "auto" }} />
        </Box>
        <Box sx={{ display: { xs: "none", md: "flex" }, gap: 2, alignItems: "center" }}>
          <Chip
            label="Zonal Finder v2"
            sx={{
              bgcolor: "rgba(76,201,240,0.1)", color: C.blue, fontWeight: 400,
              fontFamily: FONT_TEXT, fontSize: "1.2rem", padding: "1.5rem 1rem", borderRadius: "100px"
            }}
          />
          {authed && (
            <Box sx={{
              px: 1.5, py: 0.4, borderRadius: "8px",
              border: `1px solid ${C.glassBorder}`,
              fontFamily: FONT_TEXT, fontSize: "0.75rem"
            }}>
              {name} • <span style={{ color: C.blue }}>{balance ?? 0}</span>
            </Box>
          )}
        </Box>
      </Box>

      {/* ── Main content ── */}
      <Box sx={{
        position: "relative", zIndex: 1, flex: 1,
        px: { xs: 2, md: 6 },
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4,
        flexDirection: { xs: "column", lg: "row" }
      }}>
        <Box sx={{ maxWidth: { xs: "100%", lg: "1000px" }, width: "100%" }}>

          {/* Badge */}
          <Box
            className="enter-up"
            sx={{
              animationDelay: "1s",
              display: "inline-flex", alignItems: "center", gap: 1,
              px: 2, py: 0.6, borderRadius: "100px",
              bgcolor: "rgba(76, 201, 240, 0.08)",
              border: `1px solid rgba(76, 201, 240, 0.25)`,
              mb: 2, backdropFilter: "blur(10px)",
              transition: "all 0.70s ease",
              "&:hover": {
                bgcolor: "rgba(76, 201, 240, 0.12)",
                boxShadow: "0 0 20px rgba(76, 201, 240, 0.2)",
              }
            }}
          >
            <Box sx={{
              width: 6, height: 6, bgcolor: C.blue, borderRadius: "50%",
              boxShadow: `0 0 10px ${C.blue}`,
              animation: "pulse-glow 2s ease-in-out infinite",
            }} />
            <Typography sx={{
              fontFamily: FONT_TITLE, fontSize: "0.9rem", fontWeight: 800,
              letterSpacing: "1.5px", color: C.blue
            }}>
              REAL ESTATE INTELLIGENCE
            </Typography>
          </Box>

          {/* Headline */}
          <Typography
            className="enter-up"
            variant="h1"
            sx={{
              animationDelay: "1.15s",
              fontFamily: FONT_TITLE, fontWeight: 900,
              fontSize: { xs: "2rem", md: "3rem", lg: "4.5rem" },
              lineHeight: 1.1, mb: 1.5, letterSpacing: "-0.5px",
              textShadow: "0 4px 25px rgba(0,0,0,0.6)"
            }}
          >
            Discover{" "}
            <span style={{ color: C.blue, textShadow: "0 0px 40px rgba(76, 201, 240, 0.55)" }}>
              Precise Zonal Values
            </span>{" "}
            <br /> Across the Philippines
          </Typography>

          {/* Subtitle */}
          <Typography
            className="enter-up"
            sx={{
              animationDelay: "1.3s",
              fontFamily: FONT_TEXT, fontSize: { xs: "1rem", md: "1.3rem" },
              color: "rgba(255,255,255,0.95)",
              maxWidth: "100%", mb: 3, fontWeight: 400, lineHeight: 1.7,
              textShadow: "0 2px 15px rgba(0,0,0,0.4)",
            }}
          >
            Built for real estate professionals — get street-level accuracy for every barangay and province.
          </Typography>

          {/* Stat boxes */}
          <Box
            className="enter-up"
            sx={{ animationDelay: "1.45s", display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}
          >
            <StatBox value="81+" label="Provinces" />
            <StatBox value="1,634" label="Municipalities" />
            <StatBox value="42K+" label="Barangays" />
          </Box>

          {/* Action row */}
          <Box
            className="enter-up"
            sx={{ animationDelay: "1.6s", display: "flex", alignItems: "center", gap: 2, mb: 4, flexWrap: "wrap" }}
          >
            <Button
              onClick={enterApp}
              sx={{
                px: 3.5, py: 1.4, borderRadius: "14px",
                background: `linear-gradient(135deg, ${C.blueDeep} 0%, ${C.blue} 100%)`,
                color: "#fff", fontFamily: FONT_TITLE, fontWeight: 600,
                textTransform: "none", fontSize: "1rem",
                boxShadow: `0 15px 30px rgba(67, 97, 238, 0.3)`,
                transition: "all 0.3s ease",
                position: "relative", overflow: "hidden",
                "&::before": {
                  content: '""', position: "absolute", inset: 0,
                  background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4) 0%, transparent 65%)`,
                  opacity: 0, transition: "opacity 0.4s ease", zIndex: 0,
                },
                "&:hover": {
                  transform: "translateY(-3px) scale(1.02)",
                  boxShadow: `0 25px 50px rgba(67, 97, 238, 0.5), 0 0 30px rgba(76, 201, 240, 0.3)`,
                  background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueDeep} 100%)`,
                  "&::before": { opacity: 1 },
                },
                "&:active": { transform: "translateY(-1px) scale(0.98)" }
              }}
              endIcon={<ArrowRight size={18} />}
            >
              {loading ? "Loading..." : "Start Exploring"}
            </Button>

            {!authed && (
              <Link
                href="/login"
                style={{
                  color: "rgba(255,255,255,0.9)", textDecoration: "none",
                  fontFamily: FONT_TEXT, fontWeight: 600, fontSize: "1rem",
                  textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                  transition: "all 0.3s ease",
                  padding: "0.8rem 1rem",
                  borderRadius: "10px",
                  border: "1px solid transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#fff";
                  e.currentTarget.style.borderColor = C.blue;
                  e.currentTarget.style.background = "rgba(76, 201, 240, 0.1)";
                  e.currentTarget.style.boxShadow = "0 0 20px rgba(76, 201, 240, 0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(255,255,255,0.9)";
                  e.currentTarget.style.borderColor = "transparent";
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                Sign in to your account
              </Link>
            )}
          </Box>

          {/* Feature cards */}
          <Box
            className="enter-up"
            sx={{
              animationDelay: "0.85s",
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" },
              gap: 1.5
            }}
          >
            <FeatureGlassCard delay="0.85s" icon={<Compass size={16} />}     title="SMART PINNING"    desc="Street-level accuracy with satellite view." color="#4cc9f0" />
            <FeatureGlassCard delay="0.98s" icon={<ShieldCheck size={16} />} title="RELIABLE FILTERS" desc="Filter by province, city & barangay."        color="#10b981" />
            <FeatureGlassCard delay="1.11s" icon={<TrendingUp size={16} />}  title="INSTANT INSIGHTS" desc="Analyze nearby commercial zones."             color="#f59e0b" />
            <FeatureGlassCard delay="1.24s" icon={<Zap size={16} />}         title="1-CLICK REPORTS"  desc="Generate professional PDF reports."           color="#ef4444" />
          </Box>
        </Box>

        {/* 3D floating image */}
        <Box
          className="enter-left"
          sx={{
            animationDelay: "5.3s",
            display: { xs: "none", lg: "block" },
            textAlign: "center",
            "& img": {
              width: "100%",
              maxWidth: "380px",
              height: "auto",
              filter: "drop-shadow(0 0px 20px rgb(76, 201, 240, 0.65))",
              animation: "float 20s ease-in-out infinite",
            }
          }}
        >
          <Image
            src="/pictures/3d-fh.png"
            alt="Filipino Homes 3D"
            width={380}
            height={380}
            style={{ objectFit: "contain" }}
          />
        </Box>
      </Box>

      {/* ── Footer ── */}
      <Box
        className="enter-fade"
        sx={{
          animationDelay: "2.4s",
          py: 2, textAlign: "center",
          borderTop: `1px solid ${C.glassBorder}`
        }}
      >
        <Typography sx={{
          fontFamily: FONT_TEXT, fontSize: "0.75rem",
          color: "rgba(255,255,255,0.6)", textShadow: "0 1px 5px rgba(0,0,0,0.3)"
        }}>
          © {new Date().getFullYear()} Filipino Homes | Real Estate Tech Division
        </Typography>
      </Box>
    </Box>
  );
}