/** Notifikasi lokal tidak tersedia di web; semua fungsi menjadi no-op. */
export const GEOFENCE_CHANNEL_ID = 'arena-geofence';

export function configureNotifications(): void {
  // Tidak ada notifikasi lokal di web.
}

export async function ensureNotificationPermission(): Promise<boolean> {
  return false;
}

export async function presentGeofenceNotification(
  _type: 'enter' | 'exit',
  _arenaName: string,
): Promise<void> {
  // Tidak ada notifikasi lokal di web.
}
