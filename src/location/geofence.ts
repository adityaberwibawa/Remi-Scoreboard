import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { Arena } from '../types';
import { clampRadius } from './geo';
import { ARENA_GEOFENCE_TASK } from './geofenceTask';
import { ensureNotificationPermission } from './notifications';
import { ensureBackgroundPermission, ensureForegroundPermission } from './permissions';

export interface BackgroundGeofenceSupport {
  supported: boolean;
  reason: string | null;
}

export interface GeofenceStartResult {
  ok: boolean;
  error: string | null;
  warning: string | null;
}

const EXPO_GO_REASON =
  'Geofence latar belakang butuh development build. Di Expo Go, pemantauan arena hanya berjalan saat aplikasi terbuka.';

export async function isBackgroundGeofenceSupported(): Promise<BackgroundGeofenceSupport> {
  try {
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      return { supported: false, reason: EXPO_GO_REASON };
    }
    const available = await TaskManager.isAvailableAsync();
    if (!available) return { supported: false, reason: EXPO_GO_REASON };
    return { supported: true, reason: null };
  } catch {
    return { supported: false, reason: 'Perangkat ini tidak mendukung geofence latar belakang.' };
  }
}

export async function startArenaMonitoring(arena: Arena): Promise<GeofenceStartResult> {
  const support = await isBackgroundGeofenceSupported();
  if (!support.supported) {
    return { ok: false, error: support.reason, warning: null };
  }

  const foreground = await ensureForegroundPermission();
  if (!foreground.ok) {
    return { ok: false, error: foreground.message, warning: null };
  }

  const background = await ensureBackgroundPermission();
  if (!background.ok) {
    return { ok: false, error: background.message, warning: null };
  }

  const notificationGranted = await ensureNotificationPermission();
  const warning = notificationGranted
    ? null
    : 'Izin notifikasi tidak aktif. Event arena tetap dicatat tanpa notifikasi.';

  try {
    await Location.startGeofencingAsync(ARENA_GEOFENCE_TASK, [
      {
        identifier: 'pentungscore-arena',
        latitude: arena.latitude,
        longitude: arena.longitude,
        radius: clampRadius(arena.radiusM),
        notifyOnEnter: true,
        notifyOnExit: true,
      },
    ]);
    return { ok: true, error: null, warning };
  } catch {
    return {
      ok: false,
      error:
        'Gagal mengaktifkan geofence. Pastikan izin lokasi “Selalu izinkan” sudah diberikan.',
      warning,
    };
  }
}

export async function stopArenaMonitoring(): Promise<void> {
  try {
    const started = await Location.hasStartedGeofencingAsync(ARENA_GEOFENCE_TASK);
    if (started) await Location.stopGeofencingAsync(ARENA_GEOFENCE_TASK);
  } catch {
    // Tidak ada yang perlu dilakukan bila task belum pernah aktif.
  }
}

export async function isArenaMonitoringActive(): Promise<boolean> {
  try {
    return await Location.hasStartedGeofencingAsync(ARENA_GEOFENCE_TASK);
  } catch {
    return false;
  }
}
