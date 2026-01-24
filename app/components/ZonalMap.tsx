"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ✅ Fix default marker icons (Next bundling)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: (markerIcon2x as any).src ?? markerIcon2x,
  iconUrl: (markerIcon as any).src ?? markerIcon,
  shadowUrl: (markerShadow as any).src ?? markerShadow,
});

type LatLng = { lat: number; lon: number };

function MapEffects({
  selected,
  zoom = 16,
}: {
  selected: LatLng | null;
  zoom?: number;
}) {
  const map = useMap();

  // Always fix sizing in flex layouts
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(t);
  }, [map]);

  useEffect(() => {
    if (!selected) return;

    const target: [number, number] = [selected.lat, selected.lon];

    // Invalidate size before flying helps a lot in flex layouts
    map.invalidateSize();

    try {
      map.flyTo(target, zoom, { duration: 0.8 });
    } catch {
      // fallback if flyTo ever fails
      map.setView(target, zoom);
    }

    // Invalidate after animation start to ensure tiles render
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [selected?.lat, selected?.lon, zoom, map]);

  return null;
}

function ClickToSet({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function ZonalMap({
  selected,
  onPickOnMap,
  popupLabel,
}: {
  selected: LatLng | null;
  onPickOnMap: (lat: number, lon: number) => void;
  popupLabel?: string;
}) {
  const phCenter = useMemo<[number, number]>(() => [12.8797, 121.774], []);
  const markerRef = useRef<L.Marker | null>(null);

  // auto open popup when selected changes
  useEffect(() => {
    if (selected && markerRef.current) {
      markerRef.current.openPopup();
    }
  }, [selected?.lat, selected?.lon, popupLabel]);

  const zoom = selected ? 16 : 6;

  return (
    <div className="h-full w-full">
      <MapContainer
        center={selected ? [selected.lat, selected.lon] : phCenter}
        zoom={zoom}
        scrollWheelZoom
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <ZoomControl position="bottomright" />

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ClickToSet onPick={onPickOnMap} />
        <MapEffects selected={selected} zoom={16} />

        {selected ? (
          <Marker
            position={[selected.lat, selected.lon]}
            ref={(r) => {
              // @ts-ignore react-leaflet marker wrapper
              markerRef.current = r?.marker ?? null;
            }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-medium">Selected location</div>
                <div>
                  {popupLabel ??
                    `${selected.lat.toFixed(5)}, ${selected.lon.toFixed(5)}`}
                </div>
              </div>
            </Popup>
          </Marker>
        ) : null}
      </MapContainer>
    </div>
  );
}
