import { useEffect, useRef, useState } from 'react';
import { geocodeCacheKey, reverseGeocodeCoordinates } from './geocoding';
import type { Coordinates, GeocodedPlace } from './types';

interface Options {
  /** Jumlah desimal untuk cache; 3 ≈ 110 m, 4 ≈ 11 m. */
  digits?: number;
  /** Debounce saat pin digeser agar tidak memanggil geocoder setiap frame. */
  debounceMs?: number;
}

interface Result {
  key: string | null;
  place: GeocodedPlace | null;
  geocoding: boolean;
}

/**
 * Reverse geocode dengan cache + debounce. Hasil lama tidak ditampilkan saat
 * koordinat berubah, sehingga UI tidak menampilkan alamat titik sebelumnya.
 */
export function useReverseGeocode(
  coords: Coordinates | null,
  { digits = 4, debounceMs = 0 }: Options = {},
): { place: GeocodedPlace | null; geocoding: boolean } {
  const key = coords ? geocodeCacheKey(coords, digits) : null;
  const latestCoords = useRef<Coordinates | null>(coords);
  const [result, setResult] = useState<Result>({
    key: null,
    place: null,
    geocoding: false,
  });

  useEffect(() => {
    latestCoords.current = coords;
  }, [coords]);

  useEffect(() => {
    if (!key) return;

    let active = true;
    let deadline: ReturnType<typeof setTimeout> | null = null;
    const timer = setTimeout(() => {
      const target = latestCoords.current;
      if (!target) return;
      // Jangan biarkan tombol simpan tertahan selamanya saat geocoder offline.
      deadline = setTimeout(() => {
        if (active) setResult({ key, place: null, geocoding: false });
      }, 5_000);
      void reverseGeocodeCoordinates(target)
        .then((place) => {
          if (!active) return;
          if (deadline) clearTimeout(deadline);
          setResult({ key, place, geocoding: false });
        })
        .catch(() => {
          if (!active) return;
          if (deadline) clearTimeout(deadline);
          setResult({ key, place: null, geocoding: false });
        });
    }, debounceMs);

    return () => {
      active = false;
      clearTimeout(timer);
      if (deadline) clearTimeout(deadline);
    };
  }, [key, debounceMs]);

  // Saat key berubah, hasil lama otomatis disembunyikan tanpa setState sinkron.
  const place = result.key === key && key !== null ? result.place : null;
  const geocoding =
    key !== null && (result.key !== key || result.geocoding);
  return { place, geocoding };
}
