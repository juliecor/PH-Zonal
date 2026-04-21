"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { apiLogin, apiRequestLoginOtp, apiVerifyLoginOtp, setToken, setCachedUser } from "../lib/authClient";
import Image from "next/image";

// MUI imports
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";

// MUI Icons
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import MarkEmailUnreadOutlinedIcon from "@mui/icons-material/MarkEmailUnreadOutlined";

// ── Design tokens ──────────────────────────────────────────
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
  green: "#10b981",
};

// ── Shared input sx ────────────────────────────────────────
const inputSx = {
  "& .MuiOutlinedInput-root": {
    fontFamily: FONT_TEXT,
    fontSize: "1rem",
    color: "#fff",
    borderRadius: "14px",
    background: "rgba(20, 30, 48, 1)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    transition: "all 0.3s ease",
    "& fieldset": { border: "none", borderRadius: "inherit", padding: 0 },
    "& .MuiOutlinedInput-notchedOutline": { border: "none", borderRadius: "inherit" },
    "&:hover": {
      background: "rgba(20, 30, 48, 1)",
      borderColor: "rgba(76, 201, 240, 0.3)",
    },
    "&.Mui-focused": {
      background: "rgba(20, 30, 48, 1)",
      borderColor: C.blue,
      boxShadow: `0 0 0 3px rgba(76, 201, 240, 0.15), 0 0 25px rgba(76, 201, 240, 0.1)`,
      "& fieldset": { border: "none", borderRadius: "inherit", padding: 0 },
      "& .MuiOutlinedInput-notchedOutline": { border: "none", borderRadius: "inherit" },
    },
    "& .MuiInputBase-input": {
      background: "transparent",
      color: "#fff",
    },
    "& .MuiInputAdornment-root": {
      background: "transparent",
      color: "rgba(255, 255, 255, 0.5)",
    },
    "& input:-webkit-autofill": {
      WebkitBoxShadow: "0 0 0 1000px rgba(20, 30, 48, 1) inset",
      WebkitTextFillColor: "#fff",
    },
    "& input:-webkit-autofill:hover": {
      WebkitBoxShadow: "0 0 0 1000px rgba(20, 30, 48, 1) inset",
      WebkitTextFillColor: "#fff",
    },
    "& input:-webkit-autofill:focus": {
      WebkitBoxShadow: "0 0 0 1000px rgba(20, 30, 48, 1) inset",
      WebkitTextFillColor: "#fff",
    },
    "& input::placeholder": { color: "rgba(255, 255, 255, 0.5)", opacity: 1 },
  },
};

