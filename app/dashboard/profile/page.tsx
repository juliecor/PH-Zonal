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
  const [activeTab, setActiveTab] = useState<"overview" | "edit">("overview");

  // Ensure only the main content (inside layout) scrolls: lock window scroll while on profile
  // No window scroll lock needed; layout handles content-only scrolling
  useEffect(() => {}, []);

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

  const displayName = me?.name || [me?.first_name, me?.middle_name, me?.last_name].filter(Boolean).join(" ") || me?.email || "User";
  const roleLabel = (me?.role || "Client").toString();
  const hasTokenBalance = typeof me?.token_balance !== "undefined";

  function initials() {
    return (displayName || "?").split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
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

        .cp-root *, .cp-root *::before, .cp-root *::after { box-sizing:border-box; margin:0; padding:0; }
        .cp-root {
          font-family:'Syne',sans-serif;
          background:#192a46; /* lighter navy */
          color:#ede9e1;
          width:100%; height:100%; min-height:100%;
          overflow-x:hidden;
          position:relative;
        }
        .cp-root::after {
          content:''; position:fixed; inset:0; pointer-events:none; z-index:999; opacity:.35;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E");
        }

        /* ── COVER ── */
        .cp-cover { width:100%; height:220px; position:relative; overflow:hidden; background:#192a46; }
        .cp-aurora {
          position:absolute; inset:-60% -20%; width:140%; height:220%;
          background:
            radial-gradient(ellipse 70% 55% at 15% 55%, rgba(12,32,70,.95) 0%, transparent 55%),
            radial-gradient(ellipse 65% 45% at 85% 25%, rgba(201,168,76,.22) 0%, transparent 52%),
            radial-gradient(ellipse 55% 65% at 65% 85%, rgba(20,45,90,.7)  0%, transparent 50%),
            radial-gradient(ellipse 80% 35% at 5%  90%, rgba(201,168,76,.07) 0%, transparent 45%);
          animation:caShift 14s ease-in-out infinite alternate;
        }
        @keyframes caShift {
          0%{transform:translate(0,0) rotate(0deg) scale(1)}
          33%{transform:translate(-2%,2%) rotate(.8deg) scale(1.03)}
          66%{transform:translate(2%,-2%) rotate(-.8deg) scale(.98)}
          100%{transform:translate(-1%,1%) rotate(.4deg) scale(1.01)}
        }
        .cp-grid-lines {
          position:absolute; inset:0;
          background-image:linear-gradient(rgba(201,168,76,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,.035) 1px,transparent 1px);
          background-size:56px 56px;
          mask-image:linear-gradient(to bottom,transparent 0%,rgba(0,0,0,.5) 25%,rgba(0,0,0,.5) 75%,transparent 100%);
        }
        .cp-orb { position:absolute; border-radius:50%; filter:blur(90px); pointer-events:none; }
        .cp-orb-1 { width:420px; height:420px; top:-180px; right:8%; background:radial-gradient(circle,rgba(201,168,76,.13),transparent 70%); animation:coFloat 9s ease-in-out infinite; }
        .cp-orb-2 { width:300px; height:300px; bottom:-120px; left:12%; background:radial-gradient(circle,rgba(20,55,120,.45),transparent 70%); animation:coFloat 7s ease-in-out infinite; animation-delay:-4s; }
        @keyframes coFloat { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-22px) scale(1.06)} }
        .cp-cover-vignette { position:absolute; inset:0; background:linear-gradient(to top,#192a46 0%,rgba(25,42,70,.22) 40%,transparent 100%); }
        .cp-cover-btn {
          position:absolute; top:18px; right:18px;
          display:flex; align-items:center; gap:7px;
          padding:.38rem .9rem;
          background:rgba(201,168,76,.09); border:1px solid rgba(201,168,76,.22); border-radius:999px;
          backdrop-filter:blur(14px); font-family:'Syne',sans-serif;
          font-size:10px; font-weight:700; letter-spacing:.14em; text-transform:uppercase;
          color:#c9a84c; cursor:pointer; transition:background .2s,border-color .2s,box-shadow .2s;
        }
        .cp-cover-btn:hover { background:rgba(201,168,76,.18); border-color:rgba(201,168,76,.5); box-shadow:0 0 20px rgba(201,168,76,.15); }
        .cp-cover-btn::before { content:'✦'; font-size:8px; }

        /* ── HERO ── */
        .cp-hero { position:relative; z-index:10; padding:0 24px; margin-top:-120px; }
        .cp-hero-inner { width:100%; max-width:none; margin:0; display:flex; align-items:flex-end; gap:28px; }

        /* avatar */
        .cp-av-shell { position:relative; flex-shrink:0; cursor:pointer; }
        .cp-av-ring {
          position:absolute; inset:-5px; border-radius:50%;
          background:conic-gradient(from 0deg,#c9a84c 0%,#e2bf6a 30%,#fff9ee 50%,#e2bf6a 70%,#c9a84c 100%);
          animation:crSpin 4s linear infinite; opacity:.75;
        }
        @keyframes crSpin { to{ transform:rotate(360deg); } }
        .cp-av-ring-bg { position:absolute; inset:4px; border-radius:50%; background:#192a46; }
        .cp-av {
          position:relative; z-index:2;
          width:135px; height:135px; border-radius:50%;
          background:linear-gradient(135deg,#1e3a6e,#0a1628);
          overflow:hidden; display:flex; align-items:center; justify-content:center;
          transition:transform .3s ease;
        }
        .cp-av-shell:hover .cp-av { transform:scale(1.05); }
        .cp-av img { width:100%; height:100%; object-fit:cover; }
        .cp-av-init { font-family:'Cormorant',serif; font-size:46px; font-weight:300; font-style:italic; color:#c9a84c; }
        .cp-av-ov {
          position:absolute; inset:0; border-radius:50%; z-index:3;
          background:rgba(0,0,0,.6);
          display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px;
          opacity:0; transition:opacity .22s;
        }
        .cp-av-shell:hover .cp-av-ov { opacity:1; }
        .cp-av-ov svg { width:22px; height:22px; stroke:#c9a84c; fill:none; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; }
        .cp-av-ov-t { font-size:9px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#c9a84c; }

        /* meta */
        .cp-meta { flex:1; min-width:0; padding-bottom:10px; }
        .cp-meta-ey { font-size:9px; font-weight:800; letter-spacing:.24em; text-transform:uppercase; color:#c9a84c; display:flex; align-items:center; gap:10px; margin-bottom:7px; opacity:0; animation:cfUp .55s .15s forwards; }
        .cp-meta-ey::before { content:''; width:28px; height:1px; background:#c9a84c; display:block; }
        .cp-meta-name {
          font-family:'Cormorant',serif; font-size:clamp(30px,5vw,56px); font-weight:300; font-style:italic;
          color:#ede9e1; line-height:1.05; letter-spacing:-.02em;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
          opacity:0; animation:cfUp .55s .25s forwards;
        }
        .cp-meta-row { display:flex; align-items:center; gap:12px; margin-top:9px; flex-wrap:wrap; opacity:0; animation:cfUp .55s .35s forwards; }
        .cp-meta-email { font-size:13px; color:rgba(237,233,225,.5); }
        .cp-meta-role {
          display:inline-flex; align-items:center; gap:6px;
          padding:.24rem .75rem;
          background:rgba(201,168,76,.08); border:1px solid rgba(201,168,76,.28); border-radius:999px;
          font-size:9px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:#c9a84c;
        }
        .cp-meta-role::before { content:''; width:5px; height:5px; border-radius:50%; background:#c9a84c; animation:cpBlink 2s infinite; }
        @keyframes cpBlink { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.7)} }

        /* token pill in meta */
        .cp-token-meta {
          display:inline-flex; align-items:center; gap:6px;
          padding:.24rem .75rem;
          background:rgba(30,58,138,.15); border:1px solid rgba(30,58,138,.35); border-radius:999px;
          font-size:9px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#93c5fd;
        }

        .cp-actions { display:flex; gap:10px; flex-shrink:0; padding-bottom:12px; flex-wrap:wrap; opacity:0; animation:cfUp .55s .45s forwards; }
        @keyframes cfUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }

        /* buttons */
        .cp-btn-g {
          background:transparent; color:rgba(237,233,225,.6); border:1px solid rgba(255,255,255,.1); border-radius:10px;
          padding:.55rem 1.1rem; font-family:'Syne',sans-serif; font-size:11px; font-weight:700;
          letter-spacing:.07em; cursor:pointer; transition:all .25s; white-space:nowrap; backdrop-filter:blur(8px);
        }
        .cp-btn-g:hover { border-color:rgba(201,168,76,.4); color:#c9a84c; background:rgba(201,168,76,.06); }
        .cp-btn-gold {
          background:linear-gradient(135deg,#b8932e 0%,#e2bf6a 50%,#b8932e 100%); background-size:200% 100%; background-position:0 0;
          color:#070b12; border:none; border-radius:10px; padding:.55rem 1.35rem;
          font-family:'Syne',sans-serif; font-size:11px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;
          cursor:pointer; box-shadow:0 4px 22px rgba(201,168,76,.3); transition:all .3s; white-space:nowrap;
        }
        .cp-btn-gold:hover { background-position:100% 0; box-shadow:0 6px 32px rgba(201,168,76,.55); transform:translateY(-2px); }
        .cp-btn-gold:disabled { opacity:.45; cursor:not-allowed; transform:none; box-shadow:none; }

        /* ── NAV ── */
        .cp-nav { position:sticky; top:0; z-index:50; backdrop-filter:blur(28px); background:rgba(7,11,18,.88); border-bottom:1px solid rgba(255,255,255,.07); }
        .cp-nav-i { width:100%; max-width:none; margin:0; display:flex; padding:0 24px; gap:4px; }
        .cp-tab {
          position:relative; padding:1rem 1.5rem;
          font-size:10px; font-weight:800; letter-spacing:.18em; text-transform:uppercase;
          color:rgba(237,233,225,.3); cursor:pointer; border:none; background:none;
          font-family:'Syne',sans-serif; transition:color .2s;
        }
        .cp-tab:hover { color:rgba(237,233,225,.6); }
        .cp-tab.on { color:#c9a84c; }
        .cp-tab.on::after { content:''; position:absolute; bottom:-1px; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,#c9a84c,transparent); }

        /* ── BODY ── */
        .cp-body { width:100%; padding:44px 24px; }
        .cp-body-i { width:100%; max-width:none; margin:0; }

        .cp-sl { display:flex; align-items:center; gap:14px; margin-bottom:22px; }
        .cp-sl span { font-size:9px; font-weight:800; letter-spacing:.22em; text-transform:uppercase; color:#c9a84c; white-space:nowrap; }
        .cp-sl::after { content:''; flex:1; height:1px; background:rgba(255,255,255,.07); }

        /* ── TOKEN HERO CARD ── */
        .cp-token-hero {
          position:relative; overflow:hidden;
          border-radius:20px; padding:36px 40px;
          margin-bottom:14px;
          background:linear-gradient(135deg, #0a1628 0%, #0f1f38 40%, #162840 100%);
          border:1px solid rgba(201,168,76,.15);
          box-shadow:0 20px 60px rgba(0,0,0,.6), inset 0 1px 0 rgba(201,168,76,.08);
          display:flex; align-items:center; justify-content:space-between; gap:24px; flex-wrap:wrap;
          opacity:0; animation:cfUp .5s .05s forwards;
        }
        .cp-token-hero::before {
          content:''; position:absolute; top:-1px; left:10%; right:10%;
          height:1px; background:linear-gradient(90deg,transparent,rgba(201,168,76,.5),transparent);
        }
        .cp-token-hero-bg {
          position:absolute; inset:0; pointer-events:none;
          background:radial-gradient(ellipse 80% 100% at 80% 50%, rgba(201,168,76,.06) 0%, transparent 60%);
        }
        .cp-token-hero-grid {
          position:absolute; inset:0; pointer-events:none;
          background-image:linear-gradient(rgba(201,168,76,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,.025) 1px,transparent 1px);
          background-size:40px 40px;
        }
        .cp-token-hero-left { position:relative; z-index:2; }
        .cp-token-hero-lbl { font-size:9px; font-weight:800; letter-spacing:.22em; text-transform:uppercase; color:rgba(201,168,76,.6); margin-bottom:10px; }
        .cp-token-hero-val {
          font-family:'Cormorant',serif; font-size:clamp(40px,7vw,72px); font-weight:300; font-style:italic;
          color:#e2bf6a; line-height:1; letter-spacing:-.02em;
        }
        .cp-token-hero-sub { font-size:12px; color:rgba(237,233,225,.3); margin-top:8px; letter-spacing:.04em; }
        .cp-token-hero-right { position:relative; z-index:2; display:flex; flex-direction:column; align-items:flex-end; gap:12px; }
        .cp-token-icon {
          width:72px; height:72px; border-radius:50%;
          background:rgba(201,168,76,.1); border:1px solid rgba(201,168,76,.2);
          display:flex; align-items:center; justify-content:center;
          font-size:32px;
          box-shadow:0 0 40px rgba(201,168,76,.15);
          animation:coinGlow 3s ease-in-out infinite alternate;
        }
        @keyframes coinGlow {
          from { box-shadow:0 0 20px rgba(201,168,76,.12); }
          to   { box-shadow:0 0 50px rgba(201,168,76,.3), 0 0 80px rgba(201,168,76,.1); }
        }

        /* ── INFO GRID ── */
        .cp-ig { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:14px; }
        .cp-ic {
          background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.07);
          border-radius:16px; padding:22px 20px;
          position:relative; overflow:hidden;
          transition:transform .28s,border-color .28s,box-shadow .28s;
          opacity:0; animation:cfUp .5s forwards;
        }
        .cp-ic::before {
          content:''; position:absolute; top:0; left:0; right:0; height:1px;
          background:linear-gradient(90deg,transparent,rgba(201,168,76,.25),transparent);
          opacity:0; transition:opacity .25s;
        }
        .cp-ic:hover { transform:translateY(-4px); border-color:rgba(201,168,76,.2); box-shadow:0 16px 50px rgba(0,0,0,.5),0 0 0 1px rgba(201,168,76,.08); }
        .cp-ic:hover::before { opacity:1; }
        .cp-ic-sym { font-size:20px; color:#c9a84c; margin-bottom:12px; opacity:.6; }
        .cp-ic-lbl { font-size:9px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:rgba(237,233,225,.3); margin-bottom:7px; }
        .cp-ic-val { font-size:15px; font-weight:600; color:#ede9e1; word-break:break-word; line-height:1.4; }
        .cp-ic-val.e { color:rgba(237,233,225,.25); font-style:italic; font-weight:400; font-size:13px; }

        /* bio */
        .cp-bio {
          background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.07);
          border-radius:16px; padding:30px 28px;
          position:relative; overflow:hidden;
          opacity:0; animation:cfUp .5s .4s forwards;
          transition:border-color .25s;
        }
        .cp-bio:hover { border-color:rgba(201,168,76,.18); }
        .cp-bio-deco { position:absolute; top:12px; right:24px; font-family:'Cormorant',serif; font-size:100px; font-weight:300; font-style:italic; color:rgba(201,168,76,.05); line-height:1; pointer-events:none; user-select:none; }
        .cp-bio-lbl { font-size:9px; font-weight:800; letter-spacing:.2em; text-transform:uppercase; color:#c9a84c; margin-bottom:16px; }
        .cp-bio-txt { font-family:'Cormorant',serif; font-size:19px; font-weight:300; line-height:1.85; color:rgba(237,233,225,.65); }
        .cp-bio-txt.e { font-size:14px; font-family:'Syne',sans-serif; font-style:italic; color:rgba(237,233,225,.25); }

        /* ── FORM ── */
        .cp-fw {
          background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.07);
          border-radius:20px; padding:40px; position:relative; overflow:hidden;
          opacity:0; animation:cfUp .5s .1s forwards;
        }
        .cp-fw::before { content:''; position:absolute; top:-1px; left:8%; right:8%; height:1px; background:linear-gradient(90deg,transparent,rgba(201,168,76,.45),transparent); }
        .cp-ft { font-family:'Cormorant',serif; font-size:40px; font-weight:300; font-style:italic; color:#ede9e1; margin-bottom:36px; letter-spacing:-.01em; }
        .cp-ft em { color:#c9a84c; font-style:italic; }
        .cp-fg { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
        .cp-ff { position:relative; }
        .cp-ff.full { grid-column:1/-1; }
        .cp-fi {
          width:100%; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.09);
          border-radius:12px; padding:1.15rem 1rem .5rem;
          font-family:'Syne',sans-serif; font-size:14px; font-weight:500; color:#ede9e1;
          outline:none; transition:border-color .25s,background .25s,box-shadow .25s; caret-color:#c9a84c;
        }
        .cp-fi::placeholder { color:transparent; }
        .cp-fi:focus { border-color:rgba(201,168,76,.45); background:rgba(201,168,76,.04); box-shadow:0 0 0 4px rgba(201,168,76,.08),inset 0 1px 0 rgba(201,168,76,.1); }
        .cp-fl {
          position:absolute; left:14px; top:14px;
          font-size:12px; font-weight:700; letter-spacing:.06em; color:rgba(237,233,225,.3);
          font-family:'Syne',sans-serif; pointer-events:none; background:transparent;
          transition:all .2s cubic-bezier(.4,0,.2,1);
        }
        .cp-fi:focus + .cp-fl,
        .cp-fi:not(:placeholder-shown) + .cp-fl {
          top:-9px; left:10px; font-size:9px; letter-spacing:.14em; text-transform:uppercase;
          color:#c9a84c; font-weight:800; background:#0f1a2e; padding:0 6px;
        }
        textarea.cp-fi { resize:vertical; min-height:130px; }
        .cp-ferr { grid-column:1/-1; background:rgba(185,28,28,.1); border:1px solid rgba(185,28,28,.3); border-radius:10px; padding:.75rem 1rem; color:#fca5a5; font-size:13px; }
        .cp-fsec { font-size:9px; font-weight:800; letter-spacing:.2em; text-transform:uppercase; color:#c9a84c; margin:30px 0 16px; display:flex; align-items:center; gap:12px; }
        .cp-fsec::after { content:''; flex:1; height:1px; background:rgba(255,255,255,.07); }
        .cp-ff-foot { display:flex; justify-content:flex-end; gap:12px; margin-top:34px; padding-top:28px; border-top:1px solid rgba(255,255,255,.07); }

        /* ── RESPONSIVE ── */
        @media(max-width:960px){
          .cp-ig{grid-template-columns:repeat(2,1fr);}
          .cp-fg{grid-template-columns:repeat(2,1fr);}
          .cp-token-hero{padding:24px 28px;}
          .cp-token-hero-val{font-size:40px;}
        }
        @media(max-width:640px){
          .cp-cover{height:200px;}
          .cp-hero{padding:0 16px;margin-top:-55px;}
          .cp-hero-inner{flex-wrap:wrap;gap:14px;align-items:flex-start;}
          .cp-av{width:92px;height:92px;}
          .cp-av-init{font-size:32px;}
          .cp-actions{width:100%;}
          .cp-nav-i{padding:0 16px;}
          .cp-body{padding:24px 16px;}
          .cp-ig{grid-template-columns:1fr;}
          .cp-fg{grid-template-columns:1fr;}
          .cp-fw{padding:20px;}
          .cp-meta-name{font-size:26px;}
          .cp-ft{font-size:28px;margin-bottom:24px;}
          .cp-token-hero{padding:22px 20px;}
          .cp-token-hero-right{display:none;}
        }
        @media(max-width:380px){
          .cp-btn-g,.cp-btn-gold{font-size:10px;padding:.45rem .8rem;}
        }
      `}</style>

      <div className="cp-root">
        {/* Cover */}
        <div className="cp-cover">
          <div className="cp-aurora" />
          <div className="cp-grid-lines" />
          <div className="cp-orb cp-orb-1" />
          <div className="cp-orb cp-orb-2" />
          <div className="cp-cover-vignette" />
        </div>

        {/* Hero */}
        <div className="cp-hero">
          <div className="cp-hero-inner">
            <div className="cp-av-shell" onClick={() => fileRef.current?.click()} title="Change photo">
              <div className="cp-av-ring" />
              <div className="cp-av-ring-bg" />
              <div className="cp-av">
                {avatarUrl() ? <img src={avatarUrl()} alt="Avatar" /> : <span className="cp-av-init">{me ? initials() : ""}</span>}
              </div>
              <div className="cp-av-ov">
                <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <span className="cp-av-ov-t">Change</span>
              </div>
            </div>

            {me && (
              <div className="cp-meta">
                <div className="cp-meta-ey">Client Profile</div>
                <div className="cp-meta-name">{displayName}</div>
                <div className="cp-meta-row">
                  <span className="cp-meta-email">{me?.email}</span>
                  <span className="cp-meta-role">{roleLabel}</span>
                  {hasTokenBalance && (
                    <span className="cp-token-meta">🪙 {Number(me.token_balance || 0).toLocaleString()} tokens</span>
                  )}
                </div>
              </div>
            )}

            {me && (
              <div className="cp-actions">
                <button className="cp-btn-g" type="button" onClick={() => fileRef.current?.click()}>↑ Upload Photo</button>
                <button className="cp-btn-gold" type="button" onClick={() => setActiveTab("edit")}>Edit Profile</button>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        {me && (
          <div className="cp-nav" style={{ marginTop:28 }}>
            <div className="cp-nav-i">
              {(["overview","edit"] as const).map(t => (
                <button key={t} className={`cp-tab ${activeTab === t ? "on" : ""}`} onClick={() => setActiveTab(t)}>
                  {t === "overview" ? "Overview" : "Edit Profile"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        {me && (
          <div className="cp-body">
            <div className="cp-body-i">

              {activeTab === "overview" && (
                <>
                  {/* Token Hero */}
                  {hasTokenBalance && (
                    <>
                      <div className="cp-sl"><span>Wallet</span></div>
                      <div className="cp-token-hero" style={{ marginBottom:32 }}>
                        <div className="cp-token-hero-bg" />
                        <div className="cp-token-hero-grid" />
                        <div className="cp-token-hero-left">
                          <div className="cp-token-hero-lbl">Available Token Balance</div>
                          <div className="cp-token-hero-val">{Number(me.token_balance || 0).toLocaleString()}</div>
                          <div className="cp-token-hero-sub">tokens in your account</div>
                        </div>
                        <div className="cp-token-hero-right">
                          <div className="cp-token-icon">🪙</div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="cp-sl"><span>Personal Information</span></div>
                  <div className="cp-ig">
                    {infoFields.map((f, i) => (
                      <div key={f.key} className="cp-ic" style={{ animationDelay:`${i * 0.06}s` }}>
                        <div className="cp-ic-sym">{f.icon}</div>
                        <div className="cp-ic-lbl">{f.label}</div>
                        <div className={`cp-ic-val ${!me[f.key] ? "e" : ""}`}>{me[f.key] || "Not provided"}</div>
                      </div>
                    ))}
                  </div>

                  <div className="cp-sl" style={{ marginTop:32 }}><span>Biography</span></div>
                  <div className="cp-bio">
                    <div className="cp-bio-deco">"</div>
                    <div className="cp-bio-lbl">About</div>
                    <div className={`cp-bio-txt ${!me.bio ? "e" : ""}`}>
                      {me.bio || "No biography added yet. Share a little about yourself by editing your profile."}
                    </div>
                  </div>
                </>
              )}

              {activeTab === "edit" && (
                <form onSubmit={onSubmit}>
                  <div className="cp-fw">
                    <div className="cp-ft">Edit <em>Profile</em></div>

                    <div className="cp-fsec">Basic Information</div>
                    <div className="cp-fg">
                      {[{ key:"first_name",label:"First Name" },{ key:"middle_name",label:"Middle Name" },{ key:"last_name",label:"Last Name" }].map(f => (
                        <div key={f.key} className="cp-ff">
                          <input className="cp-fi" placeholder=" " value={me?.[f.key] ?? ""} onChange={e => setMe({ ...me, [f.key]:e.target.value })} />
                          <label className="cp-fl">{f.label}</label>
                        </div>
                      ))}
                    </div>

                    <div className="cp-fsec">Contact & Company</div>
                    <div className="cp-fg">
                      {[{ key:"phone",label:"Phone",full:false },{ key:"company",label:"Company",full:false },{ key:"address",label:"Address",full:true }].map(f => (
                        <div key={f.key} className={`cp-ff ${f.full ? "full":""}`}>
                          <input className="cp-fi" placeholder=" " value={me?.[f.key] ?? ""} onChange={e => setMe({ ...me, [f.key]:e.target.value })} />
                          <label className="cp-fl">{f.label}</label>
                        </div>
                      ))}
                    </div>

                    <div className="cp-fsec">Biography</div>
                    <div className="cp-fg">
                      <div className="cp-ff full">
                        <textarea className="cp-fi" placeholder=" " rows={5} value={me?.bio ?? ""} onChange={e => setMe({ ...me, bio:e.target.value })} />
                        <label className="cp-fl">Tell your story…</label>
                      </div>
                      {err && <div className="cp-ferr">{err}</div>}
                    </div>

                    <div className="cp-ff-foot">
                      <button className="cp-btn-g" type="button" onClick={() => setActiveTab("overview")}>Cancel</button>
                      <button className="cp-btn-gold" type="submit" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
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