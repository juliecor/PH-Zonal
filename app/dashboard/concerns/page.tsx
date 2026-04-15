"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiCreateConcern, apiMyConcerns } from "../../lib/authClient";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import SendIcon from "@mui/icons-material/Send";

export default function ClientConcernsPage() {
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [list, setList] = useState<any>({ data: [], meta: {} });
  const [page, setPage] = useState(1);
  const onceRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");

  async function load(p = 1) {
    try {
      const j = await apiMyConcerns({ page: p });
      setList(j);
      setPage(p);
    } catch {}
  }

  useEffect(() => {
    if (!onceRef.current) {
      onceRef.current = true;
      load(1);
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      try {
        toast.error("Subject and message are required");
      } catch {}
      return;
    }
    setSubmitting(true);
    try {
      await apiCreateConcern({
        category: category || undefined,
        subject: subject.trim(),
        message: message.trim(),
        attachmentFile: file || undefined,
      });
      setSubject("");
      setMessage("");
      setCategory("");
      setFile(null);
      setPreview("");
      await load(1);
      try {
        toast.success("Concern submitted");
      } catch {}
    } catch (e: any) {
      try {
        toast.error(e?.message || "Submit failed");
      } catch {}
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            letterSpacing: 0.2,
            color: (theme) => (theme.palette.mode === "dark" ? theme.palette.grey[50] : theme.palette.grey[900]),
            textShadow: (theme) => (theme.palette.mode === "dark" ? "0 1px 1px rgba(0,0,0,0.6)" : "0 1px 0 rgba(255,255,255,0.6)"),
          }}
        >
          Report a Concern
        </Typography>
        <Typography
          variant="subtitle1"
          sx={{ mt: 0.5, color: (theme) => (theme.palette.mode === "dark" ? theme.palette.grey[200] : theme.palette.grey[800]) }}
        >
          Share issues, data corrections, or feature requests with our team.
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
        <CardContent>
          <Box component="form" onSubmit={onSubmit} noValidate>
            <Stack spacing={2}>
              <Box sx={{ width: { xs: "100%", sm: "60%", md: "40%" } }}>
                <FormControl fullWidth>
                  <InputLabel id="category-label">Category</InputLabel>
                  <Select
                    labelId="category-label"
                    label="Category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <MenuItem value="">
                      <em>Select…</em>
                    </MenuItem>
                    <MenuItem value="Missing Zonal Value">Missing Zonal Value</MenuItem>
                    <MenuItem value="Bug">Bug</MenuItem>
                    <MenuItem value="Data Issue">Data Issue</MenuItem>
                    <MenuItem value="Feature Request">Feature Request</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <TextField
                fullWidth
                label="Subject"
                placeholder="Brief summary"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />

              <TextField
                fullWidth
                label="Details"
                placeholder="Describe the issue…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                multiline
                minRows={5}
              />

              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                  <Button variant="outlined" component="label">
                    Upload Image
                    <input
                      hidden
                      accept="image/*"
                      type="file"
                      onChange={(e) => {
                        const f = (e.target as HTMLInputElement).files?.[0] || null;
                        setFile(f);
                        setPreview(f ? URL.createObjectURL(f) : "");
                      }}
                    />
                  </Button>
                  <Typography variant="body2" color="text.secondary">
                    Optional. PNG/JPG up to ~5MB.
                  </Typography>
                </Box>
                {preview && (
                  <Box sx={{ mt: 2 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt="Preview"
                      style={{ maxWidth: 240, maxHeight: 160, borderRadius: 8, border: "1px solid #e5e7eb" }}
                    />
                  </Box>
                )}
              </Box>

              <Box>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={submitting ? <CircularProgress color="inherit" size={16} /> : <SendIcon />}
                  disabled={submitting}
                >
                  {submitting ? "Submitting…" : "Submit Concern"}
                </Button>
              </Box>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              My Concerns
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />

          <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: "none" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Status</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Before Photo</TableCell>
                  <TableCell>After Photo</TableCell>
                  <TableCell>After Note</TableCell>
                  <TableCell>Submitted</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(list?.data ?? []).length ? (
                  (list.data as any[]).map((r: any) => {
                    const isResolved = String(r.status).toLowerCase() === "resolved";
                    return (
                      <TableRow key={r.id} hover>
                        <TableCell>
                          <Chip
                            size="small"
                            label={r.status}
                            color={isResolved ? "success" : "warning"}
                            variant={isResolved ? "filled" : "outlined"}
                          />
                        </TableCell>
                        <TableCell>{r.category || "—"}</TableCell>
                        <TableCell sx={{ maxWidth: 380 }}>
                          <Typography variant="body2" noWrap title={r.subject}>
                            {r.subject}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {r.attachment_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <a href={r.attachment_url} target="_blank" rel="noreferrer">
                              <img
                                src={r.attachment_url}
                                alt="attachment"
                                style={{ maxWidth: 80, maxHeight: 60, borderRadius: 6, border: "1px solid #e5e7eb" }}
                              />
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {r.resolution_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <a href={r.resolution_url} target="_blank" rel="noreferrer">
                              <img
                                src={r.resolution_url}
                                alt="resolution"
                                style={{ maxWidth: 80, maxHeight: 60, borderRadius: 6, border: "1px solid #e5e7eb" }}
                              />
                            </a>
                          ) : (
                            isResolved ? (
                              <Typography variant="caption" color="text.secondary">—</Typography>
                            ) : (
                              <Typography variant="caption" color="text.secondary">Pending</Typography>
                            )
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" title={r.resolution_note || ""} sx={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', maxWidth:200 }}>
                            {r.resolution_note || (isResolved ? "—" : "Pending")}
                          </Typography>
                        </TableCell>
                        <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography variant="body2" color="text.secondary">
                        No concerns yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIosNewIcon fontSize="small" />}
              disabled={!list?.links?.prev}
              onClick={() => load(Math.max(1, page - 1))}
            >
              Prev
            </Button>
            <Typography variant="caption" color="text.secondary">
              Page {page}
            </Typography>
            <Button
              variant="outlined"
              endIcon={<ArrowForwardIosIcon fontSize="small" />}
              disabled={!list?.links?.next}
              onClick={() => load(page + 1)}
            >
              Next
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
