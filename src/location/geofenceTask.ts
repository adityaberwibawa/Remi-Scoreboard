/**
 * Task geofence harus didefinisikan di module scope dan di-import lebih awal
 * oleh root layout agar bisa dieksekusi saat aplikasi di latar belakang.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { fetchArena, fetchLastGeofenceEvent, insertGeofenceEvent } from '../db';
import type { GeofenceEventType } from '../types';
import { configureNotifications, presentGeofenceNotification } from './notifications';

export const ARENA_GEOFENCE_TASK = 'pentungscore-arena-geofence';

const DEDUPE_MS = 10 * 60 * 1000;

interface ArenaGeofencePayload {
  eventType: Location.GeofencingEventType;
  region?: Location.LocationRegion;
}

if (!TaskManager.isTaskDefined(ARENA_GEOFENCE_TASK)) {
  TaskManager.defineTask(ARENA_GEOFENCE_TASK, async ({ data, error }) => {
    if (error || !data) return;
    const payload = data as ArenaGeofencePayload;
    const type: GeofenceEventType =
      payload.eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit';

    try {
      configureNotifications();

      // iOS melaporkan state awal region setiap app dibuka: jangan spam event.
      const last = await fetchLastGeofenceEvent();
      if (last && last.type === type) {
        const lastAt = Date.parse(last.at);
        if (Number.isFinite(lastAt) && Date.now() - lastAt < DEDUPE_MS) return;
      }

      const arena = await fetchArena();
      const arenaName = arena?.name?.trim() || 'arena permainan';
      await insertGeofenceEvent({ type, arenaName, at: new Date().toISOString() });
      await presentGeofenceNotification(type, arenaName);
    } catch {
      // Task latar belakang tidak boleh crash; event berikutnya tetap diproses.
    }
  });
}
