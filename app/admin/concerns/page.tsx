"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { apiAdminListConcerns, apiAdminResolveConcern } from "../../lib/authClient";

// ─── MUI Imports ───────────────────────────────────────────────────────────────
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Skeleton,
  Tooltip,
  Avatar,
  Stack,
  Divider,
  Badge,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import NavigateBeforeRoundedIcon from "@mui/icons-material/NavigateBeforeRounded";
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import RemoveRedEyeRoundedIcon from "@mui/icons-material/RemoveRedEyeRounded";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

// ─── Theme ─────────────────────────────────────────────────────────────────────
const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1a2e4a", light: "#2d4a72", dark: "#0f1f38" },
    secondary: { main: "#e67e4d" },
    success: { main: "#059669", light: "#d1fae5" },
    warning: { main: "#d97706", light: "#fef3c7" },
    background: { default: "#f4f1ed", paper: "#ffffff" },
  },
  typography: {
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
    h4: {
      fontFamily: "'Cormorant Garamond', Georgia, serif",
      fontWeight: 700,
      letterSpacing: "-0.5px",
    },
  },
  shape: { borderRadius: 0 },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          boxShadow: "0 2px 20px rgba(15,31,56,0.07), 0 0 0 1px rgba(15,31,56,0.04)",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: "#f8f6f3",
          color: "#6b7280",
          fontWeight: 600,
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.7px",
          borderBottom: "1px solid #ede8e1",
        },
        body: {
          fontSize: "13px",
          color: "#1a2e4a",
          borderBottom: "1px solid #f5f1ec",
          verticalAlign: "top",
          padding: "13px 16px",
        },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600, fontSize: "11px" } } },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600, borderRadius: 10 },
      },
    },
  },
});

// ─── Status Chip ───────────────────────────────────────────────────────────────
function StatusChip({ status }: { status: string }) {
  const resolved = String(status).toLowerCase() === "resolved";
  return (
    <Chip
      size="small"
      icon={
        resolved ? (
          <CheckCircleOutlineRoundedIcon style={{ fontSize: 13 }} />
        ) : (
          <ReportProblemOutlinedIcon style={{ fontSize: 13 }} />
        )
      }
      label={resolved ? "Resolved" : "Open"}
      sx={{
        bgcolor: resolved ? "#dcfce7" : "#fef3c7",
        color: resolved ? "#065f46" : "#92400e",
        border: `1px solid ${resolved ? "#86efac" : "#fcd34d"}`,
        "& .MuiChip-icon": { color: resolved ? "#059669" : "#d97706" },
        px: 0.5,
      }}
    />
  );
}

