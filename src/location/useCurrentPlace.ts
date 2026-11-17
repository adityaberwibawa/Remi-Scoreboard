/** Hook state lokasi: sekali ambil, pantau langsung, dan status arena. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { SessionLocation } from '../types';
import { useStore } from '../store';
import { getCurrentPlace } from './currentPlace';
import { distanceMeters, isInsideFence } from './geo';
import type { GeoPoint } from './geo';
import { reverseGeocode } from './reverseGeocode';

export type PlaceStatus = 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable' | 'error';

const REGEOCODE_DISTANCE_M = 75;

export function useCurrentPlace(options?: { auto?: boolean }) {
  const arena = useStore((state) => state.arena);
  const [status, setStatus] = useState<PlaceStatus>('idle');
  const [place, setPlace] = useState<SessionLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mocked, setMocked] = useState(false);
  const [tracking, setTracking] = useState(false);

  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const activeRef = useRef(true);
  const lastGeocodeRef = useRef<GeoPoint | null>(null);
  const geocodingRef = useRef(false);
  const placeRef = useRef<SessionLocation | null>(null);

  useEffect(() => {
    placeRef.current = place;
  }, [place]);

  const stopTracking = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setTracking(false);
  }, []);

  const refresh = useCallback(async () => {
    setStatus('locating');
    setError(null);
    const result = await getCurrentPlace();
    if (!activeRef.current) return;
    if (!result.place) {
      setStatus(
        result.reason === 'denied'
          ? 'denied'
          : result.reason === 'unavailable'
            ? 'unavailable'
            : 'error',
      );
      setError(result.error);
      return;
    }
    setPlace(result.place);
    setMocked(result.mocked);
    setStatus('ready');
    lastGeocodeRef.current = {
      latitude: result.place.latitude,
      longitude: result.place.longitude,
    };
  }, []);

  const startTracking = useCallback(async () => {
    if (subscriptionRef.current) return;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setStatus('denied');
        setError('Izin lokasi ditolak. Aktifkan izin lokasi untuk memantau arena.');
        return;
      }
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 25,
          timeInterval: 10_000,
        },
        (update) => {
          if (!activeRef.current) return;
          const { coords } = update;
          const next: SessionLocation = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
            address: placeRef.current?.address ?? null,
            capturedAt: new Date(update.timestamp || Date.now()).toISOString(),
          };
          setPlace(next);
          setStatus('ready');
          setError(null);

          const last = lastGeocodeRef.current;
          const moved =
            !last ||
            distanceMeters(next, last) >= REGEOCODE_DISTANCE_M;
          if (moved && !geocodingRef.current) {
            geocodingRef.current = true;
            lastGeocodeRef.current = next;
            void reverseGeocode(next)
              .then((address) => {
                if (!address || !activeRef.current) return;
                setPlace((current) => (current ? { ...current, address } : current));
              })
              .finally(() => {
                geocodingRef.current = false;
              });
          }
        },
        () => {
          if (activeRef.current) setError('Pemantauan lokasi terhenti. Coba mulai lagi.');
        },
      );
      subscriptionRef.current = subscription;
      setTracking(true);
      setError(null);
    } catch {
      setError('Gagal memantau lokasi. Periksa izin dan GPS perangkat.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    if (options?.auto) {
      Location.getForegroundPermissionsAsync()
        .then((permission) => {
          if (permission.granted && activeRef.current) void refresh();
        })
        .catch(() => undefined);
    }
    return () => {
      activeRef.current = false;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [options?.auto, refresh]);

  const fence = useMemo(() => {
    if (!place || !arena) return { distance: null as number | null, inside: null as boolean | null };
    return {
      distance: distanceMeters(place, arena),
      inside: isInsideFence(place, arena),
    };
  }, [place, arena]);

  return {
    status,
    place,
    error,
    mocked,
    tracking,
    distanceToArena: fence.distance,
    insideFence: fence.inside,
    refresh,
    startTracking,
    stopTracking,
  };
}
