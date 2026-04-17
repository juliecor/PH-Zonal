"use client";

import { useMemo, useState } from "react";
import { apiAdminInviteUsers } from "@/app/lib/authClient";

function parseEmails(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /.+@.+\..+/.test(s))
    )
  );
}

export default function AdminInvitationsPage() {
  const [raw, setRaw] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<null | { sent: string[]; failed: string[] }>(null);
  const [error, setError] = useState<string | null>(null);

  const emails = useMemo(() => parseEmails(raw), [raw]);
  const origin = typeof window !== "undefined" ? window.location.origin : undefined;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const j = await apiAdminInviteUsers({ emails, redirect_url: origin });
      setResult({ sent: j.results?.sent || [], failed: j.results?.failed || [] });
      setRaw("");
    } catch (err: any) {
      setError(err?.message || "Failed to send invitations");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4">
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 sm:p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Invite Users</h1>
        <p className="mt-1 text-sm text-slate-600">
          Paste one or more emails. Separate by commas, spaces, or new lines.
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">
              Email addresses
            </label>
            <textarea
              aria-label="Email addresses"
              className="w-full min-h-[160px] bg-white text-slate-900 placeholder-slate-400 border border-slate-300 rounded-lg p-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              placeholder="e.g. user1@example.com, user2@example.com"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
            <div className="text-xs text-slate-600 mt-1">Parsed: {emails.length} valid email(s)</div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={sending || emails.length === 0}
              className={`inline-flex items-center px-4 py-2 rounded-lg text-white font-medium shadow-sm transition-colors ${
                sending || emails.length === 0
                  ? "bg-slate-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {sending ? "Sending…" : "Send Invitations"}
            </button>
            <span className="text-xs text-slate-500">Only admins can send invitations.</span>
          </div>
        </form>

        {error && (
          <div className="mt-5 p-3 rounded-md bg-red-50 text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-5 space-y-3">
            {result.sent.length > 0 && (
              <div className="p-3 rounded-md bg-green-50 text-green-800 border border-green-200">
                <span className="font-medium">Sent:</span> {result.sent.join(", ")}
              </div>
            )}
            {result.failed.length > 0 && (
              <div className="p-3 rounded-md bg-yellow-50 text-yellow-800 border border-yellow-200">
                <span className="font-medium">Failed:</span> {result.failed.join(", ")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
