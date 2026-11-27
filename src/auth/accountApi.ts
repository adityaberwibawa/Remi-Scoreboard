import { ApiError, isSessionExpired } from '../api/errors';
import { requestJson } from '../api/http';
import { getAccessToken } from './supabase';

/** Cadangan cloud: isi mentah divalidasi di lapisan UI sebelum dipulihkan. */
export interface AccountSnapshot {
  players: unknown[];
  sessions: unknown[];
  updatedAt: string | null;
}

interface AccountApiOptions {
  timeoutMs?: number;
  retryBaseDelayMs?: number;
}

/**
 * Klien cadangan cloud (`/api/sync`).
 *
 * Autentikasi memakai access token dari sesi Supabase Auth (lihat AuthContext);
 * refresh token ditangani otomatis oleh supabase-js, jadi klien ini cukup membaca
 * sesi berjalan — tanpa penyimpanan token sendiri dan tanpa endpoint login/refresh.
 */
export class AccountApi {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retryBaseDelayMs: number;

  constructor(baseUrl: string, options: AccountApiOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    if (!/^https:\/\//i.test(this.baseUrl) && !/^http:\/\/localhost(?::\d+)?$/i.test(this.baseUrl)) {
      throw new ApiError({
        kind: 'config',
        message: 'URL backend harus memakai HTTPS (kecuali localhost untuk development).',
      });
    }
    this.timeoutMs = options.timeoutMs ?? 12_000;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 500;
  }

  /** Ambil cadangan pemain & sesi milik akun dari server. */
  async pullSnapshot(): Promise<AccountSnapshot> {
    return this.authorizedRequest<AccountSnapshot>('/api/sync');
  }

  /** Simpan cadangan (snapshot terakhir menang); mengembalikan waktu server. */
  async pushSnapshot(players: unknown[], sessions: unknown[]): Promise<string> {
    const result = await this.authorizedRequest<{ ok: boolean; updatedAt: string }>(
      '/api/sync',
      {
        method: 'PUT',
        body: JSON.stringify({ players, sessions }),
      },
    );
    return result.updatedAt;
  }

  /** Request dengan Bearer token sesi Supabase; sekali percobaan ulang bila token baru terbit. */
  private async authorizedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getAccessToken();
    if (!token) {
      throw new ApiError({
        kind: 'http',
        status: 401,
        message: 'Silakan masuk terlebih dahulu.',
      });
    }
    try {
      return await this.request<T>(path, this.withAuth(init, token));
    } catch (error) {
      if (!isSessionExpired(error)) throw error;
      // Auto-refresh mungkin baru menerbitkan token baru; coba sekali lagi.
      const fresh = await getAccessToken();
      if (fresh && fresh !== token) {
        return this.request<T>(path, this.withAuth(init, fresh));
      }
      throw error;
    }
  }

  private withAuth(init: RequestInit, token: string): RequestInit {
    return {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    };
  }

  private async request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    return requestJson<T>(
      `${this.baseUrl}${path}`,
      {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
      },
      { timeoutMs: this.timeoutMs, retryBaseDelayMs: this.retryBaseDelayMs },
    );
  }
}
