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
  onPoiClick?: (placeId: string, lat: number, lon: number) => void; // clicked a base-map establishment icon
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
  valuePoints?: Array<{ lat: number; lon: number; label: string; info?: string }>; // zonal value price-tags (info = hover HTML)
  onBoundsChange?: (b: { minLat: number; maxLat: number; minLon: number; maxLon: number; zoom: number }) => void;
  scanMode?: boolean; // when true, dragging draws a box to scan zonal values
  onScanComplete?: (b: { minLat: number; maxLat: number; minLon: number; maxLon: number }) => void;
  floodOverlay?: { url: string; north: number; south: number; east: number; west: number } | null;
  scanFloodOverlay?: { url: string; north: number; south: number; east: number; west: number } | null;
  clearScanBoxSignal?: number; // bump to erase the drawn scan square
  floodTilesOn?: boolean; // crisp NOAH-style flood tile layer
  landslideTilesOn?: boolean; // crisp landslide hazard tile layer
  stormSurgeTilesOn?: boolean; // crisp storm-surge (SSA4) tile layer
  faultsOn?: boolean; // active fault lines (PHIVOLCS) vector overlay
  liquefactionOn?: boolean; // PHIVOLCS liquefaction-susceptibility raster overlay
  tsunamiOn?: boolean; // PHIVOLCS tsunami-prone raster overlay
  groundRuptureOn?: boolean; // PHIVOLCS ground-rupture / active-fault raster overlay

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
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ lightness: 20 }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#3b3b3b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }, { weight: 2 }] },
];

