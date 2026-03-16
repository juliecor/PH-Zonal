"use client";

import { useEffect, useRef, useState } from "react";
// use plain <img> for local assets to avoid any Next Image config/caching issues
import type { LatLng, PoiData, PoiItem, Row } from "../lib/types";
import PdfPreviewModal from "./PdfPreviewModal";
import PoiLoadingSpinner from "./PoiLoadingSpinner";
import { waitForZonalMapIdle } from "../lib/zonal-util";

function toTitleSafe(s: string) {
  return String(s ?? "").trim();
}

function formatMoneyLikeSample(v: string) {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n === 0) return "Not Appraised";
  return `PHP ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / sqm`;
}

async function fetchAsDataURL(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function arrayBufferToBase64(buf: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Convert rich text (emojis, smart quotes, bullets, non-ASCII) into
// PDF-safe ASCII so jsPDF's core fonts render cleanly.
function toPdfAscii(text: string): string {
  const map: Record<string, string> = {
    "📍": "",
    "💼": "",
    "🏢": "",
    "⭐": "",
    "•": "-",
    "●": "-",
    "○": "-",
    "▪": "-",
    "–": "-",
    "—": "-",
    "“": '"',
    "”": '"',
    "’": "'",
    "‒": "-",
    " ": " ", // narrow no-break space
    " ": " ", // nbsp
  };
  let s = String(text || "");
  s = s.replace(/[📍💼🏢⭐•●○▪–—“”’‒\u202F\u00A0]/g, (m) => map[m] ?? "");
  // Strip any remaining non-ASCII (keep tabs/newlines and standard spaces)
  s = s.replace(/[^\t\n\r\x20-\x7E]/g, "");
  return s;
}

async function tryRegisterHurricaneFont(pdf: any) {
  try {
    const res = await fetch("/fonts/Hurricane-Regular.ttf");
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    const base64 = arrayBufferToBase64(buf);

    pdf.addFileToVFS("Hurricane-Regular.ttf", base64);
    pdf.addFont("Hurricane-Regular.ttf", "Hurricane", "normal");
    return true;
  } catch {
    return false;
  }
}

export default function ReportBuilder(props: {
  selectedLocation: LatLng | null;
  selectedRow: Row | null;
  geoLabel: string;
  poiLoading: boolean;
  poiData: PoiData | null;
  poiRadiusKm?: number;
  onChangePoiRadius?: (km: number) => void;

  idealBusinessText: string;
  setIdealBusinessText: (v: string) => void;

  areaDescription: string;

  mapContainerId?: string;
}) {
  const {
    selectedLocation,
    selectedRow,
    geoLabel,
    poiLoading,
    poiData,
    idealBusinessText,
    setIdealBusinessText,
    areaDescription,
    mapContainerId = "map-container",
    poiRadiusKm = 1.5,
    onChangePoiRadius,
  } = props;

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfErr, setPdfErr] = useState("");
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfStage, setPdfStage] = useState<string>("");
  const [pdfStep, setPdfStep] = useState<number>(0);
  const pdfFilenameRef = useRef<string>("zonal-report.pdf");
  const [activeCat, setActiveCat] = useState<
    "hospitals" | "schools" | "policeStations" | "fireStations" | "pharmacies" | "clinics" | null
  >(null);
  const [enriched, setEnriched] = useState<Record<string, Record<string, Partial<PoiItem>>>>({});
  const [enriching, setEnriching] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(4);
  const [expandedAnalysis, setExpandedAnalysis] = useState(true);
  const [expandedBusinessUses, setExpandedBusinessUses] = useState(true);
  const [newBusinessUse, setNewBusinessUse] = useState("");

  // distance helpers
  function distMeters(aLat?: number, aLon?: number, bLat?: number, bLon?: number) {
    if (aLat == null || aLon == null || bLat == null || bLon == null) return null;
    const R = 6371000;
    const dLat = ((bLat - aLat) * Math.PI) / 180;
    const dLon = ((bLon - aLon) * Math.PI) / 180;
    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLon / 2);
    const c = s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2;
    return 2 * R * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
  }
  function formatDistance(meters: number | null) {
    if (meters == null || !isFinite(meters)) return "";
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }

  // Reset active category and any enriched cache when the source data/location changes
  useEffect(() => {
    setActiveCat(null);
    setEnriched({});
    setEnriching(false);
    setPage(1);
    // no-op
  }, [poiData, selectedLocation?.lat, selectedLocation?.lon]);

  useEffect(() => {
    const run = async () => {
      if (!activeCat || !poiData || !selectedLocation) return;
      const byKey: Record<string, PoiItem[]> = {
        hospitals: poiData.items.hospitals,
        schools: poiData.items.schools,
        policeStations: poiData.items.policeStations,
        fireStations: poiData.items.fireStations,
        pharmacies: poiData.items.pharmacies,
        clinics: poiData.items.clinics,
      };
      const amenityMap: Record<string, string> = {
        hospitals: "hospital",
        schools: "school",
        policeStations: "police",
        fireStations: "fire_station",
        pharmacies: "pharmacy",
        clinics: "clinic",
      };
      const list = (byKey as any)[activeCat] as PoiItem[];
      if (!list?.length) return;
      const start = (page - 1) * pageSize;
      const slice = list.slice(start, start + pageSize);
      const have = enriched[activeCat] || {};
      const toFetch = slice.filter((x) => !have[(x.name || "").toLowerCase()]);
      if (toFetch.length === 0) return;
      setEnriching(true);
      try {
        const res = await fetch("/api/places-enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: selectedLocation.lat, //the main source
            lon: selectedLocation.lon,
            type: amenityMap[activeCat],
            items: toFetch.map((x) => ({ name: x.name, lat: x.lat, lon: x.lon, type: x.type })),
          }),
        });
        const data = await res.json().catch(() => null);
        if (data?.ok) {
          const map: Record<string, Partial<PoiItem>> = { ...(enriched[activeCat] || {}) };
          for (const m of data.items as any[]) {
            const k = String(m?.name || "").toLowerCase();
            if (!k) continue;
            map[k] = { phone: m.phone ?? null, website: m.website ?? null, photoUrl: m.photoUrl ?? null };
          }
          setEnriched((prev) => ({ ...prev, [activeCat]: map }));
        }
      } finally {
        setEnriching(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCat, poiData, selectedLocation, page, pageSize]);

  function closePreview() {
    setPdfPreviewOpen(false);
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
  }

  function downloadPreviewPdf() {
    if (!pdfPreviewUrl) return;
    const a = document.createElement("a");
    a.href = pdfPreviewUrl;
    a.download = pdfFilenameRef.current || "zonal-report.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  async function buildPdfBlob(mapDataUrl: string) {
    const { jsPDF } = await import("jspdf");

    const locationLine = selectedRow
      ? `Location: ${toTitleSafe(selectedRow["Street/Subdivision-"])} - ${toTitleSafe(
          selectedRow["Barangay-"]
        )}, ${toTitleSafe(selectedRow["City-"])}`
      : `Location: ${geoLabel || "Selected location"}`;

    const classLine = selectedRow
      ? `Classification: ${toTitleSafe(selectedRow["Classification-"])}`
      : `Classification: -`;

    const zonalText = selectedRow
      ? formatMoneyLikeSample(String(selectedRow["ZonalValuepersqm.-"] ?? ""))
      : "PHP - / sqm";

    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 40;

    const headerLogo = await fetchAsDataURL("/pictures/FilipinoHomes.png");
    const watermark = await fetchAsDataURL("/pictures/LeuterioRealty.png");

    const hasHurricane = await tryRegisterHurricaneFont(pdf);

    // =========================
    // PAGE 1
    // =========================

    if (headerLogo) {
      const logoW = 260;
      const logoH = 60;
      pdf.addImage(headerLogo, "PNG", (pageW - logoW) / 2, 28, logoW, logoH);
    } else {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text("FILIPINO HOMES", pageW / 2, 60, { align: "center" });
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text(zonalText, pageW / 2, 125, { align: "center" });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(locationLine, pageW / 2, 145, { align: "center" });
    pdf.text(classLine, pageW / 2, 158, { align: "center" });

    const topY = 190;
    const mapW = 240;
    const mapH = 240;

    const mapX = margin;
    const mapY = topY;

    const rightX = mapX + mapW + 36;
    const contentBottom = pageH - 150; // keep clear space for signature line

    pdf.setDrawColor(140);
    pdf.setLineWidth(1);
    pdf.roundedRect(mapX, mapY, mapW, mapH, 10, 10);

    pdf.addImage(mapDataUrl, "PNG", mapX + 8, mapY + 8, mapW - 16, mapH - 16);

    // Align right column content with the top of the map
    let y = mapY + 10;

    // HBU - Moved to later (both sections on page 1 now)
    // This section is now replaced by Business & Market Opportunity + Recommended Business Uses
    const bulletsFromText = (t: string) =>
      String(t || "")
        .split("\n")
        .map((x: string) => x.replace(/^([•\-\*]\s*)/, "").trim())
        .filter(Boolean)
        .map((x: string) => toPdfAscii(x));

    // ✅ Area description (AI) - Business & Market Opportunity
    y += 0;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("Business & Market Opportunity", rightX, y);

    y += 16;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);

    const desc =
      String(areaDescription || "").trim() || "(No description yet - select a property to generate.)";

    const wrappedDesc = pdf.splitTextToSize(toPdfAscii(desc), pageW - rightX - margin);
    // Print as much of the description as will fit, leaving space for uses below
    for (const line of wrappedDesc) {
      if (y > contentBottom) break;
      pdf.text(toPdfAscii(line), rightX, y);
      y += 11;
    }

    // ✅ Recommended Business Uses
    y += 14;
    if (y < contentBottom - 10) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text("Recommended Business Uses", rightX, y);

      y += 16;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);

      const hbuItems = bulletsFromText(idealBusinessText); // include all items
      const maxLinesHBU = 100; // high cap; contentBottom will limit
      let hbuCount = 0;
      const bulletIndent = 10; // indent for bullet items
      const availableWidth = pageW - rightX - margin - bulletIndent; // wrap width

      for (const item of hbuItems.length ? hbuItems : ["(Add items)"]) {
        if (y > contentBottom || hbuCount >= maxLinesHBU) break;
        
        // Wrap text to fit within available width
        const wrappedItem = pdf.splitTextToSize(`• ${toPdfAscii(item)}`, availableWidth);
        
        for (let i = 0; i < wrappedItem.length; i++) {
          if (y > contentBottom) break;
          // First line gets the bullet, subsequent lines are indented to align
          if (i === 0) {
            pdf.text(wrappedItem[i], rightX + bulletIndent, y);
          } else {
            pdf.text(wrappedItem[i], rightX + bulletIndent + 10, y);
          }
          y += 11;
        }
        
        hbuCount++;
      }
    }

    // Note: Removed page-1 watermark to maximize usable content space

    // Signature area (bottom-right)
    const sigBaseY = pageH - 110;
    const sigX = pageW - margin - 240;

    pdf.setDrawColor(60);
    pdf.setLineWidth(1);
    pdf.line(sigX, sigBaseY, sigX + 220, sigBaseY);

    if (hasHurricane) {
      pdf.setFont("Hurricane", "normal");
      pdf.setFontSize(26);
      pdf.text("Anthony Gerard Leuterio", sigX, sigBaseY - 8);
    } else {
      pdf.setFont("times", "italic");
      pdf.setFontSize(18);
      pdf.text("Anthony Gerard Leuterio", sigX, sigBaseY - 10);
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text("CEO / Founder of Filipino Homes", sigX, sigBaseY + 24);

    // Collect disclaimer text; applied to all pages later
    const disclaimerText =
      "The Zonal Value information provided in this report is intended for informational purposes only. It is not an official appraisal report. The values presented are based on our data-driven analysis of Filipino homes and should not be used as the sole basis for property valuation, legal, or financial decisions. For official appraisal, please consult a licensed appraiser or the appropriate government authority (e.g., BIR).";

    // =========================
    // PAGE 2 (cards)
    // =========================
    pdf.addPage();

    if (headerLogo) {
      const logoW = 260;
      const logoH = 60;
      pdf.addImage(headerLogo, "PNG", (pageW - logoW) / 2, 28, logoW, logoH);
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(`Nearby Facilities / POIs (within ${poiRadiusKm}km)`, pageW / 2, 115, { align: "center" });

    const gridTop = 145;
    const gap = 18;
    const cardW = (pageW - margin * 2 - gap) / 2;
    const cardH = 130;

    const leftColX = margin;
    const rightColX = margin + cardW + gap;

    const row1Y = gridTop;
    const row2Y = gridTop + cardH + gap;
    const row3Y = gridTop + (cardH + gap) * 2;

    const cards: Array<{ title: string; items: PoiItem[] }> = poiData
      ? [
          { title: `Hospitals (${poiData.items.hospitals.length})`, items: poiData.items.hospitals },
          { title: `Police Stations (${poiData.items.policeStations.length})`, items: poiData.items.policeStations },
          { title: `Schools (${poiData.items.schools.length})`, items: poiData.items.schools },
          { title: `Fire Stations (${poiData.items.fireStations.length})`, items: poiData.items.fireStations },
          { title: `Pharmacies (${poiData.items.pharmacies.length})`, items: poiData.items.pharmacies },
          { title: `Clinics (${poiData.items.clinics.length})`, items: poiData.items.clinics },
        ]
      : [
          { title: "Hospitals (0)", items: [] },
          { title: "Police Stations (0)", items: [] },
          { title: "Schools (0)", items: [] },
          { title: "Fire Stations (0)", items: [] },
          { title: "Pharmacies (0)", items: [] },
          { title: "Clinics (0)", items: [] },
        ];

    const cardPositions = [
      { x: leftColX, y: row1Y },
      { x: rightColX, y: row1Y },
      { x: leftColX, y: row2Y },
      { x: rightColX, y: row2Y },
      { x: leftColX, y: row3Y },
      { x: rightColX, y: row3Y },
    ];

    const drawCard = (x: number, y: number, title: string, items: PoiItem[]) => {
      pdf.setDrawColor(80);
      pdf.setLineWidth(1);
      pdf.roundedRect(x, y, cardW, cardH, 14, 14);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(title, x + 14, y + 22);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);

      let ty = y + 40;

      if (!items.length) {
        pdf.text("• None found", x + 14, ty);
        return;
      }

      let shownItems = 0;

      for (const it of items) {
        const name = it?.name ? String(it.name) : "(unnamed)";
        const wrapped = pdf.splitTextToSize(`• ${name}`, cardW - 28);

        for (const line of wrapped) {
          if (ty > y + cardH - 26) {
            const remaining = items.length - shownItems;
            if (remaining > 0) {
              pdf.setFont("helvetica", "italic");
              pdf.setFontSize(9);
              pdf.text(`…and ${remaining} more`, x + 14, y + cardH - 14);
            }
            return;
          }
          pdf.text(line, x + 14, ty);
          ty += 12;
        }

        shownItems += 1;
      }
    };

    for (let i = 0; i < 6; i++) {
      const pos = cardPositions[i];
      const c = cards[i];
      drawCard(pos.x, pos.y, c.title, c.items);
    }

    if (watermark) {
      try {
        const GState = (pdf as any).GState;
        if (GState) pdf.setGState(new GState({ opacity: 0.18 }));
      } catch {}

      const wmW = pageW * 0.9;
      const wmH = (wmW * 120) / 520;
      const wmY = pageH - wmH - 240;
      pdf.addImage(watermark, "PNG", (pageW - wmW) / 2, wmY, wmW, wmH);

      try {
        const GState = (pdf as any).GState;
        if (GState) pdf.setGState(new GState({ opacity: 1 }));
      } catch {}
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text("Copyright © 2026 All rights reserved. Filipino Homes | Developers", pageW / 2, pageH - 16, {
      align: "center",
    });

    // PAGE 3+ (full list)
    pdf.addPage();

    if (headerLogo) {
      const logoW = 260;
      const logoH = 60;
      pdf.addImage(headerLogo, "PNG", (pageW - logoW) / 2, 28, logoW, logoH);
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(`Full Nearby Facilities List (within ${poiRadiusKm}km)`, pageW / 2, 110, { align: "center" });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);

    let py = 140;

    const sections: Array<[string, PoiItem[]]> = poiData
      ? [
          ["Hospitals", poiData.items.hospitals],
          ["Schools", poiData.items.schools],
          ["Police Stations", poiData.items.policeStations],
          ["Fire Stations", poiData.items.fireStations],
          ["Pharmacies", poiData.items.pharmacies],
          ["Clinics", poiData.items.clinics],
        ]
      : [];

    for (const [title, list] of sections) {
      if (py > pageH - 80) {
        pdf.addPage();
        py = 60;
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text(`${title} (${list.length})`, margin, py);
      py += 16;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);

      if (!list.length) {
        pdf.text("• None found", margin, py);
        py += 14;
        continue;
      }

      for (const it of list) {
        const name = it?.name ? String(it.name) : "(unnamed)";
        const wrapped = pdf.splitTextToSize(`• ${name}`, pageW - margin * 2);

        for (const w of wrapped) {
          if (py > pageH - 60) {
            pdf.addPage();
            py = 60;
          }
          pdf.text(w, margin, py);
          py += 12;
        }
      }

      py += 14;
    }

    if (watermark) {
      try {
        const GState = (pdf as any).GState;
        if (GState) pdf.setGState(new GState({ opacity: 0.08 }));
      } catch {}

      const wmW = pageW * 0.9;
      const wmH = (wmW * 120) / 520;
      const wmY = pageH - wmH - 240;
      pdf.addImage(watermark, "PNG", (pageW - wmW) / 2, wmY, wmW, wmH);

      try {
        const GState = (pdf as any).GState;
        if (GState) pdf.setGState(new GState({ opacity: 1 }));
      } catch {}
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text("Copyright © 2026 All rights reserved. Filipino Homes | Developers", pageW / 2, pageH - 16, {
      align: "center",
    });

    // Apply simple disclaimer footer on every page
    const totalPages =
      typeof (pdf as any).getNumberOfPages === "function"
        ? (pdf as any).getNumberOfPages()
        : ((pdf as any).internal?.pages?.length ?? 1);
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(0);
      const lines = pdf.splitTextToSize(disclaimerText, pageW - margin * 2);
      const discY = pageH - 36 - Math.max(0, (lines.length - 1) * 0);
      pdf.text(lines, margin, discY);
    }

    const blob = pdf.output("blob");

    const safeName = (selectedRow
      ? `${String(selectedRow["Street/Subdivision-"] ?? "")}-${String(selectedRow["City-"] ?? "")}`
      : geoLabel || "location"
    )
      .replace(/[^\w]+/g, "-")
      .slice(0, 60);

    return { blob, filename: `zonal-report-${safeName}.pdf` };
  }

  async function generatePdfPreview() {
    setPdfErr("");
    if (!selectedLocation) {
      setPdfErr("Select a row or click on the map first.");
      return;
    }

    setPdfLoading(true);
    setPdfStage("Initializing…");
    setPdfStep(0);
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      setPdfStage("Preparing map snapshot…");
      setPdfStep(1);

      await waitForZonalMapIdle({ minEvents: 2, timeoutMs: 4500 });
      await new Promise((r) => setTimeout(r, 80));
      setPdfStage("Capturing high‑res map…");
      setPdfStep(2);

      const mapEl = document.getElementById(mapContainerId);
      if (!mapEl) throw new Error(`Map container not found (${mapContainerId})`);

      const canvas = await html2canvas(mapEl as HTMLElement, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
        removeContainer: true,
        onclone: (clonedDoc) => {
          const all = clonedDoc.querySelectorAll<HTMLElement>("*");
          for (const el of Array.from(all)) {
            const style = el.getAttribute("style");
            if (style && (style.includes("oklch(") || style.includes("lab(") || style.includes("lch("))) {
              el.setAttribute(
                "style",
                style
                  .replace(/oklch\([^)]+\)/g, "rgb(0,0,0)")
                  .replace(/lab\([^)]+\)/g, "rgb(0,0,0)")
                  .replace(/lch\([^)]+\)/g, "rgb(0,0,0)")
              );
            }
          }
          const s = clonedDoc.createElement("style");
          s.textContent = `* { color-scheme: light !important; }`;
          clonedDoc.head.appendChild(s);
        },
      });

      const mapDataUrl = canvas.toDataURL("image/png");
      setPdfStage("Composing report pages…");
      setPdfStep(3);
      const { blob, filename } = await buildPdfBlob(mapDataUrl);
      setPdfStage("Finalizing preview…");
      setPdfStep(4);
      pdfFilenameRef.current = filename;

      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      const url = URL.createObjectURL(blob);
      setPdfPreviewUrl(url);
      setPdfPreviewOpen(true);
    } catch (e: any) {
      setPdfErr(e?.message ?? "Failed to generate PDF preview");
    } finally {
      setPdfLoading(false);
      setTimeout(() => {
        setPdfStage("");
        setPdfStep(0);
      }, 300);
    }
  }

  // hazards removed

  return (
    <>
      {pdfLoading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="rounded-2xl bg-white/95 border border-gray-200 shadow-2xl px-5 py-4 flex items-center gap-3 min-w-[280px]">
            <div className="relative w-9 h-9">
              <img
                src="/pictures/filipinohomespointer.png"
                alt="Generating"
                width={47}
                height={47}
                className="object-contain pointer-flip"
                style={{ animationDuration: "1.1s" }}
              />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-black text-slate-900 truncate">Preparing PDF Report…</div>
              <div className="text-xs text-gray-600 truncate">{pdfStage || "Working…"}</div>
              <div className="mt-2 h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${Math.min(100, ((pdfStep + 1) / 5) * 100)}%` }}
                />
              </div>
            </div>
          </div>
          <style jsx>{`
            @keyframes pointerFlip {
          0%   { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
        .pointer-flip {
          animation: pointerFlip 1.2s linear infinite;
          transform-origin: center center;
        }
          `}</style>
        </div>
      )}
      <PdfPreviewModal open={pdfPreviewOpen} url={pdfPreviewUrl} onClose={closePreview} onDownload={downloadPreviewPdf} />

      <aside className="w-96 border-l border-gray-200 bg-white p-5 overflow-auto">
        <h3 className="text-lg font-bold text-gray-900 mb-5">Real Estate Assessment</h3>

        <div className="space-y-4">
          {/* Real Estate Assessment Section */}
          <div>
            <label className="block text-sm font-bold uppercase tracking-wide text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-lg">🏢</span> Business & Market Opportunity
            </label>
            <div className={`w-full rounded-lg border border-gray-300 px-4 py-3 leading-relaxed bg-gray-50 text-gray-800 transition-all ${
              expandedAnalysis ? "" : "max-h-[120px] overflow-hidden"
            }`}>
              <p className="text-sm font-medium whitespace-pre-line">
                {areaDescription || (
                  <span className="text-gray-500 italic">Select a property to generate real estate assessment…</span>
                )}
              </p>
            </div>
            {areaDescription && (
              <button
                onClick={() => setExpandedAnalysis(!expandedAnalysis)}
                className="text-blue-600 hover:text-blue-800 text-sm font-semibold mt-2 transition"
              >
                {expandedAnalysis ? "See Less ▲" : "See More ▼"}
              </button>
            )}
          </div>

          {/* Recommended Business Uses */}
          <div>
            <label className="block text-sm font-bold uppercase tracking-wide text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-lg">💼</span> Recommended Business Uses
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              value={idealBusinessText}
              onChange={(e) => setIdealBusinessText(e.target.value)}
              placeholder={"• Retail Store\n• Food & Beverage\n• Personal Services\n• Professional Office"}
              rows={expandedBusinessUses ? 8 : 5}
            />
            
            {/* Add new business use */}
            <div className="flex gap-2 mt-3">
              <input
                type="text"
                value={newBusinessUse}
                onChange={(e) => setNewBusinessUse(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const trimmed = newBusinessUse.trim();
                    if (trimmed) {
                      const currentText = idealBusinessText.trim();
                      const newText = currentText 
                        ? `${currentText}\n• ${trimmed}` 
                        : `• ${trimmed}`;
                      setIdealBusinessText(newText);
                      setNewBusinessUse("");
                    }
                  }
                }}
                placeholder="Add more business uses (press Enter)..."
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => {
                  const trimmed = newBusinessUse.trim();
                  if (trimmed) {
                    const currentText = idealBusinessText.trim();
                    const newText = currentText 
                      ? `${currentText}\n• ${trimmed}` 
                      : `• ${trimmed}`;
                    setIdealBusinessText(newText);
                    setNewBusinessUse("");
                  }
                }}
                disabled={!newBusinessUse.trim()}
                className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                Add
              </button>
            </div>
            
            <button
              onClick={() => setExpandedBusinessUses(!expandedBusinessUses)}
              className="text-blue-600 hover:text-blue-800 text-sm font-semibold mt-2 transition"
            >
              {expandedBusinessUses ? "Collapse ▲" : "Expand ▼"}
            </button>
          </div>

          <button
            onClick={generatePdfPreview}
            disabled={pdfLoading || !selectedLocation}
            className="w-full rounded-lg bg-blue-600 text-white px-4 py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {pdfLoading ? "Generating PDF…" : "Preview PDF Report"}
          </button>

          {pdfErr && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{pdfErr}</div>
          )}

          <div className="border-t border-gray-200 pt-4 mt-4">
            {/* Investment Potential Score Section */}
            {poiData && !poiLoading && (
              <div className="mb-5 p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 shadow-sm">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-3">Investment Viability Score</h3>
                
                {/* Calculate viability based on POIs */}
                {(() => {
                  const healthcare = (poiData.counts.hospitals || 0) + (poiData.counts.clinics || 0);
                  const education = poiData.counts.schools || 0;
                  const security = (poiData.counts.policeStations || 0) + (poiData.counts.fireStations || 0);
                  const services = (poiData.counts.pharmacies || 0);
                  const totalScore = Math.min(100, Math.round((healthcare * 15 + education * 15 + security * 10 + services * 10) / 5));
                  const viability = totalScore >= 75 ? 'Excellent' : totalScore >= 60 ? 'Good' : totalScore >= 45 ? 'Moderate' : 'Limited';
                  const color = totalScore >= 75 ? 'from-green-400 to-emerald-500' : totalScore >= 60 ? 'from-blue-400 to-cyan-500' : totalScore >= 45 ? 'from-yellow-400 to-amber-500' : 'from-orange-400 to-red-500';
                  
                  return (
                    <div className="space-y-2">
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-2xl font-black text-gray-900">{totalScore}</p>
                          <p className={`text-xs font-bold ${totalScore >= 75 ? 'text-green-700' : totalScore >= 60 ? 'text-blue-700' : totalScore >= 45 ? 'text-yellow-700' : 'text-red-700'}`}>
                            {viability}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {[...Array(5)].map((_, i) => (
                            <div key={i} className={`h-1.5 rounded-full ${i < Math.ceil(totalScore / 20) ? `bg-gradient-to-r ${color}` : 'bg-gray-300'}`} style={{width: '12px'}} />
                          ))}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-blue-200">
                        <div className="flex items-center gap-2 text-[11px]">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                          <span className="text-gray-700"><strong>{healthcare}</strong> Healthcare</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                          <span className="text-gray-700"><strong>{education}</strong> Schools</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                          <span className="text-gray-700"><strong>{security}</strong> Security</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                          <span className="text-gray-700"><strong>{services}</strong> Services</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Facilities Section Header */}
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs">📍</span>
                Nearby Facilities ({poiRadiusKm}km)
              </h4>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
                <label className="text-[11px] font-semibold text-gray-600">Radius:</label>
                <select
                  className="rounded-md border border-gray-300 text-xs px-2 py-0.5 bg-white font-semibold"
                  value={String(poiRadiusKm)}
                  onChange={(e) => onChangePoiRadius?.(Number(e.target.value))}
                >
                  <option value="1.5">1.5</option>
                  <option value="2">2</option>
                  <option value="2.5">2.5</option>
                  <option value="3">3</option>
                  <option value="3.3">3.3</option>
                  <option value="4">4</option>
                  <option value="4.5">4.5</option>
                  <option value="5">5</option>
                </select>
                <span className="text-[11px] font-semibold text-gray-600">km</span>
              </div>
            </div>

            {poiLoading && (
              <div className="fixed inset-0 z-[50] flex items-center justify-center bg-black/20 backdrop-blur-sm">
                <div className="rounded-2xl bg-white/95 border border-gray-200 shadow-2xl p-6 w-full max-w-sm">
                  <PoiLoadingSpinner />
                </div>
              </div>
            )}

            {!poiLoading && poiData ? (
              <div className="space-y-3">
                {/* Professional Facilities Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Hospitals Card */}
                  <button 
                    onClick={() => setActiveCat("hospitals")} 
                    className={`group rounded-xl border-2 p-3 text-center transition-all duration-200 ${activeCat==='hospitals' ? 'border-red-500 bg-gradient-to-br from-red-50 to-pink-50 shadow-md' : 'border-gray-200 bg-white hover:border-red-300 hover:shadow-sm'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <img src="/pictures/hospital.png" alt="Hospitals" width={20} height={20} className="icon" style={{filter:'invert(18%) sepia(87%) saturate(5458%) hue-rotate(351deg) brightness(96%) contrast(102%)'}} loading="lazy" />
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${activeCat==='hospitals' ? 'bg-red-200 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {(poiData.counts.hospitals || 0) > 5 ? '✓ Good' : (poiData.counts.hospitals || 0) > 2 ? '◐ Fair' : '✗ Low'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-600 font-medium">Hospitals</p>
                    <p className="text-2xl font-black text-red-600 mt-0.5">{poiData.counts.hospitals}</p>
                  </button>

                  {/* Schools Card */}
                  <button 
                    onClick={() => setActiveCat("schools")} 
                    className={`group rounded-xl border-2 p-3 text-center transition-all duration-200 ${activeCat==='schools' ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-cyan-50 shadow-md' : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <img src="/pictures/school.png" alt="Schools" width={20} height={20} className="icon" style={{filter:'invert(25%) sepia(96%) saturate(2035%) hue-rotate(194deg) brightness(92%) contrast(102%)'}} loading="lazy" />
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${activeCat==='schools' ? 'bg-blue-200 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {(poiData.counts.schools || 0) > 8 ? '✓ Good' : (poiData.counts.schools || 0) > 3 ? '◐ Fair' : '✗ Low'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-600 font-medium">Schools</p>
                    <p className="text-2xl font-black text-blue-600 mt-0.5">{poiData.counts.schools}</p>
                  </button>

                  {/* Police Card */}
                  <button 
                    onClick={() => setActiveCat("policeStations")} 
                    className={`group rounded-xl border-2 p-3 text-center transition-all duration-200 ${activeCat==='policeStations' ? 'border-amber-500 bg-gradient-to-br from-amber-50 to-yellow-50 shadow-md' : 'border-gray-200 bg-white hover:border-amber-300 hover:shadow-sm'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <img src="/pictures/police-station.png" alt="Police" width={20} height={20} className="icon" style={{filter:'invert(58%) sepia(96%) saturate(531%) hue-rotate(351deg) brightness(98%) contrast(104%)'}} loading="lazy" />
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${activeCat==='policeStations' ? 'bg-amber-200 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        {(poiData.counts.policeStations || 0) > 2 ? '✓ Good' : (poiData.counts.policeStations || 0) > 0 ? '◐ Fair' : '✗ Low'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-600 font-medium">Police</p>
                    <p className="text-2xl font-black text-amber-600 mt-0.5">{poiData.counts.policeStations}</p>
                  </button>

                  {/* Fire Card */}
                  <button 
                    onClick={() => setActiveCat("fireStations")} 
                    className={`group rounded-xl border-2 p-3 text-center transition-all duration-200 ${activeCat==='fireStations' ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-red-50 shadow-md' : 'border-gray-200 bg-white hover:border-orange-300 hover:shadow-sm'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <img src="/pictures/fire-department.png" alt="Fire" width={20} height={20} className="icon" style={{filter:'invert(46%) sepia(86%) saturate(1408%) hue-rotate(1deg) brightness(100%) contrast(103%)'}} loading="lazy" />
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${activeCat==='fireStations' ? 'bg-orange-200 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                        {(poiData.counts.fireStations || 0) > 1 ? '✓ Good' : (poiData.counts.fireStations || 0) > 0 ? '◐ Fair' : '✗ Low'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-600 font-medium">Fire</p>
                    <p className="text-2xl font-black text-orange-600 mt-0.5">{poiData.counts.fireStations}</p>
                  </button>

                  {/* Pharmacy Card */}
                  <button 
                    onClick={() => setActiveCat("pharmacies")} 
                    className={`group rounded-xl border-2 p-3 text-center transition-all duration-200 ${activeCat==='pharmacies' ? 'border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md' : 'border-gray-200 bg-white hover:border-green-300 hover:shadow-sm'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <img src="/pictures/pharmacy.png" alt="Pharmacy" width={20} height={20} className="icon" style={{filter:'invert(45%) sepia(12%) saturate(2470%) hue-rotate(90deg) brightness(92%) contrast(92%)'}} loading="lazy" />
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${activeCat==='pharmacies' ? 'bg-green-200 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {(poiData.counts.pharmacies || 0) > 5 ? '✓ Good' : (poiData.counts.pharmacies || 0) > 2 ? '◐ Fair' : '✗ Low'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-600 font-medium">Pharmacy</p>
                    <p className="text-2xl font-black text-green-600 mt-0.5">{poiData.counts.pharmacies}</p>
                  </button>

                  {/* Clinics Card */}
                  <button 
                    onClick={() => setActiveCat("clinics")} 
                    className={`group rounded-xl border-2 p-3 text-center transition-all duration-200 ${activeCat==='clinics' ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 shadow-md' : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <img src="/pictures/clinic.png" alt="Clinics" width={20} height={20} className="icon" style={{filter:'invert(19%) sepia(84%) saturate(1640%) hue-rotate(253deg) brightness(88%) contrast(98%)'}} loading="lazy" />
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${activeCat==='clinics' ? 'bg-purple-200 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {(poiData.counts.clinics || 0) > 5 ? '✓ Good' : (poiData.counts.clinics || 0) > 2 ? '◐ Fair' : '✗ Low'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-600 font-medium">Clinics</p>
                    <p className="text-2xl font-black text-purple-600 mt-0.5">{poiData.counts.clinics}</p>
                  </button>
                </div>

                <div className="text-xs space-y-3">
                  {!activeCat ? (
                    <p className="text-[11px] text-gray-500 mt-2 p-2 text-center">Click a category above to view detailed results.</p>
                  ) : (
                    (() => {
                      const byKey: Record<string, {label: string; list: PoiItem[]; icon: string; color: string}> = {
                        hospitals: { label: 'Hospitals', list: poiData.items.hospitals, icon: '/pictures/hospital.png', color: 'red' },
                        schools: { label: 'Schools', list: poiData.items.schools, icon: '/pictures/school.png', color: 'blue' },
                        policeStations: { label: 'Police', list: poiData.items.policeStations, icon: '/pictures/police-station.png', color: 'amber' },
                        fireStations: { label: 'Fire', list: poiData.items.fireStations, icon: '/pictures/fire-department.png', color: 'orange' },
                        pharmacies: { label: 'Pharmacy', list: poiData.items.pharmacies, icon: '/pictures/pharmacy.png', color: 'green' },
                        clinics: { label: 'Clinics', list: poiData.items.clinics, icon: '/pictures/clinic.png', color: 'purple' },
                      };
                      const data = byKey[activeCat];
                      const total = data.list.length;
                      const pageCount = Math.max(1, Math.ceil(total / pageSize));
                      const safePage = Math.min(Math.max(1, page), pageCount);
                      const start = (safePage - 1) * pageSize;
                      const baseSlice = data.list.slice(start, start + pageSize);
                      const showList = baseSlice.map((x) => {
                        const info = (enriched[activeCat] || {})[(x.name || '').toLowerCase()];
                        return info ? { ...x, ...info } : x;
                      });
                      return (
                        <div>
                          <p className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
                            <img src={data.icon} width={16} height={16} />
                            {data.label} <span className="text-gray-500">({data.list.length})</span>
                          </p>
                          {enriching && <p className="text-[11px] text-gray-500 mb-1">Fetching photos and contacts…</p>}
                          {showList.length ? (
                            <ul className="grid grid-cols-1 gap-2">
                              {showList.map((x: PoiItem, i: number) => {
                                const d = distMeters(selectedLocation?.lat, selectedLocation?.lon, x.lat, x.lon);
                                return (
                                <li key={`${activeCat}-${start + i}`} className="flex items-center gap-3 border border-gray-200 rounded-md p-2">
                                  <div className="w-14 h-12 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                                    {x.photoUrl ? (
                                      <img src={x.photoUrl} alt={x.name} className="w-full h-full object-cover" loading="lazy" />
                                    ) : (
                                      <img src={data.icon} alt="icon" className="w-full h-full object-contain p-2 opacity-70" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[12px] font-semibold text-gray-900 truncate">{x.name || '(unnamed)'}</p>
                                    <div className="text-[11px] text-gray-600 flex flex-wrap gap-3">
                                      {d != null ? (
                                        <span className="inline-flex items-center gap-1">
                                          <img src="/pictures/filipinohomespointer.png" alt="pin" width={12} height={12} className="opacity-90" />
                                          {formatDistance(d)}
                                        </span>
                                      ) : null}
                                      {x.phone ? <span>☎ {x.phone}</span> : null}
                                      {x.website ? (
                                        <a href={x.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Website</a>
                                      ) : null}
                                    </div>
                                  </div>
                                </li>
                              );})}
                            </ul>
                          ) : (
                            <p className="text-[11px] text-gray-500 mt-1">None found</p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <button className="text-xs px-2 py-1 border rounded disabled:opacity-50" onClick={() => setPage(Math.max(1, page - 1))} disabled={safePage <= 1}>Prev</button>
                            <span className="text-[11px] text-gray-600">Page {safePage} / {pageCount}</span>
                            <button className="text-xs px-2 py-1 border rounded disabled:opacity-50" onClick={() => setPage(Math.min(pageCount, safePage + 1))} disabled={safePage >= pageCount}>Next</button>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Select a property to load facilities</p>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
