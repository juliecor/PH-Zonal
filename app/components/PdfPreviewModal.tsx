"use client";

import React from "react";

export default function PdfPreviewModal(props: {
  open: boolean;
  url: string | null;
  onClose: () => void;
  onDownload: () => void;
}) {
  const { open, url, onClose, onDownload } = props;
  if (!open || !url) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl h-[85vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b bg-white flex items-center justify-between">
          <h2 className="text-base font-semibold">PDF Preview</h2>
          <div className="flex gap-2">
            <button
              onClick={onDownload}
              className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition"
            >
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 transition"
            >
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 bg-gray-100">
          <iframe title="pdf-preview" src={url} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
}
