"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiCreateConcern, apiMyConcerns } from "../../lib/authClient";

const CATEGORIES = [
  "Missing Zonal Value",
  "Bug",
  "Data Issue",
  "Feature Request",
  "Other",
];

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      toast.error("Subject and message are required");
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
      toast.success("Concern submitted successfully");
    } catch (e: any) {
      toast.error(e?.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  const concerns: any[] = list?.data ?? [];
  const hasPrev = !!list?.links?.prev;
  const hasNext = !!list?.links?.next;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');

        .cc-wrap {
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
          gap: 1.75rem;
          width: 100%;
        }

        /* ── Header ── */
        .cc-eyebrow {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #c9a84c;
          margin-bottom: 0.4rem;
        }
        .cc-eyebrow::before {
          content: '';
          display: inline-block;
          width: 18px;
          height: 2px;
          background: #c9a84c;
          border-radius: 2px;
        }
        .cc-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 2.1rem;
          font-weight: 700;
          color: #0f1f38;
          line-height: 1.1;
        }
        .cc-desc {
          margin-top: 0.3rem;
          font-size: 0.82rem;
          color: #9aa3b0;
        }

        /* ── Card ── */
        .cc-card {
          background: #fff;
          border-radius: 16px;
          border: 1px solid #eae2d9;
          box-shadow: 0 2px 12px rgba(15,31,56,0.06), 0 4px 24px rgba(15,31,56,0.04);
          overflow: hidden;
        }
        .cc-card-header {
          padding: 1.2rem 1.5rem;
          border-bottom: 1px solid #f0ebe4;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }
        .cc-card-title {
          font-size: 0.88rem;
          font-weight: 700;
          color: #0f1f38;
        }
        .cc-card-body {
          padding: 1.5rem;
        }

        /* ── Form ── */
        .cc-form {
          display: flex;
          flex-direction: column;
          gap: 1.15rem;
        }
        .cc-row-half {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        @media (max-width: 600px) {
          .cc-row-half { grid-template-columns: 1fr; }
        }
        .cc-field {
          display: flex;
          flex-direction: column;
          gap: 0.42rem;
        }
        .cc-label {
          font-size: 0.74rem;
          font-weight: 600;
          color: #4a5568;
          letter-spacing: 0.03em;
        }
        .cc-label-req {
          color: #c9a84c;
          margin-left: 2px;
        }
        .cc-input, .cc-select, .cc-textarea {
          width: 100%;
          box-sizing: border-box;
          background: #faf8f5;
          border: 1.5px solid #e2d9d0;
          border-radius: 10px;
          padding: 0.65rem 0.9rem;
          font-size: 0.84rem;
          font-family: 'DM Sans', sans-serif;
          color: #0f1f38;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .cc-input::placeholder, .cc-textarea::placeholder { color: #c0b8b0; }
        .cc-input:focus, .cc-select:focus, .cc-textarea:focus {
          border-color: #c9a84c;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(201,168,76,0.1);
        }
        .cc-select { cursor: pointer; }
        .cc-textarea {
          resize: vertical;
          min-height: 130px;
          line-height: 1.65;
        }

        /* ── Upload ── */
        .cc-upload-row {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          flex-wrap: wrap;
        }
        .cc-upload-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.55rem 1rem;
          background: #fff;
          border: 1.5px solid #e2d9d0;
          border-radius: 10px;
          font-size: 0.8rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          color: #4a5568;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s, color 0.15s;
          white-space: nowrap;
        }
        .cc-upload-btn:hover {
          border-color: #c9a84c;
          background: #fffbf2;
          color: #0f1f38;
        }
        .cc-upload-hint { font-size: 0.75rem; color: #9aa3b0; }
        .cc-upload-name {
          font-size: 0.74rem;
          color: #0f1f38;
          font-weight: 500;
          background: rgba(201,168,76,0.08);
          border: 1px solid rgba(201,168,76,0.2);
          border-radius: 6px;
          padding: 0.24rem 0.6rem;
        }
        .cc-preview { margin-top: 0.75rem; }
        .cc-preview img {
          max-width: 220px;
          max-height: 148px;
          border-radius: 10px;
          border: 1px solid #e2d9d0;
          display: block;
          object-fit: cover;
          box-shadow: 0 2px 8px rgba(15,31,56,0.08);
        }
        .cc-preview-remove {
          margin-top: 0.4rem;
          font-size: 0.73rem;
          color: #9aa3b0;
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
          font-family: 'DM Sans', sans-serif;
          transition: color 0.13s;
        }
        .cc-preview-remove:hover { color: #dc2626; }

        /* ── Submit btn ── */
        .cc-submit {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          background: #0f1f38;
          color: #f5f0eb;
          border: none;
          border-radius: 10px;
          padding: 0.68rem 1.4rem;
          font-size: 0.85rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, transform 0.12s, box-shadow 0.15s;
          box-shadow: 0 2px 8px rgba(15,31,56,0.18);
          align-self: flex-start;
        }
        .cc-submit:hover:not(:disabled) {
          background: #1a3358;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(15,31,56,0.26);
        }
        .cc-submit:disabled { opacity: 0.55; cursor: not-allowed; transform: none; box-shadow: none; }

        /* Spinner */
        .cc-spin {
          width: 13px; height: 13px;
          border: 2px solid rgba(245,240,235,0.3);
          border-top-color: #f5f0eb;
          border-radius: 50%;
          animation: cc-spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes cc-spin { to { transform: rotate(360deg); } }

        /* ── Table ── */
        .cc-table-wrap { overflow-x: auto; }
        .cc-table {
          width: 100%;
          min-width: 700px;
          border-collapse: collapse;
          font-size: 0.82rem;
        }
        .cc-table thead tr { border-bottom: 1.5px solid #f0ebe4; }
        .cc-table th {
          padding: 0.85rem 1.25rem;
          text-align: left;
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #9aa3b0;
          background: #faf8f5;
          white-space: nowrap;
        }
        .cc-table tbody tr {
          border-bottom: 1px solid #f5f0eb;
          transition: background 0.12s;
        }
        .cc-table tbody tr:last-child { border-bottom: none; }
        .cc-table tbody tr:hover { background: #faf7f3; }
        .cc-table td {
          padding: 0.85rem 1.25rem;
          color: #374151;
          vertical-align: middle;
        }

        /* Status pill */
        .cc-status {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.26rem 0.7rem;
          border-radius: 50px;
          font-size: 0.67rem;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .cc-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .cc-status-resolved {
          background: rgba(16,185,129,0.1);
          color: #065f46;
          border: 1px solid rgba(16,185,129,0.22);
        }
        .cc-status-resolved .cc-dot { background: #10b981; }
        .cc-status-pending {
          background: rgba(245,158,11,0.1);
          color: #92400e;
          border: 1px solid rgba(245,158,11,0.22);
        }
        .cc-status-pending .cc-dot { background: #f59e0b; }
        .cc-status-other {
          background: rgba(107,117,133,0.1);
          color: #374151;
          border: 1px solid rgba(107,117,133,0.18);
        }
        .cc-status-other .cc-dot { background: #6b7585; }

        /* Table helpers */
        .cc-thumb {
          max-width: 72px;
          max-height: 52px;
          border-radius: 7px;
          border: 1px solid #e2d9d0;
          display: block;
          object-fit: cover;
          transition: transform 0.15s;
        }
        .cc-thumb:hover { transform: scale(1.05); }
        .cc-subject {
          font-weight: 500;
          color: #0f1f38;
          max-width: 200px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
        }
        .cc-note {
          max-width: 175px;
          font-size: 0.77rem;
          color: #6b7585;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .cc-muted { font-size: 0.77rem; color: #b0b8c4; }

        /* Empty state */
        .cc-empty {
          padding: 3rem 1.5rem;
          text-align: center;
        }
        .cc-empty-icon {
          width: 46px; height: 46px;
          border-radius: 13px;
          background: #f5f0eb;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #c0b8b0;
          margin-bottom: 0.75rem;
        }
        .cc-empty-title { font-size: 0.88rem; font-weight: 600; color: #6b7585; margin-bottom: 0.2rem; }
        .cc-empty-sub { font-size: 0.78rem; color: #b0b8c4; }

        /* Pagination */
        .cc-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border-top: 1px solid #f0ebe4;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .cc-page-info { font-size: 0.77rem; color: #9aa3b0; }
        .cc-page-info strong { color: #0f1f38; font-weight: 600; }
        .cc-pag-controls { display: flex; align-items: center; gap: 0.4rem; }
        .cc-pag-btn {
          display: flex; align-items: center; gap: 0.3rem;
          padding: 0.48rem 0.9rem;
          background: #fff;
          border: 1.5px solid #e2d9d0;
          border-radius: 10px;
          font-size: 0.78rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          color: #0f1f38;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(15,31,56,0.06);
          transition: all 0.15s;
        }
        .cc-pag-btn:hover:not(:disabled) {
          border-color: #c9a84c;
          background: #fffbf2;
          transform: translateY(-1px);
        }
        .cc-pag-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
        .cc-pag-current {
          padding: 0.48rem 0.85rem;
          background: #0f1f38;
          color: #f5f0eb;
          border-radius: 10px;
          font-size: 0.78rem;
          font-weight: 600;
          min-width: 38px;
          text-align: center;
        }
      `}</style>

      <div className="cc-wrap">

        {/* ── Header ── */}
        <div>
          <div className="cc-eyebrow">Support</div>
          <h1 className="cc-title">Report a Concern</h1>
          <p className="cc-desc">Share issues, data corrections, or feature requests with our team.</p>
        </div>

        {/* ── Form Card ── */}
        <div className="cc-card">
          <div className="cc-card-header">
            <span className="cc-card-title">Submit a New Concern</span>
          </div>
          <div className="cc-card-body">
            <form className="cc-form" onSubmit={onSubmit} noValidate>

              <div className="cc-row-half">
                <div className="cc-field">
                  <label className="cc-label">Category</label>
                  <select className="cc-select" value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="">Select a category…</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="cc-field">
                  <label className="cc-label">Subject <span className="cc-label-req">*</span></label>
                  <input
                    type="text"
                    className="cc-input"
                    placeholder="Brief summary of the issue"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                  />
                </div>
              </div>

              <div className="cc-field">
                <label className="cc-label">Details <span className="cc-label-req">*</span></label>
                <textarea
                  className="cc-textarea"
                  placeholder="Describe the issue in detail — include location, property ID, or any relevant context…"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
              </div>

              <div className="cc-field">
                <label className="cc-label">Attachment</label>
                <div className="cc-upload-row">
                  <button type="button" className="cc-upload-btn" onClick={() => fileInputRef.current?.click()}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    {file ? "Change Image" : "Upload Image"}
                  </button>
                  {file
                    ? <span className="cc-upload-name">{file.name}</span>
                    : <span className="cc-upload-hint">Optional — PNG or JPG, up to 5 MB</span>
                  }
                  <input
                    ref={fileInputRef}
                    hidden
                    accept="image/*"
                    type="file"
                    onChange={e => {
                      const f = e.target.files?.[0] || null;
                      setFile(f);
                      setPreview(f ? URL.createObjectURL(f) : "");
                    }}
                  />
                </div>
                {preview && (
                  <div className="cc-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Preview" />
                    <button type="button" className="cc-preview-remove" onClick={() => { setFile(null); setPreview(""); }}>
                      Remove image
                    </button>
                  </div>
                )}
              </div>

              <button type="submit" className="cc-submit" disabled={submitting}>
                {submitting ? (
                  <><span className="cc-spin" /> Submitting…</>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    Submit Concern
                  </>
                )}
              </button>

            </form>
          </div>
        </div>

        {/* ── My Concerns Card ── */}
        <div className="cc-card">
          <div className="cc-card-header">
            <span className="cc-card-title">My Concerns</span>
            {concerns.length > 0 && (
              <span style={{ fontSize: "0.75rem", color: "#9aa3b0" }}>
                {concerns.length} record{concerns.length !== 1 ? "s" : ""} on this page
              </span>
            )}
          </div>

          <div className="cc-table-wrap">
            <table className="cc-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Category</th>
                  <th>Subject</th>
                  <th>Before Photo</th>
                  <th>After Photo</th>
                  <th>After Note</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {concerns.length > 0 ? concerns.map((r: any) => {
                  const status = String(r.status || "").toLowerCase();
                  const isResolved = status === "resolved";
                  const isPending = status === "pending";
                  const badgeClass = `cc-status ${isResolved ? "cc-status-resolved" : isPending ? "cc-status-pending" : "cc-status-other"}`;
                  return (
                    <tr key={r.id}>
                      <td>
                        <span className={badgeClass}>
                          <span className="cc-dot" />
                          {r.status}
                        </span>
                      </td>
                      <td><span className="cc-muted">{r.category || "—"}</span></td>
                      <td><span className="cc-subject" title={r.subject}>{r.subject}</span></td>
                      <td>
                        {r.attachment_url ? (
                          <a href={r.attachment_url} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={r.attachment_url} alt="before" className="cc-thumb" />
                          </a>
                        ) : <span className="cc-muted">—</span>}
                      </td>
                      <td>
                        {r.resolution_url ? (
                          <a href={r.resolution_url} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={r.resolution_url} alt="after" className="cc-thumb" />
                          </a>
                        ) : <span className="cc-muted">{isResolved ? "—" : "Pending"}</span>}
                      </td>
                      <td>
                        <span className="cc-note" title={r.resolution_note || ""}>
                          {r.resolution_note || <span className="cc-muted">{isResolved ? "—" : "Pending"}</span>}
                        </span>
                      </td>
                      <td>
                        <span className="cc-muted">
                          {new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7}>
                      <div className="cc-empty">
                        <div className="cc-empty-icon">
                          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                          </svg>
                        </div>
                        <div className="cc-empty-title">No concerns submitted yet</div>
                        <div className="cc-empty-sub">Use the form above to report an issue or request</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="cc-pagination">
            <span className="cc-page-info">Page <strong>{page}</strong></span>
            <div className="cc-pag-controls">
              <button className="cc-pag-btn" disabled={!hasPrev} onClick={() => load(Math.max(1, page - 1))}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                Prev
              </button>
              <span className="cc-pag-current">{page}</span>
              <button className="cc-pag-btn" disabled={!hasNext} onClick={() => load(page + 1)}>
                Next
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
