import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { Coordinates } from './types';

export interface CurrentLocation {
  coords: Coordinates | null;
  accuracy: number | null;
  updatedAt: number | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function toCoordinates(location: Location.LocationObject): Coordinates {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

/**
 * Satu posisi cepat + watch selama layar aktif. Watch dengan distanceInterval
 * agar tidak membanjiri render dan menghemat baterai.
 */
export function useCurrentLocation(enabled: boolean): CurrentLocation {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const apply = useCallback((position: Location.LocationObject) => {
    if (!aliveRef.current) return;
    setCoords(toCoordinates(position));
    setAccuracy(position.coords.accuracy);
    setUpdatedAt(position.timestamp);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled || !aliveRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 60_000,
        requiredAccuracy: 5_000,
      });
      if (lastKnown) apply(lastKnown);

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      apply(current);
    } catch {
      if (aliveRef.current) {
        setError('Lokasi belum bisa diambil. Pastikan GPS aktif lalu coba lagi.');
      }
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [apply, enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    void Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 10,
        timeInterval: 10_000,
      },
      (position) => {
        if (!cancelled) apply(position);
      },
    )
      .then((next) => {
        if (cancelled) {
          next.remove();
          return;
        }
        subscription = next;
      })
      .catch(() => {
        if (!cancelled) {
          setError('Pemantauan lokasi tidak tersedia di perangkat ini.');
        }
      });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [apply, enabled, refresh]);

  return { coords, accuracy, updatedAt, loading, error, refresh };
}
