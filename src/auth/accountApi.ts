import { deleteItem, getItem, setItem } from './secureStorage';

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

export class AccountApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AccountApiError';
    this.status = status;
  }
}

export class AccountApi {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    if (!/^https:\/\//i.test(this.baseUrl) && !/^http:\/\/localhost(?::\d+)?$/i.test(this.baseUrl)) {
      throw new Error('URL backend harus memakai HTTPS (kecuali localhost untuk development).');
    }
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
    return result.user;
  }

  /** Apakah perangkat ini sudah punya sesi akun tersimpan (tanpa memanggil jaringan). */
  async hasSession(): Promise<boolean> {
    return (await this.readTokens()) !== null;
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

  async logout(): Promise<void> {
    const tokens = await this.readTokens();
    try {
      if (tokens) {
        await this.request('/api/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });
      }
    } finally {
      await deleteItem(TOKEN_KEY);
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

  /** Request dengan Bearer token; sekali refresh otomatis bila server menjawab 401. */
  private async authorizedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const tokens = await this.readTokens();
    if (!tokens) throw new AccountApiError('Silakan login terlebih dahulu.', 401);
    const withAuth = (accessToken: string): RequestInit => ({
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
    });
    try {
      return await this.request<T>(path, withAuth(tokens.accessToken));
    } catch (error) {
      if (!(error instanceof AccountApiError) || error.status !== 401) throw error;
      let fresh: AccountTokens;
      try {
        fresh = await this.refresh(tokens.refreshToken);
      } catch (refreshError) {
        if (refreshError instanceof AccountApiError && refreshError.status === 401) {
          await deleteItem(TOKEN_KEY);
        }
        throw refreshError;
      }
      return this.request<T>(path, withAuth(fresh.accessToken));
    }
  }

  private async readTokens(): Promise<AccountTokens | null> {
    const raw = await getItem(TOKEN_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AccountTokens;
    } catch {
      await deleteItem(TOKEN_KEY);
      return null;
    }
  }

  private async saveTokens(tokens: AccountTokens): Promise<void> {
    await setItem(TOKEN_KEY, JSON.stringify(tokens));
  }

  private async request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
      });
    } catch {
      throw new AccountApiError('Tidak dapat terhubung ke server. Periksa koneksi internet.', 0);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) {
      const message = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `Server mengembalikan status ${response.status}.`;
      throw new AccountApiError(message, response.status);
    }
    return body as T;
  }
}
