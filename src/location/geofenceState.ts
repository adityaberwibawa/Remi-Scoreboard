import { clampRadius, type GeofenceArea } from './geo';

/**
 * Signature area geofence. Nama tidak ikut karena perubahan nama saja tidak
 * boleh mereset baseline masuk/keluar. Perubahan pusat atau radius mereset
 * baseline agar event pertama pada area baru tidak dicatat sebagai transisi.
 */
export function geofenceAreaSignature(area: GeofenceArea | null | undefined): string {
  if (
    !area ||
    !Number.isFinite(area.latitude) ||
    !Number.isFinite(area.longitude) ||
    !Number.isFinite(area.radius)
  ) {
    return '';
  }
  return [
    area.latitude.toFixed(6),
    area.longitude.toFixed(6),
    clampRadius(area.radius),
  ].join(':');
}

/** Apakah dua area mengarah ke region geofence yang sama. */
export function sameGeofenceArea(
  left: GeofenceArea | null | undefined,
  right: GeofenceArea | null | undefined,
): boolean {
  const leftSignature = geofenceAreaSignature(left);
  return leftSignature.length > 0 && leftSignature === geofenceAreaSignature(right);
}
