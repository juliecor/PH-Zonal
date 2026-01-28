import dynamic from "next/dynamic";

import { useEffect, useRef, useState } from "react";



type LatLng = { lat: number; lon: number };
type Boundary = Array<[number, number]>;
type MapType = "street" | "terrain" | "satellite";

interface ZonalMapProps {
  selected?: LatLng | null;
  onPickOnMap?: (lat: number, lon: number) => void;
  popupLabel?: string;
  boundary?: Boundary | null;
  highlightRadiusMeters?: number;
  containerId?: string;
  mapType?: MapType;
}

const TILESERVERS = {
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
}: ZonalMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  const emitIdle = () => {
    const event = new CustomEvent("zonalmap:idle");
    window.dispatchEvent(event);
  };

  // Initialize map
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
      if (onPickOnMap) {
        onPickOnMap(e.latlng.lat, e.latlng.lng);
      }
    });

    mapRef.current = map;

    map.on("moveend", () => emitIdle());
    map.on("zoomend", () => emitIdle());

    return () => {
      // Don't destroy map on unmount
    };
  }, [onPickOnMap]);

  // Update tile layer based on mapType
  useEffect(() => {
    if (!mapRef.current) return;

    const tileServerConfig = TILESERVERS[mapType];

    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    const newTileLayer = (require("leaflet").default || require("leaflet")).tileLayer(
      tileServerConfig.url,
      {
        attribution: tileServerConfig.attribution,
        maxZoom: tileServerConfig.maxZoom,
      }
    );

    newTileLayer.addTo(mapRef.current);
    tileLayerRef.current = newTileLayer;
  }, [mapType]);

  // Update marker and circle (with custom div marker to avoid 404)
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

    // Remove old marker
    if (markerRef.current) {
      mapRef.current.removeLayer(markerRef.current);
    }

    // Create custom marker using divIcon (no image files needed!)
    const customMarkerHtml = `
      <div style="
        width: 32px;
        height: 32px;
        background-color: #2563eb;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 8px;
          height: 8px;
          background-color: white;
          border-radius: 50%;
        "></div>
      </div>
    `;

    const customIcon = leaflet.divIcon({
      html: customMarkerHtml,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -20],
      className: "custom-div-icon",
    });

    // Add new marker
    const marker = leaflet
      .marker([selected.lat, selected.lon], {
        icon: customIcon,
        title: popupLabel,
      })
      .bindPopup(popupLabel || `${selected.lat.toFixed(5)}, ${selected.lon.toFixed(5)}`)
      .openPopup()
      .addTo(mapRef.current);

    markerRef.current = marker;

    // Remove old circle
    if (circleRef.current) {
      mapRef.current.removeLayer(circleRef.current);
    }

    // Add new circle
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

    // Fly to location
    mapRef.current.flyTo([selected.lat, selected.lon], 15, { duration: 1 });

    setTimeout(() => emitIdle(), 500);
  }, [selected, popupLabel, highlightRadiusMeters]);

  // Update boundary polyline
  useEffect(() => {
    if (!mapRef.current || !boundary || boundary.length === 0) {
      if (polylineRef.current) {
        mapRef.current?.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }
      return;
    }

    const leafletModule = require("leaflet");
    const leaflet = leafletModule.default || leafletModule;

    if (polylineRef.current) {
      mapRef.current.removeLayer(polylineRef.current);
    }

    const polyline = leaflet
      .polyline(boundary as any, {
        color: "#059669",
        weight: 3,
        opacity: 0.6,
        dashArray: "5, 5",
      })
      .addTo(mapRef.current);

    polylineRef.current = polyline;
  }, [boundary]);

  return (
    <div
      id={containerId}
      ref={mapContainerRef}
      className="w-full h-full"
      style={{ position: "relative", zIndex: 1 }}
    />
  );
}