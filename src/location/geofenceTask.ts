import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { insertGeofenceEvent } from '../db';
import type { GeofenceZone } from '../types';
import { clampRadius } from './geo';

export const GEOFENCE_TASK_NAME = 'pentungscore-geofence';
export const GEOFENCE_IDENTIFIER = 'pentungscore-area';

export type GeofenceMonitoringMode = 'background' | 'foreground' | 'off';

export type GeofenceMonitoringReason = 'expo-go' | 'permission' | 'unsupported' | 'error';

export interface GeofenceMonitoringResult {
  mode: GeofenceMonitoringMode;
  reason?: GeofenceMonitoringReason;
}

interface GeofenceTaskData {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(GEOFENCE_TASK_NAME)) {
  TaskManager.defineTask<GeofenceTaskData>(GEOFENCE_TASK_NAME, async ({ data, error }) => {
    if (error || !data) return;
    const entered = data.eventType === Location.GeofencingEventType.Enter;
    await insertGeofenceEvent({
      type: entered ? 'enter' : 'exit',
      latitude: data.region.latitude,
      longitude: data.region.longitude,
      occurredAt: new Date().toISOString(),
    }).catch(() => undefined);
  });
}

export async function stopGeofenceMonitoring(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME)) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    }
  } catch {
    return;
  }
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
    await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, [
      {
        identifier: GEOFENCE_IDENTIFIER,
        latitude: zone.latitude,
        longitude: zone.longitude,
        radius: clampRadius(zone.radius),
        notifyOnEnter: true,
        notifyOnExit: true,
      },
    ]);
    return { mode: 'background' };
  } catch {
    return { mode: 'foreground', reason: 'error' };
  }
}
