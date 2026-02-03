"use client";

import { useEffect, useRef } from "react";

type LatLng = { lat: number; lon: number };
type Boundary = Array<[number, number]>;
type MapType = "street" | "terrain" | "satellite";

type HazardLayers = {
  flood?: GeoJSON.FeatureCollection | null;
  landslide?: GeoJSON.FeatureCollection | null;
  liquefaction?: GeoJSON.FeatureCollection | null;
  faults?: GeoJSON.FeatureCollection | null;
};

interface ZonalMapProps {
  selected?: LatLng | null;
  onPickOnMap?: (lat: number, lon: number) => void;
  popupLabel?: string;
  boundary?: Boundary | null;
  highlightRadiusMeters?: number;
  containerId?: string;
  mapType?: MapType;
  showStreetHighlight?: boolean;

  // ✅ hazards
  hazardLayers?: HazardLayers | null;
  hazardEnabled?: {
    flood?: boolean;
    landslide?: boolean;
    liquefaction?: boolean;
    faults?: boolean;
  };

  // ✅ street highlight (GeoJSON lines)
  streetGeojson?: GeoJSON.FeatureCollection | null;
  streetGeojsonEnabled?: boolean;
}

const TILESERVERS: Record<MapType, { url: string; attribution: string; maxZoom: number }> = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: '© <a href="https://opentopomap.org/">OpenTopoMap</a>',
    maxZoom: 17,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '© <a href="https://www.arcgis.com/">Esri</a>',
    maxZoom: 18,
  },
};

