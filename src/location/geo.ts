/** Perhitungan geospasial murni (tanpa dependensi native) agar mudah diuji. */
import type { Coordinates } from './types';

const EARTH_RADIUS_M = 6371008.8;

/** Jarak lingkaran besar antara dua koordinat, dalam meter. */
export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isInsideRadius(
  center: Coordinates,
  point: Coordinates,
  radiusM: number,
): boolean {
  return haversineMeters(center, point) <= Math.max(1, radiusM);
}

/** Format jarak untuk UI: meter di bawah 1 km, kilometer di atasnya. */
export function formatDistance(distanceM: number | null): string {
  if (distanceM == null || !Number.isFinite(distanceM)) return '—';
  if (distanceM < 1000) return `${Math.max(0, Math.round(distanceM))} m`;
  return `${(distanceM / 1000).toFixed(1)} km`;
}

export function formatCoordinate(coords: Coordinates): string {
  return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
}

export function clampRadius(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(1000, Math.max(50, Math.round(value)));
}

export function roundCoordinate(coords: Coordinates, digits = 4): Coordinates {
  const factor = 10 ** digits;
  return {
    latitude: Math.round(coords.latitude * factor) / factor,
    longitude: Math.round(coords.longitude * factor) / factor,
  };
}

export const RADIUS_PRESETS = [100, 200, 500] as const;
