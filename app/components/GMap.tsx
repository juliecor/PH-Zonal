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
  popupLabel?: string;
  boundary?: Boundary | null;
  highlightRadiusMeters?: number;
  containerId?: string;
  mapType?: MapType;
  showStreetHighlight?: boolean;
  streetGeojson?: GeoJSON.FeatureCollection | null;
  streetGeojsonEnabled?: boolean;
  areaLabels?: Array<{ lat: number; lon: number; name: string }>; // optional labels for villages/subdivisions
}

function loadGoogleScript(apiKey: string) {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if ((window as any).google) return resolve();
    const id = "gmaps-js";
    if (document.getElementById(id)) {
      (document.getElementById(id) as any).addEventListener?.("load", () => resolve());
      return resolve();
    }
    const s = document.createElement("script");
    s.id = id;
    s.async = true;
    s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    s.onload = () => resolve();
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
  boundary,
  highlightRadiusMeters = 80,
  containerId = "map-container",
  mapType = "street",
  showStreetHighlight = false,
  streetGeojson,
  streetGeojsonEnabled,
  areaLabels,
}: GMapProps) {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const outlineRef = useRef<any>(null);
  const streetCasingRef = useRef<any>(null);
  const streetLineRef = useRef<any>(null);
  const labelMarkersRef = useRef<any[]>([]);

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
      if (onPickOnMap) {
        map.addListener("click", (e: any) => {
          if (!e.latLng) return;
          onPickOnMap(e.latLng.lat(), e.latLng.lng());
        });
      }
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

    if (!circleRef.current) {
      circleRef.current = new google.maps.Circle({
        map,
        center: { lat: selected.lat, lng: selected.lon },
        radius: highlightRadiusMeters,
        strokeColor: "#2563eb",
        strokeOpacity: 0.5,
        strokeWeight: 2,
        fillColor: "#3b82f6",
        fillOpacity: 0.15,
        zIndex: 40,
      });
    } else {
      circleRef.current.setCenter({ lat: selected.lat, lng: selected.lon });
      circleRef.current.setRadius(highlightRadiusMeters);
    }

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

  return <div id={containerId} className="w-full h-full" style={{ position: "relative", zIndex: 1 }} />;
}
