"use client";

import { useMemo, useState } from "react";
import { apiAdminInviteUsers } from "@/app/lib/authClient";

import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, keyframes } from "@mui/material/styles";

/* ─────────────────────────────────────────────────────────────────── */
/*  Keyframes                                                          */
/* ─────────────────────────────────────────────────────────────────── */

const floatA = keyframes`
  0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.6; }
  50%       { transform: translateY(-18px) rotate(8deg); opacity: 1; }
`;
const floatB = keyframes`
  0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.4; }
  50%       { transform: translateY(-12px) rotate(-6deg); opacity: 0.8; }
`;
const floatC = keyframes`
  0%, 100% { transform: translateY(0px) scale(1); opacity: 0.5; }
  50%       { transform: translateY(-22px) scale(1.08); opacity: 0.9; }
`;
const shimmer = keyframes`
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
`;
const fadeSlideIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;
const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
  50%       { box-shadow: 0 0 0 8px rgba(99,102,241,0); }
`;

/* ─────────────────────────────────────────────────────────────────── */
/*  Inline SVG Icons                                                   */
/* ─────────────────────────────────────────────────────────────────── */

const IconEmail = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);

const IconSend = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const IconLock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const IconWarning = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const IconError = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const IconSparkle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
);

const IconUsers = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

/* ─────────────────────────────────────────────────────────────────── */
/*  Helpers                                                            */
/* ─────────────────────────────────────────────────────────────────── */

function parseEmails(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /.+@.+\..+/.test(s))
    )
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Decorative Floating Orbs in Header                                 */
/* ─────────────────────────────────────────────────────────────────── */

const HeaderOrbs = () => (
  <>
    {/* large soft orb top-right */}
    <Box sx={{
      position: "absolute", top: -30, right: 60, width: 160, height: 160,
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(167,139,250,0.35) 0%, transparent 70%)",
      animation: `${floatA} 7s ease-in-out infinite`,
      pointerEvents: "none",
    }} />
    {/* medium orb mid-right */}
    <Box sx={{
      position: "absolute", bottom: -20, right: 220, width: 90, height: 90,
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(251,191,36,0.3) 0%, transparent 70%)",
      animation: `${floatB} 5s ease-in-out infinite`,
      pointerEvents: "none",
    }} />
    {/* small accent orb left */}
    <Box sx={{
      position: "absolute", top: 10, right: 160, width: 50, height: 50,
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(99,255,220,0.35) 0%, transparent 70%)",
      animation: `${floatC} 6s ease-in-out infinite 1s`,
      pointerEvents: "none",
    }} />
    {/* subtle grid dots overlay */}
    <Box sx={{
      position: "absolute", inset: 0, borderRadius: "inherit",
      backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
      backgroundSize: "22px 22px",
      pointerEvents: "none",
    }} />
  </>
);

/* ─────────────────────────────────────────────────────────────────── */
/*  Stat Badge                                                         */
/* ─────────────────────────────────────────────────────────────────── */

const StatBadge = ({ count }: { count: number }) => (
  <Box sx={{
    display: "flex", alignItems: "center", gap: 0.75,
    px: 1.5, py: 0.6,
    borderRadius: 1,
    bgcolor: count > 0
      ? "rgba(99,102,241,0.12)"
      : "rgba(255,255,255,0.06)",
    border: "1px solid",
    borderColor: count > 0
      ? "rgba(99,102,241,0.3)"
      : "rgba(255,255,255,0.1)",
    transition: "all 0.25s ease",
    animation: count > 0 ? `${fadeSlideIn} 0.3s ease` : "none",
  }}>
    <Box sx={{
      color: count > 0 ? "#a5b4fc" : "rgba(255,255,255,0.4)",
      display: "flex", alignItems: "center",
      transition: "color 0.25s",
    }}>
      <IconSparkle />
    </Box>
    <Typography variant="caption" sx={{
      fontWeight: 700, fontSize: 11,
      color: count > 0 ? "#c7d2fe" : "rgba(255,255,255,0.4)",
      letterSpacing: 0.4,
      transition: "color 0.25s",
    }}>
      {count} {count === 1 ? "recipient" : "recipients"}
    </Typography>
  </Box>
);

/* ─────────────────────────────────────────────────────────────────── */
/*  Component                                                          */
/* ─────────────────────────────────────────────────────────────────── */

export default function AdminInvitationsPage() {
  const [raw, setRaw] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<null | { sent: string[]; failed: string[] }>(null);
  const [error, setError] = useState<string | null>(null);

  const emails = useMemo(() => parseEmails(raw), [raw]);
  const origin = typeof window !== "undefined" ? window.location.origin : undefined;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const j = await apiAdminInviteUsers({ emails, redirect_url: origin });
      setResult({ sent: j.results?.sent || [], failed: j.results?.failed || [] });
      setRaw("");
    } catch (err: any) {
      setError(err?.message || "Failed to send invitations");
    } finally {
      setSending(false);
    }
  }

  const canSend = !sending && emails.length > 0;

  return (
    <Box sx={{ mx: 0, width: "100%", maxWidth: "100%", px: 0, py: 2 }}>
      <Paper
        elevation={0}
        sx={{
          border: "1px solid",
          borderColor: "rgba(99,102,241,0.15)",
          borderRadius: 1.5,
          overflow: "hidden",
          width: "100%",
          boxShadow: "0 4px 40px rgba(99,102,241,0.08), 0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        {/* ── Hero Header ── */}
        <Box
          sx={{
            px: 4,
            py: 3.5,
            position: "relative",
            overflow: "hidden",
            background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 75%, #6366f1 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <HeaderOrbs />

          {/* Left: Icon + Text */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2.5, position: "relative", zIndex: 1 }}>
            {/* Animated icon box */}
            <Box
              sx={{
                width: 52, height: 52,
                borderRadius: 1.5,
                background: "linear-gradient(145deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05))",
                border: "1px solid rgba(255,255,255,0.22)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#e0e7ff",
                flexShrink: 0,
                animation: `${pulseGlow} 3s ease-in-out infinite`,
                transition: "transform 0.2s ease",
                "&:hover": { transform: "scale(1.08) rotate(-3deg)" },
              }}
            >
              <IconEmail />
            </Box>

            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  fontSize: "1.2rem",
                  color: "#fff",
                  letterSpacing: -0.3,
                  lineHeight: 1.2,
                  /* shimmer effect on the text */
                  background: `linear-gradient(90deg, #fff 0%, #c7d2fe 30%, #fff 60%, #a5b4fc 100%)`,
                  backgroundSize: "400px 100%",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  animation: `${shimmer} 5s linear infinite`,
                }}
              >
                Invite Users
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: "rgba(199,210,254,0.75)",
                  display: "block",
                  mt: 0.25,
                  fontSize: 12,
                  letterSpacing: 0.2,
                }}
              >
                Send email invitations to new team members
              </Typography>
            </Box>
          </Box>

          {/* Right: live recipient count badge */}
          <Box sx={{ position: "relative", zIndex: 1, flexShrink: 0 }}>
            <StatBadge count={emails.length} />
          </Box>
        </Box>

        {/* ── Thin accent stripe ── */}
        <Box sx={{
          height: 3,
          background: "linear-gradient(90deg, #6366f1, #a78bfa, #f59e0b, #6366f1)",
          backgroundSize: "300% 100%",
          animation: `${shimmer} 4s linear infinite`,
        }} />

        {/* ── Card Body ── */}
        <Box
          component="form"
          onSubmit={onSubmit}
          sx={{
            px: 4, py: 4,
            display: "flex", flexDirection: "column", gap: 3,
            bgcolor: "background.paper",
          }}
        >
          {/* Instruction row */}
          <Box sx={{
            display: "flex", alignItems: "flex-start", gap: 1.5,
            px: 2, py: 1.75,
            borderRadius: 1,
            bgcolor: "rgba(99,102,241,0.04)",
            border: "1px solid rgba(99,102,241,0.1)",
          }}>
            <Box sx={{ color: "primary.main", mt: 0.15, flexShrink: 0, display: "flex" }}>
              <IconUsers />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75, fontSize: 13 }}>
              Paste one or more email addresses below. You can separate them with{" "}
              <Box component="span" sx={{ fontWeight: 600, color: "primary.main" }}>commas</Box>,{" "}
              <Box component="span" sx={{ fontWeight: 600, color: "primary.main" }}>spaces</Box>, or{" "}
              <Box component="span" sx={{ fontWeight: 600, color: "primary.main" }}>new lines</Box> —
              duplicates are handled automatically.
            </Typography>
          </Box>

          {/* Textarea */}
          <Box>
            <TextField
              multiline
              fullWidth
              minRows={5}
              maxRows={10}
              aria-label="Email addresses"
              label="Email addresses"
              placeholder={"user1@example.com\nuser2@example.com, user3@example.com"}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              variant="outlined"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 1,
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  bgcolor: "rgba(248,250,252,1)",
                  transition: "all 0.2s ease",
                  "&:hover fieldset": {
                    borderColor: "rgba(99,102,241,0.4)",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#6366f1",
                    borderWidth: 2,
                    boxShadow: "0 0 0 3px rgba(99,102,241,0.1)",
                  },
                },
                "& .MuiInputLabel-root.Mui-focused": {
                  color: "#6366f1",
                },
              }}
            />

            {/* Live parsed preview */}
            {emails.length > 0 && (
              <Box sx={{
                mt: 1.5, p: 1.5,
                borderRadius: 1,
                bgcolor: "rgba(99,102,241,0.04)",
                border: "1px dashed rgba(99,102,241,0.2)",
                animation: `${fadeSlideIn} 0.3s ease`,
              }}>
                <Typography variant="caption" sx={{
                  color: "text.disabled", fontWeight: 600, letterSpacing: 0.6,
                  textTransform: "uppercase", fontSize: 10, mb: 1, display: "block",
                }}>
                  Detected ({emails.length})
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                  {emails.slice(0, 8).map((email) => (
                    <Chip
                      key={email}
                      label={email}
                      size="small"
                      sx={{
                        fontSize: 11, height: 22, borderRadius: 0.5,
                        bgcolor: "rgba(99,102,241,0.08)",
                        color: "#4338ca",
                        border: "1px solid rgba(99,102,241,0.2)",
                        fontFamily: "monospace",
                        "& .MuiChip-label": { px: 1 },
                      }}
                    />
                  ))}
                  {emails.length > 8 && (
                    <Chip
                      label={`+${emails.length - 8} more`}
                      size="small"
                      sx={{
                        fontSize: 11, height: 22, borderRadius: 0.5,
                        bgcolor: "rgba(245,158,11,0.1)",
                        color: "#b45309",
                        border: "1px solid rgba(245,158,11,0.25)",
                        "& .MuiChip-label": { px: 1 },
                      }}
                    />
                  )}
                </Box>
              </Box>
            )}
          </Box>

          <Divider sx={{ borderColor: "rgba(99,102,241,0.08)" }} />

          {/* Action Row */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Tooltip title="Only administrators are allowed to send invitations" placement="top">
              <Box
                sx={{
                  display: "flex", alignItems: "center", gap: 0.75,
                  px: 1.5, py: 0.75,
                  borderRadius: 1,
                  bgcolor: "rgba(0,0,0,0.03)",
                  border: "1px solid rgba(0,0,0,0.06)",
                  cursor: "default",
                  color: "text.disabled",
                  transition: "all 0.2s",
                  "&:hover": { bgcolor: "rgba(0,0,0,0.055)" },
                }}
              >
                <IconLock />
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11, fontWeight: 500 }}>
                  Admin-only action
                </Typography>
              </Box>
            </Tooltip>

            <Button
              type="submit"
              variant="contained"
              disabled={!canSend}
              startIcon={
                sending
                  ? <CircularProgress size={14} color="inherit" />
                  : <IconSend />
              }
              sx={{
                borderRadius: 1,
                px: 3.5,
                py: 1.2,
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: 0.4,
                textTransform: "none",
                background: canSend
                  ? "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)"
                  : undefined,
                boxShadow: canSend
                  ? "0 4px 20px rgba(79,70,229,0.4), 0 1px 4px rgba(79,70,229,0.2)"
                  : "none",
                transition: "all 0.25s ease",
                "&:hover": canSend ? {
                  background: "linear-gradient(135deg, #4338ca 0%, #6d28d9 100%)",
                  boxShadow: "0 6px 24px rgba(79,70,229,0.5), 0 2px 6px rgba(79,70,229,0.25)",
                  transform: "translateY(-1px)",
                } : {},
                "&:active": { transform: "translateY(0)" },
              }}
            >
              {sending ? "Sending…" : "Send Invitations"}
            </Button>
          </Box>

          {/* ── Error Alert ── */}
          {error && (
            <Alert
              severity="error"
              icon={<IconError />}
              sx={{
                borderRadius: 1,
                fontSize: 13,
                animation: `${fadeSlideIn} 0.3s ease`,
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <AlertTitle sx={{ fontSize: 13, fontWeight: 700, mb: 0.25 }}>
                Sending Failed
              </AlertTitle>
              {error}
            </Alert>
          )}

          {/* ── Result Alerts ── */}
          {result && (
            <Stack spacing={1.5} sx={{ animation: `${fadeSlideIn} 0.35s ease` }}>
              {result.sent.length > 0 && (
                <Alert
                  severity="success"
                  icon={<IconCheck />}
                  sx={{
                    borderRadius: 1,
                    fontSize: 13,
                    border: "1px solid rgba(34,197,94,0.2)",
                    bgcolor: "rgba(240,253,244,1)",
                  }}
                >
                  <AlertTitle sx={{ fontSize: 13, fontWeight: 700, mb: 0.5 }}>
                    Invitations Sent ({result.sent.length})
                  </AlertTitle>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 0.5 }}>
                    {result.sent.map((email) => (
                      <Chip
                        key={email}
                        label={email}
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ fontSize: 11, height: 22, borderRadius: 0.5, fontFamily: "monospace" }}
                      />
                    ))}
                  </Box>
                </Alert>
              )}

              {result.failed.length > 0 && (
                <Alert
                  severity="warning"
                  icon={<IconWarning />}
                  sx={{
                    borderRadius: 1,
                    fontSize: 13,
                    border: "1px solid rgba(245,158,11,0.2)",
                    bgcolor: "rgba(255,251,235,1)",
                  }}
                >
                  <AlertTitle sx={{ fontSize: 13, fontWeight: 700, mb: 0.5 }}>
                    Failed to Send ({result.failed.length})
                  </AlertTitle>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 0.5 }}>
                    {result.failed.map((email) => (
                      <Chip
                        key={email}
                        label={email}
                        size="small"
                        color="warning"
                        variant="outlined"
                        sx={{ fontSize: 11, height: 22, borderRadius: 0.5, fontFamily: "monospace" }}
                      />
                    ))}
                  </Box>
                </Alert>
              )}
            </Stack>
          )}
        </Box>
      </Paper>
    </Box>
  );
}