/** URL aplikasi peta eksternal sebagai fallback peta dalam aplikasi. */
import { Linking, Platform } from 'react-native';
import type { GeoPoint } from './geo';

export function googleMapsUrl(point: Pick<GeoPoint, 'latitude' | 'longitude'>): string {
  return `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`;
}

export function externalMapUrl(
  point: Pick<GeoPoint, 'latitude' | 'longitude'>,
  label?: string | null,
): string {
  const query = `${point.latitude},${point.longitude}`;
  const name = encodeURIComponent(label?.trim() || 'Lokasi');
  if (Platform.OS === 'android') return `geo:${query}?q=${query}(${name})`;
  if (Platform.OS === 'ios') return `https://maps.apple.com/?ll=${query}&q=${name}`;
  return googleMapsUrl(point);
}

/** Buka peta eksternal; fallback ke Google Maps bila skema tidak didukung. */
export async function openInMaps(
  point: Pick<GeoPoint, 'latitude' | 'longitude'>,
  label?: string | null,
): Promise<void> {
  try {
    await Linking.openURL(externalMapUrl(point, label));
  } catch {
    try {
      await Linking.openURL(googleMapsUrl(point));
    } catch {
      // Tidak ada aplikasi peta/browser yang bisa membuka tautan.
    }
  }
}
