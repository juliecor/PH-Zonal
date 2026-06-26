/* eslint-disable */
// @ts-nocheck
"use client";
import { useEffect, useRef } from "react";

const CSS = "\n  :root{\n    --paper:#FBFAF7; --paper-2:#F4F1E9;\n    --ink:#16223A; --ink-soft:#3A4763;\n    --ink-mute:#6E7689;\n    --gold:#B8893A; --gold-deep:#8A5A1E; --gold-pale:#ECD9B0;\n    --line:#DED8CC; --line-soft:#EAE5DA;\n    --g-green:#2F9E6B; --g-amber:#E0A52E; --g-orange:#DD7B2C; --g-red:#C8412B;\n    --serif:Georgia,\"Times New Roman\",ui-serif,serif;\n    --sans:ui-sans-serif,system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif;\n    --mono:ui-monospace,\"SF Mono\",\"Cascadia Mono\",\"Segoe UI Mono\",Menlo,Consolas,monospace;\n  }\n  *{box-sizing:border-box}\n  html{-webkit-text-size-adjust:100%}\n  body,.wrap{margin:0}\n  .wrap{\n    background:var(--paper);\n    color:var(--ink);\n    font-family:var(--sans);\n    line-height:1.6;\n    overflow-x:hidden;\n    --mar:clamp(20px,5vw,72px);\n  }\n  ::selection{background:var(--gold-pale);color:var(--ink)}\n  a{color:inherit}\n  :focus-visible{outline:2.5px solid var(--gold-deep);outline-offset:3px;border-radius:1px}\n\n  .mono{font-family:var(--mono);font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-mute)}\n\n  /* ---- top bar ---- */\n  header.top{\n    display:flex;align-items:center;justify-content:space-between;\n    gap:16px;padding:22px var(--mar) 0;\n  }\n  .brand{display:flex;align-items:baseline;gap:12px}\n  .brand .logo{\n    font-family:var(--serif);font-size:19px;letter-spacing:-.01em;font-weight:600;\n  }\n  .brand .logo .dot{color:var(--gold-deep)}\n  .brand .by{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-mute)}\n  .brand .by .fh-logo{display:inline-block;height:32px;width:auto;vertical-align:baseline;margin-left:7px;filter:drop-shadow(0 1px 1.5px rgba(22,34,58,.10))}\n  .top nav{display:flex;align-items:center;gap:8px}\n  .btn{\n    font-family:var(--sans);font-size:14px;font-weight:550;\n    padding:9px 16px;border-radius:2px;border:1px solid transparent;\n    text-decoration:none;cursor:pointer;background:none;transition:background .18s,border-color .18s,color .18s;\n    white-space:nowrap;\n  }\n  .btn-ghost{color:var(--ink-soft)}\n  .btn-ghost:hover{background:var(--paper-2)}\n  .btn-line{border-color:var(--line);color:var(--ink)}\n  .btn-line:hover{border-color:var(--ink);}\n  .btn-solid{background:var(--ink);color:var(--paper);}\n  .btn-solid:hover{background:#0d1729}\n  .btn-solid .arr{color:var(--gold-pale);margin-left:7px}\n\n  /* ---- hero ---- */\n  .hero{\n    display:grid;grid-template-columns:minmax(0,0.86fr) minmax(0,1.14fr);\n    gap:clamp(24px,4vw,60px);\n    align-items:start;\n    padding:clamp(34px,5vw,64px) var(--mar) clamp(40px,5vw,72px);\n    max-width:1340px;margin:0 auto;\n  }\n  .lede .eyebrow{display:flex;align-items:center;gap:12px;margin-bottom:22px}\n  .lede .eyebrow .ln{height:1px;width:34px;background:var(--gold);display:inline-block}\n  h1{\n    font-family:var(--serif);font-weight:600;\n    font-size:clamp(35px,5.4vw,62px);line-height:1.03;letter-spacing:-.02em;\n    margin:0 0 22px;text-wrap:balance;\n  }\n  h1 em{font-style:italic;color:var(--gold-deep)}\n  .lede p.sub{\n    font-size:clamp(15.5px,1.6vw,18px);color:var(--ink-soft);\n    max-width:46ch;margin:0 0 30px;line-height:1.62;\n  }\n  .lede .cta-row{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:34px}\n  .cta-row .btn{padding:13px 22px;font-size:15px}\n\n  .stats{display:flex;flex-wrap:wrap;gap:0;border-top:1px solid var(--line)}\n  .stats .stat{padding:16px 26px 14px 0;margin-right:26px;border-right:1px solid var(--line-soft)}\n  .stats .stat:last-child{border-right:0;margin-right:0}\n  .stats .num{font-family:var(--serif);font-size:23px;font-weight:600;letter-spacing:-.01em;font-variant-numeric:tabular-nums}\n  .stats .lab{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mute);margin-top:3px}\n\n  /* ---- map stage ---- */\n  .stage{position:relative;perspective:1400px}\n  .frame{\n    position:relative;background:linear-gradient(168deg,#FEFDFB,#F6F2E9);\n    border:1px solid var(--line);border-radius:3px;\n    box-shadow:0 1px 0 #fff inset, 0 30px 58px -34px rgba(22,34,58,.34);\n    overflow:hidden;transform-style:preserve-3d;transition:transform .35s cubic-bezier(.2,.7,.2,1);will-change:transform;\n  }\n  .frame .platelabel{\n    position:absolute;top:13px;left:15px;z-index:4;\n    font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-mute);\n  }\n  .frame .platelabel b{color:var(--ink);font-weight:600}\n  .frame .compass{\n    position:absolute;top:11px;right:13px;z-index:4;display:flex;align-items:center;gap:8px;\n    font-family:var(--mono);font-size:10px;letter-spacing:.1em;color:var(--ink-mute);text-align:right;line-height:1.4;\n  }\n  .frame .compass svg{flex:0 0 auto;opacity:.75}\n  canvas#mosaic{display:block;width:100%;height:auto;cursor:crosshair;position:relative;z-index:1}\n  .tick{position:absolute;z-index:4;width:11px;height:11px;pointer-events:none}\n  .tick::before,.tick::after{content:\"\";position:absolute;background:rgba(22,34,58,.30)}\n  .tick::before{width:11px;height:1px;top:0;left:0}\n  .tick::after{width:1px;height:11px;top:0;left:0}\n  .tick.tl{top:10px;left:10px}\n  .tick.tr{top:10px;right:10px;transform:scaleX(-1)}\n  .tick.bl{bottom:10px;left:10px;transform:scaleY(-1)}\n  .tick.br{bottom:10px;right:10px;transform:scale(-1,-1)}\n  .hovertag{position:absolute;z-index:7;pointer-events:none;transform:translate(-50%,calc(-100% - 13px));\n    background:linear-gradient(180deg,#FFFEFB,var(--paper));color:var(--ink);border:1px solid var(--gold-pale);border-radius:4px;padding:7px 11px;white-space:nowrap;\n    opacity:0;transition:opacity .14s ease;box-shadow:0 14px 30px -12px rgba(22,34,58,.5)}\n  .hovertag.on{opacity:1}\n  .hovertag b{font-family:var(--serif);font-size:16px;font-weight:600;letter-spacing:-.01em;font-variant-numeric:tabular-nums;color:var(--ink)}\n  .hovertag small{font-family:var(--mono);font-size:10px;color:var(--ink-mute)}\n  .hovertag i{display:block;font-style:normal;color:var(--gold-deep);font-family:var(--mono);font-size:9px;letter-spacing:.09em;text-transform:uppercase;margin-top:4px}\n  .hovertag::after{content:\"\";position:absolute;left:50%;bottom:-4px;width:8px;height:8px;background:var(--paper);border-right:1px solid var(--gold-pale);border-bottom:1px solid var(--gold-pale);transform:translateX(-50%) rotate(45deg)}\n\n  /* value scale legend */\n  .legend{\n    position:absolute;left:15px;bottom:13px;z-index:4;\n    display:flex;align-items:center;gap:9px;\n    background:rgba(251,250,247,.82);backdrop-filter:blur(3px);\n    padding:6px 9px;border:1px solid var(--line);border-radius:2px;\n  }\n  .legend .bar{height:7px;width:78px;border-radius:1px;\n    background:linear-gradient(90deg,var(--gold-pale),var(--gold),var(--gold-deep))}\n  .legend span{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-mute)}\n\n  /* floating readout pin */\n  .pin{\n    position:absolute;z-index:5;\n    background:linear-gradient(180deg,rgba(255,254,251,.95) 0%,rgba(251,250,247,.95) 100%);\n    border:1px solid rgba(22,34,58,.38);border-radius:3px;\n    box-shadow:0 13px 26px -18px rgba(22,34,58,.38),0 1px 4px -2px rgba(22,34,58,.08);\n    padding:8px 11px;min-width:138px;\n    opacity:0;transform:translate(-50%,calc(-100% - 8px));\n    transition:opacity .55s ease,transform .6s cubic-bezier(.22,1,.36,1);\n  }\n  .pin.show{opacity:1;transform:translate(-50%,calc(-100% - 16px))}\n  .pin::after{content:\"\";position:absolute;left:50%;bottom:-5px;width:8px;height:8px;background:var(--paper);\n    border-right:1px solid rgba(22,34,58,.38);border-bottom:1px solid rgba(22,34,58,.38);transform:translateX(-50%) rotate(45deg)}\n  .pin .addr{display:flex;align-items:center;gap:6px;font-family:var(--mono);font-size:8.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-mute);margin-bottom:5px}\n  .pin .ping{position:relative;flex:none;width:7px;height:7px;border-radius:50%;background:var(--gold);box-shadow:0 0 0 2px rgba(184,137,58,.18)}\n  .pin .ping::after{content:\"\";position:absolute;left:50%;top:50%;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;border-radius:50%;border:1.5px solid var(--gold);animation:pinPing 2.4s ease-out infinite}\n  @keyframes pinPing{0%{transform:scale(1);opacity:.75}70%{transform:scale(2.9);opacity:0}100%{transform:scale(2.9);opacity:0}}\n  .pin .val{font-family:var(--serif);font-size:18px;font-weight:600;letter-spacing:-.01em;font-variant-numeric:tabular-nums;color:var(--ink);line-height:1.05}\n  .pin .val small{font-size:11px;color:var(--ink-mute);font-family:var(--mono);font-weight:400;letter-spacing:0}\n  .pin .cls{display:inline-block;margin-top:7px;font-family:var(--mono);font-size:8.5px;letter-spacing:.09em;text-transform:uppercase;\n    padding:2px 7px;border:1px solid var(--gold-pale);background:#FCF6EA;border-radius:2px;color:var(--gold-deep)}\n\n  /* ---- sample readout card ---- */\n  .sample{\n    max-width:1320px;margin:0 auto;padding:0 var(--mar) clamp(50px,6vw,86px);\n  }\n  .sample-card{\n    border:1px solid var(--line);border-radius:3px;background:#fff;\n    display:grid;grid-template-columns:1.3fr 1fr 1fr;\n    box-shadow:0 18px 40px -34px rgba(22,34,58,.3);\n  }\n  .sc-cell{padding:22px 26px;border-right:1px solid var(--line-soft)}\n  .sc-cell:last-child{border-right:0}\n  .sc-cell .kicker{font-family:var(--mono);font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-mute);margin-bottom:9px}\n  .sc-where .name{font-family:var(--serif);font-size:20px;font-weight:600;letter-spacing:-.01em;margin-bottom:4px}\n  .sc-where .street{font-size:13.5px;color:var(--ink-soft)}\n  .sc-where .tag{display:inline-block;margin-top:11px;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-deep);border:1px solid var(--gold-pale);background:#FCF6EA;padding:3px 8px;border-radius:2px}\n  .sc-val .big{font-family:var(--serif);font-size:30px;font-weight:600;letter-spacing:-.015em;font-variant-numeric:tabular-nums}\n  .sc-val .big small{font-family:var(--mono);font-size:12px;color:var(--ink-mute);font-weight:400;letter-spacing:0}\n  .sc-val .meta{font-size:13px;color:var(--ink-soft);margin-top:6px}\n\n  /* hazard gauge */\n  .gauge{display:flex;align-items:center;gap:14px}\n  .gauge .ring{flex:none}\n  .gauge .read .lvl{font-family:var(--serif);font-size:19px;font-weight:600}\n  .gauge .read .lvl.low{color:var(--g-green)}\n  .gauge .read .score{font-family:var(--mono);font-size:11px;color:var(--ink-mute);font-variant-numeric:tabular-nums;margin-top:2px}\n  .haz-list{display:flex;flex-wrap:wrap;gap:5px;margin-top:13px}\n  .haz-list .chip{display:flex;align-items:center;gap:5px;font-family:var(--mono);font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-soft);border:1px solid var(--line-soft);padding:3px 6px;border-radius:2px}\n  .haz-list .chip .dotc{width:6px;height:6px;border-radius:50%}\n\n  /* ---- instruments ---- */\n  .instruments{max-width:1320px;margin:0 auto;padding:0 var(--mar) clamp(50px,6vw,86px)}\n  .sec-head{display:flex;align-items:baseline;justify-content:space-between;gap:18px;border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:34px;flex-wrap:wrap}\n  .sec-head h2{font-family:var(--serif);font-weight:600;font-size:clamp(24px,3vw,33px);letter-spacing:-.015em;margin:0;text-wrap:balance}\n  .sec-head .note{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mute);max-width:30ch;text-align:right}\n  .inst-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:1px solid var(--line);border-radius:3px;overflow:hidden;background:#fff}\n  .inst{padding:30px 28px 32px;border-right:1px solid var(--line-soft);position:relative}\n  .inst:last-child{border-right:0}\n  .inst .idx{font-family:var(--mono);font-size:11px;letter-spacing:.12em;color:var(--gold-deep);margin-bottom:20px}\n  .inst h3{font-family:var(--serif);font-size:21px;font-weight:600;letter-spacing:-.01em;margin:0 0 10px}\n  .inst p{font-size:14px;color:var(--ink-soft);margin:0;line-height:1.6}\n  .inst .gly{height:46px;margin-bottom:18px;color:var(--gold-deep)}\n\n  /* ---- flow ---- */\n  .flow{max-width:1320px;margin:0 auto;padding:0 var(--mar) clamp(56px,7vw,96px)}\n  .flow-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(20px,3vw,40px)}\n  .step{position:relative;padding-top:26px;border-top:2px solid var(--ink)}\n  .step .n{position:absolute;top:-13px;left:0;background:var(--paper);padding-right:12px;font-family:var(--mono);font-size:11px;letter-spacing:.1em;color:var(--ink-mute)}\n  .step h4{font-family:var(--serif);font-size:18px;font-weight:600;margin:0 0 7px;letter-spacing:-.01em}\n  .step p{font-size:14px;color:var(--ink-soft);margin:0;line-height:1.58}\n\n  /* ---- scroll reveal + section life ---- */\n  .reveal{opacity:0;transform:translateY(22px);transition:opacity .75s ease,transform .85s cubic-bezier(.22,1,.36,1)}\n  .reveal.in{opacity:1;transform:none}\n  .flow-grid .step:nth-child(2){transition-delay:.1s,.1s}\n  .flow-grid .step:nth-child(3){transition-delay:.2s,.2s}\n  /* section heading: a gold rule draws in beneath the title */\n  .sec-head{position:relative}\n  .sec-head::after{content:\"\";position:absolute;left:0;bottom:-1px;height:2px;width:0;background:linear-gradient(90deg,var(--gold),var(--gold-deep));transition:width .9s cubic-bezier(.22,1,.36,1) .18s}\n  .sec-head.in::after{width:58px}\n  /* instrument cards: gold top-rule sweeps in + glyph lifts on hover */\n  .inst::before{content:\"\";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--gold),var(--gold-deep));transform:scaleX(0);transform-origin:left;transition:transform .4s cubic-bezier(.22,1,.36,1)}\n  .inst:hover::before{transform:scaleX(1)}\n  .inst .gly{transition:color .3s ease,transform .3s ease}\n  .inst:hover .gly{color:var(--gold);transform:translateY(-3px)}\n  .inst h3{transition:color .25s ease}\n  .inst:hover h3{color:var(--gold-deep)}\n  /* flow steps: a gold line draws over the rule on hover, the move label warms */\n  .step::before{content:\"\";position:absolute;top:-2px;left:0;height:2px;width:100%;background:var(--gold);transform:scaleX(0);transform-origin:left;transition:transform .5s cubic-bezier(.22,1,.36,1)}\n  .step:hover::before{transform:scaleX(1)}\n  .step .n{transition:color .25s ease}\n  .step:hover .n{color:var(--gold-deep)}\n  /* hazard gauge ring draws when the sample card enters view */\n  .gauge .ring-prog{stroke-dashoffset:144.5;transition:stroke-dashoffset 1.25s cubic-bezier(.22,1,.36,1) .25s}\n  .sample-card.in .ring-prog{stroke-dashoffset:120.4}\n  @media (prefers-reduced-motion: reduce){\n    .reveal{opacity:1!important;transform:none!important;transition:none}\n    .sec-head::after,.inst::before,.step::before{transition:none}\n    .gauge .ring-prog{stroke-dashoffset:120.4!important;transition:none}\n    .pin .ping::after{animation:none}\n    .pin{transition:opacity .4s ease}\n    .pin:not(.show){transform:translate(-50%,calc(-100% - 16px))}\n  }\n\n  /* ---- closing cta ---- */\n  .closer{background:linear-gradient(165deg,#FCF6EA,#F2ECDE);color:var(--ink);border-top:1px solid var(--line)}\n  .closer .inner{max-width:1320px;margin:0 auto;padding:clamp(46px,6vw,82px) var(--mar);display:flex;align-items:center;justify-content:space-between;gap:30px;flex-wrap:wrap}\n  .closer h2{font-family:var(--serif);font-weight:600;font-size:clamp(26px,3.4vw,40px);letter-spacing:-.02em;margin:0;text-wrap:balance;max-width:18ch}\n  .closer h2 em{font-style:italic;color:var(--gold-deep)}\n  .closer .c-cta{display:flex;gap:12px;flex-wrap:wrap}\n  .closer .btn-line:hover{border-color:var(--gold-pale)}\n\n  /* ---- footer ---- */\n  footer.foot{max-width:1320px;margin:0 auto;padding:34px var(--mar) 44px;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;align-items:flex-start}\n  .foot .f-brand .logo{font-family:var(--serif);font-size:17px;font-weight:600}\n  .foot .f-brand .logo .dot{color:var(--gold-deep)}\n  .foot p{font-size:13px;color:var(--ink-mute);margin:8px 0 0;max-width:40ch}\n  .foot .sources{font-family:var(--mono);font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-mute);text-align:right;line-height:1.9}\n  .foot .sources b{color:var(--ink-soft);font-weight:600}\n\n  @media(max-width:880px){\n    .hero{grid-template-columns:1fr;gap:36px}\n    .stage{order:2;perspective:none}\n    .frame{transform:none !important}\n    .sample-card{grid-template-columns:1fr}\n    .sc-cell{border-right:0;border-bottom:1px solid var(--line-soft)}\n    .sc-cell:last-child{border-bottom:0}\n    .inst-grid{grid-template-columns:1fr}\n    .inst{border-right:0;border-bottom:1px solid var(--line-soft)}\n    .inst:last-child{border-bottom:0}\n    .flow-grid{grid-template-columns:1fr;gap:30px}\n    .closer .inner{flex-direction:column;align-items:flex-start}\n  }\n  @media(max-width:480px){\n    .brand .by{display:none}\n    .top nav .btn-ghost{display:none}\n    .stats .stat{padding-right:18px;margin-right:18px}\n  }\n\n  /* ---- cinematic intro (camera flies over the building map, then resolves into the layout) ---- */\n  .cine-bg{position:fixed;inset:0;z-index:9000;pointer-events:none;opacity:0;\n    background:radial-gradient(120% 95% at 50% 40%, #FFFEFA 0%, var(--paper) 55%, #EFEADE 100%);\n    transition:opacity .45s ease}\n  .cinema .cine-bg{opacity:1}\n  html.cinema,html.cinema body{overflow:hidden}\n  .cinema .stage{z-index:9001}\n  .cinema .frame{border-color:transparent !important;background:transparent !important;box-shadow:none !important;transform:none !important}\n  .cinema .platelabel,.cinema .compass{opacity:0 !important;transform:translateY(-12px)}\n  .cinema .legend{opacity:0 !important;transform:translateY(12px)}\n  .cinema .frame .tick{opacity:0 !important}\n  /* \"stick the landing\": a gold line draws clockwise around the frame, then the chrome animates in */\n  .fe{position:absolute;z-index:6;pointer-events:none;background:var(--gold);opacity:0;box-shadow:0 0 7px rgba(184,137,58,.5)}\n  .fe-t{top:0;left:0;right:0;height:2px;transform-origin:left;transform:scaleX(0)}\n  .fe-r{top:0;right:0;bottom:0;width:2px;transform-origin:top;transform:scaleY(0)}\n  .fe-b{bottom:0;left:0;right:0;height:2px;transform-origin:right;transform:scaleX(0)}\n  .fe-l{top:0;left:0;bottom:0;width:2px;transform-origin:bottom;transform:scaleY(0)}\n  @keyframes feDX{0%{transform:scaleX(0);opacity:1}48%{transform:scaleX(1);opacity:1}80%{opacity:1}100%{transform:scaleX(1);opacity:0}}\n  @keyframes feDY{0%{transform:scaleY(0);opacity:1}48%{transform:scaleY(1);opacity:1}80%{opacity:1}100%{transform:scaleY(1);opacity:0}}\n  .frame.landed .fe-t{animation:feDX .62s cubic-bezier(.4,0,.2,1) .05s both}\n  .frame.landed .fe-r{animation:feDY .62s cubic-bezier(.4,0,.2,1) .36s both}\n  .frame.landed .fe-b{animation:feDX .62s cubic-bezier(.4,0,.2,1) .67s both}\n  .frame.landed .fe-l{animation:feDY .62s cubic-bezier(.4,0,.2,1) .98s both}\n  .frame.landed{transition:transform .35s cubic-bezier(.2,.7,.2,1), border-color .65s ease .8s}\n  .frame.landed .platelabel{transition:opacity .55s ease .55s, transform .6s cubic-bezier(.2,1,.36,1) .55s}\n  .frame.landed .compass{transition:opacity .55s ease .68s, transform .6s cubic-bezier(.2,1,.36,1) .68s}\n  .frame.landed .legend{transition:opacity .55s ease 1s, transform .6s cubic-bezier(.2,1,.36,1) 1s}\n  .frame.landed .tick{transition:opacity .5s ease .3s}\n  /* left column resolves with the map (cinematic only): headline word-by-word, eyebrow line, subtext, buttons, stats */\n  .lede.cin-text .eyebrow .ln{transform:scaleX(0);transform-origin:left}\n  .lede.cin-text .eyebrow .mono{opacity:0;transform:translateY(8px)}\n  .lede.cin-text h1 .hw{display:inline-block;opacity:0;transform:translateY(.55em) rotate(2deg);transition:opacity .5s ease, transform .66s cubic-bezier(.2,1.2,.3,1)}\n  .lede.cin-text .sub,.lede.cin-text .cta-row,.lede.cin-text .stats{opacity:0;transform:translateY(16px)}\n  .lede.cin-text.in .eyebrow .ln{transform:scaleX(1);transition:transform .6s cubic-bezier(.4,0,.2,1) .1s}\n  .lede.cin-text.in .eyebrow .mono{opacity:1;transform:none;transition:opacity .5s ease .22s, transform .5s ease .22s}\n  .lede.cin-text.in h1 .hw{opacity:1;transform:none}\n  .lede.cin-text.in .sub{opacity:1;transform:none;transition:opacity .6s ease 1s, transform .7s cubic-bezier(.2,1,.36,1) 1s}\n  .lede.cin-text.in .cta-row{opacity:1;transform:none;transition:opacity .6s ease 1.18s, transform .7s cubic-bezier(.2,1,.36,1) 1.18s}\n  .lede.cin-text.in .stats{opacity:1;transform:none;transition:opacity .6s ease 1.32s, transform .7s cubic-bezier(.2,1,.36,1) 1.32s}\n  /* standing value labels: float upright over the tilted map, rise up on entrance, vanish on pull-back */\n  .vlayer{position:fixed;inset:0;z-index:9002;pointer-events:none;overflow:hidden;transition:opacity .4s ease}\n  .vlayer.out{opacity:0}\n  .vlabel{position:absolute;font-family:var(--mono);font-size:13.5px;font-weight:700;letter-spacing:.01em;color:var(--ink);white-space:nowrap;\n    padding:3px 10px;border-radius:5px;background:rgba(252,251,248,.97);border:1px solid var(--gold-pale);\n    box-shadow:0 10px 22px -8px rgba(22,34,58,.62);\n    opacity:0;transform:translate(-50%,calc(-100% + 18px)) scaleY(.28);transform-origin:bottom center;\n    transition:opacity .32s ease, transform .62s cubic-bezier(.2,1.6,.3,1)}\n  .vlabel.show{opacity:1;transform:translate(-50%,calc(-100% - 7px)) scaleY(1)}\n  .vlabel::after{content:\"\";position:absolute;left:50%;bottom:-4px;width:7px;height:7px;margin-left:-3.5px;background:rgba(252,251,248,.96);border-right:1px solid var(--gold-pale);border-bottom:1px solid var(--gold-pale);transform:rotate(45deg)}\n  /* cinematic title beside the building map */\n  .cine-title{position:fixed;left:6vw;top:50%;z-index:9004;pointer-events:none;max-width:42vw;\n    transform:translateY(-50%);opacity:1;transition:opacity .45s ease}\n  .cine-title.out{opacity:0}\n  .cine-title .ct-logo{font-family:var(--serif);font-size:clamp(36px,4.5vw,64px);font-weight:600;letter-spacing:-.012em;color:var(--ink);line-height:1.02;white-space:nowrap}\n  .cine-title .ct-l{display:inline-block;opacity:0;transform:translateY(.6em) rotate(9deg) scale(.78);transform-origin:50% 100%;transition:opacity .45s ease, transform .62s cubic-bezier(.2,1.6,.3,1)}\n  .cine-title.show .ct-l{opacity:1;transform:none}\n  .cine-title .ct-l.dot{color:var(--gold-deep)}\n  .cine-title .ct-by{display:flex;align-items:center;gap:10px;margin-top:16px;font-family:var(--mono);font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-mute);\n    opacity:0;transform:translateY(10px);transition:opacity .6s ease 1s, transform .6s ease 1s}\n  .cine-title.show .ct-by{opacity:1;transform:none}\n  .cine-title .ct-by .fh-logo{height:34px;width:auto;display:inline-block;vertical-align:middle;margin:0}\n";

