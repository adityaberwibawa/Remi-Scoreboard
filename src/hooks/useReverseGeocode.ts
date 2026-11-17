import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { distanceMeters, formatGeocodedAddress, type GeoPoint } from '../location/geo';

const MIN_MOVE_METERS = 50;

export function useReverseGeocode(point: GeoPoint | null) {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastPointRef = useRef<GeoPoint | null>(null);
  const requestIdRef = useRef(0);

  const geocode = useCallback(async (target: GeoPoint, force: boolean) => {
    if (Platform.OS === 'web') {
      setAddress('');
      return;
    }
    if (!force && lastPointRef.current) {
      const moved = distanceMeters(lastPointRef.current, target);
      if (Number.isFinite(moved) && moved < MIN_MOVE_METERS) return;
    }
    lastPointRef.current = target;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude: target.latitude,
        longitude: target.longitude,
      });
      if (requestIdRef.current !== requestId) return;
      const formatted = formatGeocodedAddress(results[0]);
      setAddress(formatted);
      if (!formatted) setError('Alamat tidak ditemukan untuk titik ini.');
    } catch {
      if (requestIdRef.current !== requestId) return;
      setAddress('');
      setError('Gagal mengambil alamat. Koordinat tetap bisa dipakai.');
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!point) return;
    const timer = setTimeout(() => {
      void geocode(point, false);
    }, 0);
    return () => clearTimeout(timer);
  }, [geocode, point]);

  const refresh = useCallback(async () => {
    if (!point) return;
    await geocode(point, true);
  }, [geocode, point]);

  return { address, loading, error, refresh };
}
