import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';

export const GEOFENCE_CHANNEL_ID = 'arena-geofence';

let handlerConfigured = false;

/** Tampilkan notifikasi meski aplikasi sedang terbuka. */
export function configureNotifications(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(GEOFENCE_CHANNEL_ID, {
    name: 'Arena & geofence',
    description: 'Pemberitahuan saat Anda masuk atau keluar arena permainan.',
    importance: AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#34D399',
  });
}

/** Minta izin notifikasi. Mengembalikan false bila ditolak (tanpa melempar). */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    configureNotifications();
    await ensureChannel();
    const existing = await Notifications.getPermissionsAsync();
    if (
      existing.granted ||
      existing.ios?.status === IosAuthorizationStatus.PROVISIONAL
    ) {
      return true;
    }
    if (!existing.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return (
      requested.granted ||
      requested.ios?.status === IosAuthorizationStatus.PROVISIONAL
    );
  } catch {
    return false;
  }
}

export async function presentGeofenceNotification(
  type: 'enter' | 'exit',
  arenaName: string,
): Promise<void> {
  try {
    configureNotifications();
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: type === 'enter' ? 'Kembali di arena' : 'Meninggalkan arena',
        body:
          type === 'enter'
            ? `Anda tiba di ${arenaName}.`
            : `Anda keluar dari ${arenaName}.`,
        data: { type: 'arena-geofence', event: type },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: GEOFENCE_CHANNEL_ID,
      },
    });
  } catch {
    // Notifikasi bersifat pelengkap: kegagalan tidak boleh menggagalkan task.
  }
}
