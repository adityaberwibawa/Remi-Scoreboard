/** Registrasi region geofence untuk sesi yang sedang berjalan. */
import * as Location from 'expo-location';
import type { GameSession } from '../types';
import { GEOFENCE_TASK } from './geofenceTask';
import { buildGeofenceRegions } from './geofenceRegions';
import type { SessionLocation } from './types';

export { buildGeofenceRegions } from './geofenceRegions';

export interface SyncGeofencesResult {
  activeCount: number;
  error?: string;
}

/** Hindari restart region saat skor berubah tetapi area tidak berubah. */
let lastRegionSignature: string | null = null;

function signatureOf(regions: Location.LocationRegion[]): string {
  return regions
    .map(
      (region) =>
        `${region.identifier ?? ''}:${region.latitude}:${region.longitude}:${region.radius}`,
    )
    .sort()
    .join('|');
}

export async function syncGeofences(
  locations: Record<string, SessionLocation>,
  sessions: GameSession[],
): Promise<SyncGeofencesResult> {
  const regions = buildGeofenceRegions(locations, sessions);
  const signature = signatureOf(regions);

  let alreadyStarted = false;
  try {
    alreadyStarted = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
  } catch {
    alreadyStarted = false;
  }

  if (regions.length === 0) {
    if (alreadyStarted) {
      try {
        await Location.stopGeofencingAsync(GEOFENCE_TASK);
      } catch {
        // Tidak ada yang perlu dilakukan bila OS sudah menghentikannya.
      }
    }
    lastRegionSignature = null;
    return { activeCount: 0 };
  }

  try {
    const [foreground, background] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
    ]);
    if (foreground.status !== 'granted' || background.status !== 'granted') {
      if (alreadyStarted) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK).catch(() => undefined);
      }
      lastRegionSignature = null;
      return { activeCount: 0, error: 'Izin lokasi background belum diberikan.' };
    }

    if (alreadyStarted && lastRegionSignature === signature) {
      return { activeCount: regions.length };
    }

    await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
    lastRegionSignature = signature;
    return { activeCount: regions.length };
  } catch {
    lastRegionSignature = null;
    return { activeCount: 0, error: 'Geofence belum bisa diaktifkan di perangkat ini.' };
  }
}
