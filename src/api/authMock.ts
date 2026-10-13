/** Mock auth — interface sama dengan backend, dipakai saat belum ada base URL. */
import type { AuthTokens } from './session';

export const DEMO_EMAIL = 'demo@pentung.app';
export const DEMO_PASSWORD = 'demo1234';
const DEMO_USER = { id: 'demo-1', name: 'Dika', email: DEMO_EMAIL };

function mockTokens(): AuthTokens {
  return {
    accessToken: `mock-access-${Date.now().toString(36)}`,
    refreshToken: `mock-refresh-${Math.random().toString(36).slice(2)}`,
    expiresAt: Date.now() + 15 * 60 * 1000,
    user: DEMO_USER,
  };
}

export function mockLogin(email: string, password: string, delayMs = 500): Promise<AuthTokens> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
        resolve(mockTokens());
      } else {
        reject(new Error('Email atau kata sandi salah.'));
      }
    }, delayMs);
  });
}

export function mockRegister(name: string, email: string, _password: string, delayMs = 500): Promise<AuthTokens> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ ...mockTokens(), user: { id: 'demo-new', name: name.trim(), email: email.trim().toLowerCase() } });
    }, delayMs);
  });
}

export function mockRefresh(_refreshToken: string, delayMs = 300): Promise<AuthTokens | null> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockTokens()), delayMs);
  });
}
