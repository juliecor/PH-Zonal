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
  Polygon,
  Circle,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: (markerIcon2x as any).src ?? markerIcon2x,
  iconUrl: (markerIcon as any).src ?? markerIcon,
  shadowUrl: (markerShadow as any).src ?? markerShadow,
});

type LatLng = { lat: number; lon: number };
type Boundary = Array<[number, number]>; // [lat, lon]

function MapIdleEmitter() {
  const map = useMap();

  useEffect(() => {
    const emit = () => {
      // wait 1 frame so overlays are positioned correctly
      requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent("zonalmap:idle"));
      });
    };

    map.whenReady(() => emit());

    map.on("moveend", emit);
    map.on("zoomend", emit);
    map.on("layeradd", emit);

    return () => {
      map.off("moveend", emit);
      map.off("zoomend", emit);
      map.off("layeradd", emit);
    };
  }, [map]);

  return null;
}

function MapEffects({ selected, zoom = 16 }: { selected: LatLng | null; zoom?: number }) {
  const map = useMap();

  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(t);
  }, [map]);

  useEffect(() => {
    if (!selected) return;

    const target: [number, number] = [selected.lat, selected.lon];
    map.invalidateSize();

    try {
      map.flyTo(target, zoom, { duration: 0.8 });
    } catch {
      map.setView(target, zoom);
    }

    const t = setTimeout(() => map.invalidateSize(), 250);
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
  boundary,
  highlightRadiusMeters = 80,
  containerId = "map-container",
}: {
  selected: LatLng | null;
  onPickOnMap: (lat: number, lon: number) => void;
  popupLabel?: string;
  boundary?: Boundary | null;
  highlightRadiusMeters?: number;
  containerId?: string;
}) {
  const phCenter = useMemo<[number, number]>(() => [12.8797, 121.774], []);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (selected && markerRef.current) markerRef.current.openPopup();
  }, [selected?.lat, selected?.lon, popupLabel]);

  const zoom = selected ? 16 : 6;

  return (
    <div id={containerId} className="h-full w-full">
      <MapContainer
        center={selected ? [selected.lat, selected.lon] : phCenter}
        zoom={zoom}
        scrollWheelZoom
        zoomControl={false}
        preferCanvas={true}
        style={{ height: "100%", width: "100%" }}
      >
        <ZoomControl position="bottomright" />

        <TileLayer
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          crossOrigin="anonymous"
        />

        <MapIdleEmitter />
        <ClickToSet onPick={onPickOnMap} />
        <MapEffects selected={selected} zoom={16} />

        {boundary?.length ? (
          <Polygon
            positions={boundary as any}
            pathOptions={{
              color: "#111827",
              weight: 2,
              fillColor: "#111827",
              fillOpacity: 0.08,
            }}
          />
        ) : null}

        {selected ? (
          <Circle
            center={[selected.lat, selected.lon]}
            radius={highlightRadiusMeters}
            pathOptions={{
              color: "#2563eb",
              weight: 2,
              fillColor: "#2563eb",
              fillOpacity: 0.2,
            }}
          />
        ) : null}

        {selected ? (
          <Marker
            position={[selected.lat, selected.lon]}
            ref={(r) => {
              // @ts-ignore
              markerRef.current = r?.marker ?? null;
            }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-medium">Selected location</div>
                <div>{popupLabel ?? `${selected.lat.toFixed(5)}, ${selected.lon.toFixed(5)}`}</div>
              </div>
            </Popup>
          </Marker>
        ) : null}
      </MapContainer>
    </div>
  );
}
