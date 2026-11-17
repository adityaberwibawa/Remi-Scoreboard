/**
 * Pembungkus izin lokasi dengan pesan siap tampil (bahasa Indonesia).
 * Semua kegagalan dikembalikan sebagai nilai, bukan exception.
 */
import * as Location from 'expo-location';

export interface PermissionOutcome {
  ok: boolean;
  canAskAgain: boolean;
  message: string | null;
}

function toOutcome(
  response: Location.LocationPermissionResponse,
  deniedMessage: string,
  blockedMessage: string,
): PermissionOutcome {
  if (response.granted) return { ok: true, canAskAgain: true, message: null };
  return {
    ok: false,
    canAskAgain: response.canAskAgain,
    message: response.canAskAgain ? deniedMessage : blockedMessage,
  };
}

export async function ensureForegroundPermission(): Promise<PermissionOutcome> {
  try {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.granted) return { ok: true, canAskAgain: true, message: null };
    if (!existing.canAskAgain) {
      return {
        ok: false,
        canAskAgain: false,
        message:
          'Izin lokasi diblokir. Aktifkan lewat Pengaturan perangkat agar arena bisa dipakai.',
      };
    }
    const requested = await Location.requestForegroundPermissionsAsync();
    return toOutcome(
      requested,
      'Izin lokasi ditolak. PentungScore butuh lokasi untuk menandai arena.',
      'Izin lokasi diblokir. Aktifkan lewat Pengaturan perangkat agar arena bisa dipakai.',
    );
  } catch {
    return {
      ok: false,
      canAskAgain: true,
      message: 'Gagal meminta izin lokasi. Coba lagi.',
    };
  }
}

export async function ensureBackgroundPermission(): Promise<PermissionOutcome> {
  try {
    const existing = await Location.getBackgroundPermissionsAsync();
    if (existing.granted) return { ok: true, canAskAgain: true, message: null };
    if (!existing.canAskAgain) {
      return {
        ok: false,
        canAskAgain: false,
        message:
          'Izin lokasi latar belakang diblokir. Aktifkan “Selalu izinkan” di Pengaturan untuk memantau arena.',
      };
    }
    const requested = await Location.requestBackgroundPermissionsAsync();
    return toOutcome(
      requested,
      'Izin lokasi latar belakang ditolak. Geofence tetap bisa dipakai saat aplikasi terbuka.',
      'Izin lokasi latar belakang diblokir. Aktifkan “Selalu izinkan” di Pengaturan untuk memantau arena.',
    );
  } catch {
    return {
      ok: false,
      canAskAgain: true,
      message: 'Gagal meminta izin lokasi latar belakang. Coba lagi.',
    };
  }
}

export async function areLocationServicesEnabled(): Promise<boolean> {
  try {
    return await Location.hasServicesEnabledAsync();
  } catch {
    return false;
  }
}

export function locationDeniedMessage(canAskAgain: boolean): string {
  return canAskAgain
    ? 'Izin lokasi belum diberikan.'
    : 'Izin lokasi diblokir. Aktifkan lewat Pengaturan perangkat.';
}
