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
  const [activeTab, setActiveTab] = useState<"overview" | "edit">("overview");

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
      const updated = await apiUpdateProfile({
        first_name: me.first_name ?? "", middle_name: me.middle_name ?? "",
        last_name: me.last_name ?? "", phone: me.phone ?? "",
        address: me.address ?? "", company: me.company ?? "", bio: me.bio ?? "",
      });
      setMe(updated);
      try { toast.success("Profile saved"); } catch {}
    } catch (e: any) {
      setErr(e?.message || "Update failed");
      try { toast.error(e?.message || "Update failed"); } catch {}
    } finally { setSaving(false); }
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setPreviewUrl(URL.createObjectURL(f));
    try {
      const j = await apiUploadAvatar(f); setMe(j.user); setPreviewUrl("");
      try { toast.success("Profile photo updated"); } catch {}
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
      try { toast.error(e?.message || "Upload failed"); } catch {}
    }
  }

  function avatarUrl() {
    if (previewUrl) return previewUrl;
    if (me?.avatar_url && typeof me.avatar_url === "string") return me.avatar_url;
    if (me?.avatar_path) {
      const p = String(me.avatar_path);
      if (p.startsWith("http")) return p;
      return `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000"}/storage/${p.replace(/^storage\//, "")}`;
    }
    return "";
  }

  function initials() {
    return (me?.name || me?.email || "?").split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
  }

  const infoFields = [
    { icon: "◈", label: "First Name",  key: "first_name"  },
    { icon: "◈", label: "Middle Name", key: "middle_name" },
    { icon: "◈", label: "Last Name",   key: "last_name"   },
    { icon: "◉", label: "Phone",       key: "phone"       },
    { icon: "◉", label: "Company",     key: "company"     },
    { icon: "◉", label: "Address",     key: "address"     },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Syne:wght@400;500;600;700;800&display=swap');

        .ap-root *, .ap-root *::before, .ap-root *::after { box-sizing:border-box; margin:0; padding:0; }
        .ap-root {
          font-family:'Syne',sans-serif;
          background:#192a46; /* lighter navy */
          color:#ede9e1;
          width:100%; height:100%; min-height:100%;
          overflow-x:hidden;
          position:relative;
        }

        /* grain overlay */
        .ap-root::after {
          content:''; position:fixed; inset:0; pointer-events:none; z-index:999;
          opacity:.35;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E");
        }

        /* ── COVER ── */
        .ap-cover {
          width:100%; height:220px;
          position:relative; overflow:hidden;
          background:#192a46; /* lighter */
        }
        .ap-aurora {
          position:absolute; inset:-60% -20%;
          width:140%; height:220%;
          background:
            radial-gradient(ellipse 70% 55% at 15% 55%, rgba(12,32,70,.95) 0%, transparent 55%),
            radial-gradient(ellipse 65% 45% at 85% 25%, rgba(201,168,76,.22) 0%, transparent 52%),
            radial-gradient(ellipse 55% 65% at 65% 85%, rgba(20,45,90,.7)  0%, transparent 50%),
            radial-gradient(ellipse 80% 35% at 5%  90%, rgba(201,168,76,.07) 0%, transparent 45%);
          animation:aShift 14s ease-in-out infinite alternate;
        }
        @keyframes aShift {
          0%   { transform:translate(0,0) rotate(0deg) scale(1); }
          33%  { transform:translate(-2%,2%) rotate(.8deg) scale(1.03); }
          66%  { transform:translate(2%,-2%) rotate(-.8deg) scale(.98); }
          100% { transform:translate(-1%,1%) rotate(.4deg) scale(1.01); }
        }
        .ap-grid-lines {
          position:absolute; inset:0;
          background-image:
            linear-gradient(rgba(201,168,76,.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(201,168,76,.035) 1px, transparent 1px);
          background-size:56px 56px;
          mask-image:linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.5) 25%, rgba(0,0,0,.5) 75%, transparent 100%);
        }
        .ap-orb {
          position:absolute; border-radius:50%;
          filter:blur(90px); pointer-events:none;
        }
        .ap-orb-1 { width:420px; height:420px; top:-180px; right:8%; background:radial-gradient(circle, rgba(201,168,76,.13), transparent 70%); animation:oFloat 9s ease-in-out infinite; }
        .ap-orb-2 { width:300px; height:300px; bottom:-120px; left:12%; background:radial-gradient(circle, rgba(20,55,120,.45), transparent 70%); animation:oFloat 7s ease-in-out infinite; animation-delay:-4s; }
        @keyframes oFloat { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-22px) scale(1.06)} }
        .ap-cover-vignette {
          position:absolute; inset:0;
          background:linear-gradient(to top, #192a46 0%, rgba(25,42,70,.2) 40%, transparent 100%);
        }
        .ap-cover-btn {
          position:absolute; top:18px; right:18px;
          display:flex; align-items:center; gap:7px;
          padding:.38rem .9rem;
          background:rgba(201,168,76,.09);
          border:1px solid rgba(201,168,76,.22);
          border-radius:999px;
          backdrop-filter:blur(14px);
          font-family:'Syne',sans-serif;
          font-size:10px; font-weight:700; letter-spacing:.14em; text-transform:uppercase;
          color:#c9a84c; cursor:pointer;
          transition:background .2s, border-color .2s, box-shadow .2s;
        }
        .ap-cover-btn:hover { background:rgba(201,168,76,.18); border-color:rgba(201,168,76,.5); box-shadow:0 0 20px rgba(201,168,76,.15); }
        .ap-cover-btn::before { content:'✦'; font-size:8px; }

        /* ── HERO ── */
        .ap-hero { position:relative; z-index:10; padding:0 24px; margin-top:-120px; }
        .ap-hero-inner { max-width:1300px; margin:0 auto; display:flex; align-items:flex-end; gap:28px; }

        /* avatar */
        .ap-av-shell { position:relative; flex-shrink:0; cursor:pointer; }
        .ap-av-ring {
          position:absolute; inset:-5px; border-radius:50%;
          background:conic-gradient(from 0deg, #c9a84c 0%, #e2bf6a 30%, #fff9ee 50%, #e2bf6a 70%, #c9a84c 100%);
          animation:rSpin 4s linear infinite; opacity:.75;
        }
        @keyframes rSpin { to{ transform:rotate(360deg); } }
        .ap-av-ring-bg { position:absolute; inset:4px; border-radius:50%; background:#192a46; }
        .ap-av {
          position:relative; z-index:2;
          width:135px; height:135px; border-radius:50%;
          background:linear-gradient(135deg,#1e3a6e,#0a1628);
          overflow:hidden; display:flex; align-items:center; justify-content:center;
          transition:transform .3s ease;
        }
        .ap-av-shell:hover .ap-av { transform:scale(1.05); }
        .ap-av img { width:100%; height:100%; object-fit:cover; }
        .ap-av-init { font-family:'Cormorant',serif; font-size:46px; font-weight:300; font-style:italic; color:#c9a84c; }
        .ap-av-ov {
          position:absolute; inset:0; border-radius:50%; z-index:3;
          background:rgba(0,0,0,.6);
          display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px;
          opacity:0; transition:opacity .22s;
        }
        .ap-av-shell:hover .ap-av-ov { opacity:1; }
        .ap-av-ov svg { width:22px; height:22px; stroke:#c9a84c; fill:none; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; }
        .ap-av-ov-t { font-size:9px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#c9a84c; }

        /* meta */
        .ap-meta { flex:1; min-width:0; padding-bottom:10px; }
        .ap-meta-ey {
          font-size:9px; font-weight:800; letter-spacing:.24em; text-transform:uppercase; color:#c9a84c;
          display:flex; align-items:center; gap:10px; margin-bottom:7px;
          opacity:0; animation:fUp .55s .15s forwards;
        }
        .ap-meta-ey::before { content:''; width:28px; height:1px; background:#c9a84c; display:block; }
        .ap-meta-name {
          font-family:'Cormorant',serif;
          font-size:clamp(30px,5vw,56px); font-weight:300; font-style:italic;
          color:#ede9e1; line-height:1.05; letter-spacing:-.02em;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
          opacity:0; animation:fUp .55s .25s forwards;
        }
        .ap-meta-row { display:flex; align-items:center; gap:12px; margin-top:9px; flex-wrap:wrap; opacity:0; animation:fUp .55s .35s forwards; }
        .ap-meta-email { font-size:13px; color:rgba(237,233,225,.5); }
        .ap-meta-role {
          display:inline-flex; align-items:center; gap:6px;
          padding:.24rem .75rem;
          background:rgba(201,168,76,.08); border:1px solid rgba(201,168,76,.28); border-radius:999px;
          font-size:9px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:#c9a84c;
        }
        .ap-meta-role::before { content:''; width:5px; height:5px; border-radius:50%; background:#c9a84c; animation:bPulse 2s infinite; }
        @keyframes bPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.7)} }

        /* actions */
        .ap-actions { display:flex; gap:10px; flex-shrink:0; padding-bottom:12px; flex-wrap:wrap; opacity:0; animation:fUp .55s .45s forwards; }
        @keyframes fUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }

        /* buttons */
        .ap-btn-g {
          background:transparent; color:rgba(237,233,225,.6);
          border:1px solid rgba(255,255,255,.1); border-radius:10px;
          padding:.55rem 1.1rem; font-family:'Syne',sans-serif; font-size:11px; font-weight:700;
          letter-spacing:.07em; cursor:pointer; transition:all .25s; white-space:nowrap;
          backdrop-filter:blur(8px);
        }
        .ap-btn-g:hover { border-color:rgba(201,168,76,.4); color:#c9a84c; background:rgba(201,168,76,.06); }
        .ap-btn-gold {
          background:linear-gradient(135deg,#b8932e 0%,#e2bf6a 50%,#b8932e 100%);
          background-size:200% 100%; background-position:0 0;
          color:#070b12; border:none; border-radius:10px;
          padding:.55rem 1.35rem; font-family:'Syne',sans-serif; font-size:11px; font-weight:800;
          letter-spacing:.1em; text-transform:uppercase; cursor:pointer;
          box-shadow:0 4px 22px rgba(201,168,76,.3); transition:all .3s; white-space:nowrap;
        }
        .ap-btn-gold:hover { background-position:100% 0; box-shadow:0 6px 32px rgba(201,168,76,.55); transform:translateY(-2px); }
        .ap-btn-gold:disabled { opacity:.45; cursor:not-allowed; transform:none; box-shadow:none; }

        /* ── NAV ── */
        .ap-nav { position:sticky; top:0; z-index:50; backdrop-filter:blur(28px); background:rgba(7,11,18,.88); border-bottom:1px solid rgba(255,255,255,.07); }
        .ap-nav-i { max-width:1300px; margin:0 auto; display:flex; padding:0 36px; gap:4px; }
        .ap-tab {
          position:relative; padding:1rem 1.5rem;
          font-size:10px; font-weight:800; letter-spacing:.18em; text-transform:uppercase;
          color:rgba(237,233,225,.3); cursor:pointer; border:none; background:none;
          font-family:'Syne',sans-serif; transition:color .2s;
        }
        .ap-tab:hover { color:rgba(237,233,225,.6); }
        .ap-tab.on { color:#c9a84c; }
        .ap-tab.on::after {
          content:''; position:absolute; bottom:-1px; left:0; right:0; height:2px;
          background:linear-gradient(90deg,transparent,#c9a84c,transparent);
        }

        /* ── BODY ── */
        .ap-body { width:100%; padding:44px 36px; }
        .ap-body-i { max-width:1300px; margin:0 auto; }

        /* section label */
        .ap-sl { display:flex; align-items:center; gap:14px; margin-bottom:22px; }
        .ap-sl span { font-size:9px; font-weight:800; letter-spacing:.22em; text-transform:uppercase; color:#c9a84c; white-space:nowrap; }
        .ap-sl::after { content:''; flex:1; height:1px; background:rgba(255,255,255,.07); }

        /* info grid */
        .ap-ig { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:14px; }
        .ap-ic {
          background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.07);
          border-radius:16px; padding:22px 20px;
          position:relative; overflow:hidden;
          transition:transform .28s, border-color .28s, box-shadow .28s;
          opacity:0; animation:fUp .5s forwards;
        }
        .ap-ic::before {
          content:''; position:absolute; top:0; left:0; right:0; height:1px;
          background:linear-gradient(90deg,transparent,rgba(201,168,76,.25),transparent);
          opacity:0; transition:opacity .25s;
        }
        .ap-ic:hover { transform:translateY(-4px); border-color:rgba(201,168,76,.2); box-shadow:0 16px 50px rgba(0,0,0,.5),0 0 0 1px rgba(201,168,76,.08); }
        .ap-ic:hover::before { opacity:1; }
        .ap-ic-sym { font-size:20px; color:#c9a84c; margin-bottom:12px; opacity:.6; }
        .ap-ic-lbl { font-size:9px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:rgba(237,233,225,.3); margin-bottom:7px; }
        .ap-ic-val { font-size:15px; font-weight:600; color:#ede9e1; word-break:break-word; line-height:1.4; }
        .ap-ic-val.e { color:rgba(237,233,225,.25); font-style:italic; font-weight:400; font-size:13px; }

        /* bio */
        .ap-bio {
          background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.07);
          border-radius:16px; padding:30px 28px;
          position:relative; overflow:hidden;
          opacity:0; animation:fUp .5s .4s forwards;
          transition:border-color .25s;
        }
        .ap-bio:hover { border-color:rgba(201,168,76,.18); }
        .ap-bio-deco {
          position:absolute; top:12px; right:24px;
          font-family:'Cormorant',serif; font-size:100px; font-weight:300; font-style:italic;
          color:rgba(201,168,76,.05); line-height:1; pointer-events:none; user-select:none;
        }
        .ap-bio-lbl { font-size:9px; font-weight:800; letter-spacing:.2em; text-transform:uppercase; color:#c9a84c; margin-bottom:16px; }
        .ap-bio-txt { font-family:'Cormorant',serif; font-size:19px; font-weight:300; line-height:1.85; color:rgba(237,233,225,.65); }
        .ap-bio-txt.e { font-size:14px; font-family:'Syne',sans-serif; font-style:italic; color:rgba(237,233,225,.25); }

        /* ── FORM ── */
        .ap-fw {
          background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.07);
          border-radius:20px; padding:40px;
          position:relative; overflow:hidden;
          opacity:0; animation:fUp .5s .1s forwards;
        }
        .ap-fw::before {
          content:''; position:absolute; top:-1px; left:8%; right:8%;
          height:1px; background:linear-gradient(90deg,transparent,rgba(201,168,76,.45),transparent);
        }
        .ap-ft { font-family:'Cormorant',serif; font-size:40px; font-weight:300; font-style:italic; color:#ede9e1; margin-bottom:36px; letter-spacing:-.01em; }
        .ap-ft em { color:#c9a84c; font-style:italic; }
        .ap-fg { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
        .ap-ff { position:relative; }
        .ap-ff.full { grid-column:1 / -1; }
        .ap-fi {
          width:100%; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.09);
          border-radius:12px; padding:1.15rem 1rem .5rem;
          font-family:'Syne',sans-serif; font-size:14px; font-weight:500; color:#ede9e1;
          outline:none; transition:border-color .25s, background .25s, box-shadow .25s;
          caret-color:#c9a84c;
        }
        .ap-fi::placeholder { color:transparent; }
        .ap-fi:focus { border-color:rgba(201,168,76,.45); background:rgba(201,168,76,.04); box-shadow:0 0 0 4px rgba(201,168,76,.08),inset 0 1px 0 rgba(201,168,76,.1); }
        .ap-fl {
          position:absolute; left:14px; top:14px;
          font-size:12px; font-weight:700; letter-spacing:.06em; color:rgba(237,233,225,.3);
          font-family:'Syne',sans-serif; pointer-events:none; background:transparent;
          transition:all .2s cubic-bezier(.4,0,.2,1);
        }
        .ap-fi:focus + .ap-fl,
        .ap-fi:not(:placeholder-shown) + .ap-fl {
          top:-9px; left:10px; font-size:9px; letter-spacing:.14em; text-transform:uppercase;
          color:#c9a84c; font-weight:800; background:#0f1a2e; padding:0 6px;
        }
        textarea.ap-fi { resize:vertical; min-height:130px; }
        .ap-ferr {
          grid-column:1/-1; background:rgba(185,28,28,.1); border:1px solid rgba(185,28,28,.3);
          border-radius:10px; padding:.75rem 1rem; color:#fca5a5; font-size:13px;
        }
        .ap-fsec { font-size:9px; font-weight:800; letter-spacing:.2em; text-transform:uppercase; color:#c9a84c; margin:30px 0 16px; display:flex; align-items:center; gap:12px; }
        .ap-fsec::after { content:''; flex:1; height:1px; background:rgba(255,255,255,.07); }
        .ap-ff-foot { display:flex; justify-content:flex-end; gap:12px; margin-top:34px; padding-top:28px; border-top:1px solid rgba(255,255,255,.07); }

        /* ── RESPONSIVE ── */
        @media(max-width:960px){
          .ap-ig{grid-template-columns:repeat(2,1fr);}
          .ap-fg{grid-template-columns:repeat(2,1fr);}
        }
        @media(max-width:640px){
          .ap-cover{height:200px;}
          .ap-hero{padding:0 16px;margin-top:-55px;}
          .ap-hero-inner{flex-wrap:wrap;gap:14px;align-items:flex-start;}
          .ap-av{width:92px;height:92px;}
          .ap-av-init{font-size:32px;}
          .ap-actions{width:100%;}
          .ap-nav-i{padding:0 16px;}
          .ap-body{padding:24px 16px;}
          .ap-ig{grid-template-columns:1fr;}
          .ap-fg{grid-template-columns:1fr;}
          .ap-fw{padding:20px;}
          .ap-meta-name{font-size:26px;}
          .ap-ft{font-size:28px;margin-bottom:24px;}
        }
        @media(max-width:380px){
          .ap-btn-g,.ap-btn-gold{font-size:10px;padding:.45rem .8rem;}
        }
      `}</style>

      <div className="ap-root">
        {/* Cover */}
        <div className="ap-cover">
          <div className="ap-aurora" />
          <div className="ap-grid-lines" />
          <div className="ap-orb ap-orb-1" />
          <div className="ap-orb ap-orb-2" />
          <div className="ap-cover-vignette" />
          {/* cover change button removed per request */}
        </div>

        {/* Hero */}
        <div className="ap-hero">
          <div className="ap-hero-inner">
            {/* Avatar */}
            <div className="ap-av-shell" onClick={() => fileRef.current?.click()} title="Change photo">
              <div className="ap-av-ring" />
              <div className="ap-av-ring-bg" />
              <div className="ap-av">
                {avatarUrl()
                  ? <img src={avatarUrl()} alt="Avatar" />
                  : <span className="ap-av-init">{me ? initials() : ""}</span>}
              </div>
              <div className="ap-av-ov">
                <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <span className="ap-av-ov-t">Change</span>
              </div>
            </div>

            {me && (
              <div className="ap-meta">
                <div className="ap-meta-ey">Administrator Profile</div>
                <div className="ap-meta-name">{me?.name || "—"}</div>
                <div className="ap-meta-row">
                  <span className="ap-meta-email">{me?.email}</span>
                  {me?.role && <span className="ap-meta-role">{String(me.role)}</span>}
                  {me?.company && <span style={{ fontSize:12, color:"rgba(237,233,225,.35)" }}>{me.company}</span>}
                </div>
              </div>
            )}

            {me && (
              <div className="ap-actions">
                <button className="ap-btn-g" type="button" onClick={() => fileRef.current?.click()}>↑ Upload Photo</button>
                <button className="ap-btn-gold" type="button" onClick={() => setActiveTab("edit")}>Edit Profile</button>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        {me && (
          <div className="ap-nav" style={{ marginTop:28 }}>
            <div className="ap-nav-i">
              {(["overview","edit"] as const).map(t => (
                <button key={t} className={`ap-tab ${activeTab === t ? "on" : ""}`} onClick={() => setActiveTab(t)}>
                  {t === "overview" ? "Overview" : "Edit Profile"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        {me && (
          <div className="ap-body">
            <div className="ap-body-i">

              {activeTab === "overview" && (
                <>
                  <div className="ap-sl"><span>Personal Information</span></div>
                  <div className="ap-ig">
                    {infoFields.map((f, i) => (
                      <div key={f.key} className="ap-ic" style={{ animationDelay:`${i * 0.06}s` }}>
                        <div className="ap-ic-sym">{f.icon}</div>
                        <div className="ap-ic-lbl">{f.label}</div>
                        <div className={`ap-ic-val ${!me[f.key] ? "e" : ""}`}>{me[f.key] || "Not provided"}</div>
                      </div>
                    ))}
                  </div>

                  <div className="ap-sl" style={{ marginTop:32 }}><span>Biography</span></div>
                  <div className="ap-bio">
                    <div className="ap-bio-deco">"</div>
                    <div className="ap-bio-lbl">About</div>
                    <div className={`ap-bio-txt ${!me.bio ? "e" : ""}`}>
                      {me.bio || "No biography added yet. Share a little about yourself by editing your profile."}
                    </div>
                  </div>
                </>
              )}

              {activeTab === "edit" && (
                <form onSubmit={onSubmit}>
                  <div className="ap-fw">
                    <div className="ap-ft">Edit <em>Profile</em></div>

                    <div className="ap-fsec">Basic Information</div>
                    <div className="ap-fg">
                      {[{ key:"first_name",label:"First Name" },{ key:"middle_name",label:"Middle Name" },{ key:"last_name",label:"Last Name" }].map(f => (
                        <div key={f.key} className="ap-ff">
                          <input className="ap-fi" placeholder=" " value={me?.[f.key] ?? ""} onChange={e => setMe({ ...me, [f.key]:e.target.value })} />
                          <label className="ap-fl">{f.label}</label>
                        </div>
                      ))}
                    </div>

                    <div className="ap-fsec">Contact & Company</div>
                    <div className="ap-fg">
                      {[{ key:"phone",label:"Phone",full:false },{ key:"company",label:"Company",full:false },{ key:"address",label:"Address",full:true }].map(f => (
                        <div key={f.key} className={`ap-ff ${f.full ? "full":""}`}>
                          <input className="ap-fi" placeholder=" " value={me?.[f.key] ?? ""} onChange={e => setMe({ ...me, [f.key]:e.target.value })} />
                          <label className="ap-fl">{f.label}</label>
                        </div>
                      ))}
                    </div>

                    <div className="ap-fsec">Biography</div>
                    <div className="ap-fg">
                      <div className="ap-ff full">
                        <textarea className="ap-fi" placeholder=" " rows={5} value={me?.bio ?? ""} onChange={e => setMe({ ...me, bio:e.target.value })} />
                        <label className="ap-fl">Tell your story…</label>
                      </div>
                      {err && <div className="ap-ferr">{err}</div>}
                    </div>

                    <div className="ap-ff-foot">
                      <button className="ap-btn-g" type="button" onClick={() => setActiveTab("overview")}>Cancel</button>
                      <button className="ap-btn-gold" type="submit" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} style={{ display:"none" }} />
      </div>
    </>
  );
}