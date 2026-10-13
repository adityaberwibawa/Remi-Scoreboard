import * as SecureStore from 'expo-secure-store';

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
    const tokens = await this.readTokens();
    if (!tokens) throw new AccountApiError('Silakan login terlebih dahulu.', 401);
    try {
      const result = await this.request<{ user: AccountUser }>('/api/me', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      return result.user;
    } catch (error) {
      if (!(error instanceof AccountApiError) || error.status !== 401) throw error;
      const fresh = await this.refresh(tokens.refreshToken);
      const result = await this.request<{ user: AccountUser }>('/api/me', {
        headers: { Authorization: `Bearer ${fresh.accessToken}` },
      });
      return result.user;
    }
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
      await SecureStore.deleteItemAsync(TOKEN_KEY);
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

  private async readTokens(): Promise<AccountTokens | null> {
    const raw = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AccountTokens;
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      return null;
    }
  }

  private async saveTokens(tokens: AccountTokens): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
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
