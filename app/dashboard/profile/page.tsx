"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiGetProfile, apiMe, apiUpdateProfile, apiUploadAvatar } from "../../lib/authClient";

export default function ClientProfileEditPage() {
  const [me, setMe] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const u = await apiGetProfile();
        setMe(u);
      } catch {
        try { const u = await apiMe(); setMe(u); } catch {}
      }
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
    } finally {
      setSaving(false);
    }
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPreviewUrl(URL.createObjectURL(f));
    try {
      const j = await apiUploadAvatar(f);
      setMe(j.user);
      setPreviewUrl("");
      try { toast.success("Profile photo updated"); } catch {}
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
      try { toast.error(e?.message || "Upload failed"); } catch {}
    }
  }

  function avatarUrl() {
    if (previewUrl) return previewUrl;
    if (me?.avatar_path) {
      const p = String(me.avatar_path);
      if (p.startsWith("http")) return p;
      return `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000"}/storage/${p.replace(/^storage\//,'')}`;
    }
    return "";
  }

  return (
    <div style={{ padding: "1.25rem" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');
        .prof-wrap { font-family: 'DM Sans', sans-serif; }
        .prof-title { font-family:'Cormorant Garamond',serif; font-size:28px; font-weight:700; color:#0f1f38; margin: 0 0 14px; }
        .prof-card { background:#fff; border:1px solid #e8e0d8; border-radius:14px; box-shadow:0 2px 16px rgba(15,31,56,0.06); padding:1.25rem; }
        .prof-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; }
        .prof-label { font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#6b7280; margin-bottom:6px; }
        .zv-input { width:100%; background:#fff; border:1px solid #e5e7eb; color:#0f1f38; border-radius:10px; padding:0.6rem 0.7rem; outline:none; transition:border-color .15s, box-shadow .15s; }
        .zv-input::placeholder { color:#9aa3b0; }
        .zv-input:focus { border-color:#1e3a8a; box-shadow:0 0 0 3px rgba(30,58,138,0.12); }
        .prof-actions { display:flex; gap:10px; margin-top:16px; }
        .zv-btn { border-radius:10px; padding:0.55rem 0.9rem; font-weight:700; cursor:pointer; }
        .zv-btn-primary { background:#c9a84c; color:#0f1f38; border:1px solid #c9a84c; }
        .zv-helper { font-size:12px; color:#6b7280; margin-top:6px; }
        .avatar-box { width:72px; height:72px; border-radius:16px; background:#f5f0eb; display:flex; align-items:center; justify-content:center; overflow:hidden; border:1px solid #e8e0d8; }
        .avatar-initials { font-family:'Cormorant Garamond',serif; font-weight:700; font-size:22px; color:#c9a84c; }
      `}</style>
      <div style={{ maxWidth: 820, margin: "0 auto" }} className="prof-wrap">
        <h1 className="prof-title">Edit Profile</h1>

        <form onSubmit={onSubmit} className="prof-card">
          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
            <div className="avatar-box">
              {avatarUrl() ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl()} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span className="avatar-initials">
                  {(me?.name || me?.email || '?').split(' ').slice(0,2).map((w: string) => w[0]).join('').toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <button type="button" onClick={() => fileRef.current?.click()} className="zv-btn zv-btn-primary" style={{ background:'#0f1f38', color:'#f5f0eb', borderColor:'#0f1f38' }}>Upload Photo</button>
              <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} style={{ display: 'none' }} />
              <div className="zv-helper">JPG/PNG/WebP up to 4MB</div>
            </div>
          </div>

          {/* Fields */}
          <div className="prof-grid">
            {[
              { key: 'first_name', label: 'First name' },
              { key: 'middle_name', label: 'Middle name' },
              { key: 'last_name', label: 'Last name' },
              { key: 'phone', label: 'Phone' },
              { key: 'company', label: 'Company' },
              { key: 'address', label: 'Address', full: true },
            ].map((f: any) => (
              <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: f.full ? '1 / -1' : undefined }}>
                <label className="prof-label">{f.label}</label>
                <input className="zv-input" value={me?.[f.key] ?? ''} onChange={(e) => setMe({ ...me, [f.key]: e.target.value })} />
              </div>
            ))}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
              <label className="prof-label">Bio</label>
              <textarea className="zv-input" value={me?.bio ?? ''} onChange={(e) => setMe({ ...me, bio: e.target.value })} rows={4} style={{ resize: 'vertical' }} />
            </div>
          </div>

          {err && <div style={{ color: '#b91c1c', marginTop: 10 }}>{err}</div>}

          <div className="prof-actions">
            <button disabled={saving} type="submit" className="zv-btn zv-btn-primary">{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
