"use client";

export default function ZonalSearchIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div className="flex items-center gap-3 rounded-full bg-white/90 backdrop-blur-sm border border-blue-200 shadow-lg px-6 py-4">
        {/* Flipping Filipino Homes pointer */}
        <div className="relative w-8 h-8 flex items-center justify-center">
          <img
            src="/pictures/filipinohomespointer.png"
            alt="Loading"
            width={57}
            height={57}
            className="object-contain pointer-flip"
          />
        </div>

        {/* Text */}
        <div className="flex flex-col gap-0.5">
          <div className="text-sm font-black text-slate-900">Please wait, boss 😊</div>
          <div className="text-xs text-gray-600">Searching zonal values…</div>
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
  );
}