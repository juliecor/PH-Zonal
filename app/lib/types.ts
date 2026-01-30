export type Row = {
  rowIndex: number;
  route?: string;
  "Street/Subdivision-": string;
  "Vicinity-": string;
  "Barangay-": string;
  "City-": string;
  "Province-": string;
  "Classification-": string;
  "ZonalValuepersqm.-": string;
  __zonal_raw?: number | string;
};

export type RegionMatch = { province: string; city: string; domain: string };
export type LatLng = { lat: number; lon: number };
export type Boundary = Array<[number, number]>;

export type PoiItem = {
  name: string;
  lat?: number;
  lon?: number;
  type?: string; // amenity type
  idKey?: string; // OSM type:id
  phone?: string | null;
  website?: string | null;
  photoUrl?: string | null;
};
export type PoiData = {
  counts: {
    hospitals: number;
    schools: number;
    policeStations: number;
    fireStations: number;
    pharmacies: number;
    clinics: number;
  };
  items: {
    hospitals: PoiItem[];
    schools: PoiItem[];
    policeStations: PoiItem[];
    fireStations: PoiItem[];
    pharmacies: PoiItem[];
    clinics: PoiItem[];
  };
};

export type MapType = "street" | "terrain" | "satellite";
