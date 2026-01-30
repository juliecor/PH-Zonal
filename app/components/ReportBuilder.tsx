"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, BookOpen, Shield, Flame, Pill, Stethoscope } from "lucide-react";
import type { LatLng, PoiData, PoiItem, Row } from "../lib/types";
import PdfPreviewModal from "./PdfPreviewModal";
import { waitForZonalMapIdle } from "../lib/zonal-util";

function toTitleSafe(s: string) {
  return String(s ?? "").trim();
}

function formatMoneyLikeSample(v: string) {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return "PHP - / sqm";
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
  } = props;

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfErr, setPdfErr] = useState("");
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const pdfFilenameRef = useRef<string>("zonal-report.pdf");

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

    pdf.setDrawColor(140);
    pdf.setLineWidth(1);
    pdf.roundedRect(mapX, mapY, mapW, mapH, 10, 10);

    pdf.addImage(mapDataUrl, "PNG", mapX + 8, mapY + 8, mapW - 16, mapH - 16);

    const bulletsFromText = (t: string) =>
      String(t || "")
        .split("\n")
        .map((x: string) => x.replace(/^•\s*/, "").trim())
        .filter(Boolean);

    const hbuItems = bulletsFromText(idealBusinessText).slice(0, 6);

    let y = mapY + 30;

    // HBU
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("Highest and Best Use (HBU)", rightX, y);

    y += 18;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);

    for (const item of hbuItems.length ? hbuItems : ["(Add items)"]) {
      pdf.text(`• ${item}`, rightX, y);
      y += 14;
    }

    // ✅ Area description (AI)
    y += 12;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("Area Description", rightX, y);

    y += 16;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10.5);

    const desc =
      String(areaDescription || "").trim() || "(No description yet — select a property to generate.)";

    const wrappedDesc = pdf.splitTextToSize(desc, pageW - rightX - margin);
    const maxLines = 6;
    for (const line of wrappedDesc.slice(0, maxLines)) {
      pdf.text(line, rightX, y);
      y += 12;
    }

    // Watermark (visible but not overpowering)
    if (watermark) {
      try {
        const GState = (pdf as any).GState;
        if (GState) pdf.setGState(new GState({ opacity: 0.22 }));
      } catch {}

      const wmW = pageW * 0.9;
      const wmH = (wmW * 200) / 520;
      const wmY = pageH - wmH - 180;
      pdf.addImage(watermark, "PNG", (pageW - wmW) / 2, wmY, wmW, wmH);

      try {
        const GState = (pdf as any).GState;
        if (GState) pdf.setGState(new GState({ opacity: 1 }));
      } catch {}
    }

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
    pdf.text("Nearby Facilities / POIs (within 1.5km)", pageW / 2, 115, { align: "center" });

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
    pdf.text("Copyright © 2026 All rights reserved. Filipino Homes | Developers", pageW / 2, pageH - 26, {
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
    pdf.text("Full Nearby Facilities List (within 1.5km)", pageW / 2, 110, { align: "center" });

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
    pdf.text("Copyright © 2026 All rights reserved. Filipino Homes | Developers", pageW / 2, pageH - 26, {
      align: "center",
    });

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
    try {
      const { default: html2canvas } = await import("html2canvas-pro");

      await waitForZonalMapIdle({ minEvents: 2, timeoutMs: 4500 });
      await new Promise((r) => setTimeout(r, 80));

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
      const { blob, filename } = await buildPdfBlob(mapDataUrl);
      pdfFilenameRef.current = filename;

      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      const url = URL.createObjectURL(blob);
      setPdfPreviewUrl(url);
      setPdfPreviewOpen(true);
    } catch (e: any) {
      setPdfErr(e?.message ?? "Failed to generate PDF preview");
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <>
      <PdfPreviewModal open={pdfPreviewOpen} url={pdfPreviewUrl} onClose={closePreview} onDownload={downloadPreviewPdf} />

      <aside className="w-80 border-l border-gray-200 bg-white p-5 overflow-auto">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Report Builder</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Ideal Business Uses</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={idealBusinessText}
              onChange={(e) => setIdealBusinessText(e.target.value)}
              placeholder={"• Basic Food Stall\n• Sari-sari / Micro-retail\n• Pharmacy / Medical Supplies"}
              rows={6}
            />
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
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Nearby Facilities (1.5km)</h4>

            {poiLoading ? (
              <p className="text-sm text-gray-500">Loading facilities…</p>
            ) : poiData ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-gray-200 p-3 text-center hover:bg-red-50 transition">
                    <Heart size={16} className="text-red-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-600">Hospitals</p>
                    <p className="text-lg font-bold text-gray-900">{poiData.counts.hospitals}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3 text-center hover:bg-blue-50 transition">
                    <BookOpen size={16} className="text-blue-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-600">Schools</p>
                    <p className="text-lg font-bold text-gray-900">{poiData.counts.schools}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3 text-center hover:bg-amber-50 transition">
                    <Shield size={16} className="text-amber-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-600">Police</p>
                    <p className="text-lg font-bold text-gray-900">{poiData.counts.policeStations}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3 text-center hover:bg-orange-50 transition">
                    <Flame size={16} className="text-orange-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-600">Fire</p>
                    <p className="text-lg font-bold text-gray-900">{poiData.counts.fireStations}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3 text-center hover:bg-green-50 transition">
                    <Pill size={16} className="text-green-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-600">Pharmacy</p>
                    <p className="text-lg font-bold text-gray-900">{poiData.counts.pharmacies}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3 text-center hover:bg-purple-50 transition">
                    <Stethoscope size={16} className="text-purple-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-600">Clinics</p>
                    <p className="text-lg font-bold text-gray-900">{poiData.counts.clinics}</p>
                  </div>
                </div>

                <div className="text-xs space-y-3 max-h-80 overflow-auto">
                  {(
                    [
                      ["Hospitals", poiData.items.hospitals, <Heart key="h" size={12} className="text-red-600" />],
                      ["Schools", poiData.items.schools, <BookOpen key="s" size={12} className="text-blue-600" />],
                      ["Police", poiData.items.policeStations, <Shield key="p" size={12} className="text-amber-600" />],
                      ["Fire", poiData.items.fireStations, <Flame key="f" size={12} className="text-orange-600" />],
                      ["Pharmacy", poiData.items.pharmacies, <Pill key="ph" size={12} className="text-green-600" />],
                      ["Clinics", poiData.items.clinics, <Stethoscope key="c" size={12} className="text-purple-600" />],
                    ] as const
                  ).map(([label, list, icon], idx) => (
                    <div key={`poi-${idx}`}>
                      <p className="font-semibold text-gray-900 flex items-center gap-2">
                        {icon}
                        {label} <span className="text-gray-500">({list.length})</span>
                      </p>

                      {list.length ? (
                        <ul className="list-disc pl-4 text-gray-600 text-[11px] mt-1 space-y-0.5">
                          {list.map((x: PoiItem, i: number) => (
                            <li key={`${idx}-${i}`}>{x.name || "(unnamed)"}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-gray-500 mt-1">None found</p>
                      )}
                    </div>
                  ))}
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