// ── OTP digit input sx ─────────────────────────────────────
const otpInputSx = {
  "& .MuiOutlinedInput-root": {
    fontFamily: FONT_TITLE,
    fontSize: "2rem",
    fontWeight: 800,
    color: "#fff",
    borderRadius: "16px",
    background: "rgba(20, 30, 48, 1)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    transition: "all 0.3s ease",
    letterSpacing: "10px",
    textAlign: "center",
    "& fieldset": { border: "none" },
    "& .MuiOutlinedInput-notchedOutline": { border: "none" },
    "&:hover": {
      borderColor: "rgba(76, 201, 240, 0.3)",
    },
    "&.Mui-focused": {
      borderColor: C.blue,
      boxShadow: `0 0 0 3px rgba(76, 201, 240, 0.15), 0 0 30px rgba(76, 201, 240, 0.15)`,
    },
    "& input": {
      textAlign: "center",
      letterSpacing: "12px",
      padding: "1rem 1rem",
      color: "#fff",
      background: "transparent",
    },
    "& input::placeholder": { color: "rgba(255, 255, 255, 0.2)", opacity: 1, letterSpacing: "8px" },
  },
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Urbanist:wght@700;800;900&family=Outfit:wght@300;400;500;600&display=swap');

  @keyframes slideInLeft {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 10px currentColor; }
    50% { box-shadow: 0 0 25px currentColor, 0 0 40px currentColor; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(18px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes iconPop {
    0% { transform: scale(0.6); opacity: 0; }
    70% { transform: scale(1.12); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
`;

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // OTP login state
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpPhase, setOtpPhase] = useState<"email" | "code">("email");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpUserId, setOtpUserId] = useState<number | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpErr, setOtpErr] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const { token, user } = await apiLogin({ email, password });
      setToken(token);
      try { setCachedUser(user); } catch {}
      const role = String(user?.role || "").toLowerCase();
      const next = search.get('next');
      if (next && next.startsWith('/')) {
        router.replace(next);
      } else {
        router.replace(role === "admin" ? "/admin" : "/dashboard");
      }
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{STYLES}</style>

      {/* ── Root ── */}
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: C.bgDark,
          display: "flex",
          fontFamily: FONT_TEXT,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background Video Layer */}
        <Box sx={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
          <Box
            component="video"
            src="/video/map_vid.mov"
            autoPlay
            loop
            muted
            playsInline
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.65,
              pointerEvents: "none",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(circle at 20% 50%, rgba(5, 11, 20, 0.72) 0%, ${C.bgDark} 100%)`,
              pointerEvents: "none",
            }}
          />
        </Box>

        {/* ══════════════════════════════════
            LEFT DECORATIVE PANEL
        ══════════════════════════════════ */}
        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            width: "45%",
            position: "relative",
            overflow: "hidden",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            animation: "slideInLeft 0.6s ease-out both",
            zIndex: 1,
          }}
        >
          <Box
            sx={{
              animation: "float 3s ease-in-out infinite",
              "& img": {
                width: "100%",
                maxWidth: "320px",
                height: "auto",
                filter: `drop-shadow(0 0px 30px rgba(76, 201, 240, 0.4))`,
              }
            }}
          >
            <Image
              src="/pictures/3d-fh.png"
              alt="Filipino Homes 3D"
              width={320}
              height={320}
              style={{ objectFit: "contain" }}
            />
          </Box>

          <Box sx={{ zIndex: 1, textAlign: "center", mt: 4 }}>
            <Typography
              sx={{
                fontFamily: FONT_TITLE,
                fontSize: { xs: "1.8rem", md: "2.4rem" },
                fontWeight: 800,
                color: "#fff",
                lineHeight: 1.2,
                textTransform: "capitalize",
                mb: "1rem",
                textShadow: "0 4px 25px rgba(0,0,0,0.5)",
              }}
            >
              Property insights,{" "}
              <Box component="span" sx={{ color: C.blue, textShadow: `0 0 40px rgba(76, 201, 240, 0.55)` }}>
                precisely
              </Box>{" "}
              mapped.
            </Typography>
            <Typography
              sx={{
                fontSize: "1.1rem",
                color: "rgba(255,255,255,0.8)",
                lineHeight: 1.75,
                maxWidth: "100%",
                fontWeight: 400,
                textShadow: "0 2px 15px rgba(0,0,0,0.4)",
              }}
            >
              Access verified zonal values across all regions empowering smarter real estate decisions.
            </Typography>
          </Box>
        </Box>

        {/* ══════════════════════════════════
            RIGHT FORM PANEL
        ══════════════════════════════════ */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: { xs: "2rem 1.25rem", sm: "2.5rem 2rem" },
            animation: "slideInRight 0.6s ease-out 0.1s both",
            zIndex: 1,
          }}
        >
          {/* Glass Card */}
          <Box
            component="form"
            onSubmit={onSubmit}
            sx={{
              width: "100%",
              maxWidth: 480,
              p: { xs: 3, sm: 4 },
              borderRadius: "24px",
              background: "rgba(255, 255, 255, 0.02)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.3)",
            }}
          >
            {/* Logo */}
            <Box sx={{ display: "flex", justifyContent: "center", mb: 5.5 }}>
              <Link href="/welcome">
                <Box
                  component="span"
                  sx={{
                    display: "inline-block",
                    transition: "all 0.3s ease",
                    "&:hover": { opacity: 0.8, transform: "scale(1.02)" },
                  }}
                >
                  <Image src="/pictures/fh.png" alt="Filipino Homes" width={260} height={21} />
                </Box>
              </Link>
            </Box>

            {/* Eyebrow badge */}
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.8,
                px: 2,
                py: 0.5,
                borderRadius: "100px",
                bgcolor: "rgba(76, 201, 240, 0.08)",
                border: "1px solid rgba(76, 201, 240, 0.25)",
                mb: 2,
              }}
            >
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  bgcolor: C.blue,
                  borderRadius: "50%",
                  boxShadow: `0 0 10px ${C.blue}`,
                  animation: "pulse-glow 2s ease-in-out infinite",
                }}
              />
              <Typography
                sx={{
                  fontFamily: FONT_TITLE,
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  letterSpacing: "1.5px",
                  color: C.blue,
                }}
              >
                SECURE ACCESS
              </Typography>
            </Box>

            {/* Title */}
            <Typography
              component="h1"
              sx={{
                fontFamily: FONT_TITLE,
                fontSize: { xs: "2rem", md: "2.5rem" },
                fontWeight: 800,
                color: "#fff",
                mb: 0.5,
                lineHeight: 1.1,
                textShadow: "0 4px 25px rgba(0,0,0,0.5)",
              }}
            >
              Welcome back
            </Typography>

            {/* Blue divider */}
            <Box
              sx={{
                width: 44,
                height: "3px",
                background: `linear-gradient(90deg, ${C.blueDeep}, ${C.blue})`,
                borderRadius: 2,
                mb: 2,
                mt: 1,
                boxShadow: `0 0 15px ${C.blue}50`,
              }}
            />

            {/* Subtitle */}
            <Typography
              sx={{
                fontSize: "1.05rem",
                color: "rgba(255,255,255,0.8)",
                mb: 3,
                fontWeight: 400,
                lineHeight: 1.6,
                fontFamily: FONT_TEXT,
                textShadow: "0 1px 5px rgba(0,0,0,0.3)",
              }}
            >
              Sign in to your Zonal Value account to continue.
            </Typography>

            {/* ── Email field ── */}
            <Box sx={{ mb: 2.5 }}>
              <Typography
                component="label"
                sx={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.9)",
                  mb: 1,
                  fontFamily: FONT_TITLE,
                }}
              >
                Email address
              </Typography>
              <TextField
                type="email"
                required
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                slotProps={{
                  input: {
                    startAdornment: (
                      <Box component="span" sx={{ mr: 1, display: "flex" }}>
                        <EmailOutlinedIcon sx={{ fontSize: 20 }} />
                      </Box>
                    ),
                  },
                }}
                sx={inputSx}
              />
            </Box>

            {/* ── Password field ── */}
            <Box sx={{ mb: 3 }}>
              <Typography
                component="label"
                sx={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.9)",
                  mb: 1,
                  fontFamily: FONT_TITLE,
                }}
              >
                Password
              </Typography>
              <TextField
                type="password"
                required
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                slotProps={{
                  input: {
                    startAdornment: (
                      <Box component="span" sx={{ mr: 1, display: "flex" }}>
                        <LockOutlinedIcon sx={{ fontSize: 20 }} />
                      </Box>
                    ),
                  },
                }}
                sx={inputSx}
              />
            </Box>

            {/* ── Error message ── */}
            {err && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  mb: 2,
                  p: "0.85rem 1rem",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "12px",
                  color: "#ef4444",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  fontFamily: FONT_TEXT,
                }}
              >
                <Box sx={{ width: 6, height: 6, bgcolor: "#ef4444", borderRadius: "50%", flexShrink: 0 }} />
                {err}
              </Box>
            )}

            {/* ── Submit button ── */}
            <Button
              type="submit"
              disabled={loading}
              fullWidth
              sx={{
                p: "1rem",
                background: `linear-gradient(135deg, ${C.blueDeep} 0%, ${C.blue} 100%)`,
                color: "#fff",
                fontFamily: FONT_TITLE,
                fontSize: "1rem",
                fontWeight: 700,
                letterSpacing: "0.5px",
                textTransform: "none",
                borderRadius: "14px",
                boxShadow: `0 15px 30px rgba(67, 97, 238, 0.3)`,
                transition: "all 0.3s ease",
                position: "relative",
                overflow: "hidden",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  inset: 0,
                  background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4) 0%, transparent 65%)`,
                  opacity: 0,
                  transition: "opacity 0.4s ease",
                  zIndex: 0,
                },
                "&:hover": {
                  transform: "translateY(-3px) scale(1.02)",
                  boxShadow: `0 25px 50px rgba(67, 97, 238, 0.5), 0 0 30px rgba(76, 201, 240, 0.3)`,
                  background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueDeep} 100%)`,
                  "&::before": { opacity: 1 },
                },
                "&:active": { transform: "translateY(-1px) scale(0.98)" },
                "&.Mui-disabled": {
                  opacity: 0.6,
                  color: "#fff",
                  background: `linear-gradient(135deg, ${C.blueDeep} 0%, ${C.blue} 100%)`,
                },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: "0.6rem", position: "relative", zIndex: 1 }}>
                {loading && <CircularProgress size={18} thickness={4} sx={{ color: "rgba(255,255,255,0.8)" }} />}
                {loading ? "Signing in..." : "Sign in"}
                {!loading && <ArrowForwardIcon sx={{ fontSize: 18 }} />}
              </Box>
            </Button>

            {/* Alt: Login with email code */}
            <Box sx={{ mt: 1.5, textAlign: 'center' }}>
              <Button
                variant="text"
                onClick={() => { setOtpOpen(true); setOtpPhase('email'); setOtpErr(''); setOtpEmail(email || ''); }}
                sx={{ textTransform: 'none', color: C.blue, fontWeight: 700, fontFamily: FONT_TEXT }}
              >
                Login with email code
              </Button>
            </Box>

            {/* ── Footer ── */}
            <Typography
              sx={{
                mt: 2.5,
                textAlign: "center",
                fontSize: "0.95rem",
                color: "rgba(255,255,255,0.7)",
                fontWeight: 400,
                fontFamily: FONT_TEXT,
                textShadow: "0 1px 5px rgba(0,0,0,0.3)",
              }}
            >
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                style={{
                  color: C.blue,
                  fontWeight: 600,
                  textDecoration: "none",
                  textShadow: `0 0 15px rgba(76, 201, 240, 0.3)`,
                  transition: "all 0.3s ease",
                }}
              >
                Create one
              </Link>
            </Typography>

            {/* Back to Homepage Button */}
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Link href="/welcome">
                <Button
                  sx={{
                    color: "#fff",
                    fontFamily: FONT_TITLE,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: "100px",
                    px: 2.5,
                    py: 0.8,
                    backdropFilter: "blur(10px)",
                    background: "rgba(255,255,255,0.05)",
                    transition: "all 0.3s ease",
                    "&:hover": {
                      background: "rgba(255,255,255,0.15)",
                      borderColor: C.blue,
                      color: C.blue,
                    },
                  }}
                >
                  <ArrowBackIcon sx={{ fontSize: 14, mr: 0.5 }} />
                  Back to Homepage
                </Button>
              </Link>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ══════════════════════════════════
          OTP LOGIN MODAL — Redesigned
      ══════════════════════════════════ */}
      <Dialog
        open={otpOpen}
        onClose={() => setOtpOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "28px",
            overflow: "hidden",
            backgroundColor: "rgba(8, 16, 30, 0.97) !important",
            background: "rgba(8, 16, 30, 0.97) !important",
            backdropFilter: "blur(32px)",
            WebkitBackdropFilter: "blur(32px)",
            border: "1px solid rgba(76, 201, 240, 0.15)",
            boxShadow: `0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 60px rgba(67,97,238,0.12)`,
            color: "#fff",
          },
        }}
        slotProps={{
          backdrop: {
            sx: {
              backdropFilter: "blur(6px)",
              background: "rgba(5, 11, 20, 0.75)",
            },
          },
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          {/* ── Top accent bar ── */}
          <Box
            sx={{
              height: "3px",
              background: `linear-gradient(90deg, ${C.blueDeep}, ${C.blue}, ${C.blueDeep})`,
              backgroundSize: "200% auto",
              animation: "shimmer 3s linear infinite",
            }}
          />

          <Box sx={{ p: { xs: 3, sm: 4 }, animation: "fadeSlideUp 0.35s ease-out both" }}>

            {/* ── Header row: icon + close ── */}
            <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 3 }}>

              {/* Icon bubble */}
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: "16px",
                  background: "rgba(76, 201, 240, 0.08)",
                  border: "1px solid rgba(76, 201, 240, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  animation: "iconPop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s both",
                  boxShadow: `0 0 30px rgba(76, 201, 240, 0.12)`,
                }}
              >
                <MarkEmailUnreadOutlinedIcon sx={{ color: C.blue, fontSize: 26 }} />
              </Box>

              {/* Close button */}
              <Box
                onClick={() => setOtpOpen(false)}
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.5)",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    background: "rgba(239,68,68,0.1)",
                    borderColor: "rgba(239,68,68,0.3)",
                    color: "#ef4444",
                  },
                }}
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </Box>
            </Box>

            {/* ── Title & subtitle ── */}
            <Typography
              sx={{
                fontFamily: FONT_TITLE,
                fontWeight: 800,
                fontSize: "1.6rem",
                color: "#050505",
                mb: 0.5,
                lineHeight: 1.2,
              }}
            >
              {otpPhase === "email" ? "Email verification" : "Check your inbox"}
            </Typography>

            {/* Divider accent */}
            <Box
              sx={{
                width: 36,
                height: "3px",
                background: `linear-gradient(90deg, ${C.blueDeep}, ${C.blue})`,
                borderRadius: 2,
                mb: 1.5,
                boxShadow: `0 0 12px ${C.blue}50`,
              }}
            />

            <Typography
              sx={{
                fontSize: "0.95rem",
                color: "rgba(30, 29, 29, 0.65)",
                mb: 3,
                fontFamily: FONT_TEXT,
                lineHeight: 1.65,
              }}
            >
              {otpPhase === "email"
                ? "Enter your registered email address and we'll send you a 6‑digit sign‑in code."
                : `We sent a 6‑digit code to `}
              {otpPhase === "code" && (
                <Box component="span" sx={{ color: C.blue, fontWeight: 600 }}>
                  {otpEmail}
                </Box>
              )}
            </Typography>

            {/* ══ PHASE: Email input ══ */}
            {otpPhase === "email" && (
              <>
                <Typography
                  component="label"
                  sx={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    color: "rgba(29, 29, 29, 0.9)",
                    mb: 1,
                    fontFamily: FONT_TITLE,
                  }}
                >
                  Email address
                </Typography>
                <TextField
                  type="email"
                  fullWidth
                  value={otpEmail}
                  onChange={(e) => setOtpEmail(e.target.value)}
                  placeholder="you@example.com"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <Box component="span" sx={{ mr: 1, display: "flex" }}>
                          <EmailOutlinedIcon sx={{ fontSize: 20, color: "rgba(255,255,255,0.4)" }} />
                        </Box>
                      ),
                    },
                  }}
                  sx={inputSx}
                />

                {otpErr && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mt: 2,
                      p: "0.75rem 1rem",
                      background: "rgba(239, 68, 68, 0.08)",
                      border: "1px solid rgba(239, 68, 68, 0.25)",
                      borderRadius: "12px",
                      color: "#ef4444",
                      fontSize: "0.88rem",
                      fontFamily: FONT_TEXT,
                    }}
                  >
                    <Box sx={{ width: 5, height: 5, bgcolor: "#ef4444", borderRadius: "50%", flexShrink: 0 }} />
                    {otpErr}
                  </Box>
                )}

                <Button
                  onClick={async () => {
                    setOtpErr('');
                    try {
                      setOtpLoading(true);
                      const r = await apiRequestLoginOtp(otpEmail);
                      setOtpUserId(r.user_id);
                      setResendCooldown(r.resend_cooldown ?? 30);
                      setOtpPhase('code');
                    } catch (e: any) {
                      setOtpErr(e?.message || 'Unable to send code');
                    } finally { setOtpLoading(false); }
                  }}
                  disabled={!otpEmail || otpLoading}
                  fullWidth
                  sx={{
                    mt: 3,
                    p: "0.95rem",
                    background: `linear-gradient(135deg, ${C.blueDeep} 0%, ${C.blue} 100%)`,
                    color: "#fff",
                    fontFamily: FONT_TITLE,
                    fontSize: "1rem",
                    fontWeight: 700,
                    letterSpacing: "0.3px",
                    textTransform: "none",
                    borderRadius: "14px",
                    boxShadow: `0 12px 28px rgba(67, 97, 238, 0.3)`,
                    transition: "all 0.3s ease",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: `0 20px 40px rgba(67, 97, 238, 0.45), 0 0 25px rgba(76, 201, 240, 0.25)`,
                      background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueDeep} 100%)`,
                    },
                    "&:active": { transform: "translateY(0)" },
                    "&.Mui-disabled": {
                      opacity: 0.5,
                      color: "#fff",
                      background: `linear-gradient(135deg, ${C.blueDeep} 0%, ${C.blue} 100%)`,
                    },
                  }}
                >
                  {otpLoading
                    ? <CircularProgress size={20} thickness={4} sx={{ color: "rgba(255,255,255,0.9)" }} />
                    : <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        Send verification code <ArrowForwardIcon sx={{ fontSize: 18 }} />
                      </Box>
                  }
                </Button>
              </>
            )}

            {/* ══ PHASE: Code input ══ */}
            {otpPhase === "code" && (
              <>
                <Typography
                  component="label"
                  sx={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    color: "rgba(23, 23, 23, 0.9)",
                    mb: 1,
                    fontFamily: FONT_TITLE,
                  }}
                >
                  6‑digit code
                </Typography>

                <TextField
                  autoFocus
                  inputMode="numeric"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  fullWidth
                  sx={otpInputSx}
                />

                {otpErr && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mt: 2,
                      p: "0.75rem 1rem",
                      background: "rgba(239, 68, 68, 0.08)",
                      border: "1px solid rgba(239, 68, 68, 0.25)",
                      borderRadius: "12px",
                      color: "#ef4444",
                      fontSize: "0.88rem",
                      fontFamily: FONT_TEXT,
                    }}
                  >
                    <Box sx={{ width: 5, height: 5, bgcolor: "#ef4444", borderRadius: "50%", flexShrink: 0 }} />
                    {otpErr}
                  </Box>
                )}

                {/* Verify button */}
                <Button
                  onClick={async () => {
                    if (!otpUserId) return;
                    setOtpErr('');
                    try {
                      setOtpLoading(true);
                      const r = await apiVerifyLoginOtp(otpUserId, otpCode.trim());
                      setToken(r.token);
                      try { setCachedUser((r as any).user); } catch {}
                      const role = String((r as any)?.user?.role || '').toLowerCase();
                      const next = search.get('next');
                      if (next && next.startsWith('/')) router.replace(next);
                      else router.replace(role === 'admin' ? '/admin' : '/dashboard');
                    } catch (e: any) {
                      setOtpErr(e?.message || 'Invalid or expired code');
                    } finally { setOtpLoading(false); }
                  }}
                  disabled={otpCode.length !== 6 || otpLoading}
                  fullWidth
                  sx={{
                    mt: 3,
                    p: "0.95rem",
                    background: `linear-gradient(135deg, ${C.blueDeep} 0%, ${C.blue} 100%)`,
                    color: "#fff",
                    fontFamily: FONT_TITLE,
                    fontSize: "1rem",
                    fontWeight: 700,
                    letterSpacing: "0.3px",
                    textTransform: "none",
                    borderRadius: "14px",
                    boxShadow: `0 12px 28px rgba(67, 97, 238, 0.3)`,
                    transition: "all 0.3s ease",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: `0 20px 40px rgba(67, 97, 238, 0.45), 0 0 25px rgba(76, 201, 240, 0.25)`,
                      background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueDeep} 100%)`,
                    },
                    "&:active": { transform: "translateY(0)" },
                    "&.Mui-disabled": {
                      opacity: 0.5,
                      color: "#fff",
                      background: `linear-gradient(135deg, ${C.blueDeep} 0%, ${C.blue} 100%)`,
                    },
                  }}
                >
                  {otpLoading
                    ? <CircularProgress size={20} thickness={4} sx={{ color: "rgba(255,255,255,0.9)" }} />
                    : <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        Verify & sign in <ArrowForwardIcon sx={{ fontSize: 18 }} />
                      </Box>
                  }
                </Button>

                {/* Bottom row: resend + back */}
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 2.5 }}>
                  <Button
                    onClick={async () => {
                      if (!otpUserId || resendCooldown > 0) return;
                      try {
                        setResending(true);
                        await apiRequestLoginOtp(otpEmail);
                        setResendCooldown(30);
                      } catch (e: any) {
                        setOtpErr(e?.message || 'Unable to resend');
                      } finally { setResending(false); }
                    }}
                    disabled={resending || resendCooldown > 0}
                    size="small"
                    sx={{
                      textTransform: 'none',
                      color: resendCooldown > 0 ? "rgba(255,255,255,0.35)" : C.blue,
                      fontWeight: 600,
                      fontFamily: FONT_TEXT,
                      fontSize: "0.88rem",
                      px: 0,
                      "&:hover": { background: "transparent", textDecoration: "underline" },
                    }}
                  >
                    {resending ? 'Sending…' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                  </Button>

                  <Button
                    onClick={() => { setOtpPhase('email'); setOtpCode(''); setOtpErr(''); }}
                    size="small"
                    sx={{
                      textTransform: 'none',
                      color: "rgba(255,255,255,0.45)",
                      fontWeight: 500,
                      fontFamily: FONT_TEXT,
                      fontSize: "0.88rem",
                      gap: 0.5,
                      "&:hover": { color: "#fff", background: "transparent" },
                    }}
                  >
                    <ArrowBackIcon sx={{ fontSize: 14 }} />
                    Change email
                  </Button>
                </Box>
              </>
            )}

          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}