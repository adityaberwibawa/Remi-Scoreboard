import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  clearGeofenceEvents,
  deleteGeofenceZone,
  fetchGeofenceEvents,
  insertGeofenceEvent,
  readGeofenceZone,
  saveGeofenceZone,
} from '../db';
import type { GeofenceEvent, GeofenceZone } from '../types';
import { geofenceSnapshot, type GeoPoint } from '../location/geo';
import {
  applyGeofenceMonitoring,
  type GeofenceMonitoringMode,
  type GeofenceMonitoringResult,
} from '../location/geofenceTask';

export function useGeofence(current: GeoPoint | null) {
  const [zone, setZoneState] = useState<GeofenceZone | null>(null);
  const [events, setEvents] = useState<GeofenceEvent[]>([]);
  const [monitoring, setMonitoring] = useState<GeofenceMonitoringResult>({ mode: 'off' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lastInsideRef = useRef<boolean | null>(null);
  const zoneRef = useRef<GeofenceZone | null>(null);
  const monitoringRef = useRef<GeofenceMonitoringMode>('off');

  const syncMonitoring = useCallback(async (next: GeofenceZone | null) => {
    const result = await applyGeofenceMonitoring(next);
    monitoringRef.current = result.mode;
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
      if (!saved || !saved.enabled) lastInsideRef.current = null;
      await syncMonitoring(saved);
    } catch {
      setError('Gagal memuat area geofence. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [syncMonitoring]);

  const save = useCallback(
    async (next: GeofenceZone): Promise<boolean> => {
      setSaving(true);
      setError(null);
      setNotice(null);
      try {
        await saveGeofenceZone(next);
        zoneRef.current = next;
        setZoneState(next);
        lastInsideRef.current = null;
        const result = await syncMonitoring(next);
        if (result.mode === 'background') {
          setNotice('Area tersimpan dan dipantau di latar belakang.');
        } else if (result.mode === 'foreground') {
          setNotice('Area tersimpan. Geofence dicek saat aplikasi terbuka.');
        } else {
          setNotice('Area tersimpan. Geofence dalam keadaan nonaktif.');
        }
        return true;
      } catch {
        setError('Gagal menyimpan area geofence. Coba lagi.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [syncMonitoring],
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

  useEffect(() => {
    if (!zone || !zone.enabled || !current) {
      lastInsideRef.current = null;
      return;
    }
    const snapshot = geofenceSnapshot(current, zone);
    if (!Number.isFinite(snapshot.distance)) return;
    if (lastInsideRef.current === null) {
      lastInsideRef.current = snapshot.inside;
      return;
    }
    if (lastInsideRef.current === snapshot.inside) return;
    lastInsideRef.current = snapshot.inside;
    if (monitoringRef.current === 'background') return;
    const event = {
      type: snapshot.inside ? ('enter' as const) : ('exit' as const),
      latitude: current.latitude,
      longitude: current.longitude,
      occurredAt: new Date().toISOString(),
    };
    void insertGeofenceEvent(event)
      .then(() => fetchGeofenceEvents(20))
      .then(setEvents)
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
    setError,
    setNotice,
  };
}
