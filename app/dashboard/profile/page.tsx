"use client";

import { useEffect, useState } from "react";
import { apiMe } from "../../lib/authClient";

export default function ClientProfilePage() {
  const [me, setMe] = useState<any>(null);
  useEffect(() => { apiMe().then(setMe).catch(()=>setMe(null)); }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@300;400;500&display=swap');
        .p-wrap{font-family:'DM Sans',sans-serif}
        .p-card{background:#fff;border-radius:16px;border:1px solid #e8e0d8;box-shadow:0 2px 16px rgba(15,31,56,0.06);overflow:hidden}
        .p-head{background:#0f1f38;padding:1.8rem 2rem;display:flex;align-items:center;gap:1.25rem;position:relative;overflow:hidden}
        .p-head::before{content:'';position:absolute;width:260px;height:260px;border-radius:50%;background:rgba(201,168,76,0.07);top:-100px;right:-80px}
        .p-head::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(-55deg,transparent,transparent 32px,rgba(201,168,76,0.025) 32px,rgba(201,168,76,0.025) 33px)}
        .p-av{width:56px;height:56px;border-radius:14px;background:rgba(201,168,76,0.15);border:2px solid rgba(201,168,76,0.5);display:flex;align-items:center;justify-content:center;flex-shrink:0;z-index:1}
        .p-av-i{font-family:'Cormorant Garamond',serif;font-size:1.4rem;font-weight:700;color:#c9a84c;text-transform:uppercase}
        .p-ht{z-index:1}
        .p-name{font-family:'Cormorant Garamond',serif;font-size:1.4rem;font-weight:700;color:#f5f0eb;line-height:1.2}
        .p-role{display:inline-flex;align-items:center;gap:.3rem;margin-top:.3rem;padding:.2rem .65rem;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.35);border-radius:20px;font-size:.7rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#c9a84c}
        .p-body{padding:1.8rem 2rem}
        .p-sec{font-size:.68rem;font-weight:500;letter-spacing:.13em;text-transform:uppercase;color:rgba(15,31,56,0.4);margin-bottom:1.1rem;display:flex;align-items:center;gap:.6rem}
        .p-sec::after{content:'';flex:1;height:1px;background:rgba(15,31,56,0.08)}
        .p-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem}
        .p-field{background:#f9f6f2;border:1px solid #ede5da;border-radius:10px;padding:.85rem 1rem}
        .p-l{font-size:.68rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#9aa3b0;margin-bottom:.35rem;display:flex;align-items:center;gap:.4rem}
        .p-v{font-size:.925rem;font-weight:500;color:#0f1f38;word-break:break-all}
      `}</style>

      <div className="p-wrap">
        <div className="p-card">
          {me ? (
            <>
              <div className="p-head">
                <div className="p-av"><span className="p-av-i">{(me.name ?? me.email ?? '?').split(' ').slice(0,2).map((w:string)=>w[0]).join('')}</span></div>
                <div className="p-ht">
                  <div className="p-name">{me.name ?? '—'}</div>
                  {me.role && (<div className="p-role">{me.role}</div>)}
                </div>
              </div>
              <div className="p-body">
                <div className="p-sec">Account details</div>
                <div className="p-grid">
                  {me.name && (<div className="p-field"><div className="p-l">Full name</div><div className="p-v">{me.name}</div></div>)}
                  {me.email && (<div className="p-field"><div className="p-l">Email address</div><div className="p-v">{me.email}</div></div>)}
                  {me.role && (<div className="p-field"><div className="p-l">Role</div><div className="p-v">{me.role}</div></div>)}
                  <div className="p-field"><div className="p-l">Tokens</div><div className="p-v">{me.token_balance ?? 0}</div></div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-body text-sm text-gray-600">Loading...</div>
          )}
        </div>
      </div>
    </>
  );
}