// ─── Skeleton Rows ──────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <TableRow key={i}>
          {[...Array(10)].map((_, j) => (
            <TableCell key={j}>
              <Skeleton variant="rounded" height={22} sx={{ bgcolor: "#f0ece6", borderRadius: 6 }} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AdminConcernsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<any | null>(null);
  const [resolutionFile, setResolutionFile] = useState<File | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>("");
  const onceRef = useRef(false);

  async function load(p = 1, st = status) {
    setLoading(true);
    try {
      const j = await apiAdminListConcerns(st || undefined, p);
      setRows(j?.data ?? []);
      setMeta(j);
      setPage(p);
    } catch (e: any) {
      try { toast.error(e?.message || "Failed to load concerns"); } catch {}
    } finally { setLoading(false); }
  }

  useEffect(() => { if (!onceRef.current) { onceRef.current = true; load(1); } }, []);
  useEffect(() => { load(1, status); }, [status]);

  async function resolve(id: number) {
    try {
      await apiAdminResolveConcern(id, resolutionFile || undefined, resolutionNote || undefined);
      try { toast.success("Marked resolved"); } catch {}
      await load(page, status);
      setResolutionFile(null);
      setResolutionNote("");
    } catch (e: any) {
      try { toast.error(e?.message || "Failed to resolve"); } catch {}
    }
  }

  const openCount = useMemo(
    () => rows.filter((r) => (r.status || "").toLowerCase() !== "resolved").length,
    [rows]
  );

  function userAvatarUrl(user?: any) {
    if (!user?.avatar_path) return "";
    const p = String(user.avatar_path);
    if (p.startsWith("http")) return p;
    return `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000"}/storage/${p.replace(/^storage\//, "")}`;
  }

  function onView(row: any) {
    setDetailRow(row);
    setDetailOpen(true);
  }

  function closeDetail() {
    setDetailOpen(false);
    setDetailRow(null);
  }

  function exportCSV() {
    if (!rows.length) return;
    const headers = [
      "id",
      "status",
      "created_at",
      "category",
      "subject",
      "message",
      "attachment_url",
      "user_name",
      "user_email",
    ];
    const esc = (v: any) => {
      const s = String(v ?? "");
      return '"' + s.replaceAll('"', '""').replace(/\r?\n|\r/g, " ") + '"';
    };
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push([
        r.id,
        r.status,
        r.created_at,
        r.category,
        r.subject,
        r.message,
        r.attachment_url,
        r.user?.name || "",
        r.user?.email || "",
      ].map(esc).join(","));
    }
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `concerns-${status || 'all'}-p${page}-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <ThemeProvider theme={theme}>
      {/* Google Fonts */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap');`}</style>

      <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: "background.default", minHeight: "100vh" }}>
        <Stack spacing={2.5}>

          {/* ── Header ── */}
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}>
            <Box>
              <Typography
                variant="h4"
                sx={{
                  fontSize: { xs: 24, md: 30 },
                  fontWeight: 800,
                  lineHeight: 1.1,
                  color: (theme) => (theme.palette.mode === "dark" ? theme.palette.grey[50] : theme.palette.grey[900]),
                  textShadow: (theme) => (theme.palette.mode === "dark" ? "0 1px 1px rgba(0,0,0,0.6)" : "0 1px 0 rgba(255,255,255,0.6)"),
                }}
              >
                User Concerns
              </Typography>
              <Typography variant="subtitle1" sx={{ color: (theme) => (theme.palette.mode === "dark" ? theme.palette.grey[200] : theme.palette.grey[800]), mt: 0.6, fontWeight: 500 }}>
                Review and manage all submitted support requests
              </Typography>
            </Box>

            {/* Stats pills */}
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <Box
                sx={{
                  display: "flex", alignItems: "center", gap: 1,
                  px: 1.5, py: 0.75,
                  bgcolor: "#fef3c7", border: "1px solid #fcd34d",
                  borderRadius: "999px",
                  cursor: "pointer",
                }}
                onClick={() => setStatus("open")}
              >
                <ReportProblemOutlinedIcon sx={{ fontSize: 14, color: "#d97706" }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>
                  {openCount} Open
                </Typography>
              </Box>
              <Box
                sx={{
                  display: "flex", alignItems: "center", gap: 1,
                  px: 1.5, py: 0.75,
                  bgcolor: "#dcfce7", border: "1px solid #86efac",
                  borderRadius: "999px",
                  cursor: "pointer",
                }}
                onClick={() => setStatus("resolved")}
              >
                <CheckCircleOutlineRoundedIcon sx={{ fontSize: 14, color: "#059669" }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#065f46" }}>
                  {rows.length - openCount} Resolved
                </Typography>
              </Box>
              <Button size="small" onClick={() => setStatus("")} sx={{ textDecoration: "underline", fontSize: 12, color: "#374151" }}>
                Clear filter
              </Button>
            </Stack>
          </Box>

          {/* ── Toolbar ── */}
          <Paper
            sx={{
              px: 2, py: 1.5,
              display: "flex", alignItems: "center",
              justifyContent: "space-between", flexWrap: "wrap", gap: 1.5,
              borderRadius: 0,
            }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <FilterListRoundedIcon sx={{ fontSize: 18, color: "#9ca3af" }} />
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Filter by status</Typography>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  displayEmpty
                  sx={{
                    fontSize: 13, borderRadius: "10px",
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#e5e7eb" },
                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#c4bdb5" },
                  }}
                >
                  <MenuItem value="">All concerns</MenuItem>
                  <MenuItem value="open">Open only</MenuItem>
                  <MenuItem value="resolved">Resolved only</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Tooltip title="Export CSV (current list)">
                <span>
                  <Button
                    variant="contained"
                    startIcon={<FileDownloadRoundedIcon sx={{ fontSize: 16 }} />}
                    onClick={exportCSV}
                    disabled={!rows.length}
                    sx={{ fontSize: 13, px: 2 }}
                  >
                    Export CSV
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="Refresh list">
                <span>
                  <Button
                    variant="outlined"
                    startIcon={
                      <RefreshRoundedIcon
                        sx={{ fontSize: 16, transition: "transform 0.4s", transform: loading ? "rotate(360deg)" : "none" }}
                      />
                    }
                    onClick={() => load(page, status)}
                    disabled={loading}
                    sx={{
                      borderColor: "#e5e7eb", color: "#374151",
                      "&:hover": { borderColor: "#1a2e4a", bgcolor: alpha("#1a2e4a", 0.04) },
                      fontSize: 13, px: 2,
                    }}
                  >
                    {loading ? "Refreshing…" : "Refresh"}
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          </Paper>

          {/* ── Table Card ── */}
          <Paper sx={{ borderRadius: 0, overflow: "hidden" }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    {["Status", "Submitted", "Category", "Subject", "Message", "Before Photo", "After Photo", "After Note", "User", "Action"].map((h) => (
                      <TableCell key={h}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <SkeletonRows />
                  ) : rows.length ? (
                    rows.map((r) => (
                      <TableRow
                        key={r.id}
                        sx={{
                          transition: "background 0.15s",
                          "&:hover": { bgcolor: "#faf8f5" },
                          "&:last-child td": { borderBottom: 0 },
                        }}
                      >
                        {/* Status */}
                        <TableCell><StatusChip status={r.status} /></TableCell>

                        {/* Submitted */}
                        <TableCell>
                          <Typography sx={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
                            {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: "#9ca3af" }}>
                            {new Date(r.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                          </Typography>
                        </TableCell>

                        {/* Category */}
                        <TableCell>
                          {r.category ? (
                            <Chip
                              label={r.category}
                              size="small"
                              sx={{
                                bgcolor: alpha("#1a2e4a", 0.07),
                                color: "#1a2e4a",
                                fontSize: 11, fontWeight: 600,
                                border: "1px solid " + alpha("#1a2e4a", 0.12),
                              }}
                            />
                          ) : (
                            <Typography sx={{ fontSize: 12, color: "#d1d5db" }}>—</Typography>
                          )}
                        </TableCell>

                        {/* Subject */}
                        <TableCell>
                          <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#111827", maxWidth: 180 }}>
                            {r.subject}
                          </Typography>
                        </TableCell>

                        {/* Message */}
                        <TableCell>
                          <Typography
                            sx={{
                              fontSize: 12.5, color: "#4b5563", maxWidth: 360,
                              whiteSpace: "pre-wrap", lineHeight: 1.55,
                              display: "-webkit-box", WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical", overflow: "hidden",
                            }}
                          >
                            {r.message}
                          </Typography>
                        </TableCell>

                        {/* Before Photo */}
                        <TableCell>
                          {r.attachment_url ? (
                            <Tooltip title="View attachment">
                              <a href={r.attachment_url} target="_blank" rel="noreferrer">
                                <Box
                                  component="img"
                                  src={r.attachment_url}
                                  alt="attachment"
                                  sx={{
                                    width: 72, height: 56, objectFit: "cover",
                                    borderRadius: 2, border: "1px solid #e8e2da",
                                    display: "block", transition: "transform 0.15s, box-shadow 0.15s",
                                    "&:hover": { transform: "scale(1.04)", boxShadow: "0 4px 14px rgba(0,0,0,0.15)" },
                                  }}
                                />
                              </a>
                            </Tooltip>
                          ) : (
                            <Typography sx={{ fontSize: 12, color: "#d1d5db" }}>—</Typography>
                          )}
                        </TableCell>

                        {/* After Photo */}
                        <TableCell>
                          {r.resolution_url ? (
                            <Tooltip title="View completion photo">
                              <a href={r.resolution_url} target="_blank" rel="noreferrer">
                                <Box component="img" src={r.resolution_url} alt="resolution" sx={{ width:72, height:56, objectFit:'cover', borderRadius:2, border:'1px solid #e8e2da', display:'block' }} />
                              </a>
                            </Tooltip>
                          ) : (
                            <Typography sx={{ fontSize: 12, color: "#d1d5db" }}>—</Typography>
                          )}
                        </TableCell>

                        {/* After Note */}
                        <TableCell>
                          <Typography sx={{ fontSize: 12, maxWidth: 200, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }} title={r.resolution_note || ''}>
                            {r.resolution_note || (String(r.status).toLowerCase()==='resolved' ? '—' : 'Pending')}
                          </Typography>
                        </TableCell>

                        {/* User */}
                        <TableCell>
                          {(r.user?.name || r.user?.email) ? (
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                              <Avatar
                                src={userAvatarUrl(r.user) || undefined}
                                sx={{
                                  width: 28, height: 28, fontSize: 11, fontWeight: 700,
                                  bgcolor: alpha("#1a2e4a", 0.1), color: "#1a2e4a",
                                }}
                              >
                                {(!userAvatarUrl(r.user) && (r.user?.name || r.user?.email)) ? (r.user?.name || r.user?.email)[0].toUpperCase() : null}
                              </Avatar>
                              <Typography sx={{ fontSize: 12.5, color: "#374151", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {r.user?.name || r.user?.email}
                              </Typography>
                            </Stack>
                          ) : (
                            <Typography sx={{ fontSize: 12, color: "#d1d5db" }}>—</Typography>
                          )}
                        </TableCell>

                        {/* Action */}
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              startIcon={<RemoveRedEyeRoundedIcon sx={{ fontSize: 15 }} />}
                              onClick={() => onView(r)}
                              sx={{
                                border: "1px solid #e5e7eb",
                                fontSize: 12, px: 1.25, py: 0.4, whiteSpace: "nowrap",
                                color: "#374151",
                                "&:hover": { bgcolor: alpha("#1a2e4a", 0.05) },
                              }}
                            >
                              View
                            </Button>
                            {String(r.status).toLowerCase() !== "resolved" ? (
                              <Button
                                size="small"
                                startIcon={<CheckCircleOutlineRoundedIcon sx={{ fontSize: 15 }} />}
                                onClick={() => { setResolutionFile(null); onView(r); }}
                                sx={{
                                  bgcolor: "#ecfdf5", color: "#065f46",
                                  border: "1px solid #86efac",
                                  fontSize: 12, px: 1.25, py: 0.4, whiteSpace: "nowrap",
                                  "&:hover": { bgcolor: "#d1fae5", border: "1px solid #34d399" },
                                }}
                              >
                                Resolve…
                              </Button>
                            ) : null}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Box sx={{ textAlign: "center", py: 6 }}>
                          <ReportProblemOutlinedIcon sx={{ fontSize: 40, color: "#e5e7eb", mb: 1 }} />
                          <Typography sx={{ color: "#9ca3af", fontSize: 13 }}>No concerns found.</Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* ── Pagination ── */}
            <Divider sx={{ borderColor: "#f0ebe4" }} />
            <Box
              sx={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                px: 2.5, py: 1.5,
              }}
            >
              <Button
                size="small"
                startIcon={<NavigateBeforeRoundedIcon />}
                disabled={!meta?.links?.prev || loading}
                onClick={() => load(Math.max(1, page - 1), status)}
                sx={{
                  color: "#374151", borderColor: "#e5e7eb", border: "1px solid",
                  fontSize: 12, px: 1.5,
                  "&:hover": { bgcolor: alpha("#1a2e4a", 0.05) },
                  "&:disabled": { color: "#d1d5db", borderColor: "#f3f4f6" },
                }}
              >
                Previous
              </Button>

              <Typography sx={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>
                Page <Box component="span" sx={{ fontWeight: 700, color: "#1a2e4a" }}>{page}</Box>
              </Typography>

              <Button
                size="small"
                endIcon={<NavigateNextRoundedIcon />}
                disabled={!meta?.links?.next || loading}
                onClick={() => load(page + 1, status)}
                sx={{
                  color: "#374151", borderColor: "#e5e7eb", border: "1px solid",
                  fontSize: 12, px: 1.5,
                  "&:hover": { bgcolor: alpha("#1a2e4a", 0.05) },
                  "&:disabled": { color: "#d1d5db", borderColor: "#f3f4f6" },
                }}
              >
                Next
              </Button>
            </Box>
          </Paper>

          {/* ── Details Dialog ── */}
          <Dialog open={detailOpen} onClose={closeDetail} fullWidth maxWidth="md">
            <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <Avatar
                  src={userAvatarUrl(detailRow?.user) || undefined}
                  sx={{ width: 32, height: 32, fontSize: 12, fontWeight: 700 }}
                >
                  {(!userAvatarUrl(detailRow?.user) && (detailRow?.user?.name || detailRow?.user?.email))
                    ? (detailRow?.user?.name || detailRow?.user?.email)[0].toUpperCase()
                    : null}
                </Avatar>
                <Stack spacing={0.25}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <StatusChip status={detailRow?.status || ""} />
                    <Typography sx={{ fontWeight: 700 }}>
                      {detailRow?.subject || "Concern"}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ color: "#6b7280" }}>
                    {detailRow?.user?.name || detailRow?.user?.email || "Unknown user"}
                  </Typography>
                </Stack>
              </Stack>
              <IconButton onClick={closeDetail}>
                <CloseRoundedIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              {detailRow && (
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2} sx={{ alignItems: "center", color: "#6b7280" }}>
                    <PersonOutlineRoundedIcon sx={{ fontSize: 18 }} />
                    <Typography sx={{ fontSize: 13 }}>
                      {detailRow.user?.name || detailRow.user?.email || "Unknown user"}
                    </Typography>
                    <Divider orientation="vertical" flexItem />
                    <Typography sx={{ fontSize: 12 }}>
                      {new Date(detailRow.created_at).toLocaleString()}
                    </Typography>
                  </Stack>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: "#6b7280", mb: 0.5 }}>Category</Typography>
                    <Typography sx={{ fontWeight: 600 }}>{detailRow.category || "—"}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: "#6b7280", mb: 0.5 }}>Message</Typography>
                    <Typography sx={{ whiteSpace: "pre-wrap" }}>{detailRow.message}</Typography>
                  </Box>
                  {detailRow.attachment_url && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: "#6b7280", mb: 0.5 }}>Before Photo</Typography>
                      <a href={detailRow.attachment_url} target="_blank" rel="noreferrer">
                        <Box
                          component="img"
                          src={detailRow.attachment_url}
                          alt="attachment"
                          sx={{ width: 260, maxHeight: 200, objectFit: "cover", border: "1px solid #e8e2da" }}
                        />
                      </a>
                    </Box>
                  )}

                  {String(detailRow.status).toLowerCase() !== "resolved" ? (
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: "#6b7280", mb: 0.5 }}>After Photo (required to resolve)</Typography>
                      <Button component="label" variant="outlined" startIcon={<AttachFileRoundedIcon sx={{ fontSize: 16 }} />}>
                        Upload Image
                        <input hidden type="file" accept="image/*" onChange={(e)=> setResolutionFile(e.target.files?.[0] || null)} />
                      </Button>
                      {resolutionFile && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" sx={{ color: '#6b7280' }}>{resolutionFile.name}</Typography>
                        </Box>
                      )}
                      <Box sx={{ mt: 1.5 }}>
                        <Typography variant="subtitle2" sx={{ color: "#6b7280", mb: 0.5 }}>Short Note (optional)</Typography>
                        <input
                          type="text"
                          value={resolutionNote}
                          onChange={(e)=> setResolutionNote(e.target.value)}
                          placeholder="e.g. Photo updated on signage, cleaned area, etc."
                          style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8 }}
                          maxLength={500}
                        />
                      </Box>
                    </Box>
                  ) : (
                    detailRow.resolution_url ? (
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: "#6b7280", mb: 0.5 }}>After Photo</Typography>
                        <a href={detailRow.resolution_url} target="_blank" rel="noreferrer">
                          <Box component="img" src={detailRow.resolution_url} alt="resolution" sx={{ width:260, maxHeight:200, objectFit:'cover', border:'1px solid #e8e2da' }} />
                        </a>
                        {detailRow.resolution_note ? (
                          <Typography sx={{ mt: 1, fontSize: 12, color: '#374151' }}>Note: {detailRow.resolution_note}</Typography>
                        ) : null}
                      </Box>
                    ) : null
                  )}
                </Stack>
              )}
            </DialogContent>
            <DialogActions>
              {detailRow && String(detailRow.status).toLowerCase() !== "resolved" && (
                <Button
                  startIcon={<CheckCircleOutlineRoundedIcon sx={{ fontSize: 15 }} />}
                  onClick={async () => {
                    if (!resolutionFile) { try { toast.error("Please upload an after photo to resolve."); } catch {}; return; }
                    await resolve(detailRow.id); closeDetail();
                  }}
                >
                  Mark Resolved
                </Button>
              )}
              <Button onClick={closeDetail}>Close</Button>
            </DialogActions>
          </Dialog>

        </Stack>
      </Box>
    </ThemeProvider>
  );
}