const MARKUP = "<div class=\"wrap\">\n  <header class=\"top\">\n    <div class=\"brand\">\n      <span class=\"logo\">zonalvalue<span class=\"dot\">.</span>ph</span>\n      <span class=\"by\">by <img class=\"fh-logo\" src=\"/pictures/fh-ink.png\" alt=\"Filipino Homes\"/></span>\n    </div>\n    <nav>\n      <a class=\"btn btn-ghost\" href=\"#instruments\">What it reads</a>\n      <a class=\"btn btn-line\" href=\"/login\" aria-label=\"Sign in\">Sign in</a>\n      <a class=\"btn btn-solid\" href=\"/\" aria-label=\"Explore the map\">Explore the map<span class=\"arr\" aria-hidden=\"true\">&rarr;</span></a>\n    </nav>\n  </header>\n\n  <section class=\"hero\">\n    <div class=\"lede\">\n      <div class=\"eyebrow\"><span class=\"ln\" aria-hidden=\"true\"></span><span class=\"mono\">Property due diligence &middot; nationwide</span></div>\n      <h1>The land underneath an address, <em>drawn in value</em> and risk.</h1>\n      <p class=\"sub\">Official BIR zonal values in pesos per square meter, a six-point geohazard profile, and an AI analyst grounded in real data — for any address from Batanes to Tawi-Tawi.</p>\n      <div class=\"cta-row\">\n        <a class=\"btn btn-solid\" href=\"/\" aria-label=\"Explore the map\">Explore the map<span class=\"arr\" aria-hidden=\"true\">&rarr;</span></a>\n      </div>\n      <div class=\"stats\" role=\"list\">\n        <div class=\"stat\" role=\"listitem\"><div class=\"num\">823,342</div><div class=\"lab\">BIR zonal records</div></div>\n        <div class=\"stat\" role=\"listitem\"><div class=\"num\">82</div><div class=\"lab\">Provinces</div></div>\n        <div class=\"stat\" role=\"listitem\"><div class=\"num\">1,600+</div><div class=\"lab\">Cities &amp; munis</div></div>\n        <div class=\"stat\" role=\"listitem\"><div class=\"num\">6</div><div class=\"lab\">Hazard checks</div></div>\n      </div>\n    </div>\n\n    <div class=\"stage\">\n      <figure class=\"frame\" style=\"margin:0\">\n        <span class=\"tick tl\" aria-hidden=\"true\"></span><span class=\"tick tr\" aria-hidden=\"true\"></span><span class=\"tick bl\" aria-hidden=\"true\"></span><span class=\"tick br\" aria-hidden=\"true\"></span>\n        <span class=\"fe fe-t\" aria-hidden=\"true\"></span><span class=\"fe fe-r\" aria-hidden=\"true\"></span><span class=\"fe fe-b\" aria-hidden=\"true\"></span><span class=\"fe fe-l\" aria-hidden=\"true\"></span>\n        <div class=\"platelabel\">Plate I &middot; <b>The Philippines, in value</b></div>\n        <div class=\"compass\"><span>BIR &middot; PHIVOLCS</span><svg width=\"22\" height=\"22\" viewBox=\"0 0 22 22\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"9\" fill=\"none\" stroke=\"#8A5A1E\" stroke-width=\"0.8\" opacity=\"0.45\"/><path d=\"M11 1.7 L12.8 10 L11 20.3 L9.2 10 Z\" fill=\"#B8893A\"/><path d=\"M1.7 11 L10 9.2 L20.3 11 L10 12.8 Z\" fill=\"#16223A\" opacity=\"0.3\"/><circle cx=\"11\" cy=\"11\" r=\"1.05\" fill=\"#16223A\"/></svg></div>\n        <canvas id=\"mosaic\" role=\"img\"\n          aria-label=\"A map of the Philippines that builds itself: the archipelago's coastline inks in, then its land fills with value-parcels along a gold scale radiating from Metro Manila and Cebu. Hover any parcel to read its peso-per-square-meter value.\"></canvas>\n        <div class=\"legend\"><span>Low</span><div class=\"bar\" aria-hidden=\"true\"></div><span>High &#8369;/sqm</span></div>\n        <div class=\"pin p1\" id=\"pin1\">\n          <div class=\"addr\"><i class=\"ping\" aria-hidden=\"true\"></i>Luzon &middot; Metro Manila</div>\n          <div class=\"val\">&#8369;120,000<small> /sqm</small></div>\n          <span class=\"cls\">CR &middot; prime</span>\n        </div>\n        <div class=\"pin p2\" id=\"pin2\">\n          <div class=\"addr\"><i class=\"ping\" aria-hidden=\"true\"></i>Visayas &middot; Cebu City</div>\n          <div class=\"val\">&#8369;46,540<small> /sqm</small></div>\n          <span class=\"cls\">CR &middot; commercial</span>\n        </div>\n      </figure>\n      <div class=\"hovertag\" id=\"hovertag\" aria-hidden=\"true\"></div>\n    </div>\n  </section>\n\n  <section class=\"sample\" aria-label=\"Live sample readout\">\n    <div class=\"sample-card reveal\">\n      <div class=\"sc-cell sc-where\">\n        <div class=\"kicker\">Sample readout</div>\n        <div class=\"name\">Filipino Homes HQ</div>\n        <div class=\"street\">M.H. Aznar Rd, Sambag II, Cebu City</div>\n        <span class=\"tag\">Cebu &middot; Region VII</span>\n      </div>\n      <div class=\"sc-cell sc-val\">\n        <div class=\"kicker\">BIR zonal value</div>\n        <div class=\"big\">&#8369;33,500 <small>/sqm</small></div>\n        <div class=\"meta\">Classification <strong>CR</strong> — commercial &middot; street-level</div>\n      </div>\n      <div class=\"sc-cell\">\n        <div class=\"kicker\">Geohazard profile</div>\n        <div class=\"gauge\">\n          <svg class=\"ring\" width=\"56\" height=\"56\" viewBox=\"0 0 56 56\" aria-label=\"Overall hazard risk low, 0.5 out of 3.0\">\n            <circle cx=\"28\" cy=\"28\" r=\"23\" fill=\"none\" stroke=\"#EAE5DA\" stroke-width=\"6\"/>\n            <circle class=\"ring-prog\" cx=\"28\" cy=\"28\" r=\"23\" fill=\"none\" stroke=\"#2F9E6B\" stroke-width=\"6\"\n              stroke-linecap=\"round\" stroke-dasharray=\"144.5\" stroke-dashoffset=\"120.4\"\n              transform=\"rotate(-90 28 28)\"/>\n            <text x=\"28\" y=\"32\" text-anchor=\"middle\" font-family=\"ui-monospace,monospace\" font-size=\"13\" font-weight=\"600\" fill=\"#16223A\">0.5</text>\n          </svg>\n          <div class=\"read\"><div class=\"lvl low\">Low risk</div><div class=\"score\">0.5 / 3.0 overall</div></div>\n        </div>\n        <div class=\"haz-list\" aria-label=\"Six hazard checks\">\n          <span class=\"chip\"><span class=\"dotc\" style=\"background:#2F9E6B\"></span>Flood</span>\n          <span class=\"chip\"><span class=\"dotc\" style=\"background:#2F9E6B\"></span>Landslide</span>\n          <span class=\"chip\"><span class=\"dotc\" style=\"background:#E0A52E\"></span>Storm surge</span>\n          <span class=\"chip\"><span class=\"dotc\" style=\"background:#2F9E6B\"></span>Fault</span>\n          <span class=\"chip\"><span class=\"dotc\" style=\"background:#2F9E6B\"></span>Liquefaction</span>\n          <span class=\"chip\"><span class=\"dotc\" style=\"background:#2F9E6B\"></span>Tsunami</span>\n        </div>\n      </div>\n    </div>\n  </section>\n\n  <section class=\"instruments\" id=\"instruments\">\n    <div class=\"sec-head reveal\">\n      <h2>Three instruments, one address.</h2>\n      <div class=\"note\">Every reading traces back to a public source — nothing is invented.</div>\n    </div>\n    <div class=\"inst-grid reveal\">\n      <article class=\"inst\">\n        <div class=\"idx\">i &middot; value</div>\n        <svg class=\"gly\" width=\"46\" height=\"46\" viewBox=\"0 0 46 46\" fill=\"none\" aria-hidden=\"true\">\n          <rect x=\"4\" y=\"4\" width=\"17\" height=\"17\" stroke=\"currentColor\" stroke-width=\"1.5\"/>\n          <rect x=\"25\" y=\"4\" width=\"17\" height=\"17\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"#ECD9B0\" fill-opacity=\".5\"/>\n          <rect x=\"4\" y=\"25\" width=\"17\" height=\"17\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"#B8893A\" fill-opacity=\".35\"/>\n          <rect x=\"25\" y=\"25\" width=\"17\" height=\"17\" stroke=\"currentColor\" stroke-width=\"1.5\"/>\n        </svg>\n        <h3>Zonal Values</h3>\n        <p>Street-level pesos per square meter, broken out by BIR classification — RR residential, CR commercial, agricultural — so you read the exact value the bureau assigns to that lot.</p>\n      </article>\n      <article class=\"inst\">\n        <div class=\"idx\">ii &middot; risk</div>\n        <svg class=\"gly\" width=\"46\" height=\"46\" viewBox=\"0 0 46 46\" fill=\"none\" aria-hidden=\"true\">\n          <path d=\"M23 6 a17 17 0 1 1 -0.1 0\" stroke=\"#EAE5DA\" stroke-width=\"3.5\"/>\n          <path d=\"M23 6 a17 17 0 0 1 14.7 8.5\" stroke=\"#2F9E6B\" stroke-width=\"3.5\" stroke-linecap=\"round\"/>\n          <circle cx=\"23\" cy=\"23\" r=\"3\" fill=\"currentColor\"/>\n        </svg>\n        <h3>Hazard Profile</h3>\n        <p>Six risks in a single gauge — flood, landslide, storm surge, active fault, liquefaction, tsunami — sourced from PHIVOLCS and Project NOAH and scored into one clear reading.</p>\n      </article>\n      <article class=\"inst\">\n        <div class=\"idx\">iii &middot; answer</div>\n        <svg class=\"gly\" width=\"46\" height=\"46\" viewBox=\"0 0 46 46\" fill=\"none\" aria-hidden=\"true\">\n          <path d=\"M7 10 h32 v20 h-20 l-8 8 v-8 h-4 z\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\"/>\n          <line x1=\"13\" y1=\"17\" x2=\"33\" y2=\"17\" stroke=\"#B8893A\" stroke-width=\"1.5\"/>\n          <line x1=\"13\" y1=\"23\" x2=\"27\" y2=\"23\" stroke=\"#B8893A\" stroke-width=\"1.5\"/>\n        </svg>\n        <h3>AI Zonal Assistant</h3>\n        <p>Ask in plain language and get a plain-language answer, grounded in the real records on file. It explains the numbers — it never invents them.</p>\n      </article>\n    </div>\n  </section>\n\n  <section class=\"flow\">\n    <div class=\"sec-head reveal\">\n      <h2>From an address to a decision, in three moves.</h2>\n      <div class=\"note\">A free account opens all 82 provinces.</div>\n    </div>\n    <div class=\"flow-grid\">\n      <div class=\"step reveal\"><span class=\"n\">Move 01</span><h4>Find a place</h4><p>Search any address, barangay, or pin a point on the map — anywhere in the 82 provinces.</p></div>\n      <div class=\"step reveal\"><span class=\"n\">Move 02</span><h4>Read value &amp; risk</h4><p>See the BIR zonal value and the six-point hazard gauge side by side, instantly.</p></div>\n      <div class=\"step reveal\"><span class=\"n\">Move 03</span><h4>Scan, or ask the AI</h4><p>Drill into the parcel or ask the assistant a question — and get an answer grounded in the data.</p></div>\n    </div>\n  </section>\n\n  <section class=\"closer\">\n    <div class=\"inner\">\n      <h2>Read the ground before you <em>buy it</em>.</h2>\n      <div class=\"c-cta\">\n        <a class=\"btn btn-solid\" href=\"/register\" aria-label=\"Create an account\">Create an account<span class=\"arr\" aria-hidden=\"true\">&rarr;</span></a>\n      </div>\n    </div>\n  </section>\n\n  <footer class=\"foot\">\n    <div class=\"f-brand\">\n      <div class=\"logo\">zonalvalue<span class=\"dot\">.</span>ph</div>\n      <p>Property due diligence for the whole Philippines — built by Filipino Homes, a Cebu real-estate company.</p>\n    </div>\n    <div class=\"sources\">\n      Zonal values &middot; <b>BIR</b><br>\n      Geohazards &middot; <b>PHIVOLCS &amp; Project NOAH</b><br>\n      &copy; 2026 Filipino Homes\n    </div>\n  </footer>\n</div>";

