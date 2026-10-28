/** Status koneksi ternormalisasi: state "unknown" tidak dianggap offline agar tidak memblokir request. */
import { useNetworkState } from 'expo-network';

export type NetworkStatus = 'online' | 'offline' | 'unknown';

export function useNetworkStatus(): NetworkStatus {
  const state = useNetworkState();
  if (!state) return 'unknown';
  if (state.isConnected === false) return 'offline';
  if (state.isInternetReachable === false) return 'offline';
  return 'online';
}
