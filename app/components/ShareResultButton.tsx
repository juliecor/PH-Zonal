"use client";

import { useRef, useState } from "react";
import { Share2, Check, Loader2 } from "lucide-react";
import html2canvas from "html2canvas-pro";

type Props = {
  title: string;            // e.g. "Barangay, City, Province"
  name: string;             // street / subdivision / barangay headline
  address: string;          // "Barangay · City · Province"
  valuePerSqm: number | null;
  classification?: string | null;
  hazardText?: string | null;
};

const peso = (n: number) => "₱" + Math.round(n).toLocaleString("en-PH");

/**
 * "Share" for a selected property — mirrors the mobile app: builds a branded ZV value
 * card (PNG) plus a text summary + link, then uses the native share sheet where available
 * (falls back to downloading the image + copying the summary/link).
 */
export default function ShareResultButton({ title, name, address, valuePerSqm, classification, hazardText }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const estimate = valuePerSqm != null ? valuePerSqm * 250 : null;
  const summary = [
    `📍 ${title}`,
    valuePerSqm != null ? `Zonal value: ${peso(valuePerSqm)}/sqm${classification ? ` (${classification})` : ""}` : "",
    estimate != null ? `≈ ${peso(estimate)} for 250 sqm · BIR-indexed` : "",
    hazardText ? `Geohazard: ${hazardText}` : "",
    "via zonalvalue.ph",
  ].filter(Boolean).join("\n");
  const url = "https://zonalvalue.ph";

  async function onShare() {
    if (busy) return;
    setBusy(true);
    try {
      let file: File | null = null;
      if (cardRef.current) {
        const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: null, useCORS: true });
        const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), "image/png"));
        if (blob) file = new File([blob], "zonalvalue.png", { type: "image/png" });
      }
      const nav = navigator as any;
      if (file && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: "ZonalValue.ph", text: summary, url });
      } else {
        if (file) {
          const href = URL.createObjectURL(file);
          const a = document.createElement("a");
          a.href = href; a.download = "zonalvalue.png"; a.click();
          setTimeout(() => URL.revokeObjectURL(href), 4000);
        }
        if (nav.share) {
          await nav.share({ title: "ZonalValue.ph", text: summary, url });
        } else {
          await navigator.clipboard?.writeText(`${summary}\n${url}`);
          setDone(true); setTimeout(() => setDone(false), 2200);
        }
      }
    } catch {
      /* user cancelled or share failed — no-op */
    } finally {
      setBusy(false);
    }
  }

  const NAVY = "#16276a", BLUE = "#155EEF", RED = "#E53935", INK = "#16223a";

  return (
    <>
      <button
        onClick={onShare}
        disabled={busy}
        className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-70"
        style={{ background: `linear-gradient(135deg, ${BLUE}, #0f49c4)`, boxShadow: "0 8px 18px -8px rgba(15,73,196,0.7)" }}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : done ? <Check size={16} /> : <Share2 size={16} />}
        {done ? "Copied to clipboard" : "Share this property"}
      </button>

      {/* Hidden branded card captured to PNG (rendered off-screen). */}
      <div style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none", opacity: 1 }} aria-hidden>
        <div ref={cardRef} style={{ width: 620, background: "#ffffff", borderRadius: 22, overflow: "hidden", fontFamily: "'Outfit', system-ui, sans-serif" }}>
          {/* header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: NAVY, padding: "18px 26px" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>
              zonalvalue<span style={{ color: RED }}>.</span>ph
            </div>
            <div style={{ color: "#c6d0ea", fontSize: 13, fontWeight: 800, letterSpacing: "1.4px" }}>BIR ZONAL VALUE</div>
          </div>

          {/* body */}
          <div style={{ padding: "22px 26px 6px" }}>
            <div style={{ fontSize: 12, letterSpacing: "1.6px", fontWeight: 800, color: "#8a93a8" }}>LOCATION</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: INK, marginTop: 5, lineHeight: 1.15, letterSpacing: "-0.4px" }}>{name || "Selected property"}</div>
            {!!address && <div style={{ fontSize: 15, color: "#5a6079", marginTop: 5 }}>{address}</div>}

            <div style={{ background: NAVY, borderRadius: 18, padding: "18px 22px", marginTop: 18 }}>
              <div style={{ color: "#9fc0ff", fontSize: 12, fontWeight: 800, letterSpacing: "1.6px" }}>ZONAL VALUE</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginTop: 4 }}>
                <div style={{ color: "#fff", fontSize: 44, fontWeight: 800, letterSpacing: "-1.2px", lineHeight: 1 }}>
                  {valuePerSqm != null ? peso(valuePerSqm) : "Not Appraised"}
                </div>
                {valuePerSqm != null && <div style={{ color: "#c6d0ea", fontSize: 17, fontWeight: 600, marginBottom: 5 }}>/sqm</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                {!!classification && (
                  <span style={{ background: "rgba(255,255,255,0.14)", borderRadius: 100, padding: "5px 13px", color: "#fff", fontSize: 13, fontWeight: 800, letterSpacing: "0.4px" }}>{classification}</span>
                )}
                {estimate != null && <span style={{ color: "#c6d0ea", fontSize: 14, fontWeight: 600 }}>{"≈ " + peso(estimate) + " for 250 sqm"}</span>}
              </div>
            </div>

            {!!hazardText && (
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 16 }}>
                <span style={{ width: 10, height: 10, borderRadius: 6, background: RED, display: "inline-block" }} />
                <span style={{ fontSize: 14, color: "#5a6079", fontWeight: 600 }}>Geohazard: </span>
                <span style={{ fontSize: 14, color: INK, fontWeight: 800 }}>{hazardText}</span>
              </div>
            )}
          </div>

          {/* footer */}
          <div style={{ padding: "16px 26px 20px", marginTop: 14, borderTop: "1px solid #eef1f5" }}>
            <div style={{ fontSize: 13, color: "#8a93a8", fontWeight: 600 }}>via zonalvalue.ph &middot; BIR-indexed &middot; estimates only</div>
          </div>
        </div>
      </div>
    </>
  );
}
