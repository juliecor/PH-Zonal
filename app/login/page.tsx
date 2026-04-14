"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiLogin, setToken } from "../lib/authClient";

// MUI imports
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

// MUI Icons
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";

// ── Design tokens ──────────────────────────────────────────
const NAVY = "#0f1f38";
const GOLD = "#c9a84c";
const CREAM = "#f5f0eb";
const MUTED = "#8fa3bf";
const BORDER = "#e2d9d0";

const serifFont = "'Cormorant Garamond', serif";
const sansFont = "'DM Sans', sans-serif";

// ── Shared TextField sx ────────────────────────────────────
const inputSx = {
  "& .MuiOutlinedInput-root": {
    fontFamily: sansFont,
    fontSize: "1.05rem",
    color: NAVY,
    borderRadius: "12px",
    background: "#fff",
    "& fieldset": { borderWidth: "2px", borderColor: BORDER },
    "&:hover fieldset": { borderColor: GOLD },
    "&.Mui-focused fieldset": {
      borderColor: GOLD,
      boxShadow: `0 0 0 4px rgba(201,168,76,0.12)`,
    },
  },
  "& input::placeholder": { color: "#c0b9b2", opacity: 1 },
  "& .MuiInputAdornment-root": { color: "#9aa3b0" },
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const { token } = await apiLogin({ email, password });
      setToken(token);
      router.replace("/welcome");
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap');
      `}</style>

      {/* ── Root ── */}
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          fontFamily: sansFont,
          background: CREAM,
        }}
      >
        {/* ══════════════════════════════════
            LEFT DECORATIVE PANEL
        ══════════════════════════════════ */}
        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            width: "45%",
            background: NAVY,
            position: "relative",
            overflow: "hidden",
            p: "3rem",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Background decorations */}
          <Box
            sx={{
              position: "absolute",
              width: 420,
              height: 420,
              top: -120,
              right: -140,
              borderRadius: "50%",
              background: GOLD,
              opacity: 0.07,
            }}
          />
          <Box
            sx={{
              position: "absolute",
              width: 260,
              height: 260,
              bottom: -60,
              left: -80,
              borderRadius: "50%",
              background: GOLD,
              opacity: 0.07,
            }}
          />
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "repeating-linear-gradient(-55deg, transparent, transparent 40px, rgba(201,168,76,0.03) 40px, rgba(201,168,76,0.03) 41px)",
            }}
          />

          {/* Logo */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "0.7rem",
              zIndex: 1,
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                border: `2px solid ${GOLD}`,
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: GOLD,
              }}
            >
              <HomeOutlinedIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography
              sx={{
                fontFamily: serifFont,
                fontSize: "1.4rem",
                fontWeight: 600,
                color: CREAM,
                letterSpacing: "0.02em",
              }}
            >
              Zonal Value
            </Typography>
          </Box>

          {/* Headline */}
          <Box sx={{ zIndex: 1 }}>
            <Typography
              sx={{
                fontFamily: serifFont,
                fontSize: "2.9rem",
                fontWeight: 700,
                color: CREAM,
                lineHeight: 1.2,
                mb: "1.3rem",
              }}
            >
              Property insights,
              <br />
              <Box component="span" sx={{ color: GOLD }}>
                precisely
              </Box>{" "}
              mapped.
            </Typography>
            <Typography
              sx={{
                fontSize: "1.05rem",
                color: MUTED,
                lineHeight: 1.75,
                maxWidth: 320,
                fontWeight: 400,
              }}
            >
              Access verified zonal values across all regions — empowering
              smarter real estate decisions.
            </Typography>
          </Box>

          {/* Stats placeholder */}
          <Box sx={{ zIndex: 1 }} />
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
            background: CREAM,
          }}
        >
          <Box
            component="form"
            onSubmit={onSubmit}
            sx={{ width: "100%", maxWidth: 440 }}
          >
            {/* Eyebrow */}
            <Typography
              sx={{
                fontSize: "0.78rem",
                fontWeight: 600,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: GOLD,
                mb: "1rem",
                fontFamily: sansFont,
              }}
            >
              Secure access
            </Typography>

            {/* Title */}
            <Typography
              component="h1"
              sx={{
                fontFamily: serifFont,
                fontSize: "2.8rem",
                fontWeight: 700,
                color: NAVY,
                mb: "0.5rem",
                lineHeight: 1.1,
              }}
            >
              Welcome back
            </Typography>

            {/* Gold divider */}
            <Box
              sx={{
                width: 44,
                height: "2.5px",
                background: GOLD,
                borderRadius: 2,
                mb: "2rem",
                mt: "0.75rem",
              }}
            />

            {/* Subtitle */}
            <Typography
              sx={{
                fontSize: "1.05rem",
                color: "#4a5568",
                mb: "2.2rem",
                fontWeight: 400,
                lineHeight: 1.6,
                fontFamily: sansFont,
              }}
            >
              Sign in to your Zonal Value account to continue.
            </Typography>

            {/* ── Email field ── */}
            <Box sx={{ mb: "1.4rem" }}>
              <Typography
                component="label"
                sx={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: NAVY,
                  mb: "0.55rem",
                  fontFamily: sansFont,
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
                      <InputAdornment position="start">
                        <EmailOutlinedIcon sx={{ fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={inputSx}
              />
            </Box>

            {/* ── Password field ── */}
            <Box>
              <Typography
                component="label"
                sx={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: NAVY,
                  mb: "0.55rem",
                  fontFamily: sansFont,
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
                placeholder="••••••••"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon sx={{ fontSize: 18 }} />
                      </InputAdornment>
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
                  gap: "0.55rem",
                  mt: "1.2rem",
                  p: "0.85rem 1rem",
                  background: "#fff3f3",
                  border: "1.5px solid #f5c6c6",
                  borderRadius: "10px",
                  color: "#c0392b",
                  fontSize: "0.95rem",
                  fontWeight: 500,
                  fontFamily: sansFont,
                  lineHeight: 1.5,
                }}
              >
                <ErrorOutlinedIcon sx={{ fontSize: 18, flexShrink: 0 }} />
                {err}
              </Box>
            )}

            {/* ── Submit button ── */}
            <Button
              type="submit"
              disabled={loading}
              fullWidth
              sx={{
                mt: "2rem",
                p: "0.95rem",
                background: NAVY,
                color: CREAM,
                fontFamily: sansFont,
                fontSize: "1rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                borderRadius: "12px",
                boxShadow: "0 4px 18px rgba(15,31,56,0.2)",
                transition: "background 0.2s, transform 0.15s, box-shadow 0.2s",
                "&:hover": {
                  background: "#182f52",
                  boxShadow: "0 6px 24px rgba(15,31,56,0.28)",
                  transform: "translateY(-1px)",
                },
                "&:active": {
                  transform: "translateY(0)",
                  boxShadow: "0 2px 8px rgba(15,31,56,0.18)",
                },
                "&.Mui-disabled": {
                  opacity: 0.6,
                  color: CREAM,
                  background: NAVY,
                },
              }}
            >
              <Box
                sx={{ display: "flex", alignItems: "center", gap: "0.6rem" }}
              >
                {loading && (
                  <CircularProgress
                    size={16}
                    thickness={4}
                    sx={{ color: "rgba(245,240,235,0.8)" }}
                  />
                )}
                {loading ? "Signing in…" : "Sign in"}
                {!loading && <ArrowForwardIcon sx={{ fontSize: 17 }} />}
              </Box>
            </Button>

            {/* ── Footer ── */}
            <Typography
              sx={{
                mt: "1.8rem",
                textAlign: "center",
                fontSize: "0.95rem",
                color: "#6b7585",
                fontWeight: 400,
                fontFamily: sansFont,
              }}
            >
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                style={{
                  color: NAVY,
                  fontWeight: 600,
                  textDecoration: "none",
                  borderBottom: `2px solid ${GOLD}`,
                  paddingBottom: "1px",
                  transition: "color 0.15s",
                }}
              >
                Create one
              </Link>
            </Typography>
          </Box>
        </Box>
      </Box>
    </>
  );
}