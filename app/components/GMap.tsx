"use client";

// TS helpers for Google Maps global
declare global {
  interface Window { google: any }
}
declare const google: any;

import { useEffect, useRef } from "react";

type LatLng = { lat: number; lon: number };
type Boundary = Array<[number, number]>;

type MapType = "street" | "terrain" | "satellite";

interface GMapProps {
  selected?: LatLng | null;
  onPickOnMap?: (lat: number, lon: number) => void;
  disablePickOnMap?: boolean;
  popupLabel?: string;
  boundary?: Boundary | null;
  highlightRadiusMeters?: number;
  containerId?: string;
  mapType?: MapType;
  showStreetHighlight?: boolean;
  streetGeojson?: GeoJSON.FeatureCollection | null;
  streetGeojsonEnabled?: boolean;
  areaLabels?: Array<{ lat: number; lon: number; name: string }>; // optional labels for villages/subdivisions

  // ✅ land drawing / area measurement
  drawingMode?: boolean;
  onAreaMeasured?: (info: { areaSqm: number; path: Array<{ lat: number; lng: number }> } | null) => void;
  clearDrawingSignal?: number; // bump this number to clear the drawn polygon
}

function loadGoogleScript(apiKey: string) {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if ((window as any).google?.maps) return resolve();
    const id = "gmaps-js";
    const finish = () => {
      // wait until the global is truly ready
      if ((window as any).google?.maps) resolve();
      else setTimeout(finish, 50);
    };
    let s = document.getElementById(id) as HTMLScriptElement | null;
    if (s) {
      s.addEventListener("load", finish);
      // if already loaded by the time we attach
      setTimeout(finish, 0);
      return;
    }
    s = document.createElement("script");
    s.id = id;
    s.async = true;
    s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geometry`;
    s.onload = finish;
    s.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(s);
  });
}

function easeInOutQuad(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function smoothPanTo(map: any, target: { lat: number; lng: number }, durationMs = 650) {
  try {
    const start = map.getCenter();
    const startLat = start.lat();
    const startLng = start.lng();
    const dLat = target.lat - startLat;
    const dLng = target.lng - startLng;
    if (Math.abs(dLat) < 1e-6 && Math.abs(dLng) < 1e-6) return;
    const t0 = performance.now();
    function frame(now: number) {
      const p = Math.min(1, (now - t0) / durationMs);
      const e = easeInOutQuad(p);
      map.setCenter({ lat: startLat + dLat * e, lng: startLng + dLng * e });
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  } catch {}
}

const CLEAN_STYLE: any[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ lightness: 20 }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#3b3b3b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }, { weight: 2 }] },
];

const MINIMAL_STYLE: any[] = [
  { elementType: "geometry", stylers: [{ color: "#f8f9fa" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
];

export default function GMap({
  selected,
  onPickOnMap,
  disablePickOnMap,
  boundary,
  highlightRadiusMeters = 80,
  containerId = "map-container",
  mapType = "street",
  showStreetHighlight = false,
  streetGeojson,
  streetGeojsonEnabled,
  areaLabels,
  drawingMode = false,
  onAreaMeasured,
  clearDrawingSignal = 0,
}: GMapProps) {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const outlineRef = useRef<any>(null);
  const streetCasingRef = useRef<any>(null);
  const streetLineRef = useRef<any>(null);
  const labelMarkersRef = useRef<any[]>([]);
  const onPickRef = useRef<typeof onPickOnMap | null>(null);
  const canPickRef = useRef<boolean>(true);

  // ✅ land drawing refs
  const drawClickListenerRef = useRef<any>(null);
  const drawnPolygonRef = useRef<any>(null);
  const drawMarkersRef = useRef<any[]>([]);
  const drawPointsRef = useRef<Array<{ lat: number; lng: number }>>([]);
  const drawEditListenersRef = useRef<boolean>(false);
  const onAreaMeasuredRef = useRef<typeof onAreaMeasured | null>(null);
  useEffect(() => { onAreaMeasuredRef.current = onAreaMeasured ?? null; }, [onAreaMeasured]);

  // keep click handler + flag fresh
  useEffect(() => { onPickRef.current = onPickOnMap ?? null; }, [onPickOnMap]);
  useEffect(() => { canPickRef.current = !(disablePickOnMap ?? false); }, [disablePickOnMap]);

  // init map
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string | undefined;
    if (!key) return;

    let cancelled = false;
    loadGoogleScript(key).then(() => {
      if (cancelled) return;
      const el = document.getElementById(containerId) as HTMLElement | null;
      if (!el || mapRef.current) return;
      const styleChoice = (process.env.NEXT_PUBLIC_GOOGLE_MAP_STYLE || "clean").toLowerCase();
      const style = styleChoice === "default" ? null : styleChoice === "minimal" ? MINIMAL_STYLE : CLEAN_STYLE;

      const map = new google.maps.Map(el, {
        center: { lat: 12.8797, lng: 121.774 },
        zoom: 10,
        styles: style || undefined,
        mapTypeId: mapType === "satellite" ? google.maps.MapTypeId.SATELLITE : mapType === "terrain" ? google.maps.MapTypeId.TERRAIN : google.maps.MapTypeId.ROADMAP,
        clickableIcons: false,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        zoomControl: true,
      });
      map.addListener("click", (e: any) => {
        if (!e?.latLng) return;
        if (!onPickRef.current) return;
        if (!canPickRef.current) return;
        onPickRef.current(e.latLng.lat(), e.latLng.lng());
      });
      mapRef.current = map;
    });
    return () => { cancelled = true; };
  }, [containerId, onPickOnMap, mapType]);

  // map type / style
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const styleChoice = (process.env.NEXT_PUBLIC_GOOGLE_MAP_STYLE || "clean").toLowerCase();
    const style = styleChoice === "default" ? null : styleChoice === "minimal" ? MINIMAL_STYLE : CLEAN_STYLE;
    map.setOptions({
      mapTypeId: mapType === "satellite" ? google.maps.MapTypeId.SATELLITE : mapType === "terrain" ? google.maps.MapTypeId.TERRAIN : google.maps.MapTypeId.ROADMAP,
      styles: style || undefined,
    });
  }, [mapType]);

  // marker + circle (hidden when highlighting)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (showStreetHighlight) {
      if (markerRef.current) { markerRef.current.setMap(null); markerRef.current = null; }
      if (circleRef.current) { circleRef.current.setMap(null); circleRef.current = null; }
      if (selected) smoothPanTo(map, { lat: selected.lat, lng: selected.lon });
      return;
    }

    if (!selected) {
      if (markerRef.current) { markerRef.current.setMap(null); markerRef.current = null; }
      if (circleRef.current) { circleRef.current.setMap(null); circleRef.current = null; }
      return;
    }

    const icon = {
      url: "/pictures/filipinohomespointer.png",
      scaledSize: new google.maps.Size(50, 50),
      anchor: new google.maps.Point(25, 50),
    } as any;
    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({
        map,
        position: { lat: selected.lat, lng: selected.lon },
        icon,
        zIndex: 1000,
      });
    } else {
      markerRef.current.setPosition({ lat: selected.lat, lng: selected.lon });
      markerRef.current.setIcon(icon);
    }

    // Highlight circle around the pin removed (it added no value and got in
    // the way of the land-drawing tool). Clear any existing one just in case.
    if (circleRef.current) { circleRef.current.setMap(null); circleRef.current = null; }

    smoothPanTo(map, { lat: selected.lat, lng: selected.lon });
    const targetZoom = Math.max(map.getZoom() || 10, 15);
    // apply zoom a bit later for smoother effect
    window.setTimeout(() => {
      try { map.setZoom(targetZoom); } catch {}
    }, 280);
  }, [selected, highlightRadiusMeters, showStreetHighlight]);

  // Remove barangay polygon (no rendering) but keep cleared if present
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (polygonRef.current) { polygonRef.current.setMap(null); polygonRef.current = null; }
    if (outlineRef.current) { outlineRef.current.setMap(null); outlineRef.current = null; }
  }, [boundary]);

  // street highlight
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    // clear old
    if (streetCasingRef.current) { streetCasingRef.current.setMap(null); streetCasingRef.current = null; }
    if (streetLineRef.current) { streetLineRef.current.setMap(null); streetLineRef.current = null; }

    if (!streetGeojsonEnabled || !streetGeojson) return;

    // only support first LineString in FC for now
    let coords: Array<{ lat: number; lng: number }> = [];
    for (const f of streetGeojson.features as any[]) {
      if (f?.geometry?.type === "LineString") {
        coords = (f.geometry.coordinates as number[][]).map(([x, y]) => ({ lat: y, lng: x }));
        break;
      }
    }
    if (!coords.length) return;

    streetCasingRef.current = new google.maps.Polyline({ map, path: coords, strokeColor: "#ffffff", strokeOpacity: 0.95, strokeWeight: 14, zIndex: 990, clickable: false, geodesic: false });
    streetLineRef.current = new google.maps.Polyline({ map, path: coords, strokeColor: "#0ea5e9", strokeOpacity: 1, strokeWeight: 8, zIndex: 999, clickable: false, geodesic: false });
    const bounds = new google.maps.LatLngBounds(); coords.forEach(p => bounds.extend(p));
    try { map.fitBounds(bounds, 20); } catch {}
  }, [streetGeojson, streetGeojsonEnabled]);

  // Render area labels as light text markers
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    for (const m of labelMarkersRef.current) { try { m.setMap(null); } catch {} }
    labelMarkersRef.current = [];
    if (!Array.isArray(areaLabels) || areaLabels.length === 0) return;
    for (const a of areaLabels) {
      const marker = new google.maps.Marker({
        map,
        position: { lat: a.lat, lng: a.lon },
        label: { text: a.name, color: "#6b7280", fontSize: "11px", fontWeight: "500" } as any,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0, strokeOpacity: 0, fillOpacity: 0 } as any,
        clickable: false,
        zIndex: 5,
      });
      labelMarkersRef.current.push(marker);
    }
  }, [areaLabels]);

  // ✅ Land drawing / area measurement
  // NOTE: google.maps.drawing.DrawingManager was removed in Maps JS API v3.65,
  // so we draw the polygon manually: each map click appends a corner to our own
  // point list and sets it on an editable google.maps.Polygon via setPath().
  // Area is computed with a self-contained spherical formula (no Google geometry
  // library), so drawing works the moment the map is ready.
  useEffect(() => {
    let cancelled = false;

    // Spherical polygon area (m²) — same formula Google's computeArea uses.
    const sphericalArea = (pts: Array<{ lat: number; lng: number }>) => {
      const R = 6378137; // Earth radius (m)
      const toRad = (d: number) => (d * Math.PI) / 180;
      let total = 0;
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        total += toRad(p2.lng - p1.lng) * (2 + Math.sin(toRad(p1.lat)) + Math.sin(toRad(p2.lat)));
      }
      return Math.abs((total * R * R) / 2);
    };

    const emitFromPoints = (pts: Array<{ lat: number; lng: number }>) => {
      if (!pts || pts.length < 3) { onAreaMeasuredRef.current?.(null); return; }
      onAreaMeasuredRef.current?.({ areaSqm: sphericalArea(pts), path: pts });
    };

    const addVertexMarker = (latLng: any) => {
      const g = (window as any).google;
      const marker = new g.maps.Marker({
        map: mapRef.current,
        position: latLng,
        draggable: false,
        zIndex: 70,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: "#ffffff",
          fillOpacity: 1,
          strokeColor: "#1e3a8a",
          strokeWeight: 2,
        },
      });
      drawMarkersRef.current.push(marker);
    };

    const ensurePolygon = () => {
      const g = (window as any).google;
      if (!drawnPolygonRef.current) {
        drawnPolygonRef.current = new g.maps.Polygon({
          map: mapRef.current,
          paths: [],
          strokeColor: "#1e3a8a",
          strokeWeight: 2,
          fillColor: "#c9a84c",
          fillOpacity: 0.25,
          editable: true,
          clickable: false,
          zIndex: 60,
        });
      }
      return drawnPolygonRef.current;
    };

    // When the user drags a vertex, re-read the polygon's path and recompute.
    const syncFromPolygon = () => {
      const polygon = drawnPolygonRef.current;
      if (!polygon) return;
      const p = polygon.getPath?.();
      if (!p || typeof p.getLength !== "function") return;
      const pts: Array<{ lat: number; lng: number }> = [];
      p.forEach((ll: any) => pts.push({ lat: ll.lat(), lng: ll.lng() }));
      drawPointsRef.current = pts;
      emitFromPoints(pts);
    };

    const attachEditListeners = (polygon: any) => {
      if (drawEditListenersRef.current) return;
      const g = (window as any).google;
      const p = polygon.getPath?.();
      if (!p || typeof p.getLength !== "function") return;
      g.maps.event.addListener(p, "set_at", syncFromPolygon);
      g.maps.event.addListener(p, "insert_at", syncFromPolygon);
      g.maps.event.addListener(p, "remove_at", syncFromPolygon);
      drawEditListenersRef.current = true;
    };

    const onMapClick = (e: any) => {
      if (!e?.latLng) return;
      const polygon = ensurePolygon();
      // keep our own point list and set the polygon path from it (unambiguous)
      drawPointsRef.current.push({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      polygon.setPath(drawPointsRef.current);
      addVertexMarker(e.latLng);
      attachEditListeners(polygon); // getPath() is defined after setPath
      emitFromPoints(drawPointsRef.current);
    };

    const arm = (attempt = 0) => {
      if (cancelled) return;
      const map = mapRef.current;
      const g = (window as any).google;

      if (!drawingMode) {
        if (drawClickListenerRef.current) {
          try { g?.maps?.event?.removeListener(drawClickListenerRef.current); } catch {}
          drawClickListenerRef.current = null;
        }
        try { map?.setOptions({ draggableCursor: null }); } catch {}
        return;
      }

      // Only wait for the map itself (the area calc doesn't need any Google lib).
      if (!map || !g?.maps) {
        if (attempt < 40) setTimeout(() => arm(attempt + 1), 150); // retry up to ~6s
        return;
      }

      if (!drawClickListenerRef.current) {
        drawClickListenerRef.current = map.addListener("click", onMapClick);
      }
      try { map.setOptions({ draggableCursor: "crosshair" }); } catch {}
    };

    arm();
    return () => {
      cancelled = true;
      const g = (window as any).google;
      if (drawClickListenerRef.current) {
        try { g?.maps?.event?.removeListener(drawClickListenerRef.current); } catch {}
        drawClickListenerRef.current = null;
      }
      try { mapRef.current?.setOptions({ draggableCursor: null }); } catch {}
    };
  }, [drawingMode]);

  // ✅ Clear the drawn polygon when the signal changes
  useEffect(() => {
    if (drawnPolygonRef.current) {
      try { drawnPolygonRef.current.setMap(null); } catch {}
      drawnPolygonRef.current = null;
    }
    for (const m of drawMarkersRef.current) { try { m.setMap(null); } catch {} }
    drawMarkersRef.current = [];
    drawPointsRef.current = [];
    drawEditListenersRef.current = false;
    onAreaMeasuredRef.current?.(null);
  }, [clearDrawingSignal]);

  return <div id={containerId} className="w-full h-full" style={{ position: "relative", zIndex: 1 }} />;
}
