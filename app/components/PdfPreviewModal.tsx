"use client";

/**
 * PdfPreviewModal
 *
 * PDF preview with action bar:  Download  |  📧 Email  |  🖨 Print
 * The Email button lives between Download and Print.
 * Clicking it opens EmailModal — fully managed here, no prop-drilling needed.
 */

import { useState } from "react";
import { Download, Mail, Printer, X } from "lucide-react";
import EmailModal, { type EmailPropertyData } from "./EmailModal";

interface PdfPreviewModalProps {
  open: boolean;
  url: string | null;
  onClose: () => void;
  onDownload: () => void;
  /** Passed through to EmailModal so the attachment has a sensible filename */
  pdfFilename?: string;
  /** Property info shown inside the email body */
  propertyTitle?: string;
  propertyData?: EmailPropertyData | null;
}

export default function PdfPreviewModal({
  open,
  url,
  onClose,
  onDownload,
  pdfFilename,
  propertyTitle,
  propertyData,
}: PdfPreviewModalProps) {
  const [emailOpen, setEmailOpen] = useState(false);

  if (!open || !url) return null;

  function handlePrint() {
    const iframe = document.getElementById("pdf-preview-iframe") as HTMLIFrameElement | null;
    if (iframe?.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } else {
      window.open(url!, "_blank");
    }
  }

  return (
    <>
      {/* ── PDF Preview Modal ── */}
      <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

        {/* Shell */}
        <div className="relative flex flex-col w-full max-w-3xl h-[92vh] bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base">📄</span>
              <span className="text-sm font-bold text-gray-800">PDF Preview</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* PDF iframe */}
          <div className="flex-1 overflow-hidden bg-gray-200">
            <iframe
              id="pdf-preview-iframe"
              src={url}
              className="w-full h-full border-0"
              title="PDF Preview"
            />
          </div>

          {/* ── Action bar ── */}
          <div className="shrink-0 flex items-center justify-center gap-3 px-5 py-3 border-t border-gray-200 bg-gray-50">

            {/* Download */}
            <button
              onClick={onDownload}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-5 py-2.5 text-sm font-bold hover:bg-blue-700 active:scale-95 transition"
              title="Download PDF"
            >
              <Download size={16} />
              Download PDF
            </button>

            {/* ── Email — centered between Download and Print ── */}
            <button
              onClick={() => setEmailOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-blue-400 bg-white text-blue-700 px-5 py-2.5 text-sm font-bold hover:bg-blue-50 active:scale-95 transition"
              title="Email this report"
            >
              <Mail size={16} />
              Email
            </button>

            {/* Print */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white text-gray-700 px-5 py-2.5 text-sm font-bold hover:bg-gray-100 active:scale-95 transition"
              title="Print PDF"
            >
              <Printer size={16} />
              Print
            </button>

          </div>
        </div>
      </div>

      {/* ── Email Modal — self-contained, z-index above the preview ── */}
      <EmailModal
        isOpen={emailOpen}
        onClose={() => setEmailOpen(false)}
        pdfUrl={url}
        pdfFilename={pdfFilename}
        propertyTitle={propertyTitle}
        propertyData={propertyData}
      />
    </>
  );
}