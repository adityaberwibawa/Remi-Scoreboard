import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  clearGeofenceEvents,
  clearGeofenceState,
  deleteGeofenceZone,
  fetchGeofenceEvents,
  readGeofenceZone,
  recordGeofenceTransition,
  saveGeofenceZone,
} from '../db';
import type { GeofenceEvent, GeofenceZone } from '../types';
import { geofenceSnapshot, type GeoPoint } from '../location/geo';
import { geofenceAreaSignature } from '../location/geofenceState';
import {
  applyGeofenceMonitoring,
  type GeofenceMonitoringResult,
} from '../location/geofenceTask';
import {
  getGeofenceNotificationPermissionAsync,
  notifyGeofenceTransition,
  requestGeofenceNotificationPermissionAsync,
  type GeofenceNotificationPermission,
} from '../location/geofenceNotifications';

export function useGeofence(current: GeoPoint | null) {
  const [zone, setZoneState] = useState<GeofenceZone | null>(null);
  const [events, setEvents] = useState<GeofenceEvent[]>([]);
  const [monitoring, setMonitoring] = useState<GeofenceMonitoringResult>({ mode: 'off' });
  const [notificationPermission, setNotificationPermission] =
    useState<GeofenceNotificationPermission>('undetermined');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lastInsideRef = useRef<boolean | null>(null);
  const lastZoneSignatureRef = useRef<string | null>(null);
  const zoneRef = useRef<GeofenceZone | null>(null);

  const checkNotificationPermission = useCallback(async () => {
    const result = await getGeofenceNotificationPermissionAsync();
    setNotificationPermission(result);
    return result;
  }, []);

  const syncMonitoring = useCallback(async (next: GeofenceZone | null) => {
    const result = await applyGeofenceMonitoring(next);
    setMonitoring(result);
    return result;
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [saved, latest] = await Promise.all([
        readGeofenceZone(),
        fetchGeofenceEvents(20),
      ]);
      zoneRef.current = saved;
      setZoneState(saved);
      setEvents(latest);
      setError(null);
      if (!saved || !saved.enabled) {
        lastInsideRef.current = null;
        lastZoneSignatureRef.current = null;
        await clearGeofenceState().catch(() => undefined);
      }
      await syncMonitoring(saved);
      void checkNotificationPermission();
    } catch {
      setError('Gagal memuat area geofence. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [checkNotificationPermission, syncMonitoring]);

  const save = useCallback(
    async (next: GeofenceZone): Promise<boolean> => {
      setSaving(true);
      setError(null);
      setNotice(null);
      try {
        const previous = zoneRef.current;
        await saveGeofenceZone(next);

        const areaChanged =
          !previous ||
          geofenceAreaSignature(previous) !== geofenceAreaSignature(next);
        if (!next.enabled || areaChanged) {
          await clearGeofenceState();
        }

        zoneRef.current = next;
        setZoneState(next);
        lastInsideRef.current = null;
        lastZoneSignatureRef.current = geofenceAreaSignature(next);

        const result = await syncMonitoring(next);
        let notification = notificationPermission;
        if (next.enabled) {
          notification = await requestGeofenceNotificationPermissionAsync();
          setNotificationPermission(notification);
        }

        const notificationHint =
          next.enabled && notification !== 'granted'
            ? notification === 'unavailable'
              ? ' Notifikasi tidak tersedia di perangkat ini.'
              : ' Izin notifikasi belum diberikan; riwayat tetap tercatat.'
            : '';

        if (result.mode === 'background') {
          setNotice(`Area tersimpan dan dipantau di latar belakang.${notificationHint}`);
        } else if (result.mode === 'foreground') {
          setNotice(`Area tersimpan. Geofence dicek saat aplikasi terbuka.${notificationHint}`);
        } else {
          setNotice(`Area tersimpan. Geofence dalam keadaan nonaktif.${notificationHint}`);
        }
        return true;
      } catch {
        setError('Gagal menyimpan area geofence. Coba lagi.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [notificationPermission, syncMonitoring],
  );

  const remove = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await deleteGeofenceZone();
      zoneRef.current = null;
      setZoneState(null);
      setEvents([]);
      lastInsideRef.current = null;
      lastZoneSignatureRef.current = null;
      await syncMonitoring(null);
      setNotice('Area geofence dihapus.');
      return true;
    } catch {
      setError('Gagal menghapus area geofence. Coba lagi.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [syncMonitoring]);

  const clearHistory = useCallback(async (): Promise<boolean> => {
    try {
      await clearGeofenceEvents();
      setEvents([]);
      setNotice('Riwayat geofence dibersihkan.');
      return true;
    } catch {
      setError('Gagal membersihkan riwayat geofence.');
      return false;
    }
  }, []);

  const requestBackground = useCallback(async (): Promise<GeofenceMonitoringResult> => {
    setError(null);
    setNotice(null);
    try {
      let foreground = await Location.getForegroundPermissionsAsync();
      if (foreground.status !== 'granted') {
        foreground = await Location.requestForegroundPermissionsAsync();
      }
      if (foreground.status !== 'granted') {
        setNotice('Izin lokasi dasar diperlukan sebelum mengaktifkan latar belakang.');
        return syncMonitoring(zoneRef.current);
      }
      const background = await Location.requestBackgroundPermissionsAsync();
      const result = await syncMonitoring(zoneRef.current);
      if (background.status === 'granted' && result.mode === 'background') {
        setNotice('Pemantauan latar belakang aktif.');
      } else if (background.status !== 'granted') {
        setNotice('Izin latar belakang tidak diberikan. Geofence tetap dicek saat aplikasi terbuka.');
      } else if (result.reason === 'expo-go') {
        setNotice('Expo Go tidak mendukung geofencing latar belakang. Gunakan development build.');
      } else if (result.reason === 'unsupported') {
        setNotice('Perangkat ini tidak mendukung geofencing latar belakang.');
      } else {
        setNotice('Pemantauan latar belakang belum bisa diaktifkan. Geofence tetap dicek saat aplikasi terbuka.');
      }
      return result;
    } catch {
      setError('Gagal meminta izin lokasi latar belakang.');
      return { mode: 'foreground', reason: 'error' };
    }
  }, [syncMonitoring]);

  const requestNotifications = useCallback(async (): Promise<GeofenceNotificationPermission> => {
    setError(null);
    setNotice(null);
    const result = await requestGeofenceNotificationPermissionAsync();
    setNotificationPermission(result);
    if (result === 'granted') {
      setNotice('Notifikasi area bermain aktif.');
    } else if (result === 'denied') {
      setNotice('Izin notifikasi ditolak. Riwayat tetap tercatat.');
    } else if (result === 'unavailable') {
      setNotice('Notifikasi tidak tersedia di perangkat ini.');
    }
    return result;
  }, []);

  useEffect(() => {
    if (!zone || !zone.enabled || !current) {
      lastInsideRef.current = null;
      lastZoneSignatureRef.current = null;
      return;
    }

    const signature = geofenceAreaSignature(zone);
    if (lastZoneSignatureRef.current !== signature) {
      lastZoneSignatureRef.current = signature;
      lastInsideRef.current = null;
    }

    const snapshot = geofenceSnapshot(current, zone);
    if (!Number.isFinite(snapshot.distance)) return;
    if (lastInsideRef.current === snapshot.inside) return;
    lastInsideRef.current = snapshot.inside;

    const eventPoint = {
      latitude: current.latitude,
      longitude: current.longitude,
      occurredAt: new Date().toISOString(),
    };
    void recordGeofenceTransition({
      zoneSignature: signature,
      inside: snapshot.inside,
      ...eventPoint,
    })
      .then((inserted) => {
        if (!inserted) return;
        void notifyGeofenceTransition(inserted, zone.name);
        return fetchGeofenceEvents(20).then(setEvents);
      })
      .catch(() => setError('Gagal mencatat event geofence.'));
  }, [current, zone]);

  const status = useMemo(() => {
    if (!zone || !current) return null;
    return geofenceSnapshot(current, zone);
  }, [current, zone]);

  return {
    zone,
    events,
    monitoring,
    notificationPermission,
    status,
    loading,
    saving,
    error,
    notice,
    reload,
    save,
    remove,
    clearHistory,
    requestBackground,
    requestNotifications,
    setError,
    setNotice,
  };
}
