/** Penyimpanan sesi token: SecureStore + cache memori untuk access token. */
import * as SecureStore from 'expo-secure-store';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms kapan access token kedaluwarsa (sudah dikurangi skew). */
  expiresAt: number;
  user: SessionUser;
}

const KEY_ACCESS = 'pentung.auth.accessToken';
const KEY_REFRESH = 'pentung.auth.refreshToken';
const KEY_EXPIRES = 'pentung.auth.expiresAt';
const KEY_USER = 'pentung.auth.user';

const OPTS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

let memAccess: string | null = null;

export function getCachedAccessToken(): string | null {
  return memAccess;
}

export function setCachedAccessToken(token: string | null): void {
  memAccess = token;
}

export async function saveSession(t: AuthTokens): Promise<void> {
  memAccess = t.accessToken;
  await Promise.all([
    SecureStore.setItemAsync(KEY_ACCESS, t.accessToken, OPTS),
    SecureStore.setItemAsync(KEY_REFRESH, t.refreshToken, OPTS),
    SecureStore.setItemAsync(KEY_EXPIRES, String(t.expiresAt), OPTS),
    SecureStore.setItemAsync(KEY_USER, JSON.stringify(t.user), OPTS),
  ]);
}

export async function loadSession(): Promise<AuthTokens | null> {
  const [access, refresh, expires, userJson] = await Promise.all([
    SecureStore.getItemAsync(KEY_ACCESS),
    SecureStore.getItemAsync(KEY_REFRESH),
    SecureStore.getItemAsync(KEY_EXPIRES),
    SecureStore.getItemAsync(KEY_USER),
  ]);
  if (!access || !refresh) return null;
  memAccess = access;
  let user: SessionUser = { id: '', name: '', email: '' };
  try {
    user = JSON.parse(userJson ?? '') as SessionUser;
  } catch {
    user = { id: '', name: '', email: '' };
  }
  return { accessToken: access, refreshToken: refresh, expiresAt: Number(expires) || 0, user };
}

/** Hapus total sesi (memori + SecureStore). Dipakai saat logout & sesi rusak. */
export async function clearSession(): Promise<void> {
  memAccess = null;
  await Promise.all(
    [KEY_ACCESS, KEY_REFRESH, KEY_EXPIRES, KEY_USER].map((k) =>
      SecureStore.deleteItemAsync(k).catch(() => undefined),
    ),
  );
}

export function isAccessExpired(t: Pick<AuthTokens, 'expiresAt'>): boolean {
  return t.expiresAt <= Date.now();
}
