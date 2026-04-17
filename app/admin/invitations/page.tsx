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
import { alpha } from "@mui/material/styles";

/* ─────────────────────────────────────────────────────────────────── */
/*  Inline SVG Icons (no @mui/icons-material dependency)              */
/* ─────────────────────────────────────────────────────────────────── */

const IconEmail = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const IconWarning = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const IconError = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
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
          borderColor: "divider",
          borderRadius: 3,
          overflow: "hidden",
          width: "100%",
        }}
      >
        {/* ── Card Header ── */}
        <Box
          sx={{
            px: 4,
            py: 3,
            background: (t) =>
              `linear-gradient(135deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 100%)`,
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              bgcolor: (t) => alpha(t.palette.common.white, 0.12),
              border: "1px solid",
              borderColor: (t) => alpha(t.palette.common.white, 0.2),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              color: "primary.contrastText",
            }}
          >
            <IconEmail />
          </Box>
          <Box>
            <Typography
              variant="h6"
              color="primary.contrastText"
              sx={{ fontWeight: 700, lineHeight: 1.2 }}
            >
              Invite Users
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: (t) => alpha(t.palette.common.white, 0.7), mt: 0.25, display: "block" }}
            >
              Send email invitations to new team members
            </Typography>
          </Box>
        </Box>

        {/* ── Card Body ── */}
        <Box
          component="form"
          onSubmit={onSubmit}
          sx={{ px: 4, py: 3.5, display: "flex", flexDirection: "column", gap: 3 }}
        >
          {/* Description */}
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            Paste one or more email addresses below. You can separate them with commas, spaces,
            or new lines — duplicates are handled automatically.
          </Typography>

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
                  borderRadius: 2,
                  fontSize: 13.5,
                  fontFamily: "monospace",
                  bgcolor: "background.default",
                },
              }}
            />

            {/* Parsed count pill */}
            <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
              <Chip
                size="small"
                label={`${emails.length} valid email${emails.length !== 1 ? "s" : ""} detected`}
                color={emails.length > 0 ? "primary" : "default"}
                variant={emails.length > 0 ? "filled" : "outlined"}
                sx={{ fontSize: 11, height: 22, borderRadius: 1.5 }}
              />
              {emails.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {emails.slice(0, 3).join(", ")}
                  {emails.length > 3 ? ` +${emails.length - 3} more` : ""}
                </Typography>
              )}
            </Box>
          </Box>

          <Divider />

          {/* Action Row */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Tooltip title="Only administrators are allowed to send invitations">
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  color: "text.disabled",
                  cursor: "default",
                }}
              >
                <IconLock />
                <Typography variant="caption" color="text.disabled">
                  Admin-only action
                </Typography>
              </Box>
            </Tooltip>

            <Button
              type="submit"
              variant="contained"
              disabled={!canSend}
              startIcon={sending ? <CircularProgress size={15} color="inherit" /> : <IconSend />}
              sx={{
                borderRadius: 2,
                px: 3,
                py: 1.1,
                fontWeight: 600,
                fontSize: 13,
                letterSpacing: 0.3,
                textTransform: "none",
                boxShadow: canSend
                  ? (t) => `0 4px 14px ${alpha(t.palette.primary.main, 0.35)}`
                  : "none",
                transition: "all 0.2s ease",
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
              sx={{ borderRadius: 2, fontSize: 13 }}
            >
              <AlertTitle sx={{ fontSize: 13, fontWeight: 600, mb: 0.25 }}>
                Sending Failed
              </AlertTitle>
              {error}
            </Alert>
          )}

          {/* ── Result Alerts ── */}
          {result && (
            <Stack spacing={1.5}>
              {result.sent.length > 0 && (
                <Alert
                  severity="success"
                  icon={<IconCheck />}
                  sx={{ borderRadius: 2, fontSize: 13 }}
                >
                  <AlertTitle sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>
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
                        sx={{ fontSize: 11, height: 22, borderRadius: 1.5 }}
                      />
                    ))}
                  </Box>
                </Alert>
              )}

              {result.failed.length > 0 && (
                <Alert
                  severity="warning"
                  icon={<IconWarning />}
                  sx={{ borderRadius: 2, fontSize: 13 }}
                >
                  <AlertTitle sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>
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
                        sx={{ fontSize: 11, height: 22, borderRadius: 1.5 }}
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