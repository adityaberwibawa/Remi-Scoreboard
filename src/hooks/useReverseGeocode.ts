import { useCallback, useEffect, useRef, useState } from 'react';
import { distanceMeters, type GeoPoint } from '../location/geo';
import { reverseGeocodeAddress } from '../location/reverseGeocode';

const MIN_MOVE_METERS = 50;

export function useReverseGeocode(point: GeoPoint | null) {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastPointRef = useRef<GeoPoint | null>(null);
  const requestIdRef = useRef(0);

  const geocode = useCallback(async (target: GeoPoint, force: boolean) => {
    if (!force && lastPointRef.current) {
      const moved = distanceMeters(lastPointRef.current, target);
      if (Number.isFinite(moved) && moved < MIN_MOVE_METERS) return;
    }
    lastPointRef.current = target;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    setAddress('');
    try {
      const formatted = await reverseGeocodeAddress(target, { force });
      if (requestIdRef.current !== requestId) return;
      setAddress(formatted);
      if (!formatted) setError('Alamat tidak ditemukan. Koordinat tetap bisa dipakai.');
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
