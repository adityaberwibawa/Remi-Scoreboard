/**
 * Task background geofence. File ini harus diimpor dari root layout agar
 * TaskManager mendaftarkan task saat aplikasi dibuka, termasuk headless launch.
 */
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { insertGeofenceEvent } from '../db';

export const GEOFENCE_TASK = 'pentungscore-arena-geofence';

interface GeofenceTaskData {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(GEOFENCE_TASK)) {
  TaskManager.defineTask<GeofenceTaskData>(GEOFENCE_TASK, async ({ data, error }) => {
    if (error || !data) return;
    const sessionId = data.region?.identifier;
    if (!sessionId) return;

    const type = data.eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit';
    try {
      await insertGeofenceEvent({
        sessionId,
        type,
        source: 'background',
        latitude: Number.isFinite(data.region.latitude) ? data.region.latitude : null,
        longitude: Number.isFinite(data.region.longitude) ? data.region.longitude : null,
        occurredAt: new Date().toISOString(),
      });
    } catch {
      // Task background tidak punya UI; kegagalan tulis cukup diabaikan.
    }
  });
}
