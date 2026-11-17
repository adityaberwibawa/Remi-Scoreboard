/** Perhitungan geospasial murni (tanpa dependensi native) agar mudah diuji. */
import type { Arena } from '../types';

export interface GeoPoint {
  latitude: number;
  longitude: number;
  /** Radius akurasi GPS dalam meter. */
  accuracy?: number | null;
}

export const DEFAULT_RADIUS_M = 150;
export const MIN_RADIUS_M = 100;
export const MAX_RADIUS_M = 1000;

const EARTH_RADIUS_M = 6_371_008.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Jarak great-circle antara dua titik (haversine), dalam meter. */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Apakah titik berada di dalam radius arena (batas dihitung inklusif). */
export function isInsideFence(
  point: GeoPoint,
  arena: Pick<Arena, 'latitude' | 'longitude' | 'radiusM'>,
  slackM = 0,
): boolean {
  return distanceMeters(point, arena) <= arena.radiusM + Math.max(0, slackM);
}

export function clampRadius(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RADIUS_M;
  return Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, Math.round(value)));
}

/** Format jarak untuk dibaca manusia: "±12 m" atau "1,2 km". */
export function formatDistance(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return '—';
  if (meters < 1000) return `±${Math.round(meters)} m`;
  return `±${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Format koordinat dengan 5 desimal (~1 m) memakai koma desimal Indonesia. */
export function formatCoords(point: Pick<GeoPoint, 'latitude' | 'longitude'>): string {
  return `${point.latitude.toFixed(5).replace('.', ',')}, ${point.longitude
    .toFixed(5)
    .replace('.', ',')}`;
}

/** Pastikan koordinat valid sebelum disimpan/dipakai. */
export function isValidPoint(point: Pick<GeoPoint, 'latitude' | 'longitude'>): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180
  );
}
