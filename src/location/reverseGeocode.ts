/**
 * Reverse geocoding dengan dua lapis:
 * 1. Geocoder native perangkat (Android/iOS).
 * 2. Fallback HTTP keyless (BigDataCloud) untuk web, emulator tanpa geocoder,
 *    atau saat geocoder native gagal.
 *
 * Hasil di-cache di memori dan SQLite agar hemat kuota dan tahan offline.
 */
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { readGeocodeCache, writeGeocodeCache } from '../db';
import { isValidPoint } from './geo';
import type { GeoPoint } from './geo';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_MEMORY_ENTRIES = 60;
const MAX_ADDRESS_LENGTH = 160;
const REQUEST_TIMEOUT_MS = 8_000;
const PROVIDER_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

interface MemoryEntry {
  address: string;
  at: number;
}

const memoryCache = new Map<string, MemoryEntry>();

/** Key ~11 m agar pergerakan kecil tidak memicu request baru. */
export function geocodeCacheKey(point: Pick<GeoPoint, 'latitude' | 'longitude'>): string {
  return `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`;
}

function toCleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > 0 ? clean : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Gabungkan komponen alamat: buang kosong/duplikat, batasi jumlah bagian
 * dan panjang total agar tetap terbaca di kartu sempit.
 */
export function formatAddressParts(
  parts: (string | null | undefined)[],
  maxParts = 4,
): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    const clean = toCleanString(raw);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= maxParts) break;
  }
  if (out.length === 0) return null;
  const text = out.join(', ');
  if (text.length <= MAX_ADDRESS_LENGTH) return text;
  return `${text.slice(0, MAX_ADDRESS_LENGTH - 1).trimEnd()}…`;
}

export function formatNativeAddress(address: Location.LocationGeocodedAddress): string | null {
  const street = [address.streetNumber, address.street]
    .map((part) => toCleanString(part))
    .filter((part): part is string => !!part)
    .join(' ');
  return formatAddressParts([
    address.name,
    street,
    address.district,
    address.subregion,
    address.city,
    address.region,
    address.postalCode,
    address.country,
  ]);
}

interface BigDataCloudResponse {
  locality?: unknown;
  city?: unknown;
  principalSubdivision?: unknown;
  countryName?: unknown;
  postcode?: unknown;
  localityInfo?: unknown;
}

/** Parser respons BigDataCloud (diuji terpisah dari jaringan). */
export function parseBigDataCloud(input: unknown): string | null {
  if (!isRecord(input)) return null;
  const response = input as BigDataCloudResponse;
  const adminParts: string[] = [];
  if (isRecord(response.localityInfo) && Array.isArray(response.localityInfo.administrative)) {
    const admin = response.localityInfo.administrative
      .filter(isRecord)
      .map((item) => ({
        order: typeof item.order === 'number' ? item.order : 0,
        name: toCleanString(item.name),
      }))
      .sort((a, b) => a.order - b.order);
    for (const item of admin) {
      if (item.name) adminParts.push(item.name);
    }
  }
  return formatAddressParts([
    toCleanString(response.locality),
    toCleanString(response.city),
    ...adminParts,
    toCleanString(response.principalSubdivision),
    toCleanString(response.postcode),
    toCleanString(response.countryName),
  ]);
}

export function buildReverseGeocodeUrl(
  point: Pick<GeoPoint, 'latitude' | 'longitude'>,
): string {
  return `${PROVIDER_URL}?latitude=${point.latitude}&longitude=${point.longitude}&localityLanguage=id`;
}

async function fetchAddressFromProvider(
  point: Pick<GeoPoint, 'latitude' | 'longitude'>,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(buildReverseGeocodeUrl(point), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return parseBigDataCloud(data);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function remember(key: string, address: string): void {
  if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  memoryCache.set(key, { address, at: Date.now() });
}

function readMemory(key: string): string | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return entry.address;
}

async function readDisk(key: string): Promise<string | null> {
  try {
    const cached = await readGeocodeCache(key);
    if (!cached) return null;
    const at = Date.parse(cached.updatedAt);
    if (!Number.isFinite(at) || Date.now() - at > CACHE_TTL_MS) return null;
    remember(key, cached.address);
    return cached.address;
  } catch {
    return null;
  }
}

/** Reverse geocode koordinat menjadi alamat. Tidak pernah melempar error. */
export async function reverseGeocode(
  point: Pick<GeoPoint, 'latitude' | 'longitude'>,
): Promise<string | null> {
  if (!isValidPoint(point)) return null;
  const key = geocodeCacheKey(point);

  const cached = readMemory(key) ?? (await readDisk(key));
  if (cached) return cached;

  let address: string | null = null;

  if (Platform.OS !== 'web') {
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude: point.latitude,
        longitude: point.longitude,
      });
      if (results.length > 0) address = formatNativeAddress(results[0]);
    } catch {
      address = null;
    }
  }

  if (!address) address = await fetchAddressFromProvider(point);
  if (!address) return null;

  remember(key, address);
  void writeGeocodeCache(key, address).catch(() => undefined);
  return address;
}

/** Dipakai unit test agar cache memori tidak bocor antar test. */
export function clearGeocodeMemoryCache(): void {
  memoryCache.clear();
}
