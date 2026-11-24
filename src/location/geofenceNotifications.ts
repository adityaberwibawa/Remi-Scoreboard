import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { GeofenceEvent } from '../types';

export const GEOFENCE_CHANNEL_ID = 'pentungscore-geofence';

export type GeofenceNotificationPermission =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'unavailable';

// Nilai enum iOS/Android dihindari sebagai member namespace karena
// import/namespace tidak mengenali re-export tipe dari expo-notifications.
const IOS_AUTHORIZED_STATUS = 2;
const IOS_PROVISIONAL_STATUS = 3;

function permissionFromSettings(
  settings: Notifications.NotificationPermissionsStatus,
): GeofenceNotificationPermission {
  const iosStatus = Number(settings.ios?.status);
  if (
    settings.granted ||
    iosStatus === IOS_AUTHORIZED_STATUS ||
    iosStatus === IOS_PROVISIONAL_STATUS
  ) {
    return 'granted';
  }
  return settings.status === 'denied' ? 'denied' : 'undetermined';
}

if (Platform.OS !== 'web') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Modul notifikasi tidak tersedia pada beberapa lingkungan pengembangan.
  }
}

/** Buat channel Android sebelum meminta izin POST_NOTIFICATIONS. */
export async function ensureGeofenceNotificationChannelAsync(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(GEOFENCE_CHANNEL_ID, {
      name: 'Area bermain',
      description: 'Pemberitahuan saat masuk atau keluar area bermain.',
      importance: 6 as Notifications.AndroidImportance,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#34D399',
      sound: 'default',
    });
  } catch {
    // Channel bisa gagal dibuat pada lingkungan tanpa modul native.
  }
}

export async function getGeofenceNotificationPermissionAsync(): Promise<GeofenceNotificationPermission> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    const settings = await Notifications.getPermissionsAsync();
    return permissionFromSettings(settings);
  } catch {
    return 'unavailable';
  }
}

export async function requestGeofenceNotificationPermissionAsync(): Promise<GeofenceNotificationPermission> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    await ensureGeofenceNotificationChannelAsync();
    const current = await Notifications.getPermissionsAsync();
    const existing = permissionFromSettings(current);
    if (existing === 'granted') return existing;
    if (!current.canAskAgain) return existing;

    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: true,
      },
    });
    return permissionFromSettings(requested);
  } catch {
    return 'unavailable';
  }
}

/** Kirim notifikasi lokal; kegagalan tidak boleh mengganggu pencatatan riwayat. */
export async function notifyGeofenceTransition(
  event: GeofenceEvent,
  zoneName: string,
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const permission = await getGeofenceNotificationPermissionAsync();
    if (permission !== 'granted') return;

    const areaName = zoneName.trim() || 'area bermain';
    const entered = event.type === 'enter';
    await Notifications.scheduleNotificationAsync({
      content: {
        title: entered ? 'Masuk area bermain' : 'Keluar area bermain',
        body: entered
          ? `Kamu masuk ke ${areaName}.`
          : `Kamu keluar dari ${areaName}.`,
        sound: 'default',
        data: {
          url: '/(tabs)/location',
          eventType: event.type,
          occurredAt: event.occurredAt,
        },
      },
      trigger: { channelId: GEOFENCE_CHANNEL_ID },
    });
  } catch {
    // Izin/modul notifikasi bisa tidak tersedia; riwayat tetap tersimpan.
  }
}
