"use client";

import { useEffect, useRef, useState } from "react";
import type { LatLng, PoiData, PoiItem, Row } from "../lib/types";
import PdfPreviewModal from "./PdfPreviewModal";
import { waitForZonalMapIdle } from "../lib/zonal-util";

export default function ReportBuilder(props: {
  selectedLocation: LatLng | null;
  selectedRow: Row | null;
  geoLabel: string;
  poiLoading: boolean;
  poiData: PoiData | null;

  idealBusinessText: string;
  setIdealBusinessText: (v: string) => void;

  riskText: string;
  setRiskText: (v: string) => void;

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
    riskText,
    setRiskText,
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

    const locationName = selectedRow
      ? `${String(selectedRow["Street/Subdivision-"] ?? "").trim()} — ${String(selectedRow["Barangay-"] ?? "").trim()}, ${String(
          selectedRow["City-"] ?? ""
        ).trim()}`
      : geoLabel || "Selected location";

    const zonalValue = selectedRow ? String(selectedRow["ZonalValuepersqm.-"] ?? "") : "-";
    const cls = selectedRow ? String(selectedRow["Classification-"] ?? "") : "";

    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 36;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("FILIPINO HOMES ZONAL FINDER", margin, 48);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`Location: ${locationName}`, margin, 70);
    if (cls) pdf.text(`Classification: ${cls}`, margin, 86);

    const priceY = 125;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(28);
    const priceText = zonalValue ? `PHP ${zonalValue} / sqm` : "₱ - / sqm";
    const priceW = pdf.getTextWidth(priceText);
    pdf.text(priceText, (pageW - priceW) / 2, priceY);

    const topY = 150;
    const colGap = 14;
    const leftW = Math.floor((pageW - margin * 2 - colGap) * 0.58);
    const rightW = pageW - margin * 2 - colGap - leftW;

    const leftX = margin;
    const rightX = margin + leftW + colGap;

    const mapBoxH = 290;
    pdf.setDrawColor(30);
    pdf.setLineWidth(1);
    pdf.roundedRect(leftX, topY, leftW, mapBoxH, 10, 10);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("Map", leftX + 12, topY + 20);

    const imgMargin = 10;
    const imgX = leftX + imgMargin;
    const imgY = topY + 28;
    const imgW = leftW - imgMargin * 2;
    const imgH = mapBoxH - 38;
    pdf.addImage(mapDataUrl, "PNG", imgX, imgY, imgW, imgH);

    const boxGapY = 12;
    const noteBoxH = 140;
    pdf.roundedRect(rightX, topY, rightW, noteBoxH, 10, 10);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("Ideal for this place", rightX + 12, topY + 20);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    let y = topY + 40;
    const maxRightTextW = rightW - 24;
    const idealLines = pdf.splitTextToSize(idealBusinessText || "• (Add notes here)", maxRightTextW);
    for (const line of idealLines.slice(0, 10)) {
      pdf.text(line, rightX + 12, y);
      y += 12;
      if (y > topY + noteBoxH - 12) break;
    }

    const riskY = topY + noteBoxH + boxGapY;
    const riskBoxH = 138;
    pdf.roundedRect(rightX, riskY, rightW, riskBoxH, 10, 10);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("Risk / Hazards", rightX + 12, riskY + 20);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    let ry = riskY + 40;
    const riskLines = pdf.splitTextToSize(riskText || "• (Add notes here)", maxRightTextW);
    for (const line of riskLines.slice(0, 10)) {
      pdf.text(line, rightX + 12, ry);
      ry += 12;
      if (ry > riskY + riskBoxH - 12) break;
    }

    const sigBaseY = pageH - 70;
    const sigX = pageW - margin - 220;

    pdf.setDrawColor(50);
    pdf.setLineWidth(1);
    pdf.line(sigX, sigBaseY, sigX + 200, sigBaseY);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("ANTHONY LEUTERIO", sigX, sigBaseY + 18);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text("CEO / FOUNDER", sigX, sigBaseY + 34);
    pdf.text("FILIPINO HOMES", sigX, sigBaseY + 48);

    pdf.addPage();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("Nearby Facilities / POIs (within 1.5km)", margin, 56);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);

    let py = 82;

    const groups: Array<[string, PoiItem[]]> = poiData
      ? [
          ["Hospitals", poiData.items.hospitals],
          ["Schools", poiData.items.schools],
          ["Police Stations", poiData.items.policeStations],
          ["Fire Stations", poiData.items.fireStations],
          ["Pharmacies", poiData.items.pharmacies],
          ["Clinics", poiData.items.clinics],
        ]
      : [];

    if (!groups.length) {
      pdf.text("No POI data loaded. Select a row first to load POIs.", margin, py);
    } else {
      for (const [title, list] of groups) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.text(`${title} (${list.length})`, margin, py);
        py += 16;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);

        const names = list.slice(0, 28).map((x) => `• ${x.name || "(unnamed)"}`);
        if (!names.length) {
          pdf.text("• None found", margin, py);
          py += 14;
        } else {
          for (const line of names) {
            const wrapped = pdf.splitTextToSize(line, pageW - margin * 2);
            for (const wLine of wrapped) {
              if (py > pageH - 60) {
                pdf.addPage();
                py = 60;
              }
              pdf.text(wLine, margin, py);
              py += 12;
            }
          }
        }

        py += 12;
        if (py > pageH - 60) {
          pdf.addPage();
          py = 60;
        }
      }
    }

    const blob = pdf.output("blob");
    return {
      blob,
      filename: `zonal-report-${String(locationName).replace(/[^\w]+/g, "-").slice(0, 60)}.pdf`,
    };
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
              placeholder={"• Cafe\n• Retail Shop\n• Clinic"}
              rows={5}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Risks & Hazards</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={riskText}
              onChange={(e) => setRiskText(e.target.value)}
              placeholder={"• Flood Risk: Low\n• Landslide: Minimal"}
              rows={4}
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
                  <div className="rounded-lg border border-gray-200 p-3 text-center">
                    <p className="text-xs text-gray-600">Hospitals</p>
                    <p className="text-lg font-bold text-gray-900">{poiData.counts.hospitals}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3 text-center">
                    <p className="text-xs text-gray-600">Schools</p>
                    <p className="text-lg font-bold text-gray-900">{poiData.counts.schools}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3 text-center">
                    <p className="text-xs text-gray-600">Police</p>
                    <p className="text-lg font-bold text-gray-900">{poiData.counts.policeStations}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3 text-center">
                    <p className="text-xs text-gray-600">Fire</p>
                    <p className="text-lg font-bold text-gray-900">{poiData.counts.fireStations}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3 text-center">
                    <p className="text-xs text-gray-600">Pharmacy</p>
                    <p className="text-lg font-bold text-gray-900">{poiData.counts.pharmacies}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3 text-center">
                    <p className="text-xs text-gray-600">Clinics</p>
                    <p className="text-lg font-bold text-gray-900">{poiData.counts.clinics}</p>
                  </div>
                </div>

                <div className="text-xs space-y-2 max-h-40 overflow-auto">
                  {(
                    [
                      ["Hospitals", poiData.items.hospitals],
                      ["Schools", poiData.items.schools],
                      ["Police", poiData.items.policeStations],
                      ["Fire", poiData.items.fireStations],
                      ["Pharmacy", poiData.items.pharmacies],
                      ["Clinics", poiData.items.clinics],
                    ] as const
                  ).map(([label, list], idx) => (
                    <div key={`poi-${idx}`}>
                      {list.length > 0 && (
                        <>
                          <p className="font-semibold text-gray-900">{label}</p>
                          <ul className="list-disc pl-4 text-gray-600 text-[11px]">
                            {list.slice(0, 3).map((x, i) => (
                              <li key={`${idx}-${i}`}>{x.name || "(unnamed)"}</li>
                            ))}
                          </ul>
                        </>
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
