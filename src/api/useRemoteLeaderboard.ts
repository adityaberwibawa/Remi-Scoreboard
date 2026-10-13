/** Hook pemuat leaderboard remote: loading / error / refresh. */
import { useCallback, useEffect, useState } from 'react';
import { fetchRemoteLeaderboard, RemoteApiError } from './client';
import type { RemoteLeaderboardEntry } from './remoteTypes';

interface State {
  data: RemoteLeaderboardEntry[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRemoteLeaderboard(): State {
  const [data, setData] = useState<RemoteLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const rows = await fetchRemoteLeaderboard();
      setData(rows);
    } catch (e) {
      setError(
        e instanceof RemoteApiError ? e.message : 'Terjadi kesalahan tak terduga.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false).catch(() => undefined);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { data, loading, refreshing, error, refresh };
}