export default function WelcomeNewPage() {
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return; ran.current = true;
    let cleanup;
    try { cleanup = (function(){

  var canvas=document.getElementById("mosaic");
  if(!canvas) return;
  var _cl=[],_raf=0; function _on(el,ev,fn){el.addEventListener(ev,fn);_cl.push(function(){try{el.removeEventListener(ev,fn);}catch(e){}});}
  /* --- scroll reveal: bring the lower sections to life as they scroll into view --- */
  try{
    var _rev=[].slice.call(document.querySelectorAll(".reveal"));
    var _rRM=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(_rRM||!("IntersectionObserver" in window)){ _rev.forEach(function(el){el.classList.add("in");}); }
    else{
      var _rio=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");_rio.unobserve(e.target);}});},{threshold:0.16,rootMargin:"0px 0px -7% 0px"});
      _rev.forEach(function(el){_rio.observe(el);});
      if(typeof _cl!=="undefined"){_cl.push(function(){try{_rio.disconnect();}catch(e){}});}
    }
  }catch(_e){ [].forEach.call(document.querySelectorAll(".reveal"),function(el){el.classList.add("in");}); }
  var ctx=canvas.getContext("2d");
  var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ledeEl=document.querySelector(".lede"), stageEl=document.querySelector(".stage"),
      frameEl=document.querySelector(".frame"), tagEl=document.getElementById("hovertag");
  var wantAmbient=!reduce && window.matchMedia && !window.matchMedia("(hover: none)").matches;

  // ---- real Philippine archipelago geometry (potrace trace, 1024 viewBox) ----
  var PH_D = "M4742 10224 c-31 -21 -14 -50 38 -65 35 -11 42 -10 60 6 25 22 25 37 2 58 -23 21 -71 22 -100 1z M4606 10044 c-7 -28 9 -64 28 -64 16 0 26 32 19 59 -8 30 -40 33 -47 5z M5050 9923 c-24 -30 -23 -61 2 -77 21 -12 49 10 72 57 11 24 12 33 3 39 -24 15 -56 7 -77 -19z M4694 9899 c-16 -17 -16 -22 -4 -29 29 -18 57 -11 62 15 3 13 3 27 0 30 -12 11 -40 4 -58 -16z M4310 9676 c-31 -32 -52 -46 -71 -46 -33 0 -37 -10 -44 -113 -9 -115 -22 -168 -66 -262 -21 -45 -45 -107 -53 -137 -8 -31 -21 -70 -30 -86 -23 -44 -20 -87 9 -141 32 -60 45 -140 45 -274 l0 -109 -34 -39 -33 -39 4 -188 c5 -184 5 -188 33 -234 29 -47 26 -68 -10 -68 -9 0 -31 -13 -50 -30 -54 -45 -130 -37 -130 15 0 28 -24 53 -92 97 -38 24 -48 36 -48 57 0 15 -6 35 -13 44 -11 16 -14 16 -33 2 -19 -13 -22 -27 -27 -122 -3 -60 -8 -120 -12 -134 -6 -21 -1 -29 29 -50 41 -28 45 -47 50 -249 3 -137 5 -145 71 -230 37 -49 43 -63 49 -125 12 -128 18 -160 34 -177 19 -22 51 -23 81 -2 29 21 48 6 31 -26 -19 -35 -4 -78 30 -85 22 -5 37 -19 57 -57 35 -62 81 -94 108 -74 26 19 33 118 11 170 -16 38 -16 40 5 62 l22 23 41 -29 c23 -16 76 -39 119 -51 66 -19 80 -27 98 -56 18 -28 20 -39 10 -59 -11 -25 -54 -34 -66 -14 -13 21 -34 9 -41 -24 -4 -25 -26 -54 -81 -107 l-75 -73 15 -134 c9 -74 18 -136 21 -140 8 -8 56 39 56 55 0 22 46 15 78 -12 19 -16 34 -41 41 -71 9 -35 15 -44 24 -35 19 19 43 13 86 -23 46 -38 125 -62 174 -51 18 3 56 9 85 12 46 4 52 7 52 28 0 13 -10 32 -23 42 -36 29 -23 50 40 64 31 7 69 24 85 37 26 22 35 24 86 18 75 -9 173 -67 244 -145 46 -51 62 -61 125 -81 96 -30 124 -64 135 -164 8 -78 29 -105 80 -106 39 0 52 29 43 99 -8 68 -25 106 -71 160 -32 37 -35 45 -33 98 1 39 -5 75 -20 111 -11 29 -21 59 -21 67 0 32 42 12 113 -54 41 -38 84 -74 96 -81 12 -6 33 -36 46 -66 21 -48 27 -54 54 -54 17 0 43 -11 63 -27 60 -49 183 -167 204 -198 20 -27 21 -32 7 -58 -8 -16 -13 -42 -11 -59 3 -29 7 -33 54 -43 28 -6 66 -23 85 -37 19 -14 51 -28 72 -31 20 -3 49 -15 64 -26 l26 -21 51 43 c68 58 70 59 111 51 56 -10 42 -64 -16 -64 -50 0 -59 -9 -59 -59 0 -59 11 -75 52 -75 27 -1 34 -5 36 -25 4 -27 30 -71 42 -71 4 0 24 26 45 57 43 64 56 132 35 182 -9 24 -9 34 5 61 9 17 15 48 13 68 -2 30 -8 38 -25 40 -17 3 -23 -2 -23 -17 0 -11 -7 -27 -16 -35 -14 -15 -18 -14 -45 15 -26 28 -34 31 -81 29 -100 -4 -107 4 -67 81 11 23 19 42 17 43 -2 1 -15 10 -30 19 -19 12 -28 26 -28 43 0 37 -55 104 -86 104 -16 0 -28 9 -39 30 -35 68 -9 85 134 85 l105 0 18 31 19 32 -135 66 c-74 36 -140 66 -147 66 -7 0 -20 -7 -29 -15 -14 -12 -23 -13 -51 -3 -40 13 -49 24 -49 61 0 33 -16 35 -77 10 -44 -18 -58 -43 -24 -43 26 0 29 -14 22 -98 -9 -96 -32 -113 -99 -72 -31 19 -33 23 -27 63 11 70 -16 150 -68 205 -32 35 -46 59 -51 91 -5 36 -9 42 -24 35 -9 -5 -78 -8 -152 -9 l-135 0 -47 -34 c-39 -28 -48 -40 -48 -65 0 -36 -22 -73 -66 -110 -47 -39 -132 -37 -217 5 -74 37 -117 75 -117 103 0 12 -11 44 -23 71 -13 28 -27 66 -31 85 -3 19 -17 50 -31 70 -30 44 -24 80 16 104 34 20 35 26 9 49 -11 9 -20 26 -20 37 0 10 -13 34 -29 52 -15 18 -34 51 -41 73 -7 22 -18 47 -25 55 -7 8 -16 29 -19 46 -4 17 -21 44 -37 60 -50 47 -74 104 -44 104 8 0 26 17 39 38 13 20 32 45 42 54 69 61 73 67 79 112 6 36 4 51 -9 65 -23 26 -20 58 13 126 42 84 62 104 129 124 32 10 78 32 102 50 51 37 60 29 31 -28 -46 -90 -14 -95 62 -10 47 52 56 67 59 107 9 97 49 219 90 270 48 59 97 177 104 247 6 57 4 66 -20 101 -14 21 -26 47 -26 57 0 30 -50 87 -76 87 -40 0 -93 93 -105 185 -4 33 -11 73 -15 88 -3 16 -2 45 4 65 6 21 15 71 21 112 9 59 18 81 40 105 65 69 70 98 29 157 -10 15 -25 43 -33 62 -24 57 -65 45 -65 -18 0 -32 -70 -96 -116 -107 -65 -15 -102 -10 -162 20 -31 15 -88 39 -127 51 -38 13 -113 50 -165 83 l-95 59 -85 3 c-47 1 -101 5 -120 9 -32 7 -38 4 -80 -38z M5124 7205 c-12 -8 -24 -12 -26 -9 -3 2 -11 -2 -17 -10 -15 -18 5 -71 38 -100 14 -13 21 -31 21 -56 0 -34 12 -50 37 -50 3 0 3 24 0 53 -2 28 0 76 6 105 11 49 10 55 -8 68 -23 17 -26 17 -51 -1z M6688 6598 c-15 -11 -15 -24 -7 -104 l10 -92 -36 -71 c-19 -40 -33 -76 -30 -81 8 -13 51 -13 75 0 13 7 28 7 46 -1 16 -5 45 -7 66 -4 33 6 40 12 58 52 11 25 20 64 20 86 0 34 -7 48 -50 93 -27 29 -50 61 -50 72 0 24 -40 62 -66 62 -11 0 -27 -6 -36 -12z M5106 6194 c-3 -9 -6 -23 -6 -33 0 -9 -13 -30 -30 -46 -16 -16 -30 -32 -30 -37 0 -4 29 -27 64 -50 38 -26 67 -53 74 -70 6 -15 14 -28 19 -28 4 0 25 15 45 34 68 63 73 159 8 172 -23 5 -30 12 -30 30 0 26 -11 30 -41 14 -16 -9 -19 -7 -19 10 0 25 -45 28 -54 4z M4407 6140 c-31 -25 -97 -26 -217 -5 -134 24 -132 24 -150 -53 -9 -35 -4 -38 65 -44 24 -2 31 -8 33 -28 2 -19 26 -42 92 -90 48 -36 91 -74 94 -85 3 -11 11 -60 18 -109 l12 -89 58 -55 c48 -46 58 -61 58 -88 0 -44 77 -147 120 -163 17 -5 34 -21 39 -34 5 -13 23 -30 41 -37 28 -11 33 -11 53 8 12 11 38 24 57 29 29 8 37 16 47 49 6 21 12 53 12 71 1 20 12 45 30 65 15 18 34 43 40 56 15 29 5 81 -20 105 -27 26 -26 130 1 175 29 47 26 80 -7 93 -68 27 -91 43 -106 74 -21 44 -107 95 -160 95 -37 0 -96 24 -149 61 -32 23 -30 23 -61 -1z M5864 5895 c-8 -21 2 -32 34 -38 20 -4 41 -22 64 -54 41 -57 93 -89 131 -79 35 8 34 20 -5 48 -18 12 -58 48 -88 80 -48 51 -60 58 -93 58 -24 0 -40 -5 -43 -15z M6331 5624 l-35 -15 37 -37 c20 -20 45 -58 56 -84 17 -40 44 -68 65 -68 3 0 6 18 6 40 0 28 -5 42 -19 50 -11 5 -28 35 -38 67 -11 31 -23 58 -29 59 -5 2 -24 -4 -43 -12z M7203 5563 c-4 -10 -11 -21 -15 -24 -12 -8 -295 -3 -330 6 -14 4 -36 2 -48 -5 -22 -12 -22 -12 -2 -33 29 -32 49 -77 55 -126 8 -67 85 -134 183 -160 32 -9 44 -18 58 -48 31 -65 76 -113 135 -142 31 -15 63 -26 71 -24 13 3 15 -7 10 -61 -5 -57 -10 -70 -39 -100 l-33 -34 31 -16 c17 -9 35 -25 41 -36 6 -11 31 -44 56 -73 108 -127 120 -132 271 -124 l113 6 62 -39 c33 -22 70 -40 82 -40 16 0 5 14 -47 64 -37 35 -67 69 -67 74 0 6 -10 12 -22 14 -17 2 -22 9 -20 23 16 93 17 86 -27 124 l-42 36 -16 125 c-15 118 -18 162 -13 220 1 14 -2 53 -6 88 -6 57 -10 66 -47 97 -22 19 -44 35 -49 35 -4 0 -8 15 -8 34 0 25 -10 45 -37 75 -35 39 -44 43 -103 51 -36 4 -78 13 -93 19 -44 17 -97 14 -104 -6z M5253 5526 c-28 -18 -32 -27 -33 -64 0 -24 -8 -57 -17 -73 -15 -25 -16 -35 -5 -74 7 -25 12 -58 12 -73 0 -17 10 -38 24 -51 l24 -23 7 89 c4 48 14 122 23 163 27 130 22 145 -35 106z M6110 5530 c-21 -13 -16 -219 6 -236 8 -6 14 -15 14 -20 0 -8 -31 -58 -73 -117 -17 -24 -17 -28 -2 -56 8 -17 17 -31 20 -31 14 0 97 103 116 143 20 41 26 47 54 47 23 0 40 -10 66 -36 45 -48 165 -128 331 -222 l57 -33 -8 28 c-5 16 -18 47 -30 70 -11 23 -21 53 -21 66 0 13 -12 34 -26 48 -14 13 -33 41 -41 62 -12 30 -27 44 -73 67 -32 16 -69 43 -83 60 -15 17 -63 50 -108 74 l-82 44 -38 -24 c-38 -24 -38 -24 -49 -3 -6 11 -8 33 -5 50 7 30 0 35 -25 19z M5536 5451 c-19 -21 -19 -22 4 -46 13 -14 28 -25 34 -25 6 0 28 -11 48 -25 43 -29 63 -31 76 -9 12 22 4 56 -21 88 -31 38 -113 48 -141 17z M3732 5277 l-22 -23 25 -24 c14 -13 25 -33 25 -44 0 -12 17 -41 38 -65 38 -44 39 -44 62 -28 26 18 65 23 74 8 18 -29 136 -16 136 15 0 8 -18 33 -40 55 -33 34 -49 42 -87 47 -31 3 -67 18 -107 44 -32 21 -64 38 -71 38 -6 0 -21 -10 -33 -23z M3712 5073 c20 -45 70 -133 78 -138 5 -3 7 -25 3 -52 l-6 -46 32 19 c40 23 47 36 56 95 7 45 6 46 -22 52 -17 3 -49 22 -72 41 -38 32 -78 48 -69 29z M5182 5058 c-5 -7 -13 -34 -17 -59 -7 -46 -6 -47 45 -95 l52 -48 -7 -147 c-5 -103 -4 -173 6 -234 l13 -88 -32 -26 c-47 -39 -54 -69 -40 -167 9 -66 9 -97 0 -141 -6 -31 -10 -58 -8 -61 3 -2 18 -1 35 3 24 5 29 11 28 32 -2 21 10 36 56 74 64 52 125 77 267 108 124 28 185 66 201 124 15 60 95 138 175 172 43 18 64 33 64 44 0 69 24 240 37 259 8 13 12 26 8 30 -11 11 -99 -19 -145 -49 l-45 -30 -3 25 c-2 17 -17 35 -40 51 -43 30 -59 31 -85 8 -14 -13 -36 -18 -82 -18 -55 0 -68 4 -92 26 -32 30 -157 102 -253 146 -36 17 -74 40 -84 51 -22 25 -39 28 -54 10z M6915 4911 c-16 -52 41 -119 91 -107 22 6 25 11 22 44 -2 29 -10 41 -37 59 -41 28 -68 29 -76 4z M6843 4803 c3 -10 10 -40 17 -68 7 -27 21 -71 32 -97 15 -33 19 -56 14 -82 -7 -37 18 -151 36 -162 5 -3 22 -9 38 -14 29 -8 31 -7 56 41 l25 50 45 -33 c59 -42 58 -40 86 -139 l25 -86 -24 -27 c-27 -32 -28 -48 -8 -106 8 -23 15 -75 15 -114 0 -90 17 -120 64 -113 25 4 36 -1 57 -26 15 -18 30 -27 37 -23 19 11 14 78 -8 111 -25 38 -25 46 1 79 l21 27 25 -35 c28 -42 60 -47 110 -16 l33 20 -22 52 c-11 29 -29 81 -39 116 -13 47 -30 77 -68 119 -54 61 -56 67 -66 203 -8 116 -31 209 -60 245 -22 28 -24 29 -37 12 -8 -10 -45 -27 -83 -38 -111 -31 -155 -23 -155 26 0 31 -19 46 -43 34 -16 -9 -24 -5 -49 25 -20 24 -38 36 -55 36 -19 0 -24 -4 -20 -17z M3648 4712 c-51 -31 -32 -45 46 -36 50 6 56 9 56 30 0 21 -5 24 -37 24 -21 0 -50 -8 -65 -18z M3430 4645 c0 -18 -5 -25 -20 -25 -23 0 -38 -58 -22 -85 11 -20 -5 -75 -25 -88 -24 -15 -13 -56 33 -122 38 -54 45 -71 39 -93 l-7 -27 -21 26 c-12 14 -30 29 -39 32 -9 3 -22 24 -29 46 -11 37 -26 50 -41 36 -5 -6 20 -99 46 -170 l14 -40 -47 -50 c-25 -27 -56 -63 -69 -79 -18 -23 -25 -26 -36 -17 -25 21 -91 -32 -120 -95 -17 -38 -36 -61 -61 -75 -22 -14 -34 -27 -31 -35 3 -8 8 -20 11 -26 3 -7 1 -20 -5 -28 -7 -12 -12 -12 -22 -2 -22 22 -35 13 -77 -52 -25 -38 -97 -116 -177 -192 -89 -83 -143 -143 -159 -174 -13 -25 -31 -52 -39 -59 -9 -8 -16 -24 -16 -37 0 -23 -3 -24 -63 -24 -56 0 -67 -3 -88 -26 -13 -14 -34 -30 -46 -35 -12 -4 -31 -25 -41 -45 -12 -22 -31 -41 -49 -48 -30 -11 -249 -240 -296 -311 -17 -24 -27 -53 -27 -75 0 -19 -9 -50 -20 -68 -21 -33 -26 -62 -12 -62 4 0 28 20 52 45 40 40 49 45 90 45 55 0 91 31 113 95 13 37 23 45 136 107 148 81 175 103 223 182 48 78 60 86 126 86 52 0 55 2 112 58 32 32 69 66 82 74 14 9 41 47 61 85 21 41 47 75 64 85 28 16 29 19 25 80 -4 55 -3 61 10 50 14 -11 17 -5 23 43 6 54 8 56 67 97 38 25 86 47 127 57 l66 17 45 86 c66 127 86 144 171 150 75 6 94 17 124 71 17 33 17 33 -14 84 -21 34 -31 63 -31 89 0 25 -9 52 -25 76 -27 40 -31 75 -13 124 8 23 8 43 0 75 -9 35 -8 48 5 69 15 26 14 30 -12 74 -31 52 -65 64 -65 21z M6634 4653 c-4 -10 -17 -43 -31 -73 -15 -33 -27 -83 -30 -125 -4 -59 -13 -85 -55 -165 -28 -52 -73 -151 -102 -220 -28 -69 -87 -183 -130 -255 -100 -164 -121 -251 -100 -409 l7 -47 38 37 c31 30 39 45 39 74 0 26 11 53 40 93 27 39 51 94 76 174 47 150 96 219 181 254 38 15 64 34 83 60 l27 38 -14 88 c-12 76 -12 95 2 155 8 37 15 104 15 150 1 46 5 103 10 128 4 25 8 45 7 46 -1 1 -14 4 -30 8 -21 5 -29 2 -33 -11z M6075 4399 c-28 -10 -67 -18 -87 -19 -27 0 -44 -7 -63 -27 -24 -25 -26 -34 -21 -82 5 -52 4 -54 -40 -101 -24 -26 -44 -56 -44 -66 0 -11 9 -50 20 -88 10 -38 22 -95 26 -126 6 -51 3 -63 -15 -89 -14 -20 -31 -31 -46 -31 -16 0 -30 -10 -41 -29 -15 -26 -26 -30 -91 -40 -41 -6 -85 -11 -98 -11 -19 0 -26 -7 -34 -37 -6 -21 -11 -61 -11 -89 0 -50 2 -53 91 -155 65 -75 98 -105 117 -107 56 -7 106 -57 163 -161 24 -45 42 -67 56 -69 64 -9 173 56 173 104 0 13 9 38 20 56 37 60 20 110 -62 186 l-43 41 18 49 c10 31 17 79 17 128 0 86 10 114 74 218 27 45 36 71 36 103 0 45 18 90 43 112 9 6 33 58 55 114 76 194 67 222 -78 229 -65 3 -98 0 -135 -13z M5651 4178 c-60 -73 -68 -96 -49 -135 12 -24 19 -28 48 -25 36 2 70 32 70 60 0 9 10 36 21 60 17 34 20 51 13 71 -17 47 -46 38 -103 -31z M7782 4077 c-36 -17 -60 -74 -63 -153 -3 -55 0 -75 13 -87 8 -9 19 -38 23 -64 8 -58 29 -93 54 -93 26 0 31 19 31 114 0 70 -3 86 -20 101 -23 21 -26 62 -5 89 15 20 20 63 9 90 -7 18 -11 19 -42 3z M6795 3866 c-11 -7 -36 -18 -56 -25 -32 -10 -37 -17 -43 -50 -8 -54 -34 -81 -112 -121 -38 -19 -71 -36 -73 -37 -2 -2 4 -23 14 -48 18 -49 15 -59 -30 -97 l-20 -18 22 0 c12 0 34 5 50 11 15 6 99 11 185 12 l157 2 48 46 c33 33 60 49 86 53 35 7 38 10 31 29 -4 12 -9 50 -10 85 -2 78 -15 95 -64 87 -35 -6 -38 -4 -50 26 -21 49 -94 74 -135 45z M7470 3845 c0 -34 26 -72 62 -91 38 -20 44 -13 30 34 -13 42 -34 66 -69 76 -20 6 -23 4 -23 -19z M8083 3783 c-38 -36 -63 -71 -63 -90 0 -14 108 -83 133 -86 18 -2 23 4 25 31 2 24 -1 32 -12 32 -20 0 -20 4 -1 40 14 27 14 33 1 58 -28 54 -39 56 -83 15z M7642 3654 c-22 -15 -23 -21 -16 -82 4 -41 19 -93 41 -140 43 -94 73 -203 73 -263 0 -35 -5 -51 -23 -67 -43 -40 -134 -23 -170 31 -11 17 -28 26 -51 29 l-36 4 0 -42 c0 -72 -12 -134 -26 -134 -30 0 -63 24 -83 61 -19 34 -27 39 -58 39 -49 0 -113 -20 -113 -36 0 -7 5 -25 12 -39 9 -19 8 -34 -2 -66 -12 -35 -12 -50 1 -99 18 -69 9 -95 -33 -104 -64 -13 -104 -7 -128 19 -29 31 -70 32 -98 3 -11 -13 -35 -54 -52 -93 -30 -66 -31 -72 -16 -102 l15 -31 -87 -12 c-135 -18 -141 -19 -148 -43 -3 -15 -24 -30 -61 -46 -31 -14 -70 -40 -86 -58 -17 -18 -34 -33 -39 -33 -19 0 -5 30 28 60 32 28 39 42 58 128 l23 97 -21 62 c-21 67 -42 84 -101 82 -40 -1 -101 14 -155 39 -51 24 -60 21 -61 -16 0 -20 -12 -36 -49 -64 -44 -34 -56 -38 -107 -38 -65 0 -123 -27 -123 -57 -1 -10 -7 -36 -15 -57 -10 -29 -11 -45 -3 -60 17 -31 -26 -61 -109 -76 -37 -7 -130 -37 -205 -67 -75 -29 -150 -56 -167 -59 -21 -5 -42 -22 -70 -59 l-39 -52 20 -83 c23 -89 24 -84 -28 -115 -12 -8 -18 -28 -22 -70 -3 -33 -11 -69 -18 -80 -8 -11 -14 -27 -14 -36 0 -9 -14 -22 -31 -29 -41 -17 -53 -52 -39 -110 19 -75 44 -97 127 -110 40 -6 77 -9 82 -6 5 3 12 22 16 43 4 20 15 54 26 75 10 20 19 53 19 71 0 19 7 40 15 47 8 7 22 37 31 66 12 44 23 60 60 86 35 25 44 37 44 61 0 21 -6 30 -21 34 -20 6 -20 6 2 29 12 13 28 24 34 24 6 0 22 11 34 24 25 26 94 40 123 25 14 -8 18 -22 18 -68 0 -54 3 -62 30 -85 26 -22 34 -24 56 -14 18 9 27 9 36 0 8 -8 19 -5 40 13 16 14 34 25 39 25 5 0 9 13 9 28 0 27 34 72 45 60 3 -2 8 -18 11 -35 5 -26 2 -32 -16 -38 -20 -6 -20 -8 -5 -25 13 -15 27 -17 68 -13 l52 4 18 -40 c10 -22 32 -50 48 -62 29 -20 31 -20 50 -4 26 25 25 30 -21 82 l-40 46 35 38 c19 22 35 41 35 44 0 3 -7 22 -15 42 -27 64 -25 66 68 58 68 -6 88 -12 117 -35 41 -33 122 -71 204 -96 53 -16 63 -25 105 -81 37 -51 51 -62 75 -63 26 0 28 -2 21 -27 -3 -16 -38 -70 -77 -121 -38 -52 -76 -109 -84 -127 -7 -19 -18 -36 -24 -40 -6 -4 -17 -23 -26 -43 l-15 -37 38 -32 39 -32 -10 -75 -9 -75 41 -68 c22 -37 69 -95 104 -129 61 -59 70 -64 281 -147 260 -103 297 -109 353 -53 23 23 34 43 34 63 0 38 40 64 65 43 30 -25 36 -47 20 -77 -8 -15 -15 -32 -15 -36 0 -5 -10 -17 -22 -26 -27 -23 -20 -52 26 -113 20 -26 36 -59 38 -79 5 -55 32 -50 105 23 44 44 67 75 74 103 6 22 28 58 49 81 25 27 41 57 50 93 13 55 11 72 -22 223 l-21 98 -62 39 c-67 41 -108 89 -119 135 -12 50 80 205 122 206 28 0 62 48 62 87 0 34 7 46 55 93 l55 54 0 -41 c0 -36 5 -45 45 -77 25 -21 45 -45 45 -54 0 -9 9 -49 21 -88 17 -56 27 -74 50 -88 28 -17 29 -20 29 -95 0 -94 21 -163 66 -213 30 -34 33 -35 38 -15 3 12 6 79 6 148 0 99 -3 129 -15 139 -16 13 -31 77 -21 87 3 4 22 -12 42 -35 50 -59 71 -55 64 13 -1 11 -6 24 -11 29 -15 17 -10 26 15 26 36 0 71 34 91 87 10 26 35 74 57 105 47 70 51 121 13 166 -22 26 -25 39 -25 109 l0 80 -39 18 c-22 9 -54 32 -71 50 l-32 33 21 64 c12 35 25 91 28 126 l6 62 -37 0 c-45 0 -56 21 -32 60 20 36 20 55 -1 92 -24 40 -78 71 -133 78 -51 6 -68 33 -28 46 13 4 44 28 69 54 25 26 52 49 59 52 10 3 -4 35 -50 114 -54 92 -65 118 -68 167 -4 54 -6 57 -31 57 -14 1 -38 6 -53 13 -33 15 -78 79 -78 112 0 19 -13 31 -63 60 -35 19 -69 35 -75 35 -5 0 -55 34 -110 75 -55 41 -104 75 -109 75 -5 0 -19 -7 -31 -16z M7143 3248 c-6 -7 -14 -29 -18 -49 -6 -31 -3 -39 16 -53 48 -33 89 -12 89 46 0 13 -6 32 -12 41 -18 22 -62 31 -75 15z M6347 3205 c-27 -33 -28 -35 -11 -60 13 -19 25 -25 54 -25 21 0 47 8 59 18 l22 17 -42 43 c-23 23 -44 42 -48 41 -3 0 -19 -16 -34 -34z M1940 2469 c-9 -16 -9 -24 -1 -32 12 -12 31 6 31 30 0 22 -19 24 -30 2z M1724 2310 c-49 -19 -32 -101 23 -115 30 -7 26 -10 40 38 20 67 -7 100 -63 77z M5247 1440 c-26 -16 -60 -30 -76 -30 -15 0 -35 -8 -44 -18 -16 -17 -14 -20 29 -56 l45 -38 -47 -50 c-41 -44 -45 -52 -32 -65 14 -13 29 -8 136 44 83 40 125 66 136 85 12 19 31 31 62 39 63 16 56 35 -18 48 -50 9 -67 16 -86 41 -29 38 -46 38 -105 0z M4546 953 c-34 -25 -37 -31 -32 -62 6 -42 6 -41 57 -52 32 -8 53 -6 91 7 35 11 65 14 100 10 28 -4 64 -2 82 4 28 9 32 14 28 39 -4 32 -11 35 -105 47 -35 4 -61 12 -64 20 -3 10 -23 14 -62 14 -45 0 -64 -5 -95 -27z M3893 414 c-65 -32 -163 -117 -163 -142 0 -18 142 26 169 52 20 20 38 26 69 26 49 0 59 14 45 63 -12 43 -33 43 -120 1z M3493 83 c0 -38 5 -71 11 -75 23 -16 34 -6 40 38 4 34 2 53 -11 75 -28 48 -41 36 -40 -38z";
  var PH_TF = {tx:0, ty:1024, sx:0.1, sy:-0.1};                 // potrace <g> transform
  var PH_BB = {x0:-33, y0:1.6, w:841.3, h:1063.3};             // bbox after the transform

  var W=720,H=560, sites,cells,hot,hot2,maxD,contours, phPath, mask, fbx,fby,fbw,fbh, hoverIdx=-1, mx=0,my=0,mOver=false;
  var DPRBASE=Math.min(window.devicePixelRatio||1,2), renderDpr=DPRBASE;
  var labelAlpha=0, dustOn=false, particles=[], dustSprite=null;   // cinematic: value stamps + forming-dust
  var perCell=0.30, lastStart=0.66, seed=20260625;
  function rnd(){ seed=(seed*1664525+1013904223)&0x7fffffff; return seed/0x7fffffff; }
  function lerp(a,b,t){return a+(b-a)*t;}
  function easeOut(t){return 1-Math.pow(1-t,3);}
  function easeInOut(t){return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
  function easeIO3(t){return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
  function makeDust(){ var d=document.createElement("canvas"); d.width=d.height=48; var g=d.getContext("2d");
    var rg=g.createRadialGradient(24,24,0,24,24,24); rg.addColorStop(0,"rgba(198,152,72,0.55)"); rg.addColorStop(0.45,"rgba(150,108,48,0.26)"); rg.addColorStop(1,"rgba(120,80,30,0)");
    g.fillStyle=rg; g.fillRect(0,0,48,48); return d; }
  function spawnDust(x,y,now){ if(!dustSprite) dustSprite=makeDust();
    var n=2+(rnd()*3|0); for(var i=0;i<n;i++){ particles.push({x:x+(rnd()-0.5)*10,y:y+(rnd()-0.5)*8,vx:(rnd()-0.5)*0.02,vy:-(0.012+rnd()*0.028),born:now,life:680+rnd()*640,r:4+rnd()*7}); }
    if(particles.length>150) particles.splice(0,particles.length-150); }
  function clip(poly,ax,ay,bx,by){
    var mx=(ax+bx)/2,my=(ay+by)/2,nx=bx-ax,ny=by-ay,out=[];
    for(var i=0;i<poly.length;i++){var c=poly[i],n=poly[(i+1)%poly.length];
      var dc=(c.x-mx)*nx+(c.y-my)*ny,dn=(n.x-mx)*nx+(n.y-my)*ny;
      if(dc<=0)out.push(c);
      if((dc<0)!==(dn<0)){var t=dc/(dc-dn);out.push({x:c.x+t*(n.x-c.x),y:c.y+t*(n.y-c.y)});}
    }
    return out;
  }
  function valueColor(v,alpha){
    var c1=[236,217,176],c2=[184,137,58],c3=[138,90,30],r,g,b;
    if(v<0.5){var t=v/0.5;r=lerp(c1[0],c2[0],t);g=lerp(c1[1],c2[1],t);b=lerp(c1[2],c2[2],t);}
    else{var t2=(v-0.5)/0.5;r=lerp(c2[0],c3[0],t2);g=lerp(c2[1],c3[1],t2);b=lerp(c2[2],c3[2],t2);}
    return "rgba("+(r|0)+","+(g|0)+","+(b|0)+","+alpha+")";
  }
  function ptIn(px,py,poly){var inside=false;for(var i=0,j=poly.length-1;i<poly.length;j=i++){var xi=poly[i].x,yi=poly[i].y,xj=poly[j].x,yj=poly[j].y;if(((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi))inside=!inside;}return inside;}
  function inMask(x,y){ x|=0; y|=0; if(x<0||y<0||x>=W||y>=H||!mask) return false; return mask[(y*W+x)*4+3]>24; }

  function measure(){
    W=Math.max(140, Math.round(canvas.getBoundingClientRect().width||700));
    if(window.innerWidth<880) H=Math.round(W*1.2);             // mobile: portrait, fits the archipelago
    else H=Math.max(440, ledeEl?Math.round(ledeEl.getBoundingClientRect().height):620);
    var dpr=renderDpr;
    canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function buildPH(){
    var pad=Math.max(22, Math.min(W,H)*0.065);
    var s=Math.min((W-2*pad)/PH_BB.w, (H-2*pad)/PH_BB.h);
    fbw=PH_BB.w*s; fbh=PH_BB.h*s; fbx=(W-fbw)/2 - fbw*0.03; fby=(H-fbh)/2;
    var offX=fbx - PH_BB.x0*s, offY=fby - PH_BB.y0*s;
    var Mg=new DOMMatrix().translate(PH_TF.tx,PH_TF.ty).scale(PH_TF.sx,PH_TF.sy);
    var Mfit=new DOMMatrix().translate(offX,offY).scale(s);
    var total=Mfit.multiply(Mg);
    var src=new Path2D(PH_D);
    phPath=new Path2D(); phPath.addPath(src, total);
    // rasterize a fill mask → robust land test for hover + parcel membership
    var off=document.createElement("canvas"); off.width=W; off.height=H;
    var o=off.getContext("2d"); o.fillStyle="#000"; o.fill(phPath);
    mask=o.getImageData(0,0,W,H).data;
  }

  function build(){
    measure(); seed=20260625; hoverIdx=-1; particles=[];
    buildPH();
    hot ={x:fbx+fbw*0.52, y:fby+fbh*0.255};   // Metro Manila (north Luzon)
    hot2={x:fbx+fbw*0.60, y:fby+fbh*0.625};   // Cebu (central Visayas)
    maxD=Math.hypot(fbw,fbh);
    var cols=Math.max(7,Math.round(fbw/45)), rows=Math.max(11,Math.round(fbh/45));
    sites=[];
    for(var gy=0; gy<rows; gy++) for(var gx=0; gx<cols; gx++){
      sites.push({x:fbx+(gx+0.5)/cols*fbw+(rnd()-0.5)*(fbw/cols)*0.82,
                  y:fby+(gy+0.5)/rows*fbh+(rnd()-0.5)*(fbh/rows)*0.82});
    }
    var rect=[{x:fbx-6,y:fby-6},{x:fbx+fbw+6,y:fby-6},{x:fbx+fbw+6,y:fby+fbh+6},{x:fbx-6,y:fby+fbh+6}];
    cells=[];
    for(var i=0;i<sites.length;i++){
      var poly=rect.slice();
      for(var j=0;j<sites.length&&poly.length;j++){ if(i===j) continue; poly=clip(poly,sites[i].x,sites[i].y,sites[j].x,sites[j].y); }
      if(poly.length>2){
        var cx=0,cy=0,a=0;
        for(var k=0;k<poly.length;k++){var p0=poly[k],p1=poly[(k+1)%poly.length],cr=p0.x*p1.y-p1.x*p0.y;a+=cr;cx+=(p0.x+p1.x)*cr;cy+=(p0.y+p1.y)*cr;}
        a*=0.5;cx/=(6*a);cy/=(6*a);
        if(!inMask(cx,cy)) continue;                 // keep only parcels that fall on land
        cells.push({poly:poly,cx:cx,cy:cy});
      }
    }
    cells.forEach(function(c){
      var d1=Math.hypot(c.cx-hot.x,c.cy-hot.y), d2=Math.hypot(c.cx-hot2.x,c.cy-hot2.y);
      var v=Math.pow(Math.max(0,1-Math.min(d1,d2*1.08)/(maxD*0.5)),1.2)+(rnd()-0.5)*0.10;
      c.v=Math.max(0,Math.min(1,v)); c.order=Math.min(d1,d2);
      c.peso=Math.round((2400+118000*Math.pow(c.v,1.35))/100)*100;
      c.cls=c.v>0.62?["CR","commercial"]:(c.v>0.34?["RR","residential"]:["A","agricultural"]);
    });
    cells.sort(function(a,b){return a.order-b.order;});
    cells.forEach(function(c,i){ c.t0=(i/(cells.length-1||1))*lastStart; c.dusted=false; c.lab=(i%2===0)&&c.v>0.10; c.vEl=null; });
    contours=[];
    [hot,hot2].forEach(function(ctr,ci){
      for(var k=0;k<6;k++){
        var r0=24+k*22, phase=rnd()*6.283, phase2=rnd()*6.283, amp=r0*0.08+3, pts=[], step=Math.PI*2/52;
        for(var ang=0;ang<=Math.PI*2+0.0001;ang+=step){var wob=Math.sin(ang*3+phase)*amp+Math.sin(ang*2-phase2)*amp*0.5,rad=r0+wob;pts.push({x:ctr.x+Math.cos(ang)*rad,y:ctr.y+Math.sin(ang)*rad});}
        var segs=[],total=0; for(var s2=0;s2<pts.length-1;s2++){var L=Math.hypot(pts[s2+1].x-pts[s2].x,pts[s2+1].y-pts[s2].y);segs.push(L);total+=L;}
        contours.push({pts:pts,segs:segs,total:total,t0:0.1+(k/6)*0.34+ci*0.05,warm:k<3});
      }
    });
  }

  function strokeProg(pts,segs,total,frac){
    var target=total*frac,acc=0; ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
    for(var i=0;i<pts.length-1;i++){ if(acc+segs[i]<=target){ctx.lineTo(pts[i+1].x,pts[i+1].y);acc+=segs[i];} else {var t=(target-acc)/segs[i];ctx.lineTo(pts[i].x+(pts[i+1].x-pts[i].x)*t,pts[i].y+(pts[i+1].y-pts[i].y)*t);break;} }
  }
  function drawContours(progress){
    for(var i=0;i<contours.length;i++){var cn=contours[i],local=(progress-cn.t0)/0.34; if(local<=0)continue; local=Math.min(1,local);
      strokeProg(cn.pts,cn.segs,cn.total,local);
      ctx.strokeStyle=cn.warm?"rgba(184,137,58,"+(0.185*local)+")":"rgba(22,34,58,"+(0.09*local)+")"; ctx.lineWidth=1;ctx.lineJoin="round";ctx.stroke();
    }
  }
  function cellPath(poly){ctx.beginPath();ctx.moveTo(poly[0].x,poly[0].y);for(var i=1;i<poly.length;i++)ctx.lineTo(poly[i].x,poly[i].y);ctx.closePath();}
  function drawCellBorder(c,p){
    var poly=c.poly,segs=[],total=0; for(var i=0;i<poly.length;i++){var p0=poly[i],p1=poly[(i+1)%poly.length],L=Math.hypot(p1.x-p0.x,p1.y-p0.y);segs.push(L);total+=L;}
    var target=total*p,acc=0; ctx.beginPath();ctx.moveTo(poly[0].x,poly[0].y);
    for(var i=0;i<poly.length;i++){var p0=poly[i],p1=poly[(i+1)%poly.length]; if(acc+segs[i]<=target){ctx.lineTo(p1.x,p1.y);acc+=segs[i];} else {var t=(target-acc)/segs[i];ctx.lineTo(p0.x+(p1.x-p0.x)*t,p0.y+(p1.y-p0.y)*t);break;}}
    ctx.strokeStyle="rgba(22,34,58,"+(0.26+0.16*p)+")";ctx.lineWidth=0.8;ctx.lineJoin="round";ctx.stroke();
  }
  function fillCell(c,a){ cellPath(c.poly); ctx.fillStyle=valueColor(c.v, a*(0.36+0.54*c.v)); ctx.fill(); }

  function render(progress, now){
    ctx.clearRect(0,0,W,H);

    // interior — contours + value-parcels, clipped to the country
    ctx.save(); ctx.clip(phPath);
    ctx.strokeStyle="rgba(22,34,58,0.045)";ctx.lineWidth=1;
    var gc=Math.max(5,Math.round(fbw/56)),gr=Math.max(6,Math.round(fbh/56)),X,Y;
    for(var gx=1;gx<gc;gx++){X=fbx+gx/gc*fbw;ctx.beginPath();ctx.moveTo(X,0);ctx.lineTo(X,H);ctx.stroke();}
    for(var gy=1;gy<gr;gy++){Y=fby+gy/gr*fbh;ctx.beginPath();ctx.moveTo(0,Y);ctx.lineTo(W,Y);ctx.stroke();}
    drawContours(progress);
    for(var i=0;i<cells.length;i++){var c=cells[i],local=(progress-c.t0)/perCell; if(local<=0)continue; local=Math.min(1,local);
      drawCellBorder(c,Math.min(1,local/0.55));
      var fp=Math.max(0,(local-0.30)/0.70); if(fp>0) fillCell(c,easeOut(Math.min(1,fp)));
      if(dustOn && !c.dusted && now!=null && local>0.02){ c.dusted=true; spawnDust(c.cx,c.cy,now); }   // a tile forms → it kicks up dust
    }
    var conn=Math.max(0,(progress-0.72)/0.28);
    if(conn>0){ [hot,hot2].forEach(function(h){
      ctx.beginPath();ctx.arc(h.x,h.y,3,0,6.2832);ctx.fillStyle="rgba(22,34,58,"+conn+")";ctx.fill();
      ctx.beginPath();ctx.arc(h.x,h.y,6.5,0,6.2832);ctx.strokeStyle="rgba(138,90,30,"+(0.7*conn)+")";ctx.lineWidth=1.2;ctx.stroke();
    }); }
    if(progress>=1 && now!=null){
      for(var hi=0;hi<2;hi++){var h=hi?hot2:hot,pulse=0.5+0.5*Math.sin(now*0.0012+hi*2.3);
        var rg=ctx.createRadialGradient(h.x,h.y,0,h.x,h.y,44+15*pulse);
        rg.addColorStop(0,"rgba(184,137,58,"+(0.10+0.06*pulse)+")");rg.addColorStop(1,"rgba(184,137,58,0)");
        ctx.fillStyle=rg;ctx.beginPath();ctx.arc(h.x,h.y,44+15*pulse,0,6.2832);ctx.fill();}
      var period=9000, sp=(now%period)/period, sweepY=fby-50+sp*(fbh+100);
      var sg=ctx.createLinearGradient(0,sweepY-58,0,sweepY+58);
      sg.addColorStop(0,"rgba(255,250,240,0)");sg.addColorStop(0.5,"rgba(255,250,240,0.16)");sg.addColorStop(1,"rgba(255,250,240,0)");
      ctx.fillStyle=sg;ctx.fillRect(0,sweepY-58,W,116);
    }
    if(progress>=1 && mOver && !reduce){   // cursor spotlight: parcels near the mouse brighten, a warm light follows
      var SPR=128;
      for(var spi=0;spi<cells.length;spi++){ var spc=cells[spi], spd=Math.hypot(spc.cx-mx,spc.cy-my); if(spd<SPR){ var spb=1-spd/SPR; cellPath(spc.poly); ctx.fillStyle=valueColor(spc.v, 0.5*spb*spb); ctx.fill(); } }
      var spg=ctx.createRadialGradient(mx,my,0,mx,my,SPR*1.15);
      spg.addColorStop(0,"rgba(196,150,70,0.18)"); spg.addColorStop(1,"rgba(196,150,70,0)");
      ctx.fillStyle=spg; ctx.beginPath(); ctx.arc(mx,my,SPR*1.15,0,6.2832); ctx.fill();
    }
    if(progress>=1 && hoverIdx>=0 && cells[hoverIdx]){var hc=cells[hoverIdx];cellPath(hc.poly);ctx.fillStyle=valueColor(hc.v,0.95);ctx.fill();ctx.lineWidth=1.6;ctx.strokeStyle="rgba(138,90,30,0.95)";ctx.stroke();}
    ctx.restore();

    // coastline inks itself — a top→bottom wipe reveals the archipelago outline
    var coastP=Math.min(1, progress/0.52);
    if(coastP>0){
      ctx.save();
      ctx.beginPath(); ctx.rect(0,0,W, fby + fbh*coastP + 8); ctx.clip();
      ctx.lineJoin="round"; ctx.lineCap="round";
      ctx.strokeStyle="rgba(184,137,58,0.42)"; ctx.lineWidth=3.4; ctx.stroke(phPath);
      ctx.strokeStyle="rgba(22,34,58,0.82)"; ctx.lineWidth=1.3; ctx.stroke(phPath);
      ctx.restore();
    }
    // forming-dust drifts up off the land as tiles materialize
    if(particles.length && now!=null && dustSprite){
      for(var pp=particles.length-1;pp>=0;pp--){ var pa=particles[pp], age=now-pa.born;
        if(age>pa.life){ particles.splice(pp,1); continue; }
        var lp=age/pa.life, dx=pa.x+pa.vx*age, dy=pa.y+pa.vy*age-10*lp, rr=pa.r*(1+lp*1.7);
        ctx.globalAlpha=(1-lp)*0.6; ctx.drawImage(dustSprite, dx-rr, dy-rr, rr*2, rr*2);
      }
      ctx.globalAlpha=1;
    }
    return progress>=1;
  }

  function showPins(){
    var p1=document.getElementById("pin1"), p2=document.getElementById("pin2");
    if(p1){ p1.style.left=hot.x+"px"; p1.style.top=hot.y+"px"; setTimeout(function(){p1.classList.add("show");},240); }
    if(p2){ p2.style.left=hot2.x+"px"; p2.style.top=hot2.y+"px"; setTimeout(function(){p2.classList.add("show");},880); }
  }

  _on(canvas,"mousemove", function(e){
    var r=canvas.getBoundingClientRect();
    var px=(e.clientX-r.left)/r.width*W, py=(e.clientY-r.top)/r.height*H, found=-1;
    mx=px; my=py; mOver=true;
    if(inMask(px,py)){ for(var i=0;i<cells.length;i++){ if(ptIn(px,py,cells[i].poly)){found=i;break;} } }
    hoverIdx=found;
    if(found>=0 && tagEl && stageEl){var c=cells[found],sr=stageEl.getBoundingClientRect();
      tagEl.innerHTML='<b>₱'+c.peso.toLocaleString("en-PH")+'</b> <small>/sqm</small><i>'+c.cls[0]+' · '+c.cls[1]+'</i>';
      tagEl.style.left=(e.clientX-sr.left)+"px"; tagEl.style.top=(e.clientY-sr.top)+"px"; tagEl.classList.add("on");
    } else if(tagEl){ tagEl.classList.remove("on"); }
    if(reduce) render(1,null);
  });
  _on(canvas,"mouseleave", function(){ hoverIdx=-1; mOver=false; if(tagEl)tagEl.classList.remove("on"); if(reduce) render(1,null); });

  if(wantAmbient && stageEl && frameEl){
    _on(stageEl,"mousemove", function(e){var r=stageEl.getBoundingClientRect();frameEl.style.transform="rotateX("+(-((((e.clientY-r.top)/r.height)-0.5)*3.2))+"deg) rotateY("+((((e.clientX-r.left)/r.width)-0.5)*4.2)+"deg)";});
    _on(stageEl,"mouseleave", function(){frameEl.style.transform="rotateX(0deg) rotateY(0deg)";});
  }

  var cinemaOK = !reduce && window.innerWidth>=880 && stageEl && ("requestAnimationFrame" in window);
  if(cinemaOK) renderDpr=Math.min((window.devicePixelRatio||1)*2.0, 2.4);   // crisp while deeply zoomed
  build();
  if(reduce){ render(1,null); showPins(); }
  else if(cinemaOK){ cinema(); }
  else{
    var start=null, DUR=3500, shown=false;
    function loop(ts){ if(start===null)start=ts; var p=Math.min(1,(ts-start)/DUR); render(p,ts); if(p>=1&&!shown){shown=true;showPins();} if(p<1||wantAmbient) _raf=requestAnimationFrame(loop); }
    _raf=requestAnimationFrame(function(){_raf=requestAnimationFrame(loop);});
  }

  // ---- cinematic title sequence: zoom into the building map, crane down to Mindanao, pull back into the layout ----
  function cinema(){
    var root=document.documentElement, bg=null, vlayer=null, title=null, finished=false;
    var _cRaf=0, _cTimers=[], _cOff=[];
    function AF(fn){ _cRaf=requestAnimationFrame(fn); return _cRaf; }
    function ON(t,ev,fn,op){ t.addEventListener(ev,fn,op); _cOff.push(function(){try{t.removeEventListener(ev,fn,op);}catch(e){}}); }
    function TO(fn,ms){ var id=setTimeout(fn,ms); _cTimers.push(id); return id; }
    function nowts(){ try{return performance.now();}catch(e){return null;} }
    function ambient(ts){ render(1,ts); if(wantAmbient) AF(ambient); }
    var _cRaf2=0;
    function startCounts(){   // stats tick up from zero
      var nums=ledeEl?[].slice.call(ledeEl.querySelectorAll(".stats .num")):[];
      if(!nums.length) return;
      var parsed=nums.map(function(el){ var clean=el.textContent.replace(/,/g,""); var mm=clean.match(/(\d+)/); return {el:el,target:mm?parseInt(mm[1],10):0,suf:clean.replace(/[0-9]/g,"")}; });
      var t0=null, DURc=1350;
      function step(ts){ if(t0===null)t0=ts; var p=Math.min(1,(ts-t0)/DURc), e=1-Math.pow(1-p,3);
        for(var i=0;i<parsed.length;i++){ parsed[i].el.textContent=Math.round(parsed[i].target*e).toLocaleString("en-US")+parsed[i].suf; }
        if(p<1) _cRaf2=requestAnimationFrame(step); }
      _cRaf2=requestAnimationFrame(step);
    }
    function clean(){ try{cancelAnimationFrame(_cRaf);}catch(e){} _cTimers.forEach(function(t){clearTimeout(t);}); _cOff.forEach(function(f){f();}); try{root.classList.remove("cinema");}catch(e){} try{if(bg&&bg.parentNode)bg.parentNode.removeChild(bg);}catch(e){} try{if(vlayer&&vlayer.parentNode)vlayer.parentNode.removeChild(vlayer);}catch(e){} try{if(title&&title.parentNode)title.parentNode.removeChild(title);}catch(e){} try{cancelAnimationFrame(_cRaf2);}catch(e){} try{if(ledeEl)ledeEl.classList.remove("cin-text");}catch(e){} }
    if(typeof _cl!=="undefined") _cl.push(clean);
    try{
      bg=document.createElement("div"); bg.className="cine-bg"; bg.setAttribute("aria-hidden","true");
      (document.querySelector(".wrap")||document.body).appendChild(bg);
      root.classList.add("cinema");
      // headline → word spans for a word-by-word reveal; arm the left column
      if(ledeEl){ var _h1=ledeEl.querySelector("h1");
        if(_h1){ (function wrap(el){ var ns=[].slice.call(el.childNodes); el.innerHTML=""; ns.forEach(function(n){ if(n.nodeType===3){ n.textContent.split(/(\s+)/).forEach(function(w){ if(w==="")return; if(/^\s+$/.test(w)){el.appendChild(document.createTextNode(w));} else {var s=document.createElement("span");s.className="hw";s.textContent=w;el.appendChild(s);} }); } else if(n.nodeType===1){ wrap(n); el.appendChild(n); } }); })(_h1);
          var _hw=_h1.querySelectorAll(".hw"); for(var _i=0;_i<_hw.length;_i++){ _hw[_i].style.transitionDelay=(0.25+_i*0.058)+"s"; } }
        ledeEl.classList.add("cin-text");
      }
      var SR=stageEl.getBoundingClientRect();
      var cx=SR.left+SR.width/2, cy=SR.top+SR.height/2, vw=window.innerWidth, vh=window.innerHeight, H0=SR.height;
      var S0=2.45, TILT=55, PSP=900, BUILD=6600, HOLD=160, OUT=1240, t0=null, outStart=null;
      var CX=vw/2-cx, CY=vh/2-cy;
      // tilted 3D camera: build the angled plane (perspective+rotateX), crane along it (translateY), then drop it on screen (translate)
      function tf(tx,ty,S,f,tilt){ var panY=(0.5-f)*H0*S; return "translate("+tx+"px,"+ty+"px) perspective("+PSP+"px) rotateX("+tilt+"deg) translateY("+panY+"px) scale("+S+")"; }
      // standing value labels: project each parcel through the same camera, place an UPRIGHT label there
      var CR=canvas.getBoundingClientRect(), offX=CR.left-SR.left, offY=CR.top-SR.top, stageW=SR.width, stageH=SR.height;
      vlayer=document.createElement("div"); vlayer.className="vlayer"; vlayer.setAttribute("aria-hidden","true");
      (document.querySelector(".wrap")||document.body).appendChild(vlayer);
      // cinematic brand title beside the building map (reuses the real nav logo so it works in artifact + app)
      title=document.createElement("div"); title.className="cine-title"; title.setAttribute("aria-hidden","true");
      var _brand="zonalvalue.ph", _lh="";   // split into letters for a letter-by-letter entrance
      for(var _bi=0;_bi<_brand.length;_bi++){ var _ch=_brand.charAt(_bi); _lh+='<span class="ct-l'+(_ch==="."?" dot":"")+'" style="transition-delay:'+(_bi*52)+'ms">'+_ch+'</span>'; }
      title.innerHTML='<div class="ct-logo">'+_lh+'</div><div class="ct-by">by</div>';
      var _navLogo=document.querySelector(".brand .fh-logo");
      if(_navLogo){ var _lg=_navLogo.cloneNode(true); _lg.className="fh-logo"; _lg.removeAttribute("style"); title.querySelector(".ct-by").appendChild(_lg); }
      (document.querySelector(".wrap")||document.body).appendChild(title);
      TO(function(){ if(title) title.classList.add("show"); }, 300);
      function fmtPeso(p){ return "₱"+(p>=1000?Math.round(p/1000)+"k":p); }
      function updateLabels(progress,S,f,tilt){
        var panY=(0.5-f)*H0*S, M;
        try{ M=new DOMMatrix("perspective("+PSP+"px) rotateX("+tilt+"deg) translateY("+panY+"px) scale("+S+")"); }catch(e){ return; }
        for(var i=0;i<cells.length;i++){ var c=cells[i]; if(!c.lab) continue;
          if((progress-c.t0)/perCell<=0.35) continue;
          if(!c.vEl){ var el=document.createElement("div"); el.className="vlabel"; el.textContent=fmtPeso(c.peso); vlayer.appendChild(el); el.offsetWidth; el.classList.add("show"); c.vEl=el; }
          var pt=M.transformPoint(new DOMPoint((offX+c.cx)-stageW/2,(offY+c.cy)-stageH/2,0,1)), w=pt.w||1;
          if(w>0.05){ c.vEl.style.left=(vw/2+pt.x/w)+"px"; c.vEl.style.top=(vh/2+pt.y/w)+"px"; }
        }
      }
      stageEl.style.transformOrigin="center center";
      stageEl.style.transform=tf(CX,CY,S0,0.10,TILT);
      function finish(){ if(finished)return; finished=true;
        labelAlpha=0; dustOn=false; particles.length=0;          // clean final state — no stamps, no dust
        if(vlayer&&vlayer.parentNode){vlayer.parentNode.removeChild(vlayer);} vlayer=null;
        if(title&&title.parentNode){title.parentNode.removeChild(title);} title=null;
        for(var vi=0;vi<cells.length;vi++) cells[vi].vEl=null;
        stageEl.style.transform=""; stageEl.style.transformOrigin="";
        renderDpr=DPRBASE; measure(); render(1, nowts());
        stageEl.style.position="relative"; stageEl.style.zIndex="9001";   // stay above the backdrop while it fades
        root.classList.remove("cinema");                                  // scroll unlocks, backdrop fades out
        if(frameEl) frameEl.classList.add("landed");                      // gold border draws + chrome animates in
        if(ledeEl) ledeEl.classList.add("in");                            // left column rises in, in step with the map
        TO(startCounts, 1300);                                            // stats tick up as they appear
        showPins();
        TO(function(){ stageEl.style.zIndex=""; stageEl.style.position=""; if(bg&&bg.parentNode)bg.parentNode.removeChild(bg); }, 820);
        if(wantAmbient) AF(ambient);
      }
      function frame(ts){
        if(finished) return;
        if(t0===null) t0=ts;
        var t=ts-t0;
        if(t<BUILD){
          dustOn=true; labelAlpha=1;                              // tiles kick up dust + peso values stamp on
          var p=t/BUILD; render(Math.min(1,p),ts);
          var f=lerp(0.10,0.90, easeInOut(Math.min(1,p/0.9)));     // crane down the tilted plane, reaching Mindanao near the end
          var S=S0+0.10*Math.sin(Math.min(1,p)*Math.PI);          // a gentle breath of push-in
          stageEl.style.transform=tf(CX,CY,S,f,TILT);
          updateLabels(Math.min(1,p),S,f,TILT);                  // values stand up on their tiles as the land forms
          AF(frame);
        } else if(t<BUILD+HOLD){
          dustOn=false; labelAlpha=1;                             // settle: dust dies down, values still standing
          render(1,ts); stageEl.style.transform=tf(CX,CY,S0,0.90,TILT); updateLabels(1,S0,0.90,TILT); AF(frame);   // hold on Mindanao a beat
        } else {
          if(outStart===null){ outStart=ts; if(vlayer) vlayer.classList.add("out"); if(title) title.classList.add("out"); }   // values + title vanish as the camera pulls back
          var q=Math.min(1,(ts-outStart)/OUT), e=easeIO3(q);
          dustOn=false; labelAlpha=1-e;                           // values vanish as the camera pulls back
          render(1,ts);
          // pull back AND flatten the tilt to 0, gliding into the upright layout
          stageEl.style.transform=tf(lerp(CX,0,e), lerp(CY,0,e), lerp(S0,1,e), lerp(0.90,0.5,e), lerp(TILT,0,e));
          if(q<1) AF(frame); else finish();
        }
      }
      AF(function(){ AF(frame); });
      function skip(){ finish(); }
      ON(window,"wheel",skip,{passive:true});
      ON(window,"touchmove",skip,{passive:true});
      ON(window,"keydown",skip);
      ON(root,"click",skip);
      TO(function(){ finish(); }, BUILD+HOLD+OUT+2600);   // failsafe: never leave the page stuck
    }catch(e){
      try{ root.classList.remove("cinema"); if(ledeEl)ledeEl.classList.remove("cin-text"); if(bg&&bg.parentNode)bg.parentNode.removeChild(bg); renderDpr=DPRBASE; measure(); render(1,null); showPins(); if(wantAmbient) AF(ambient); }catch(_){}
    }
  }

  return function(){ try{cancelAnimationFrame(_raf);}catch(e){} for(var _i=0;_i<_cl.length;_i++){ try{_cl[_i]();}catch(e){} } };
    })(); } catch (e) { console.error("intro engine:", e); }
    return () => { if (typeof cleanup === "function") cleanup(); };
  }, []);
  return (
    <div className="zv-intro-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div dangerouslySetInnerHTML={{ __html: MARKUP }} />
    </div>
  );
}
