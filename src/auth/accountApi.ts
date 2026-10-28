import { deleteItem, getItem, setItem } from './secureStorage';
import { ApiError, isSessionExpired } from '../api/errors';
import { requestJson } from '../api/http';

const TOKEN_KEY = 'pentung.auth.accountTokens';

export interface AccountUser {
  id: string;
  name: string;
  email: string;
}

export interface AccountTokens {
  user: AccountUser;
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

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

function isAccountUser(value: unknown): value is AccountUser {
  if (typeof value !== 'object' || value === null) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === 'string' &&
    typeof user.name === 'string' &&
    typeof user.email === 'string'
  );
}

function isAccountTokens(value: unknown): value is AccountTokens {
  if (typeof value !== 'object' || value === null) return false;
  const tokens = value as Record<string, unknown>;
  return (
    isAccountUser(tokens.user) &&
    typeof tokens.accessToken === 'string' &&
    typeof tokens.refreshToken === 'string'
  );
}

export class AccountApi {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retryBaseDelayMs: number;
  private refreshPromise: Promise<AccountTokens> | null = null;

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

  async register(name: string, email: string, password: string): Promise<AccountTokens> {
    const result = await this.request<AccountTokens>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    await this.saveTokens(result);
    return result;
  }

  async login(email: string, password: string): Promise<AccountTokens> {
    const result = await this.request<AccountTokens>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await this.saveTokens(result);
    return result;
  }

  async me(): Promise<AccountUser> {
    const result = await this.authorizedRequest<{ user: AccountUser }>('/api/me');
    await this.updateCachedUser(result.user);
    return result.user;
  }

  /** Apakah perangkat ini sudah punya sesi akun tersimpan (tanpa memanggil jaringan). */
  async hasSession(): Promise<boolean> {
    return (await this.readTokens()) !== null;
  }

  /** Profil terakhir yang tersimpan; berguna saat offline. */
  async getCachedUser(): Promise<AccountUser | null> {
    const tokens = await this.readTokens();
    return tokens?.user ?? null;
  }

  /** Profil akun yang sedang login; refresh token otomatis bila access token habis. */
  async currentUser(): Promise<AccountUser> {
    return this.me();
  }

  /** Ambil cadangan pemain & sesi milik akun dari server. */
  async pullSnapshot(): Promise<AccountSnapshot> {
    return this.authorizedRequest<AccountSnapshot>('/api/sync');
  }

  /** Simpan cadangan (snapshot terakhir menang); mengembalikan waktu server. */
  async pushSnapshot(players: unknown[], sessions: unknown[]): Promise<string> {
    const result = await this.authorizedRequest<{ ok: boolean; updatedAt: string }>('/api/sync', {
      method: 'PUT',
      body: JSON.stringify({ players, sessions }),
    });
    return result.updatedAt;
  }

  /** Keluar secara lokal; panggilan server dilewati bila `remote: false` (mis. offline). */
  async logout(options: { remote?: boolean } = {}): Promise<void> {
    const tokens = await this.readTokens();
    try {
      if (tokens && options.remote !== false) {
        await this.request('/api/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });
      }
    } catch {
      // Keluar harus tetap berhasil secara lokal walau server tidak terjangkau.
    } finally {
      await this.clearSession();
    }
  }

  private async refresh(refreshToken: string): Promise<AccountTokens> {
    const result = await this.request<AccountTokens>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    await this.saveTokens(result);
    return result;
  }

  /** Satu refresh untuk banyak request 401 yang bersamaan (refresh token dirotasi server). */
  private refreshOnce(refreshToken: string): Promise<AccountTokens> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.refresh(refreshToken).finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  /** Request dengan Bearer token; sekali refresh otomatis bila server menjawab 401. */
  private async authorizedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const tokens = await this.readTokens();
    if (!tokens) {
      throw new ApiError({
        kind: 'http',
        status: 401,
        message: 'Silakan login terlebih dahulu.',
      });
    }
    const withAuth = (accessToken: string): RequestInit => ({
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
    });
    try {
      return await this.request<T>(path, withAuth(tokens.accessToken));
    } catch (error) {
      if (!isSessionExpired(error)) throw error;

      // Request lain mungkin sudah lebih dulu memperbarui token.
      const latest = await this.readTokens();
      if (latest && latest.accessToken !== tokens.accessToken) {
        return this.request<T>(path, withAuth(latest.accessToken));
      }

      let fresh: AccountTokens;
      try {
        fresh = await this.refreshOnce(tokens.refreshToken);
      } catch (refreshError) {
        if (isSessionExpired(refreshError)) await this.clearSession();
        throw refreshError;
      }
      return this.request<T>(path, withAuth(fresh.accessToken));
    }
  }

  private async readTokens(): Promise<AccountTokens | null> {
    const raw = await getItem(TOKEN_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isAccountTokens(parsed)) {
        await this.clearSession();
        return null;
      }
      return parsed;
    } catch {
      await this.clearSession();
      return null;
    }
  }

  private async saveTokens(tokens: AccountTokens): Promise<void> {
    await setItem(TOKEN_KEY, JSON.stringify(tokens));
  }

  private async updateCachedUser(user: AccountUser): Promise<void> {
    const tokens = await this.readTokens();
    if (tokens) await this.saveTokens({ ...tokens, user });
  }

  private async clearSession(): Promise<void> {
    await deleteItem(TOKEN_KEY);
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