const MINIMAL_STYLE: any[] = [
  { elementType: "geometry", stylers: [{ color: "#f8f9fa" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
];

export default function GMap({
  selected,
  onPickOnMap,
  onPoiClick,
  disablePickOnMap,
  boundary,
  highlightRadiusMeters = 80,
  containerId = "map-container",
  mapType = "street",
  showStreetHighlight = false,
  streetGeojson,
  streetGeojsonEnabled,
  areaLabels,
  valuePoints,
  onBoundsChange,
  scanMode = false,
  onScanComplete,
  floodOverlay,
  scanFloodOverlay,
  clearScanBoxSignal,
  floodTilesOn = false,
  landslideTilesOn = false,
  stormSurgeTilesOn = false,
  faultsOn = false,
  liquefactionOn = false,
  tsunamiOn = false,
  groundRuptureOn = false,
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
  const valueMarkersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const onBoundsChangeRef = useRef<typeof onBoundsChange | null>(null);
  useEffect(() => { onBoundsChangeRef.current = onBoundsChange ?? null; }, [onBoundsChange]);
  const floodOverlayRef = useRef<any>(null);
  const scanFloodOverlayRef = useRef<any>(null);
  const floodTileTypeRef = useRef<any>(null);
  const landslideTileTypeRef = useRef<any>(null);
  const stormSurgeTileTypeRef = useRef<any>(null);
  const faultDataRef = useRef<any>(null);
  const faultGeoRef = useRef<any>(null);
  const hazardLayersRef = useRef<Record<string, any[]>>({}); // layer key -> google.maps.Data[]
  const hazardGeoRef = useRef<Record<string, any>>({});      // url -> cached GeoJSON
  const scanRectRef = useRef<any>(null);
  const scanListenersRef = useRef<any[]>([]);
  const onScanCompleteRef = useRef<typeof onScanComplete | null>(null);
  useEffect(() => { onScanCompleteRef.current = onScanComplete ?? null; }, [onScanComplete]);
  const onPickRef = useRef<typeof onPickOnMap | null>(null);
  const canPickRef = useRef<boolean>(true);
  const onPoiClickRef = useRef<typeof onPoiClick | null>(null);
  useEffect(() => { onPoiClickRef.current = onPoiClick ?? null; }, [onPoiClick]);
  // Suppress POI clicks while drawing a scan box / measuring land.
  const busyModeRef = useRef<boolean>(false);
  useEffect(() => { busyModeRef.current = !!scanMode || !!drawingMode; }, [scanMode, drawingMode]);

  // ✅ land drawing refs
  const drawClickListenerRef = useRef<any>(null);
  const drawnPolygonRef = useRef<any>(null);
  const drawMarkersRef = useRef<any[]>([]);
  const drawEdgeLabelsRef = useRef<any[]>([]);
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
        mapTypeId: mapType === "satellite" ? google.maps.MapTypeId.HYBRID : mapType === "terrain" ? google.maps.MapTypeId.TERRAIN : google.maps.MapTypeId.ROADMAP,
        clickableIcons: true, // base-map establishment icons are clickable (→ onPoiClick)
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        zoomControl: true,
      });
      map.addListener("click", (e: any) => {
        // Clicked a base-map establishment icon → it carries a placeId. Suppress
        // Google's default popup and hand it to the page (name + zonal value card).
        if (e?.placeId) {
          try { e.stop?.(); } catch {}
          if (busyModeRef.current) return;
          if (e.latLng && onPoiClickRef.current) onPoiClickRef.current(e.placeId, e.latLng.lat(), e.latLng.lng());
          return;
        }
        if (!e?.latLng) return;
        if (!onPickRef.current) return;
        if (!canPickRef.current) return;
        onPickRef.current(e.latLng.lat(), e.latLng.lng());
      });
      // Report the visible bounds after each pan/zoom (so the page can load only
      // the zonal pins the user can actually see — keeps the frontend light).
      map.addListener("idle", () => {
        const cb = onBoundsChangeRef.current;
        if (!cb) return;
        const b = map.getBounds();
        if (!b) return;
        const ne = b.getNorthEast();
        const sw = b.getSouthWest();
        cb({
          minLat: sw.lat(),
          maxLat: ne.lat(),
          minLon: sw.lng(),
          maxLon: ne.lng(),
          zoom: map.getZoom() || 0,
        });
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
      mapTypeId: mapType === "satellite" ? google.maps.MapTypeId.HYBRID : mapType === "terrain" ? google.maps.MapTypeId.TERRAIN : google.maps.MapTypeId.ROADMAP,
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

  // Render zonal value points as price-tag pins (a navy dot + the ₱ value),
  // with a hover tooltip showing the full zonal info.
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    for (const m of valueMarkersRef.current) { try { m.setMap(null); } catch {} }
    valueMarkersRef.current = [];
    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow({ disableAutoPan: true });
    }
    if (!Array.isArray(valuePoints) || valuePoints.length === 0) {
      try { infoWindowRef.current.close(); } catch {}
      return;
    }
    for (const p of valuePoints) {
      // anchor dot (hoverable)
      const dot = new google.maps.Marker({
        map,
        position: { lat: p.lat, lng: p.lon },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6.5,
          fillColor: "#1e3a8a",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        } as any,
        zIndex: 8,
      });
      // Show the value (and details) on hover — keeps the map clean.
      const content = p.info || `<div style="font-weight:800;color:#1e3a8a">${p.label}</div>`;
      dot.addListener("mouseover", () => {
        const iw = infoWindowRef.current;
        if (!iw) return;
        iw.setContent(content);
        iw.setPosition({ lat: p.lat, lng: p.lon });
        iw.open(map);
      });
      dot.addListener("mouseout", () => {
        try { infoWindowRef.current?.close(); } catch {}
      });
      valueMarkersRef.current.push(dot);
    }
  }, [valuePoints]);

  // Flood hazard overlay (a single colored PNG ground overlay — loads once, no lag).
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (floodOverlayRef.current) { try { floodOverlayRef.current.setMap(null); } catch {} floodOverlayRef.current = null; }
    if (!floodOverlay) return;
    floodOverlayRef.current = new google.maps.GroundOverlay(
      floodOverlay.url,
      { north: floodOverlay.north, south: floodOverlay.south, east: floodOverlay.east, west: floodOverlay.west },
      { opacity: 0.75, clickable: false } as any
    );
    floodOverlayRef.current.setMap(map);
  }, [floodOverlay]);

  // Scan-box flood overlay (colors flood ONLY inside the drawn scan area).
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (scanFloodOverlayRef.current) { try { scanFloodOverlayRef.current.setMap(null); } catch {} scanFloodOverlayRef.current = null; }
    if (!scanFloodOverlay) return;
    scanFloodOverlayRef.current = new google.maps.GroundOverlay(
      scanFloodOverlay.url,
      { north: scanFloodOverlay.north, south: scanFloodOverlay.south, east: scanFloodOverlay.east, west: scanFloodOverlay.west },
      { opacity: 0.8, clickable: false } as any
    );
    scanFloodOverlayRef.current.setMap(map);
  }, [scanFloodOverlay]);

  // Crisp flood tile layer (NOAH-style) — only visible tiles load → sharp + smooth.
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const remove = () => {
      if (!floodTileTypeRef.current) return;
      const arr = map.overlayMapTypes;
      for (let i = arr.getLength() - 1; i >= 0; i--) {
        if (arr.getAt(i) === floodTileTypeRef.current) arr.removeAt(i);
      }
      floodTileTypeRef.current = null;
    };
    remove();
    if (!floodTilesOn) return;
    const sat = mapType === "satellite" ? 1 : 0; // blue palette on satellite, NOAH warm otherwise
    const t = new google.maps.ImageMapType({
      getTileUrl: (coord: any, zoom: number) => `/api/flood-tile/${zoom}/${coord.x}/${coord.y}?v=6&sat=${sat}`,
      tileSize: new google.maps.Size(256, 256),
      name: "Flood",
      opacity: 1,
    });
    map.overlayMapTypes.push(t);
    floodTileTypeRef.current = t;
    return remove;
  }, [floodTilesOn, mapType]);

  // Crisp landslide tile layer (separate toggle, earthy palette).
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const remove = () => {
      if (!landslideTileTypeRef.current) return;
      const arr = map.overlayMapTypes;
      for (let i = arr.getLength() - 1; i >= 0; i--) {
        if (arr.getAt(i) === landslideTileTypeRef.current) arr.removeAt(i);
      }
      landslideTileTypeRef.current = null;
    };
    remove();
    if (!landslideTilesOn) return;
    const t = new google.maps.ImageMapType({
      getTileUrl: (coord: any, zoom: number) => `/api/landslide-tile/${zoom}/${coord.x}/${coord.y}?v=5`,
      tileSize: new google.maps.Size(256, 256),
      name: "Landslide",
      opacity: 1,
    });
    map.overlayMapTypes.push(t);
    landslideTileTypeRef.current = t;
    return remove;
  }, [landslideTilesOn]);

  // Crisp storm-surge tile layer (separate toggle, violet palette).
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const remove = () => {
      if (!stormSurgeTileTypeRef.current) return;
      const arr = map.overlayMapTypes;
      for (let i = arr.getLength() - 1; i >= 0; i--) {
        if (arr.getAt(i) === stormSurgeTileTypeRef.current) arr.removeAt(i);
      }
      stormSurgeTileTypeRef.current = null;
    };
    remove();
    if (!stormSurgeTilesOn) return;
    const t = new google.maps.ImageMapType({
      getTileUrl: (coord: any, zoom: number) => `/api/stormsurge-tile/${zoom}/${coord.x}/${coord.y}?v=4`,
      tileSize: new google.maps.Size(256, 256),
      name: "StormSurge",
      opacity: 1,
    });
    map.overlayMapTypes.push(t);
    stormSurgeTileTypeRef.current = t;
    return remove;
  }, [stormSurgeTilesOn]);

  // Active fault lines (PHIVOLCS) — crisp vector overlay via a dedicated Data layer.
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    let cancelled = false;
    const clear = () => {
      if (faultDataRef.current) { for (const l of faultDataRef.current) l.setMap(null); faultDataRef.current = null; }
    };
    clear();
    if (!faultsOn) return;
    (async () => {
      let gj = faultGeoRef.current;
      if (!gj) {
        try { gj = await (await fetch("/api/faults")).json(); faultGeoRef.current = gj; } catch { return; }
      }
      if (cancelled || !mapRef.current) return;
      // Two layers: a soft wide halo (the "fault zone") under a crisp solid line.
      const casing = new google.maps.Data();
      const line = new google.maps.Data();
      try { casing.addGeoJson(gj); line.addGeoJson(gj); } catch { return; }
      casing.setStyle({ strokeColor: "#ef4444", strokeWeight: 9, strokeOpacity: 0.16, clickable: false } as any);
      line.setStyle({ strokeColor: "#b91c1c", strokeWeight: 2.5, strokeOpacity: 0.95, clickable: false } as any);
      casing.setMap(map);
      line.setMap(map);
      faultDataRef.current = [casing, line];
    })();
    return () => { cancelled = true; clear(); };
  }, [faultsOn]);

  // PHIVOLCS hazard overlays as crisp VECTOR layers (Data layers) — sharp at any zoom,
  // no labels, no pixelation. Liquefaction/Tsunami are traced polygon zones; Ground
  // Rupture = the GEM active-fault lines (red) + traced trench arcs (magenta).
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    let cancelled = false;
    const store = hazardLayersRef.current; // key -> google.maps.Data[]

    const remove = (key: string) => {
      for (const d of store[key] || []) { try { d.setMap(null); } catch {} }
      delete store[key];
    };
    const fetchGeo = async (url: string) => {
      if (hazardGeoRef.current[url]) return hazardGeoRef.current[url];
      try { const j = await (await fetch(url)).json(); hazardGeoRef.current[url] = j; return j; } catch { return null; }
    };
    const addLayer = (gj: any, style: any) => {
      const d = new google.maps.Data();
      try { d.addGeoJson(gj); } catch { return null; }
      d.setStyle(style);
      d.setMap(map);
      return d;
    };

    const sync = async (on: boolean, key: string, build: () => Promise<any[]>) => {
      if (on && !store[key]) {
        const layers = (await build()).filter(Boolean);
        if (cancelled) { for (const l of layers) try { l.setMap(null); } catch {} return; }
        store[key] = layers;
      } else if (!on && store[key]) {
        remove(key);
      }
    };

    (async () => {
      await sync(!!liquefactionOn, "liquefaction", async () => {
        const gj = await fetchGeo("/hazard/liquefaction_vec.geojson"); if (!gj) return [];
        return [addLayer(gj, { fillColor: "#e0a23a", fillOpacity: 0.5, strokeColor: "#b97e15", strokeWeight: 0.7, strokeOpacity: 0.9, clickable: false })];
      });
      await sync(!!tsunamiOn, "tsunami", async () => {
        const gj = await fetchGeo("/hazard/tsunami_vec.geojson"); if (!gj) return [];
        return [addLayer(gj, { fillColor: "#22b8cf", fillOpacity: 0.45, strokeColor: "#0e8ea6", strokeWeight: 0.7, strokeOpacity: 0.9, clickable: false })];
      });
      await sync(!!groundRuptureOn, "groundrupture", async () => {
        const out: any[] = [];
        const tr = await fetchGeo("/hazard/trenches_vec.geojson");
        if (tr) out.push(addLayer(tr, { fillColor: "#a21caf", fillOpacity: 0.85, strokeColor: "#86198f", strokeWeight: 0.5, strokeOpacity: 0.9, clickable: false }));
        const fa = await fetchGeo("/api/faults");
        if (fa) {
          out.push(addLayer(fa, { strokeColor: "#ef4444", strokeWeight: 7, strokeOpacity: 0.18, clickable: false }));
          out.push(addLayer(fa, { strokeColor: "#dc2626", strokeWeight: 2, strokeOpacity: 0.95, clickable: false }));
        }
        return out;
      });
    })();

    return () => { cancelled = true; };
  }, [liquefactionOn, tsunamiOn, groundRuptureOn]);

  // Scan tool: drag on the map to draw a box; on release, report its bounds.
  useEffect(() => {
    const map = mapRef.current; if (!map) return;

    const cleanup = () => {
      for (const l of scanListenersRef.current) { try { google.maps.event.removeListener(l); } catch {} }
      scanListenersRef.current = [];
      // NOTE: we intentionally KEEP the drawn rectangle on the map so the user can see
      // the area they scanned. It's cleared via clearScanBoxSignal (new scan / close).
      try { map.setOptions({ draggable: true, draggableCursor: null }); } catch {}
    };

    if (!scanMode) { cleanup(); return; }

    // Drawing mode: disable panning so a drag draws the box instead.
    map.setOptions({ draggable: false, draggableCursor: "crosshair" });
    let start: { lat: number; lng: number } | null = null;

    const down = map.addListener("mousedown", (e: any) => {
      if (!e?.latLng) return;
      start = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      if (scanRectRef.current) { try { scanRectRef.current.setMap(null); } catch {} }
      scanRectRef.current = new google.maps.Rectangle({
        map,
        bounds: { north: start.lat, south: start.lat, east: start.lng, west: start.lng },
        fillColor: "#1e3a8a",
        fillOpacity: 0,            // outline only — no color fill inside the square
        strokeColor: "#1e3a8a",
        strokeWeight: 2.5,
        strokeOpacity: 0.95,
        clickable: false,
      });
    });
    const move = map.addListener("mousemove", (e: any) => {
      if (!start || !e?.latLng || !scanRectRef.current) return;
      const cur = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      scanRectRef.current.setBounds({
        north: Math.max(start.lat, cur.lat),
        south: Math.min(start.lat, cur.lat),
        east: Math.max(start.lng, cur.lng),
        west: Math.min(start.lng, cur.lng),
      });
    });
    const up = map.addListener("mouseup", () => {
      if (!start) return;
      const b = scanRectRef.current?.getBounds?.();
      start = null;
      if (b) {
        const ne = b.getNorthEast();
        const sw = b.getSouthWest();
        onScanCompleteRef.current?.({
          minLat: sw.lat(),
          maxLat: ne.lat(),
          minLon: sw.lng(),
          maxLon: ne.lng(),
        });
      }
    });
    scanListenersRef.current = [down, move, up];

    return cleanup;
  }, [scanMode]);

  // Erase the drawn scan square on demand (new scan / panel closed).
  useEffect(() => {
    if (!clearScanBoxSignal) return;
    if (scanRectRef.current) { try { scanRectRef.current.setMap(null); } catch {} scanRectRef.current = null; }
  }, [clearScanBoxSignal]);

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

    const segLenM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const R = 6371000;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    };

    const clearEdgeLabels = () => {
      for (const o of drawEdgeLabelsRef.current) { try { o.setMap(null); } catch {} }
      drawEdgeLabelsRef.current = [];
    };

    const renderEdgeLabels = (pts: Array<{ lat: number; lng: number }>) => {
      clearEdgeLabels();
      const g = (window as any).google;
      if (!g?.maps || !mapRef.current || pts.length < 2) return;
      // A small white pill at each edge midpoint showing its length in meters.
      class EdgeLabel extends g.maps.OverlayView {
        position: any; text: string; div: HTMLDivElement | null = null;
        constructor(position: any, text: string) { super(); this.position = position; this.text = text; }
        onAdd() {
          const d = document.createElement("div");
          d.style.cssText = "position:absolute;transform:translate(-50%,-50%);background:rgba(255,255,255,0.95);border:1px solid #1e3a8a;color:#1e3a8a;font-size:11px;font-weight:700;padding:0 6px;border-radius:9999px;white-space:nowrap;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,.3);line-height:16px";
          d.textContent = this.text;
          this.div = d;
          (this as any).getPanes().overlayLayer.appendChild(d);
        }
        draw() {
          const proj = (this as any).getProjection?.();
          if (!proj || !this.div) return;
          const p = proj.fromLatLngToDivPixel(this.position);
          if (p) { this.div.style.left = `${p.x}px`; this.div.style.top = `${p.y}px`; }
        }
        onRemove() { if (this.div) { this.div.remove(); this.div = null; } }
      }
      const n = pts.length;
      const edges = n >= 3 ? n : n - 1; // closed polygon vs single open segment
      for (let i = 0; i < edges; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        const mid = new g.maps.LatLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2);
        const len = segLenM(a, b);
        const text = len < 1000 ? `${Math.round(len)} m` : `${(len / 1000).toFixed(2)} km`;
        const o = new EdgeLabel(mid, text);
        o.setMap(mapRef.current);
        drawEdgeLabelsRef.current.push(o);
      }
    };

    const emitFromPoints = (pts: Array<{ lat: number; lng: number }>) => {
      renderEdgeLabels(pts);
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
    for (const o of drawEdgeLabelsRef.current) { try { o.setMap(null); } catch {} }
    drawEdgeLabelsRef.current = [];
    drawPointsRef.current = [];
    drawEditListenersRef.current = false;
    onAreaMeasuredRef.current?.(null);
  }, [clearDrawingSignal]);

  return <div id={containerId} className="w-full h-full" style={{ position: "relative", zIndex: 1 }} />;
}
