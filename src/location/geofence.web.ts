import type { Arena } from '../types';

export interface BackgroundGeofenceSupport {
  supported: boolean;
  reason: string | null;
}

export interface GeofenceStartResult {
  ok: boolean;
  error: string | null;
  warning: string | null;
}

const WEB_REASON =
  'Geofence latar belakang hanya tersedia di aplikasi Android/iOS. Di web, status arena dicek selama halaman terbuka.';

export async function isBackgroundGeofenceSupported(): Promise<BackgroundGeofenceSupport> {
  return { supported: false, reason: WEB_REASON };
}

export async function startArenaMonitoring(_arena: Arena): Promise<GeofenceStartResult> {
  return { ok: false, error: WEB_REASON, warning: null };
}

export async function stopArenaMonitoring(): Promise<void> {
  // Tidak ada task latar belakang di web.
}

export async function isArenaMonitoringActive(): Promise<boolean> {
  return false;
}
