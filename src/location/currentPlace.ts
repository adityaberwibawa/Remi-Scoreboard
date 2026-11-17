/**
 * Ambil satu posisi terkini beserta alamatnya. Selalu mengembalikan objek
 * hasil (tidak melempar) agar layar bisa menampilkan status yang jelas.
 */
import * as Location from 'expo-location';
import type { SessionLocation } from '../types';
import { areLocationServicesEnabled, ensureForegroundPermission } from './permissions';
import { reverseGeocode } from './reverseGeocode';

const POSITION_TIMEOUT_MS = 12_000;
const LAST_KNOWN_MAX_AGE_MS = 60_000;

export interface CurrentPlaceResult {
  place: SessionLocation | null;
  error: string | null;
  reason: 'denied' | 'unavailable' | 'timeout' | 'error' | null;
  /** True bila koordinat dilaporkan sebagai mock oleh OS. */
  mocked: boolean;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('timeout'));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function resolvePosition(): Promise<{ object: Location.LocationObject; mocked: boolean } | null> {
  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: LAST_KNOWN_MAX_AGE_MS,
    requiredAccuracy: 500,
  }).catch(() => null);

  try {
    const current = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      }),
      POSITION_TIMEOUT_MS,
    );
    return { object: current, mocked: current.mocked === true };
  } catch {
    if (lastKnown) return { object: lastKnown, mocked: lastKnown.mocked === true };
    return null;
  }
}

export async function getCurrentPlace(options?: {
  skipGeocode?: boolean;
}): Promise<CurrentPlaceResult> {
  const permission = await ensureForegroundPermission();
  if (!permission.ok) {
    return {
      place: null,
      error: permission.message ?? 'Izin lokasi belum diberikan.',
      reason: 'denied',
      mocked: false,
    };
  }

  if (!(await areLocationServicesEnabled())) {
    return {
      place: null,
      error: 'Layanan lokasi perangkat mati. Aktifkan GPS/lokasi lalu coba lagi.',
      reason: 'unavailable',
      mocked: false,
    };
  }

  let position: Awaited<ReturnType<typeof resolvePosition>>;
  try {
    position = await resolvePosition();
  } catch {
    position = null;
  }
  if (!position) {
    return {
      place: null,
      error: 'Lokasi tidak ditemukan. Pastikan GPS aktif dan berada di area terbuka.',
      reason: 'timeout',
      mocked: false,
    };
  }

  const { coords } = position.object;
  const address = options?.skipGeocode
    ? null
    : await reverseGeocode({ latitude: coords.latitude, longitude: coords.longitude });

  return {
    place: {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
      address,
      capturedAt: new Date(position.object.timestamp || Date.now()).toISOString(),
    },
    error: null,
    reason: null,
    mocked: position.mocked,
  };
}
