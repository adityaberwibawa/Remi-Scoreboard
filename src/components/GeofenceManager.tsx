import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useStore } from '../store';
import { syncGeofences } from '../location/geofence';

/**
 * Menjaga region geofence tetap sinkron dengan arena sesi. Tidak merender UI;
 * ditempatkan di root agar pengingat area tetap aktif di luar tab Peta.
 */
export function GeofenceManager() {
  const ready = useStore((s) => s.ready);
  const locations = useStore((s) => s.sessionLocations);
  const sessions = useStore((s) => s.sessions);

  useEffect(() => {
    if (!ready || Platform.OS === 'web') return;

    const sync = () => {
      void syncGeofences(locations, sessions).catch(() => undefined);
    };
    sync();

    // Pengguna dapat mengubah izin "Selalu" lewat Settings saat app di background.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => subscription.remove();
  }, [ready, locations, sessions]);

  return null;
}
