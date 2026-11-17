/** Reverse geocoding dengan cache kecil agar tidak memanggil geocoder berulang. */
import * as Location from 'expo-location';
import { formatAddress } from './address';
import type { Coordinates, GeocodedPlace } from './types';

const CACHE_LIMIT = 40;
const cache = new Map<string, GeocodedPlace>();

export function geocodeCacheKey(coords: Coordinates, digits = 4): string {
  return `${coords.latitude.toFixed(digits)},${coords.longitude.toFixed(digits)}`;
}

/**
 * Ubah koordinat menjadi alamat. Mengembalikan null bila geocoder tidak
 * tersedia/gagal; pemanggil harus tetap menampilkan koordinat sebagai fallback.
 */
export async function reverseGeocodeCoordinates(
  coords: Coordinates,
): Promise<GeocodedPlace | null> {
  const key = geocodeCacheKey(coords);
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const results = await Location.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
    const first = results[0];
    if (!first) return null;

    const place = formatAddress(first);
    if (!place) return null;

    cache.set(key, place);
    if (cache.size > CACHE_LIMIT) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
    return place;
  } catch {
    return null;
  }
}

/** Dipakai unit test agar cache tidak bocor antar kasus. */
export function clearGeocodeCache(): void {
  cache.clear();
}
