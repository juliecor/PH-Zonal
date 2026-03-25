"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Loader2, Mail, Send, X } from "lucide-react";

type Step = "form" | "sending" | "success" | "error";

export interface EmailPropertyData {
  street?: string;
  barangay?: string;
  city?: string;
  province?: string;
  classification?: string;
  zonalValue?: string;
  areaDescription?: string;
  idealBusinessText?: string;
  poiCounts?: Record<string, number> | null;
}

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  pdfFilename?: string;
  propertyTitle?: string;
  propertyData?: EmailPropertyData | null;
}

/** Strip control characters that can break JSON serialization */
function sanitizeStr(v: unknown): string {
  return String(v ?? "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

function sanitizePropertyData(pd: EmailPropertyData | null | undefined): Record<string, unknown> {
  if (!pd) return {};
  return {
    street:            sanitizeStr(pd.street),
    barangay:          sanitizeStr(pd.barangay),
    city:              sanitizeStr(pd.city),
    province:          sanitizeStr(pd.province),
    classification:    sanitizeStr(pd.classification),
    zonalValue:        sanitizeStr(pd.zonalValue),
    areaDescription:   sanitizeStr(pd.areaDescription),
    idealBusinessText: sanitizeStr(pd.idealBusinessText),
    poiCounts:         pd.poiCounts ?? null,
  };
}

export default function EmailModal({
  isOpen,
  onClose,
  pdfUrl,
  pdfFilename,
  propertyTitle,
  propertyData,
}: EmailModalProps) {
  const [step, setStep]                   = useState<Step>("form");
  const [receiverName, setReceiverName]   = useState("");
  const [receiverEmail, setReceiverEmail] = useState("");
  const [message, setMessage]             = useState("");
  const [errorMsg, setErrorMsg]           = useState("");

  useEffect(() => {
    if (isOpen) {
      setStep("form");
      setErrorMsg("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const title    = propertyTitle || "Property Report";
  const validate = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // ── Trigger a client-side PDF download ──────────────────────────────────
  function downloadPdf() {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href     = pdfUrl;
    a.download = pdfFilename || "zonal-report.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleSend() {
    setErrorMsg("");

    if (!receiverName.trim())                              { setErrorMsg("Please enter the receiver's name."); return; }
    if (!receiverEmail.trim() || !validate(receiverEmail)) { setErrorMsg("Please enter a valid receiver email."); return; }

    setStep("sending");

    try {
      // ── Send ONLY the small property-data payload as JSON.
      // The PDF binary is NEVER sent to the server — that was what caused the
      // "Could not read request" / "Unterminated string" errors (PDF is 10–15 MB
      // which blows past Next.js's 4 MB body-size limit every time).
      //
      // Instead we auto-download the PDF on the client right after success,
      // and the email body contains all property details so the receiver still
      // gets the full report content.
      const payload = {
        receiverName:  receiverName.trim(),
        receiverEmail: receiverEmail.trim(),
        message:       sanitizeStr(message.trim()),
        propertyTitle: sanitizeStr(title),
        pdfFilename:   pdfFilename || "zonal-report.pdf",
        propertyData:  sanitizePropertyData(propertyData),
      };

      const res  = await fetch("/api/send-email", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Send failed (${res.status})`);

      // Auto-download the PDF on the client so the sender has it too
      downloadPdf();

      setStep("success");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to send. Please try again.");
      setStep("error");
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Mail size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Email Property Report</p>
              <p className="text-xs text-blue-200 mt-0.5 truncate max-w-[220px]">{title}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 hover:bg-white/20 transition text-white">
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="p-6">

          {/* ─── FORM / ERROR ─── */}
          {(step === "form" || step === "error") && (
            <div className="space-y-4">

              {/* PDF notice */}
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0 text-sm">📄</div>
                <div>
                  <p className="text-xs font-bold text-gray-800">Full report details will be emailed</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Property info, zonal value &amp; POI data included</p>
                </div>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Send To</span>
                </div>
              </div>

              {/* Receiver */}
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Receiver Information</p>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Receiver's full name"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition"
                  />
                  <input
                    type="email"
                    placeholder="receiver@email.com"
                    value={receiverEmail}
                    onChange={(e) => setReceiverEmail(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition"
                  />
                </div>
              </div>

              {/* Optional message */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-2">
                  Personal Message <span className="font-normal text-gray-400 normal-case">(optional)</span>
                </label>
                <textarea
                  placeholder="Add a personal note to accompany the report…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition resize-none"
                />
              </div>

              {/* Error */}
              {errorMsg && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-3">
                  <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-700 font-medium">{errorMsg}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  className="flex-1 rounded-xl bg-blue-600 text-white px-4 py-2.5 text-sm font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  <Send size={14} />
                  Send Report
                </button>
              </div>
            </div>
          )}

          {/* ─── SENDING ─── */}
          {step === "sending" && (
            <div className="py-10 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center">
                <Loader2 size={28} className="text-blue-600 animate-spin" />
              </div>
              <div>
                <p className="text-base font-bold text-gray-900">Sending your report…</p>
                <p className="text-sm text-gray-500 mt-1">
                  Sending report to <strong>{receiverName || "the receiver"}</strong>
                </p>
              </div>
            </div>
          )}

          {/* ─── SUCCESS ─── */}
          {step === "success" && (
            <div className="py-8 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
                <CheckCircle size={28} className="text-green-600" />
              </div>
              <div className="w-full">
                <p className="text-base font-bold text-gray-900">Report Sent Successfully!</p>
                <p className="text-sm text-gray-500 mt-1">The property report has been delivered to</p>
                <div className="mt-2 inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-1.5">
                  <Mail size={13} className="text-green-600" />
                  <span className="text-sm font-semibold text-green-800">{receiverEmail}</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-3">
                  Full property details have been sent. PDF also downloaded to your device.
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-blue-600 text-white px-4 py-2.5 text-sm font-bold hover:bg-blue-700 transition"
              >
                Done
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}