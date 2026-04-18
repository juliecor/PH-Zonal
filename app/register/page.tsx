"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRegister, setToken } from "../lib/authClient";
import Image from "next/image";

// MUI imports
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

// MUI Icons
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { CheckCircle } from "lucide-react";

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
    fontSize: "0.95rem",
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
    "& input::placeholder": { color: "rgba(255, 255, 255, 0.35)", opacity: 1 },
    "& .MuiInputAdornment-root": { color: "rgba(255, 255, 255, 0.4)" },
  },
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
        fontSize: "0.8rem",
        fontWeight: 600,
        letterSpacing: "0.5px",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.9)",
        mb: 1,
        fontFamily: FONT_TITLE,
      }}
    >
      {children}
      {optional && (
        <Box
          component="span"
          sx={{
            fontSize: "0.7rem",
            fontWeight: 400,
            letterSpacing: "0.02em",
            textTransform: "none",
            color: "rgba(255,255,255,0.35)",
            ml: "0.35rem",
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
            fontSize: "0.8rem",
            color: "#ef4444",
            fontWeight: 500,
            mt: "0.3rem",
            fontFamily: FONT_TEXT,
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
        mt: "1.5rem",
        mb: "1rem",
        fontSize: "0.72rem",
        fontWeight: 700,
        letterSpacing: "1.5px",
        textTransform: "uppercase",
        color: C.blue,
        fontFamily: FONT_TITLE,
        opacity: 0.85,
        "&::after": {
          content: '""',
          flex: 1,
          height: "1px",
          background: "rgba(76, 201, 240, 0.2)",
        },
      }}
    >
      {children}
    </Box>
  );
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Urbanist:wght@700;800;900&family=Outfit:wght@300;400;500;600&display=swap');

  @keyframes slideInLeft {
    from { transform: translateX(-60px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideInRight {
    from { transform: translateX(60px); opacity: 0; }
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
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

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
    {
      n: "01",
      title: "Create your account",
      desc: "Fill in your personal details below to get started.",
      icon: <PersonOutlinedIcon sx={{ fontSize: 16 }} />,
    },
    {
      n: "02",
      title: "Verify your email",
      desc: "A confirmation link will be sent to your inbox.",
      icon: <EmailOutlinedIcon sx={{ fontSize: 16 }} />,
    },
    {
      n: "03",
      title: "Start searching",
      desc: "Instant access to verified zonal value data.",
      icon: <CheckCircle size={16} />,
    },
  ];

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
        {/* ── Background Video Layer ── */}
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

        {/* ── Back to Homepage Button ── */}
        <Box
          sx={{
            position: "absolute",
            top: { xs: "1rem", md: "1.5rem" },
            left: { xs: "1rem", md: "1.5rem" },
            zIndex: 10,
          }}
        >
          <Link href="/welcome">
            <Button
              sx={{
                color: "#fff",
                fontFamily: FONT_TITLE,
                fontSize: "0.8rem",
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
              <ArrowBackIcon sx={{ fontSize: 16, mr: 0.5 }} />
              Back to Homepage
            </Button>
          </Link>
        </Box>

        {/* ══════════════════════════════════
            LEFT DECORATIVE PANEL
        ══════════════════════════════════ */}
        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            width: "42%",
            position: "relative",
            overflow: "hidden",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            px: 5,
            animation: "slideInLeft 0.6s ease-out both",
            zIndex: 1,
          }}
        >
          {/* Floating 3D Image */}
          <Box
            sx={{
              animation: "float 3s ease-in-out infinite",
              mb: 4,
              "& img": {
                width: "100%",
                maxWidth: "300px",
                height: "auto",
                filter: `drop-shadow(0 0px 30px rgba(76, 201, 240, 0.4))`,
              },
            }}
          >
            <Image
              src="/pictures/3d-fh.png"
              alt="Filipino Homes 3D"
              width={300}
              height={300}
              style={{ objectFit: "contain" }}
            />
          </Box>

          {/* Headline */}
          <Box sx={{ zIndex: 1, textAlign: "center", mb: 5 }}>
            <Typography
              sx={{
                fontFamily: FONT_TITLE,
                fontSize: { xs: "1.8rem", md: "2.3rem" },
                fontWeight: 800,
                color: "#fff",
                lineHeight: 1.2,
                mb: "0.8rem",
                textShadow: "0 4px 25px rgba(0,0,0,0.5)",
              }}
            >
              Your account,{" "}
              <Box
                component="span"
                sx={{ color: C.blue, textShadow: `0 0 40px rgba(76, 201, 240, 0.55)` }}
              >
                your edge.
              </Box>
            </Typography>
            <Typography
              sx={{
                fontSize: "1rem",
                color: "rgba(255,255,255,0.7)",
                lineHeight: 1.75,
                maxWidth: "320px",
                fontWeight: 400,
                textShadow: "0 2px 15px rgba(0,0,0,0.4)",
              }}
            >
              Join professionals using verified zonal value data across the Philippines.
            </Typography>
          </Box>

          {/* Steps */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 0,
              width: "100%",
              maxWidth: 320,
            }}
          >
            {steps.map((s, i) => (
              <Box key={s.n} sx={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                {/* Dot + connector */}
                <Box
                  sx={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "rgba(76, 201, 240, 0.08)",
                      border: `1px solid rgba(76, 201, 240, 0.35)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: C.blue,
                      flexShrink: 0,
                    }}
                  >
                    {s.icon}
                  </Box>
                  {i < steps.length - 1 && (
                    <Box
                      sx={{
                        width: "1px",
                        height: 28,
                        background: "rgba(76, 201, 240, 0.2)",
                        my: "4px",
                      }}
                    />
                  )}
                </Box>

                {/* Text */}
                <Box sx={{ pt: "6px", pb: i < steps.length - 1 ? "28px" : 0 }}>
                  <Typography
                    sx={{
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      color: "#fff",
                      mb: "0.2rem",
                      fontFamily: FONT_TITLE,
                    }}
                  >
                    {s.title}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "0.82rem",
                      color: "rgba(255,255,255,0.5)",
                      fontWeight: 400,
                      fontFamily: FONT_TEXT,
                      lineHeight: 1.5,
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
            alignItems: "flex-start",
            justifyContent: "center",
            p: { xs: "5rem 1.25rem 2rem", sm: "5rem 2rem 2rem" },
            overflowY: "auto",
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
              maxWidth: 520,
              p: { xs: 3, sm: 4 },
              borderRadius: "24px",
              background: "rgba(255, 255, 255, 0.02)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.3)",
            }}
          >
            {/* Logo */}
            <Box sx={{ display: "flex", justifyContent: "center", mb: 4.5 }}>
              <Link href="/welcome">
                <Box
                  component="span"
                  sx={{
                    display: "inline-block",
                    transition: "all 0.3s ease",
                    "&:hover": { opacity: 0.8, transform: "scale(1.02)" },
                  }}
                >
                  <Image src="/pictures/fh.png" alt="Filipino Homes" width={240} height={19} />
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
                NEW ACCOUNT
              </Typography>
            </Box>

            {/* Title */}
            <Typography
              component="h1"
              sx={{
                fontFamily: FONT_TITLE,
                fontSize: { xs: "1.9rem", md: "2.4rem" },
                fontWeight: 800,
                color: "#fff",
                mb: 0.5,
                lineHeight: 1.1,
                textShadow: "0 4px 25px rgba(0,0,0,0.5)",
              }}
            >
              Create your account
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
                fontSize: "1rem",
                color: "rgba(255,255,255,0.75)",
                mb: 1,
                fontWeight: 400,
                lineHeight: 1.6,
                fontFamily: FONT_TEXT,
                textShadow: "0 1px 5px rgba(0,0,0,0.3)",
              }}
            >
              Access zonal searches right after sign up.
            </Typography>

            {/* ══ Personal Information ══ */}
            <SectionLabel>Personal Information</SectionLabel>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: "1rem",
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
                        <Box component="span" sx={{ mr: 1, display: "flex" }}>
                          <PersonOutlinedIcon sx={{ fontSize: 18 }} />
                        </Box>
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
                        <Box component="span" sx={{ mr: 1, display: "flex" }}>
                          <PersonOutlinedIcon sx={{ fontSize: 18 }} />
                        </Box>
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
                        <Box component="span" sx={{ mr: 1, display: "flex" }}>
                          <PersonOutlinedIcon sx={{ fontSize: 18 }} />
                        </Box>
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
                        <Box component="span" sx={{ mr: 1, display: "flex" }}>
                          <PhoneOutlinedIcon sx={{ fontSize: 18 }} />
                        </Box>
                      ),
                    },
                  }}
                  sx={inputSx}
                />
                <FieldErrors errors={fieldErrors.phone} />
              </Box>
            </Box>

            {/* ══ Account Credentials ══ */}
            <SectionLabel>Account Credentials</SectionLabel>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: "1rem",
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
                        <Box component="span" sx={{ mr: 1, display: "flex" }}>
                          <EmailOutlinedIcon sx={{ fontSize: 18 }} />
                        </Box>
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
                        <Box component="span" sx={{ mr: 1, display: "flex" }}>
                          <LockOutlinedIcon sx={{ fontSize: 18 }} />
                        </Box>
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
                        <Box component="span" sx={{ mr: 1, display: "flex" }}>
                          <LockOutlinedIcon sx={{ fontSize: 18 }} />
                        </Box>
                      ),
                    },
                  }}
                  sx={inputSx}
                />
                <FieldErrors errors={fieldErrors.password_confirmation} />
              </Box>
            </Box>

            {/* ── Error banner ── */}
            {(err || Object.keys(fieldErrors).length > 0) && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1,
                  mt: 2.5,
                  p: "0.85rem 1rem",
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "12px",
                  color: "#ef4444",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  fontFamily: FONT_TEXT,
                }}
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    bgcolor: "#ef4444",
                    borderRadius: "50%",
                    flexShrink: 0,
                    mt: "6px",
                  }}
                />
                <Box>
                  {err && <Box sx={{ mb: Object.keys(fieldErrors).length > 0 ? 0.5 : 0 }}>{err}</Box>}
                  {Object.keys(fieldErrors).length > 0 && (
                    <Box
                      component="ul"
                      sx={{ m: 0, pl: "1.1rem", lineHeight: 1.8, fontSize: "0.85rem" }}
                    >
                      {Object.entries(fieldErrors).flatMap(([k, vals]) =>
                        (Array.isArray(vals) ? vals : [String(vals)]).map((msg, i) => (
                          <li key={`${k}-${i}`}>{msg}</li>
                        ))
                      )}
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            {/* ── Submit button ── */}
            <Button
              type="submit"
              disabled={loading}
              fullWidth
              sx={{
                mt: 3,
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
                "&:active": {
                  transform: "translateY(-1px) scale(0.98)",
                },
                "&.Mui-disabled": {
                  opacity: 0.6,
                  color: "#fff",
                  background: `linear-gradient(135deg, ${C.blueDeep} 0%, ${C.blue} 100%)`,
                },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {loading && (
                  <CircularProgress size={18} thickness={4} sx={{ color: "rgba(255,255,255,0.8)" }} />
                )}
                {loading ? "Creating account…" : "Create account"}
                {!loading && <ArrowForwardIcon sx={{ fontSize: 18 }} />}
              </Box>
            </Button>

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
              Already have an account?{" "}
              <Link
                href="/login"
                style={{
                  color: C.blue,
                  fontWeight: 600,
                  textDecoration: "none",
                  textShadow: `0 0 15px rgba(76, 201, 240, 0.3)`,
                  transition: "all 0.3s ease",
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
