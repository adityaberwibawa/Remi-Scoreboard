import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { AppState, Linking } from 'react-native';
import type { LocationPermissionState } from './types';

function toState(response: Location.LocationPermissionResponse): LocationPermissionState {
  if (response.status === 'granted') return 'granted';
  if (response.status === 'denied') return 'denied';
  return 'undetermined';
}

export interface LocationPermissions {
  foreground: LocationPermissionState;
  background: LocationPermissionState;
  servicesEnabled: boolean | null;
  canAskForeground: boolean;
  canAskBackground: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  requestForeground: () => Promise<LocationPermissionState>;
  requestBackground: () => Promise<LocationPermissionState>;
  openSettings: () => void;
}

/**
 * Izin lokasi tidak diminta otomatis saat app dibuka. Layar Peta memanggil
 * requestForeground saat pengguna menekan tombol, lalu requestBackground hanya
 * ketika pengguna mengaktifkan geofence.
 */
export function useLocationPermissions(): LocationPermissions {
  const [foreground, setForeground] = useState<LocationPermissionState>('checking');
  const [background, setBackground] = useState<LocationPermissionState>('checking');
  const [servicesEnabled, setServicesEnabled] = useState<boolean | null>(null);
  const [canAskForeground, setCanAskForeground] = useState(true);
  const [canAskBackground, setCanAskBackground] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [fg, bg, services] = await Promise.all([
        Location.getForegroundPermissionsAsync(),
        Location.getBackgroundPermissionsAsync(),
        Location.hasServicesEnabledAsync(),
      ]);
      setForeground(toState(fg));
      setBackground(toState(bg));
      setCanAskForeground(fg.canAskAgain);
      setCanAskBackground(bg.canAskAgain);
      setServicesEnabled(services);
      setError(null);
    } catch {
      setForeground('denied');
      setServicesEnabled(null);
      setError('Gagal memeriksa izin lokasi.');
    }
  }, []);

  useEffect(() => {
    // Ditunda satu tick agar pemeriksaan izin tidak memicu render berantai.
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  // Pengguna bisa mengubah izin lewat Settings; periksa ulang saat app aktif.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const requestForeground = useCallback(async () => {
    try {
      const response = await Location.requestForegroundPermissionsAsync();
      const state = toState(response);
      setForeground(state);
      setCanAskForeground(response.canAskAgain);
      const services = await Location.hasServicesEnabledAsync().catch(() => null);
      setServicesEnabled(services);
      setError(state === 'granted' ? null : 'Izin lokasi belum diberikan.');
      return state;
    } catch {
      setForeground('denied');
      setError('Gagal meminta izin lokasi.');
      return 'denied' as const;
    }
  }, []);

  const requestBackground = useCallback(async () => {
    try {
      const response = await Location.requestBackgroundPermissionsAsync();
      const state = toState(response);
      setBackground(state);
      setCanAskBackground(response.canAskAgain);
      if (state === 'granted') {
        setError(null);
      } else {
        setError(
          'Izin “Selalu” diperlukan agar pengingat area tetap aktif saat aplikasi ditutup.',
        );
      }
      return state;
    } catch {
      setBackground('denied');
      setError('Gagal meminta izin lokasi background.');
      return 'denied' as const;
    }
  }, []);

  const openSettings = useCallback(() => {
    void Linking.openSettings().catch(() => undefined);
  }, []);

  return {
    foreground,
    background,
    servicesEnabled,
    canAskForeground,
    canAskBackground,
    error,
    refresh,
    requestForeground,
    requestBackground,
    openSettings,
  };
}
