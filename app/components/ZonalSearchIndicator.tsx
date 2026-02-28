"use client";

export default function ZonalSearchIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div className="flex items-center gap-3 rounded-full bg-white/90 backdrop-blur-sm border border-blue-200 shadow-lg px-6 py-4">
        {/* Spinning Filipino Homes pointer */}
        <div className="relative w-8 h-8">
          <img
            src="/pictures/filipinohomespointer.png"
            alt="Loading"
            width={32}
            height={32}
            className="object-contain animate-spin"
            style={{
              animationDuration: "1.2s",
            }}
          />
        </div>

        {/* Text */}
        <div className="flex flex-col gap-0.5">
          <div className="text-sm font-black text-slate-900">Please wait, boss 😊</div>
          <div className="text-xs text-gray-600">Searching zonal values…</div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin {
          animation: spin 1.2s linear infinite;
        }
      `}</style>
    </div>
  );
}
