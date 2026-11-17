export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeofenceArea extends GeoPoint {
  radius: number;
}

export interface GeofenceSnapshot {
  inside: boolean;
  distance: number;
  edgeDistance: number;
}

export interface GeocodedAddressLike {
  name?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  district?: string | null;
  city?: string | null;
  subregion?: string | null;
  region?: string | null;
  country?: string | null;
  formattedAddress?: string | null;
}

const EARTH_RADIUS_M = 6371000;

export const MIN_GEOFENCE_RADIUS = 100;
export const MAX_GEOFENCE_RADIUS = 5000;
export const GEOFENCE_RADIUS_PRESETS = [100, 250, 500, 1000] as const;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function valid(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

export function isValidCoordinate(point: GeoPoint): boolean {
  return valid(point);
}

/** Jarak great-circle antara dua koordinat (meter). */
export function distanceMeters(from: GeoPoint, to: GeoPoint): number {
  if (!valid(from) || !valid(to)) return Number.NaN;
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function clampRadius(radius: number): number {
  if (!Number.isFinite(radius)) return MIN_GEOFENCE_RADIUS;
  return Math.min(MAX_GEOFENCE_RADIUS, Math.max(MIN_GEOFENCE_RADIUS, Math.round(radius)));
}

/** Hitung posisi relatif terhadap area geofence. Batas radius dihitung di dalam. */
export function geofenceSnapshot(point: GeoPoint, area: GeofenceArea): GeofenceSnapshot {
  const distance = distanceMeters(point, area);
  const radius = clampRadius(area.radius);
  const inside = Number.isFinite(distance) && distance <= radius;
  return {
    inside,
    distance,
    edgeDistance: Number.isFinite(distance) ? Math.abs(radius - distance) : Number.NaN,
  };
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** Rangkai komponen alamat menjadi teks yang enak dibaca, tanpa duplikasi. */
export function formatGeocodedAddress(address: GeocodedAddressLike | null | undefined): string {
  if (!address) return '';
  const street = [address.street, address.streetNumber].filter(Boolean).join(' ');
  const candidates = [
    address.name,
    street,
    address.district,
    address.city,
    address.subregion,
    address.region,
    address.country,
  ];
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase('id-ID');
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(value);
  }
  if (parts.length > 0) return parts.join(', ');
  return address.formattedAddress?.trim() ?? '';
}
