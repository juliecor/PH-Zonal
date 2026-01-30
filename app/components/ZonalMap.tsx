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

    const cfg = TILESERVERS[mapType];

    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    const layer = leaflet.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
    });

    layer.addTo(mapRef.current);
    tileLayerRef.current = layer;
  }, [mapType]);

  // Marker + circle
  useEffect(() => {
    if (!mapRef.current || !selected) {
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
  }, [selected, popupLabel, highlightRadiusMeters]);

  // Boundary polygon + outline
  useEffect(() => {
    if (!mapRef.current || !boundary || boundary.length === 0) {
      if (polylineRef.current) {
        mapRef.current?.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }
      if (polygonRef.current) {
        mapRef.current?.removeLayer(polygonRef.current);
        polygonRef.current = null;
      }
      return;
    }

    const leafletModule = require("leaflet");
    const leaflet = leafletModule.default || leafletModule;

    if (polylineRef.current) mapRef.current.removeLayer(polylineRef.current);
    if (polygonRef.current) mapRef.current.removeLayer(polygonRef.current);

    const polygonColor = showStreetHighlight ? "#1d4ed8" : "#0891b2";
    const polygonFillColor = showStreetHighlight ? "#2563eb" : "#06b6d4";
    const polygonOpacity = showStreetHighlight ? 1 : 0.85;
    const polygonFillOpacity = showStreetHighlight ? 0.35 : 0.15;
    const polygonWeight = showStreetHighlight ? 3 : 2.5;

    const polygon = leaflet
      .polygon(boundary as any, {
        color: polygonColor,
        weight: polygonWeight,
        opacity: polygonOpacity,
        fill: true,
        fillColor: polygonFillColor,
        fillOpacity: polygonFillOpacity,
      })
      .addTo(mapRef.current);

    polygonRef.current = polygon;

    const outline = leaflet
      .polyline(boundary as any, {
        color: polygonColor,
        weight: polygonWeight,
        opacity: polygonOpacity,
      })
      .addTo(mapRef.current);

    polylineRef.current = outline;
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

    const layer = leaflet.geoJSON(streetGeojson as any, {
      style: {
        color: "#2563eb",
        weight: 7,
        opacity: 0.95,
      },
    });

    layer.addTo(mapRef.current);
    try { if ((layer as any).bringToFront) (layer as any).bringToFront(); } catch {}
    streetLayerRef.current = layer;

    // optional: zoom to street
    try {
      const b = layer.getBounds();
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
