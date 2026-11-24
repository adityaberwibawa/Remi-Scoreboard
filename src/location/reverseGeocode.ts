import { Platform } from 'react-native';
import * as Location from 'expo-location';
import {
  formatGeocodedAddress,
  isValidCoordinate,
  type GeocodedAddressLike,
  type GeoPoint,
} from './geo';

export const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
export const REVERSE_GEOCODE_CACHE_LIMIT = 32;
const HTTP_TIMEOUT_MS = 5000;
const MIN_HTTP_INTERVAL_MS = 1100;
const USER_AGENT = 'PentungScore/1.0 (https://github.com/adityaberwibawa/Remi-Scoreboard)';

interface NominatimAddress {
  amenity?: string;
  tourism?: string;
  leisure?: string;
  building?: string;
  shop?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  path?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state_district?: string;
  state?: string;
  country?: string;
}

interface NominatimResponse {
  display_name?: string;
  address?: NominatimAddress;
  error?: string;
}

const addressCache = new Map<string, string>();
let lastHttpRequestAt = 0;
let httpQueue: Promise<unknown> = Promise.resolve();

export interface ReverseGeocodeOptions {
  force?: boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function reverseGeocodeCacheKey(point: GeoPoint): string {
  return `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`;
}

function readCachedAddress(key: string): string | null {
  const cached = addressCache.get(key);
  if (cached === undefined) return null;
  // Sentuh ulang agar urutan Map mengikuti penggunaan terbaru (LRU).
  addressCache.delete(key);
  addressCache.set(key, cached);
  return cached;
}

function writeCachedAddress(key: string, address: string): void {
  if (!address) return;
  addressCache.delete(key);
  addressCache.set(key, address);
  while (addressCache.size > REVERSE_GEOCODE_CACHE_LIMIT) {
    const oldest = addressCache.keys().next().value;
    if (oldest === undefined) break;
    addressCache.delete(oldest);
  }
}

/** Dipakai test dan saat pengguna ingin memulai cache baru. */
export function clearReverseGeocodeCache(): void {
  addressCache.clear();
}

function mapNominatimAddress(data: NominatimResponse): GeocodedAddressLike {
  const address = data.address ?? {};
  return {
    name:
      address.amenity ??
      address.tourism ??
      address.leisure ??
      address.building ??
      address.shop,
    street: address.road ?? address.pedestrian ?? address.footway ?? address.path,
    streetNumber: address.house_number,
    district:
      address.suburb ??
      address.neighbourhood ??
      address.city_district,
    city: address.city ?? address.town ?? address.village ?? address.municipality,
    subregion: address.county ?? address.state_district,
    region: address.state,
    country: address.country,
    formattedAddress: data.display_name,
  };
}

async function nativeReverseGeocode(point: GeoPoint): Promise<string> {
  if (Platform.OS === 'web') return '';
  try {
    const results = await Location.reverseGeocodeAsync(point);
    return formatGeocodedAddress(results[0]);
  } catch {
    return '';
  }
}

async function fetchNominatim(point: GeoPoint): Promise<string> {
  const task = async (): Promise<string> => {
    const url =
      `${NOMINATIM_ENDPOINT}?format=jsonv2` +
      `&lat=${encodeURIComponent(String(point.latitude))}` +
      `&lon=${encodeURIComponent(String(point.longitude))}` +
      '&zoom=18&addressdetails=1&accept-language=id';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      // Browser melarang header User-Agent; Nominatim tetap memakai UA browser.
      if (Platform.OS !== 'web') headers['User-Agent'] = USER_AGENT;

      const response = await fetch(url, { headers, signal: controller.signal });
      if (!response.ok) return '';
      const data = (await response.json()) as NominatimResponse;
      if (data.error) return '';
      return formatGeocodedAddress(mapNominatimAddress(data));
    } catch {
      return '';
    } finally {
      clearTimeout(timeout);
    }
  };

  // Serialisasi request dan jaga jarak minimal agar tidak melanggar kebijakan
  // penggunaan Nominatim (maksimal sekitar satu request per detik).
  const run = httpQueue.then(async () => {
    const wait = MIN_HTTP_INTERVAL_MS - (Date.now() - lastHttpRequestAt);
    if (wait > 0) await delay(wait);
    lastHttpRequestAt = Date.now();
    return task();
  });
  httpQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Alamat untuk koordinat tertentu. Geocoder native dicoba lebih dulu di
 * perangkat, lalu Nominatim dipakai sebagai fallback. Hasil disimpan dalam
 * cache LRU agar pin yang sama tidak memicu request berulang.
 */
export async function reverseGeocodeAddress(
  point: GeoPoint,
  options: ReverseGeocodeOptions = {},
): Promise<string> {
  if (!isValidCoordinate(point)) return '';

  const key = reverseGeocodeCacheKey(point);
  if (!options.force) {
    const cached = readCachedAddress(key);
    if (cached !== null) return cached;
  }

  const native = await nativeReverseGeocode(point);
  if (native) {
    writeCachedAddress(key, native);
    return native;
  }

  const fallback = await fetchNominatim(point);
  if (fallback) writeCachedAddress(key, fallback);
  return fallback;
}
