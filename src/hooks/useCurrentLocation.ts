import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

export type LocationPermissionState =
  | 'checking'
  | 'undetermined'
  | 'granted'
  | 'denied'
  | 'unavailable';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function useCurrentLocation(active: boolean) {
  const [permission, setPermission] = useState<LocationPermissionState>('checking');
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [servicesEnabled, setServicesEnabled] = useState(true);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const loadPosition = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!aliveRef.current) return;
      setServicesEnabled(enabled);
      if (!enabled) {
        setError('Layanan lokasi mati. Aktifkan GPS lalu coba lagi.');
        return;
      }
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 300000,
        requiredAccuracy: 500,
      });
      if (lastKnown && aliveRef.current) setLocation(lastKnown);
      const current = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        20000,
      );
      if (aliveRef.current) setLocation(current);
    } catch {
      if (aliveRef.current) {
        setError('Gagal mengambil lokasi. Pastikan GPS aktif lalu coba lagi.');
      }
    } finally {
      if (aliveRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      let result = await Location.getForegroundPermissionsAsync();
      if (result.status !== 'granted') {
        result = await Location.requestForegroundPermissionsAsync();
      }
      if (!aliveRef.current) return false;
      setCanAskAgain(result.canAskAgain);
      if (result.status !== 'granted') {
        setPermission(result.canAskAgain ? 'undetermined' : 'denied');
        setError(
          result.canAskAgain
            ? 'Izin lokasi diperlukan untuk menampilkan peta dan area bermain.'
            : 'Izin lokasi ditolak permanen. Buka pengaturan untuk mengizinkannya.',
        );
        return false;
      }
      setPermission('granted');
      await loadPosition('initial');
      return true;
    } catch {
      if (aliveRef.current) {
        setPermission('unavailable');
        setError('Layanan lokasi tidak tersedia di perangkat ini.');
      }
      return false;
    }
  }, [loadPosition]);

  const refresh = useCallback(async () => {
    if (permission !== 'granted') {
      await requestPermission();
      return;
    }
    await loadPosition('refresh');
  }, [loadPosition, permission, requestPermission]);

  const checkPermission = useCallback(async () => {
    try {
      const result = await Location.getForegroundPermissionsAsync();
      if (!aliveRef.current) return;
      setCanAskAgain(result.canAskAgain);
      if (result.status === 'granted') {
        setPermission('granted');
        void loadPosition('initial');
      } else {
        setPermission(result.canAskAgain ? 'undetermined' : 'denied');
      }
    } catch {
      if (aliveRef.current) setPermission('unavailable');
    }
  }, [loadPosition]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void checkPermission();
    }, 0);
    return () => clearTimeout(timer);
  }, [checkPermission]);

  useEffect(() => {
    if (!active || permission !== 'granted' || !servicesEnabled) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    void Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 25,
        timeInterval: 10000,
      },
      (next) => {
        if (!cancelled && aliveRef.current) setLocation(next);
      },
    )
      .then((sub) => {
        if (cancelled) sub.remove();
        else subscription = sub;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [active, permission, servicesEnabled]);

  return {
    permission,
    canAskAgain,
    servicesEnabled,
    location,
    loading,
    refreshing,
    error,
    requestPermission,
    checkPermission,
    refresh,
  };
}
