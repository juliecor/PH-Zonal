"use client";

import { Fragment, useState } from "react";

type Link = { key: string; label: string; disabled?: boolean };

export default function DashboardShell({
  title,
  links,
  active,
  onChange,
  right,
  children,
}: {
  title: string;
  links: Link[];
  active: string;
  onChange: (key: string) => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  function NavContent() {
    return (
      <nav className="space-y-1">
        {links.map((l) => (
          <button
            key={l.key}
            onClick={() => {
              if (l.disabled) return;
              onChange(l.key);
              setOpen(false);
            }}
            disabled={l.disabled}
            className={
              "w-full text-left px-3 py-2 rounded-md text-sm transition " +
              (active === l.key
                ? "bg-sky-100 text-sky-800"
                : "hover:bg-gray-50") +
              (l.disabled ? " opacity-50 cursor-not-allowed" : "")
            }
          >
            {l.label}
          </button>
        ))}
      </nav>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border bg-white shadow-sm ring-1 ring-gray-200"
              aria-label="Open menu"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M3 5h14a1 1 0 100-2H3a1 1 0 000 2zm14 4H3a1 1 0 100 2h14a1 1 0 100-2zm0 6H3a1 1 0 100 2h14a1 1 0 100-2z" clipRule="evenodd"/></svg>
            </button>
            <h1 className="text-xl sm:text-2xl font-semibold">{title}</h1>
          </div>
          {right}
        </div>

        <div className="grid lg:grid-cols-[240px,1fr] gap-4 sm:gap-6">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block rounded-xl bg-white shadow-sm ring-1 ring-black/5 p-3 h-max sticky top-4">
            <NavContent />
          </aside>

          {/* Main content */}
          <main className="space-y-4 sm:space-y-6">{children}</main>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl p-3">
            <div className="flex items-center justify-between px-1 py-2">
              <span className="text-sm font-semibold text-gray-600">Menu</span>
              <button onClick={() => setOpen(false)} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-gray-50" aria-label="Close">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M10 8.586L4.293 2.879A1 1 0 102.879 4.293L8.586 10l-5.707 5.707a1 1 0 101.414 1.414L10 11.414l5.707 5.707a1 1 0 001.414-1.414L11.414 10l5.707-5.707A1 1 0 0015.707 2.88L10 8.586z" clipRule="evenodd"/></svg>
              </button>
            </div>
            <NavContent />
          </div>
        </div>
      )}
    </div>
  );
}
