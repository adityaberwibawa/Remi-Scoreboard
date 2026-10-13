/** REST API client: ambil leaderboard dari server (mock-first). */
import { getMockLeaderboard } from './mock';
import { normalizeRemoteList, type RemoteLeaderboardEntry } from './remoteTypes';

export const REMOTE_TIMEOUT_MS = 10_000;

export class RemoteApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'RemoteApiError';
    this.status = status;
  }
}

function baseUrl(): string {
  return (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
}

function authHeader(): Record<string, string> {
  const token = process.env.EXPO_PUBLIC_API_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function useMock(): boolean {
  if (process.env.EXPO_PUBLIC_USE_MOCK === '0') return false;
  return baseUrl().length === 0;
}

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

/** GET leaderboard. Otomatis pakai mock bila EXPO_PUBLIC_API_BASE_URL belum diisi. */
export async function fetchRemoteLeaderboard(): Promise<RemoteLeaderboardEntry[]> {
  if (useMock()) return getMockLeaderboard();

  const res = await fetchWithTimeout(`${baseUrl()}/leaderboard`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  });
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
