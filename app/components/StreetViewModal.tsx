"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera } from "lucide-react";

declare global {
  interface Window { google: any }
}

export default function StreetViewModal({
  open,
  onClose,
  lat,
  lon,
  locationLabel,
}: {
  open: boolean;
  onClose: () => void;
  lat?: number | null;
  lon?: number | null;
  locationLabel?: string;
}) {
  const panoRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "none" | "error">("loading");

  useEffect(() => {
    if (!open) return;
    const hasCoords = lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon);
    if (!hasCoords) { setStatus("none"); return; }

    let cancelled = false;
    setStatus("loading");

    const tryInit = (attempt = 0) => {
      if (cancelled) return;
      const g = (window as any).google;
      if (!g?.maps || !panoRef.current) {
        if (attempt < 40) setTimeout(() => tryInit(attempt + 1), 150);
        else setStatus("error");
        return;
      }
      try {
        const sv = new g.maps.StreetViewService();
        sv.getPanorama({ location: { lat, lng: lon }, radius: 100 }, (data: any, svStatus: any) => {
          if (cancelled) return;
          if (svStatus === "OK" && data?.location?.pano) {
            const heading = g.maps.geometry?.spherical
              ? g.maps.geometry.spherical.computeHeading(data.location.latLng, new g.maps.LatLng(lat!, lon!))
              : 0;
            new g.maps.StreetViewPanorama(panoRef.current, {
              pano: data.location.pano,
              pov: { heading, pitch: 0 },
              zoom: 0,
              addressControl: true,
              fullscreenControl: true,
              motionTracking: false,
              motionTrackingControl: false,
            });
            setStatus("ok");
          } else {
            setStatus("none");
          }
        });
      } catch {
        setStatus("error");
      }
    };

    const t = setTimeout(() => tryInit(), 60);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, lat, lon]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3" onClick={onClose}>
      <div className="w-full max-w-[640px] rounded-2xl bg-white shadow-2xl border-2 border-[#155EEF] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: "#1e3a8a" }}>
          <div className="flex items-center gap-2 text-[#f1f5fc] font-bold text-sm min-w-0">
            <Camera size={16} style={{ color: "#8fb4ff" }} />
            <span className="truncate">Street View{locationLabel ? ` — ${locationLabel}` : ""}</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-white/60 hover:text-white transition shrink-0" title="Close"><X size={16} /></button>
        </div>

        {/* Panorama */}
        <div className="relative bg-gray-900" style={{ height: "60vh", maxHeight: 460 }}>
          <div ref={panoRef} className="absolute inset-0 w-full h-full" />
          {status !== "ok" && (
            <div className="absolute inset-0 flex items-center justify-center text-center p-6 text-white/90">
              {status === "loading" && (
                <div className="flex items-center gap-2 text-sm"><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Loading street imagery…</div>
              )}
              {status === "none" && (
                <div className="text-sm">
                  <Camera size={28} className="mx-auto mb-2 opacity-70" />
                  No Street View imagery is available at this exact spot.
                </div>
              )}
              {status === "error" && (
                <div className="text-sm">Couldn&apos;t load Street View. Please try again.</div>
              )}
            </div>
          )}
        </div>

        <div className="px-4 py-2 text-[10px] text-gray-400">Imagery © Google. Drag to look around; availability and capture date vary by location.</div>
      </div>
    </div>
  );
}
