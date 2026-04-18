"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiGetProfile, apiMe, apiUpdateProfile, apiUploadAvatar } from "../../lib/authClient";

export default function AdminProfilePage() {
  const [me, setMe] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  useEffect(() => {
    (async () => {
      try { const u = await apiGetProfile(); setMe(u); }
      catch { try { const u = await apiMe(); setMe(u); } catch {} }
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    setSaving(true); setErr("");
    try {
      const payload: any = {
        first_name: me.first_name ?? "",
        middle_name: me.middle_name ?? "",
        last_name: me.last_name ?? "",
        phone: me.phone ?? "",
        address: me.address ?? "",
        company: me.company ?? "",
        bio: me.bio ?? "",
      };
      const updated = await apiUpdateProfile(payload);
      setMe(updated);
      try { toast.success("Profile saved"); } catch {}
    } catch (e: any) {
      setErr(e?.message || "Update failed");
      try { toast.error(e?.message || "Update failed"); } catch {}
    } finally { setSaving(false); }
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPreviewUrl(URL.createObjectURL(f));
    try { const j = await apiUploadAvatar(f); setMe(j.user); setPreviewUrl(""); try { toast.success("Profile photo updated"); } catch {} }
    catch (e: any) { setErr(e?.message || "Upload failed"); try { toast.error(e?.message || "Upload failed"); } catch {} }
  }

  function avatarUrl() {
    if (previewUrl) return previewUrl;
    if (me?.avatar_url && typeof me.avatar_url === "string") return me.avatar_url as string;
    if (me?.avatar_path) {
      const p = String(me.avatar_path);
      if (p.startsWith("http")) return p;
      return `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000"}/storage/${p.replace(/^storage\//,'')}`;
    }
    return "";
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@300;400;500&display=swap');

        .profile-wrap {
          font-family: 'DM Sans', sans-serif;
        }

        /* ── Card ── */
        .profile-card {
          background: #fff;
          border-radius: 16px;
          border: 1px solid #e8e0d8;
          box-shadow: 0 2px 16px rgba(15,31,56,0.06);
          overflow: hidden;
        }

        /* ── Header band ── */
        .profile-header {
          background: #0f1f38;
          padding: 1.8rem 2rem;
          display: flex;
          align-items: center;
          gap: 1.25rem;
          position: relative;
          overflow: hidden;
        }
        .profile-header::before {
          content: '';
          position: absolute;
          width: 260px; height: 260px;
          border-radius: 50%;
          background: rgba(201,168,76,0.07);
          top: -100px; right: -80px;
        }
        .profile-header::after {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            -55deg, transparent, transparent 32px,
            rgba(201,168,76,0.025) 32px, rgba(201,168,76,0.025) 33px
          );
        }

        .profile-avatar {
          width: 56px; height: 56px;
          border-radius: 14px;
          background: rgba(201,168,76,0.15);
          border: 2px solid rgba(201,168,76,0.5);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          z-index: 1;
        }
        .profile-avatar-initials {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.4rem;
          font-weight: 700;
          color: #c9a84c;
          line-height: 1;
          text-transform: uppercase;
        }

        .profile-header-text { z-index: 1; }
        .profile-header-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.4rem;
          font-weight: 700;
          color: #f5f0eb;
          line-height: 1.2;
        }
        .profile-header-role {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          margin-top: 0.3rem;
          padding: 0.2rem 0.65rem;
          background: rgba(201,168,76,0.15);
          border: 1px solid rgba(201,168,76,0.35);
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #c9a84c;
        }

        /* ── Body ── */
        .profile-body { padding: 1.8rem 2rem; }

        .profile-section-label {
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: rgba(15,31,56,0.4);
          margin-bottom: 1.1rem;
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .profile-section-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(15,31,56,0.08);
        }

        .profile-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1rem;
        }

        .profile-field {
          background: #f9f6f2;
          border: 1px solid #ede5da;
          border-radius: 10px;
          padding: 0.85rem 1rem;
        }
        .profile-field-label {
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #9aa3b0;
          margin-bottom: 0.35rem;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .profile-field-label svg { color: #c9a84c; }
        .profile-field-value {
          font-size: 0.925rem;
          font-weight: 500;
          color: #0f1f38;
          word-break: break-all;
        }

        /* ── Skeleton loader ── */
        .skeleton-header {
          background: #0f1f38;
          padding: 1.8rem 2rem;
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }
        .skel {
          background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 6px;
        }
        .skel-light {
          background: linear-gradient(90deg, #f0ebe4 25%, #e8e0d5 50%, #f0ebe4 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 6px;
        }
        @keyframes shimmer { to { background-position: -200% 0; } }

        /* ── Form inputs (editable) ── */
        .pf-form grid { display:grid; grid-template-columns: repeat(auto-fill,minmax(220px,1fr)); gap:12px; }
        .pf-label { font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#6b7280; margin-bottom:6px; }
        .pf-input { width:100%; background:#fff; border:1px solid #e5e7eb; color:#0f1f38; border-radius:10px; padding:0.6rem 0.7rem; outline:none; transition:border-color .15s, box-shadow .15s; }
        .pf-input::placeholder { color:#9aa3b0; }
        .pf-input:focus { border-color:#1e3a8a; box-shadow:0 0 0 3px rgba(30,58,138,0.12); }
        .pf-actions { display:flex; gap:10px; margin-top:14px; }
        .pf-btn { border-radius:10px; padding:0.5rem 0.8rem; font-weight:700; cursor:pointer; }
        .pf-btn-primary { background:#c9a84c; color:#0f1f38; border:1px solid #c9a84c; }
      `}</style>

      <div className="profile-wrap">
        <div className="profile-card">

          {me ? (
            <>
              {/* Header */}
              <div className="profile-header">
                <div className="profile-avatar" style={{ overflow: 'hidden' }}>
                  {avatarUrl() ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl()} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span className="profile-avatar-initials">
                      {(me.name ?? me.email ?? "?")
                        .split(" ")
                        .slice(0, 2)
                        .map((w: string) => w[0])
                        .join("")}
                    </span>
                  )}
                </div>
                <div className="profile-header-text">
                  <div className="profile-header-name">{me.name ?? "—"}</div>
                  {me.role && (
                    <div className="profile-header-role">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2zm0 12c5.33 0 8 2.67 8 4v2H4v-2c0-1.33 2.67-4 8-4z"/></svg>
                      {me.role}
                    </div>
                  )}
                </div>
                <div style={{ marginLeft: 'auto', zIndex: 1 }}>
                  <button type="button" onClick={() => fileRef.current?.click()} style={{ background: '#f5f0eb', color: '#0f1f38', border: '1px solid rgba(201,168,76,0.5)', padding: '0.4rem 0.7rem', borderRadius: 8, fontWeight: 600 }}>Change Photo</button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} style={{ display: 'none' }} />
                </div>
              </div>

              {/* Body */}
              <form className="profile-body" onSubmit={onSubmit}>
                <div className="profile-section-label">Account details</div>
                <div className="profile-grid">

                  {/* Email (read-only) */}
                  {me.email && (
                    <div className="profile-field">
                      <div className="profile-field-label">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                        Email address
                      </div>
                      <div className="profile-field-value">{me.email}</div>
                    </div>
                  )}

                  {/* Editable fields */}
                  {[
                    { key: 'first_name', label: 'First name' },
                    { key: 'middle_name', label: 'Middle name' },
                    { key: 'last_name', label: 'Last name' },
                    { key: 'phone', label: 'Phone' },
                    { key: 'company', label: 'Company' },
                    { key: 'address', label: 'Address' },
                  ].map((f: any) => (
                    <div className="profile-field" key={f.key}>
                      <div className="profile-field-label">{f.label}</div>
                      <input className="pf-input" value={me?.[f.key] ?? ''} onChange={(e) => setMe({ ...me, [f.key]: e.target.value })} />
                    </div>
                  ))}

                  {/* Bio */}
                  <div className="profile-field" style={{ gridColumn: '1 / -1' }}>
                    <div className="profile-field-label">Bio</div>
                    <textarea className="pf-input" value={me?.bio ?? ''} onChange={(e) => setMe({ ...me, bio: e.target.value })} rows={4} style={{ resize: 'vertical' }} />
                  </div>
                </div>
                {err && <div style={{ color: '#b91c1c', marginTop: 10 }}>{err}</div>}
                <div className="pf-actions">
                  <button disabled={saving} type="submit" className="pf-btn pf-btn-primary">{saving ? 'Saving…' : 'Save Changes'}</button>
                </div>
              </form>
            </>
          ) : (
            /* Skeleton */
            <>
              <div className="skeleton-header">
                <div className="skel" style={{ width: 56, height: 56, borderRadius: 14, flexShrink: 0 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div className="skel" style={{ width: 160, height: 20 }} />
                  <div className="skel" style={{ width: 80, height: 14 }} />
                </div>
              </div>
              <div className="profile-body">
                <div className="profile-section-label">Account details</div>
                <div className="profile-grid">
                  {[160, 200, 100].map((w, i) => (
                    <div className="profile-field" key={i}>
                      <div className="skel-light" style={{ width: 60, height: 10, marginBottom: "0.5rem" }} />
                      <div className="skel-light" style={{ width: w, height: 16 }} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}