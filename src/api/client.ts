/** REST API client: leaderboard dari server + authFetch bertoken (mock-first). */
import { refreshSession } from './auth';
import { getMockLeaderboard } from './mock';
import { normalizeRemoteList, type RemoteLeaderboardEntry } from './remoteTypes';
import { baseUrl, RemoteApiError, useMock } from './config';
import { REMOTE_TIMEOUT_MS } from './client-timeout';
import { getCachedAccessToken, loadSession } from './session';

export { REMOTE_TIMEOUT_MS, RemoteApiError };

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new RemoteApiError('Server tidak merespons (timeout). Coba lagi.');
    }
    throw new RemoteApiError('Tidak dapat terhubung ke server. Periksa koneksi.');
  } finally {
    clearTimeout(timer);
  }
}

async function currentAccessToken(): Promise<string | null> {
  const cached = getCachedAccessToken();
  if (cached) return cached;
  const session = await loadSession().catch(() => null);
  return session?.accessToken ?? null;
}

/**
 * Fetch bertoken: pasang `Authorization: Bearer`, dan saat 401 coba refresh
 * sekali lalu ulangi. Gagal refresh → sesi dianggap kedaluwarsa.
 */
export async function authFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const token = await currentAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetchWithTimeout(`${baseUrl()}${path}`, { ...init, headers });
  if (res.status === 401 && retry) {
    const fresh = await refreshSession().catch(() => null);
    if (fresh?.accessToken) return authFetch(path, init, false);
    throw new RemoteApiError('Sesi kedaluwarsa. Masuk lagi.', 401);
  }
  return res;
}

/** GET leaderboard. Otomatis pakai mock bila EXPO_PUBLIC_API_BASE_URL belum diisi. */
export async function fetchRemoteLeaderboard(): Promise<RemoteLeaderboardEntry[]> {
  if (useMock()) return getMockLeaderboard();

  const res = await authFetch('/leaderboard', { method: 'GET' });
  if (!res.ok) {
    throw new RemoteApiError(`Gagal memuat leaderboard (HTTP ${res.status}).`, res.status);
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new RemoteApiError('Respons server bukan JSON yang valid.');
  }
  return normalizeRemoteList(json);
}
