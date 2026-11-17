import type { LocationRegion } from 'expo-location';
import type { GameSession } from '../types';
import type { SessionLocation } from './types';

/**
 * Hanya sesi ongoing yang punya arena + geofence aktif yang didaftarkan.
 * iOS membatasi 20 region; batas aman dipakai untuk kedua platform.
 */
export function buildGeofenceRegions(
  locations: Record<string, SessionLocation>,
  sessions: GameSession[],
): LocationRegion[] {
  const ongoingIds = new Set(
    sessions.filter((session) => session.status === 'ongoing').map((session) => session.id),
  );
  return Object.values(locations)
    .filter((location) => location.geofenceEnabled && ongoingIds.has(location.sessionId))
    .slice(0, 20)
    .map((location) => ({
      identifier: location.sessionId,
      latitude: location.latitude,
      longitude: location.longitude,
      radius: location.radiusM,
      notifyOnEnter: true,
      notifyOnExit: true,
    }));
}