export default function ZonalMap({
  selected,
  onPickOnMap,
  popupLabel,
  boundary,
  highlightRadiusMeters = 80,
  containerId = "map-container",
  mapType = "street",
  showStreetHighlight = false,
  hazardLayers,
  hazardEnabled,
  streetGeojson,
  streetGeojsonEnabled,
}: ZonalMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const googleReadyRef = useRef<boolean>(false);
  const canvasRendererRef = useRef<any>(null);

  const hazardRefs = useRef<{ [k: string]: any | null }>({
    flood: null,
    landslide: null,
    liquefaction: null,
    faults: null,
  });

  const polygonRef = useRef<any>(null);

  // ✅ street line layer ref
  const streetLayerRef = useRef<any>(null);

  const emitIdle = () => {
    const event = new CustomEvent("zonalmap:idle");
    window.dispatchEvent(event);
  };

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const leafletModule = require("leaflet");
    const leaflet = leafletModule.default || leafletModule;

    const map = leaflet.map(mapContainerRef.current, {
      center: [12.8797, 121.774],
      zoom: 10,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      zoomControl: true,
      attributionControl: true,
    });

    // Ensure a dedicated pane for street highlight that always renders above tiles and polygons
    try {
      map.createPane("streetHighlight");
      const ph = map.getPane("streetHighlight");
      if (ph) {
        ph.style.zIndex = "650"; // above overlayPane(400) and markerPane(600)
        ph.classList.add("leaflet-zoom-animated"); // keep in sync with map zoom transforms
        ph.style.pointerEvents = "none"; // don't eat clicks
      }
    } catch {}

    map.on("click", (e: any) => {
      if (onPickOnMap) onPickOnMap(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    map.on("moveend", () => emitIdle());
    map.on("zoomend", () => emitIdle());

    return () => {
      // keep map
    };
  }, [onPickOnMap]);

  // Tile layer
  useEffect(() => {
    if (!mapRef.current) return;

    const leafletModule = require("leaflet");
    const leaflet = leafletModule.default || leafletModule;

    const GOOGLE_KEY = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string | undefined) || undefined;

    async function ensureGoogle() {
      if (!GOOGLE_KEY) return false;
      if (googleReadyRef.current && (window as any).google && (leaflet as any).gridLayer?.googleMutant) return true;
      // load Google Maps JS
      if (!(window as any).google) {
        await new Promise<void>((resolve, reject) => {
          const id = "gmaps-js";
          if (document.getElementById(id)) return resolve();
          const s = document.createElement("script");
          s.id = id;
          s.async = true;
          s.defer = true;
          s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_KEY)}`;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("google maps load failed"));
          document.head.appendChild(s);
        }).catch(() => {});
      }
      // load GoogleMutant plugin
      if (!(leaflet as any).gridLayer?.googleMutant) {
        await new Promise<void>((resolve, reject) => {
          const id = "leaflet-googlemutant";
          if (document.getElementById(id)) return resolve();
          const s = document.createElement("script");
          s.id = id;
          s.async = true;
          s.src = "https://unpkg.com/leaflet.gridlayer.googlemutant@0.13.7/Leaflet.GoogleMutant.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("google mutant load failed"));
          document.head.appendChild(s);
        }).catch(() => {});
      }
      const ok = Boolean((window as any).google && (leaflet as any).gridLayer?.googleMutant);
      googleReadyRef.current = ok;
      return ok;
    }

    async function setBaseLayer() {
      // remove previous layer
      if (tileLayerRef.current) {
        try { mapRef.current.removeLayer(tileLayerRef.current); } catch {}
        tileLayerRef.current = null;
      }

      const useGoogle = await ensureGoogle();
      if (useGoogle) {
        const gmType = mapType === "satellite" ? "satellite" : mapType === "terrain" ? "terrain" : "roadmap";
        const layer = (leaflet as any).gridLayer.googleMutant({ type: gmType, maxZoom: 22 });
        layer.addTo(mapRef.current);
        tileLayerRef.current = layer;
        return;
      }

      // Fallback to OSM
      const cfg = TILESERVERS[mapType];
      const layer = leaflet.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: cfg.maxZoom });
      layer.addTo(mapRef.current);
      tileLayerRef.current = layer;
    }

    setBaseLayer();
  }, [mapType]);

  // Marker + circle (hidden when street highlight is enabled)
  useEffect(() => {
    if (!mapRef.current) return;

    // If street highlight is on, remove marker/circle and skip drawing them
    if (streetGeojsonEnabled) {
      if (markerRef.current) {
        mapRef.current.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      if (circleRef.current) {
        mapRef.current.removeLayer(circleRef.current);
        circleRef.current = null;
      }
      // Still fly to the selected location even if marker is hidden
      if (selected) {
        try { mapRef.current.flyTo([selected.lat, selected.lon], 15, { duration: 1 }); } catch {}
      }
      return;
    }

    if (!selected) {
      if (markerRef.current) {
        mapRef.current?.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      if (circleRef.current) {
        mapRef.current?.removeLayer(circleRef.current);
        circleRef.current = null;
      }
      return;
    }

    const leafletModule = require("leaflet");
    const leaflet = leafletModule.default || leafletModule;

    if (markerRef.current) mapRef.current.removeLayer(markerRef.current);

    const icon = leaflet.icon({
      iconUrl: "/pictures/filipinohomespointer.png",
      iconSize: [50, 50],
      iconAnchor: [25, 50],
      popupAnchor: [0, -50],
      shadowUrl: null,
      shadowSize: [0, 0],
      shadowAnchor: [0, 0],
    });

    const marker = leaflet
      .marker([selected.lat, selected.lon], { icon, title: popupLabel })
      .bindPopup(popupLabel || `${selected.lat.toFixed(5)}, ${selected.lon.toFixed(5)}`)
      .openPopup()
      .addTo(mapRef.current);

    markerRef.current = marker;

    if (circleRef.current) mapRef.current.removeLayer(circleRef.current);

    const circle = leaflet
      .circle([selected.lat, selected.lon], {
        radius: highlightRadiusMeters,
        color: "#2563eb",
        weight: 2,
        opacity: 0.5,
        fill: true,
        fillColor: "#3b82f6",
        fillOpacity: 0.15,
      })
      .addTo(mapRef.current);

    circleRef.current = circle;

    mapRef.current.flyTo([selected.lat, selected.lon], 15, { duration: 1 });

    setTimeout(() => emitIdle(), 500);
  }, [selected, popupLabel, highlightRadiusMeters, streetGeojsonEnabled]);

  // Boundary polygon removed (keep overlays cleared)
  useEffect(() => {
    if (!mapRef.current) return;
    if (polylineRef.current) {
      mapRef.current?.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }
    if (polygonRef.current) {
      mapRef.current?.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }
  }, [boundary, showStreetHighlight]);

  // ✅ STREET HIGHLIGHT (draw as thick blue line)
  useEffect(() => {
    if (!mapRef.current) return;

    const leafletModule = require("leaflet");
    const leaflet = leafletModule.default || leafletModule;

    // remove old street layer
    if (streetLayerRef.current) {
      mapRef.current.removeLayer(streetLayerRef.current);
      streetLayerRef.current = null;
    }

    if (!streetGeojsonEnabled || !streetGeojson) return;

    // Build a casing (white) + blue overlay for maximum contrast
    // Use a dedicated Canvas renderer to avoid SVG transform scaling issues in screenshots
    if (!canvasRendererRef.current) {
      try {
        canvasRendererRef.current = (leaflet as any).canvas({ pane: "streetHighlight", padding: 0.5 });
      } catch {}
    }

    const renderer = canvasRendererRef.current || undefined;

    const casing = leaflet.geoJSON(streetGeojson as any, {
      style: {
        color: "#ffffff",
        weight: 14,
        opacity: 0.95,
      },
      pane: "streetHighlight",
      renderer,
    });

    const line = leaflet.geoJSON(streetGeojson as any, {
      style: {
        color: "#0ea5e9", // sky-500
        weight: 8,
        opacity: 1,
      },
      pane: "streetHighlight",
      renderer,
    });

    const group = leaflet.layerGroup([casing, line]);
    group.addTo(mapRef.current);
    try { if ((line as any).bringToFront) (line as any).bringToFront(); } catch {}
    streetLayerRef.current = group;

    // optional: zoom to street
    try {
      const b = (group as any).getBounds ? (group as any).getBounds() : (line as any).getBounds();
      if (b?.isValid()) mapRef.current.fitBounds(b, { padding: [20, 20] });
    } catch {}

    setTimeout(() => emitIdle(), 200);
  }, [streetGeojson, streetGeojsonEnabled]);

  // ✅ Hazard overlays
  useEffect(() => {
    if (!mapRef.current) return;

    const leafletModule = require("leaflet");
    const leaflet = leafletModule.default || leafletModule;

    const addOrRemove = (key: keyof HazardLayers, style: any) => {
      if (hazardRefs.current[key]) {
        mapRef.current.removeLayer(hazardRefs.current[key]);
        hazardRefs.current[key] = null;
      }

      const enabled = hazardEnabled?.[key] ?? false;
      const fc = hazardLayers?.[key];

      if (!enabled || !fc) return;

      const layer = leaflet.geoJSON(fc as any, style);
      layer.addTo(mapRef.current);
      hazardRefs.current[key] = layer;
    };

    addOrRemove("flood", { style: { color: "#2563eb", weight: 1, fillOpacity: 0.12 } });
    addOrRemove("landslide", { style: { color: "#b45309", weight: 1, fillOpacity: 0.12 } });
    addOrRemove("liquefaction", { style: { color: "#7c3aed", weight: 1, fillOpacity: 0.12 } });
    addOrRemove("faults", { style: { color: "#ef4444", weight: 2, opacity: 0.8 } });

    setTimeout(() => emitIdle(), 200);
  }, [
    hazardLayers,
    hazardEnabled?.flood,
    hazardEnabled?.landslide,
    hazardEnabled?.liquefaction,
    hazardEnabled?.faults,
  ]);

  return (
    <div
      id={containerId}
      ref={mapContainerRef}
      className="w-full h-full"
      style={{ position: "relative", zIndex: 1 }}
    />
  );
}
