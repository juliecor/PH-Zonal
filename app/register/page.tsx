"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRegister, setToken } from "../lib/authClient";

// MUI imports
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

// MUI Icons
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";

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
    fontSize: "1rem",
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

// ── Reusable field label ───────────────────────────────────
function FieldLabel({
  children,
  optional,
}: {
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <Typography
      component="label"
      sx={{
        display: "block",
        fontSize: "0.82rem",
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: NAVY,
        mb: "0.5rem",
        fontFamily: sansFont,
      }}
    >
      {children}
      {optional && (
        <Box
          component="span"
          sx={{
            fontSize: "0.72rem",
            fontWeight: 400,
            letterSpacing: "0.02em",
            textTransform: "none",
            color: "#9aa3b0",
            ml: "0.3rem",
          }}
        >
          (optional)
        </Box>
      )}
    </Typography>
  );
}

// ── Field error text ───────────────────────────────────────
function FieldErrors({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <>
      {errors.map((m, i) => (
        <Typography
          key={i}
          sx={{
            fontSize: "0.85rem",
            color: "#c0392b",
            fontWeight: 500,
            mt: "0.35rem",
            fontFamily: sansFont,
          }}
        >
          {m}
        </Typography>
      ))}
    </>
  );
}

// ── Section divider label ──────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "0.65rem",
        mt: "1.75rem",
        mb: "0.9rem",
        fontSize: "0.75rem",
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: NAVY,
        opacity: 0.5,
        fontFamily: sansFont,
        "&::after": {
          content: '""',
          flex: 1,
          height: "1px",
          background: "rgba(15,31,56,0.1)",
        },
      }}
    >
      {children}
    </Box>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [first, setFirst] = useState("");
  const [middle, setMiddle] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    setFieldErrors({});
    try {
      const { token } = await apiRegister({
        first_name: first,
        middle_name: middle,
        last_name: last,
        phone,
        email,
        password,
        password_confirmation: confirm,
      });
      setToken(token);
      router.replace("/welcome");
    } catch (e: any) {
      setErr(e?.message || "Register failed");
      if (e?.errors && typeof e.errors === "object") {
        setFieldErrors(e.errors as Record<string, string[]>);
      }
    } finally {
      setLoading(false);
    }
  }

  const steps = [
    { n: "1", title: "Create your account", desc: "Fill in your details below" },
    { n: "2", title: "Verify your email", desc: "Quick confirmation link sent" },
    { n: "3", title: "Start searching", desc: "Instant access to zonal data" },
  ];

  return (
    <>
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
            width: "38%",
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
              width: 380,
              height: 380,
              top: -100,
              right: -120,
              borderRadius: "50%",
              background: GOLD,
              opacity: 0.07,
            }}
          />
          <Box
            sx={{
              position: "absolute",
              width: 240,
              height: 240,
              bottom: -50,
              left: -70,
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
                fontSize: "2.7rem",
                fontWeight: 700,
                color: CREAM,
                lineHeight: 1.2,
                mb: "1.3rem",
              }}
            >
              Your account,
              <br />
              your{" "}
              <Box component="span" sx={{ color: GOLD }}>
                edge.
              </Box>
            </Typography>
            <Typography
              sx={{
                fontSize: "1.05rem",
                color: MUTED,
                lineHeight: 1.75,
                maxWidth: 300,
                fontWeight: 400,
              }}
            >
              Join thousands of professionals using Zonal Value for accurate,
              real-time property data across the Philippines.
            </Typography>
          </Box>

          {/* Steps */}
          <Box
            sx={{ zIndex: 1, display: "flex", flexDirection: "column", gap: "1.1rem" }}
          >
            {steps.map((s, i) => (
              <Box key={s.n} sx={{ display: "flex", alignItems: "flex-start", gap: "0.9rem" }}>
                {/* Dot + connector */}
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "rgba(201,168,76,0.15)",
                      border: `2px solid ${GOLD}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: GOLD,
                        fontFamily: sansFont,
                      }}
                    >
                      {s.n}
                    </Typography>
                  </Box>
                  {i < steps.length - 1 && (
                    <Box
                      sx={{
                        width: "2px",
                        flex: 1,
                        minHeight: 20,
                        background: "rgba(201,168,76,0.2)",
                        my: "4px",
                      }}
                    />
                  )}
                </Box>

                {/* Text */}
                <Box>
                  <Typography
                    sx={{
                      fontSize: "0.92rem",
                      fontWeight: 600,
                      color: CREAM,
                      mb: "0.15rem",
                      fontFamily: sansFont,
                    }}
                  >
                    {s.title}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "0.82rem",
                      color: MUTED,
                      fontWeight: 400,
                      fontFamily: sansFont,
                    }}
                  >
                    {s.desc}
                  </Typography>
                </Box>
              </Box>
            ))}
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
            background: CREAM,
            overflowY: "auto",
          }}
        >
          <Box
            component="form"
            onSubmit={onSubmit}
            sx={{ width: "100%", maxWidth: 540, py: "0.5rem" }}
          >
            {/* Eyebrow */}
            <Typography
              sx={{
                fontSize: "0.78rem",
                fontWeight: 600,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: GOLD,
                mb: "0.9rem",
                fontFamily: sansFont,
              }}
            >
              New account
            </Typography>

            {/* Title */}
            <Typography
              component="h1"
              sx={{
                fontFamily: serifFont,
                fontSize: "2.6rem",
                fontWeight: 700,
                color: NAVY,
                mb: "0.4rem",
                lineHeight: 1.1,
              }}
            >
              Create your account
            </Typography>

            {/* Gold divider */}
            <Box
              sx={{
                width: 44,
                height: "2.5px",
                background: GOLD,
                borderRadius: 2,
                mt: "0.75rem",
                mb: "1.8rem",
              }}
            />

            {/* Subtitle */}
            <Typography
              sx={{
                fontSize: "1.05rem",
                color: "#4a5568",
                mb: "1.8rem",
                fontWeight: 400,
                lineHeight: 1.6,
                fontFamily: sansFont,
              }}
            >
              Access zonal searches right after sign up.
            </Typography>

            {/* ══ Personal information ══ */}
            <SectionLabel>Personal information</SectionLabel>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: "1.1rem",
              }}
            >
              {/* First name */}
              <Box>
                <FieldLabel>First name</FieldLabel>
                <TextField
                  type="text"
                  required
                  fullWidth
                  value={first}
                  onChange={(e) => setFirst(e.target.value)}
                  placeholder="Juan"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonOutlinedIcon sx={{ fontSize: 17 }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={inputSx}
                />
                <FieldErrors errors={fieldErrors.first_name} />
              </Box>

              {/* Middle name */}
              <Box>
                <FieldLabel optional>Middle name</FieldLabel>
                <TextField
                  type="text"
                  fullWidth
                  value={middle}
                  onChange={(e) => setMiddle(e.target.value)}
                  placeholder="Santos"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonOutlinedIcon sx={{ fontSize: 17 }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={inputSx}
                />
                <FieldErrors errors={fieldErrors.middle_name} />
              </Box>

              {/* Last name */}
              <Box>
                <FieldLabel>Last name</FieldLabel>
                <TextField
                  type="text"
                  required
                  fullWidth
                  value={last}
                  onChange={(e) => setLast(e.target.value)}
                  placeholder="dela Cruz"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonOutlinedIcon sx={{ fontSize: 17 }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={inputSx}
                />
                <FieldErrors errors={fieldErrors.last_name} />
              </Box>

              {/* Phone */}
              <Box>
                <FieldLabel optional>Phone</FieldLabel>
                <TextField
                  type="tel"
                  fullWidth
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+63 9XX XXX XXXX"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneOutlinedIcon sx={{ fontSize: 17 }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={inputSx}
                />
                <FieldErrors errors={fieldErrors.phone} />
              </Box>
            </Box>

            {/* ══ Account credentials ══ */}
            <SectionLabel>Account credentials</SectionLabel>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: "1.1rem",
              }}
            >
              {/* Email — full width */}
              <Box sx={{ gridColumn: "1 / -1" }}>
                <FieldLabel>Email address</FieldLabel>
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
                          <EmailOutlinedIcon sx={{ fontSize: 17 }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={inputSx}
                />
                <FieldErrors errors={fieldErrors.email} />
              </Box>

              {/* Password */}
              <Box>
                <FieldLabel>Password</FieldLabel>
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
                          <LockOutlinedIcon sx={{ fontSize: 17 }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={inputSx}
                />
                <FieldErrors errors={fieldErrors.password} />
              </Box>

              {/* Confirm password */}
              <Box>
                <FieldLabel>Confirm password</FieldLabel>
                <TextField
                  type="password"
                  required
                  fullWidth
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockOutlinedIcon sx={{ fontSize: 17 }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={inputSx}
                />
                <FieldErrors errors={fieldErrors.password_confirmation} />
              </Box>
            </Box>

            {/* ══ Error banner ══ */}
            {(err || Object.keys(fieldErrors).length > 0) && (
              <Box
                sx={{
                  mt: "1.25rem",
                  p: "1rem 1.1rem",
                  background: "#fff3f3",
                  border: "2px solid #f5c6c6",
                  borderRadius: "12px",
                }}
              >
                {err && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontSize: "0.95rem",
                      color: "#c0392b",
                      fontWeight: 600,
                      mb: Object.keys(fieldErrors).length > 0 ? "0.5rem" : 0,
                      fontFamily: sansFont,
                    }}
                  >
                    <ErrorOutlinedIcon sx={{ fontSize: 17, flexShrink: 0 }} />
                    {err}
                  </Box>
                )}
                {Object.keys(fieldErrors).length > 0 && (
                  <Box
                    component="ul"
                    sx={{
                      m: 0,
                      pl: "1.3rem",
                      fontSize: "0.9rem",
                      color: "#c0392b",
                      lineHeight: 1.75,
                      fontWeight: 400,
                      fontFamily: sansFont,
                    }}
                  >
                    {Object.entries(fieldErrors).flatMap(([k, vals]) =>
                      (Array.isArray(vals) ? vals : [String(vals)]).map(
                        (msg, i) => <li key={`${k}-${i}`}>{msg}</li>
                      )
                    )}
                  </Box>
                )}
              </Box>
            )}

            {/* ══ Submit button ══ */}
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
              <Box sx={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                {loading && (
                  <CircularProgress
                    size={16}
                    thickness={4}
                    sx={{ color: "rgba(245,240,235,0.8)" }}
                  />
                )}
                {loading ? "Creating account…" : "Create account"}
                {!loading && <ArrowForwardIcon sx={{ fontSize: 17 }} />}
              </Box>
            </Button>

            {/* ══ Footer ══ */}
            <Typography
              sx={{
                mt: "1.75rem",
                textAlign: "center",
                fontSize: "0.95rem",
                color: "#6b7585",
                fontWeight: 400,
                fontFamily: sansFont,
              }}
            >
              Already have an account?{" "}
              <Link
                href="/login"
                style={{
                  color: NAVY,
                  fontWeight: 600,
                  textDecoration: "none",
                  borderBottom: `2px solid ${GOLD}`,
                  paddingBottom: "1px",
                  transition: "color 0.15s",
                }}
              >
                Sign in
              </Link>
            </Typography>
          </Box>
        </Box>
      </Box>
    </>
  );
}