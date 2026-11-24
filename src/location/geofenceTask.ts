import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { readGeofenceZone, recordGeofenceTransition } from '../db';
import type { GeofenceEvent, GeofenceZone } from '../types';
import { clampRadius, isValidCoordinate, type GeoPoint } from './geo';
import { geofenceAreaSignature, sameGeofenceArea } from './geofenceState';
import { notifyGeofenceTransition } from './geofenceNotifications';

export const GEOFENCE_TASK_NAME = 'pentungscore-geofence';
export const GEOFENCE_IDENTIFIER = 'pentungscore-area';

const POSITION_TIMEOUT_MS = 6000;
const LAST_KNOWN_TIMEOUT_MS = 3000;
const LAST_KNOWN_MAX_AGE_MS = 60_000;
const LAST_KNOWN_MAX_ACCURACY_M = 250;

export type GeofenceMonitoringMode = 'background' | 'foreground' | 'off';

export type GeofenceMonitoringReason = 'expo-go' | 'permission' | 'unsupported' | 'error';

export interface GeofenceMonitoringResult {
  mode: GeofenceMonitoringMode;
  reason?: GeofenceMonitoringReason;
}

export interface GeofenceTaskData {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}

/** Signature terakhir yang berhasil didaftarkan pada proses aplikasi ini. */
let appliedSignature: string | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, ms);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

function toGeoPoint(coords: Location.LocationObjectCoords | null | undefined): GeoPoint | null {
  if (!coords) return null;
  const point = { latitude: coords.latitude, longitude: coords.longitude };
  return isValidCoordinate(point) ? point : null;
}

/**
 * Ambil posisi perangkat saat event geofence terjadi. Utamakan posisi terakhir
 * yang masih segar, lalu posisi terkini dengan batas waktu. Jika keduanya
 * gagal, pusat region tetap dipakai supaya event tidak hilang.
 */
export async function resolveGeofenceEventPosition(
  region: Pick<Location.LocationRegion, 'latitude' | 'longitude'>,
): Promise<GeoPoint> {
  const fallback = { latitude: region.latitude, longitude: region.longitude };

  try {
    const lastKnown = await withTimeout(
      Location.getLastKnownPositionAsync({
        maxAge: LAST_KNOWN_MAX_AGE_MS,
        requiredAccuracy: LAST_KNOWN_MAX_ACCURACY_M,
      }),
      LAST_KNOWN_TIMEOUT_MS,
    );
    const point = toGeoPoint(lastKnown?.coords);
    if (point) return point;
  } catch {
    // Lanjut ke posisi terkini.
  }

  try {
    const current = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      POSITION_TIMEOUT_MS,
    );
    const point = toGeoPoint(current?.coords);
    if (point) return point;
  } catch {
    // Pakai pusat region sebagai fallback.
  }

  return fallback;
}

/** Mapping murni event task, dipakai juga oleh test. */
export function mapGeofenceTaskEvent(
  data: GeofenceTaskData,
  position?: GeoPoint | null,
): Omit<GeofenceEvent, 'id'> {
  const entered = data.eventType === Location.GeofencingEventType.Enter;
  const point =
    position && isValidCoordinate(position)
      ? position
      : { latitude: data.region.latitude, longitude: data.region.longitude };

  return {
    type: entered ? 'enter' : 'exit',
    latitude: point.latitude,
    longitude: point.longitude,
    occurredAt: new Date().toISOString(),
  };
}

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(GEOFENCE_TASK_NAME)) {
  TaskManager.defineTask<GeofenceTaskData>(GEOFENCE_TASK_NAME, async ({ data, error }) => {
    if (error || !data) return;
    try {
      const zone = await readGeofenceZone();
      if (!zone || !zone.enabled) return;

      // Abaikan event dari region lama setelah area diubah/dihapus.
      const eventArea = {
        latitude: data.region.latitude,
        longitude: data.region.longitude,
        radius: data.region.radius,
      };
      if (!sameGeofenceArea(zone, eventArea)) return;

      const position = await resolveGeofenceEventPosition(data.region);
      const mapped = mapGeofenceTaskEvent(data, position);
      const inserted = await recordGeofenceTransition({
        zoneSignature: geofenceAreaSignature(zone),
        inside: mapped.type === 'enter',
        latitude: mapped.latitude,
        longitude: mapped.longitude,
        occurredAt: mapped.occurredAt,
      });
      if (inserted) {
        await notifyGeofenceTransition(inserted, zone.name);
      }
    } catch {
      // Task background tidak boleh melempar error ke runtime native.
    }
  });
}

export async function stopGeofenceMonitoring(): Promise<void> {
  if (Platform.OS === 'web') {
    appliedSignature = null;
    return;
  }
  try {
    if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME)) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    }
  } catch {
    // Abaikan; status akhir tetap off.
  } finally {
    appliedSignature = null;
  }
}

function toLocationRegion(zone: GeofenceZone): Location.LocationRegion {
  return {
    identifier: GEOFENCE_IDENTIFIER,
    latitude: zone.latitude,
    longitude: zone.longitude,
    radius: clampRadius(zone.radius),
    notifyOnEnter: true,
    notifyOnExit: true,
  };
}

async function isSameRegionAlreadyRegistered(zone: GeofenceZone): Promise<boolean> {
  const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME).catch(() => false);
  if (!started) return false;

  const signature = geofenceAreaSignature(zone);
  if (appliedSignature && appliedSignature === signature) return true;

  // TaskManager menyimpan options di native dan tetap ada setelah app restart.
  const options = await TaskManager.getTaskOptionsAsync<{
    regions?: Location.LocationRegion[];
  }>(GEOFENCE_TASK_NAME).catch(() => null);
  return Boolean(
    options?.regions?.some((region) => sameGeofenceArea(zone, region)),
  );
}

export async function applyGeofenceMonitoring(
  zone: GeofenceZone | null,
): Promise<GeofenceMonitoringResult> {
  if (!zone || !zone.enabled) {
    await stopGeofenceMonitoring();
    return { mode: 'off' };
  }
  if (Platform.OS === 'web') {
    return { mode: 'foreground', reason: 'unsupported' };
  }
  if (Constants.appOwnership === 'expo') {
    return { mode: 'foreground', reason: 'expo-go' };
  }
  const available = await TaskManager.isAvailableAsync().catch(() => false);
  if (!available) {
    return { mode: 'foreground', reason: 'unsupported' };
  }
  const permission = await Location.getBackgroundPermissionsAsync().catch(() => null);
  if (permission?.status !== 'granted') {
    return { mode: 'foreground', reason: 'permission' };
  }
  try {
    if (await isSameRegionAlreadyRegistered(zone)) {
      appliedSignature = geofenceAreaSignature(zone);
      return { mode: 'background' };
    }

    await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, [toLocationRegion(zone)]);
    appliedSignature = geofenceAreaSignature(zone);
    return { mode: 'background' };
  } catch {
    appliedSignature = null;
    return { mode: 'foreground', reason: 'error' };
  }
}
