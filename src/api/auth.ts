/** Auth sesi pengguna: login / register / refresh / logout. Mock-first. */
import { REMOTE_TIMEOUT_MS } from './client-timeout';
import { baseUrl, RemoteApiError, useMock } from './config';
import { mockLogin, mockRefresh, mockRegister } from './authMock';
import {
  clearSession,
  isAccessExpired,
  loadSession,
  saveSession,
  type AuthTokens,
  type SessionUser,
} from './session';

export type { SessionUser };

const SKEW_MS = 30_000;

export function validateEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!email) return 'Email tidak boleh kosong.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email tidak valid.';
  return null;
}

export function validatePassword(raw: string, opts?: { allowAny?: boolean }): string | null {
  if (!raw) return 'Kata sandi tidak boleh kosong.';
  if (!opts?.allowAny && raw.length < 8) return 'Kata sandi minimal 8 karakter.';
  if (raw.length > 72) return 'Kata sandi maksimal 72 karakter.';
  return null;
}

export function validateName(raw: string): string | null {
  const name = raw.trim();
  if (!name) return 'Nama tidak boleh kosong.';
  if (name.length > 32) return 'Nama maksimal 32 karakter.';
  return null;
}

function toTokens(json: unknown): AuthTokens {
  const o = (typeof json === 'object' && json !== null ? json : {}) as Record<string, unknown>;
  const user = (typeof o.user === 'object' && o.user !== null ? o.user : {}) as Record<string, unknown>;
  if (typeof o.accessToken !== 'string' || typeof o.refreshToken !== 'string') {
    throw new RemoteApiError('Respons auth server tidak valid.');
  }
  const expiresIn = typeof o.expiresIn === 'number' ? o.expiresIn : 900;
  return {
    accessToken: o.accessToken,
    refreshToken: o.refreshToken,
    expiresAt: Date.now() + expiresIn * 1000 - SKEW_MS,
    user: {
      id: typeof user.id === 'string' ? user.id : '',
      name: typeof user.name === 'string' ? user.name : '',
      email: typeof user.email === 'string' ? user.email : '',
    },
  };
}

async function postAuth(path: string, body: Record<string, string>): Promise<AuthTokens> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    if (!res.ok) {
      const msg =
        (json as { error?: unknown } | null)?.error && typeof (json as { error: unknown }).error === 'string'
          ? ((json as { error: string }).error as string)
          : `Gagal autentikasi (HTTP ${res.status}).`;
      throw new RemoteApiError(msg, res.status);
    }
    return toTokens(json);
  } catch (e) {
    if (e instanceof RemoteApiError) throw e;
    if ((e as Error).name === 'AbortError') throw new RemoteApiError('Server tidak merespons. Coba lagi.');
    throw new RemoteApiError('Tidak dapat terhubung ke server. Periksa koneksi.');
  } finally {
    clearTimeout(timer);
  }
}

/** Masuk. Validasi dulu, lalu mock atau POST /auth/login. */
export async function login(email: string, password: string): Promise<SessionUser> {
  const cleanEmail = email.trim().toLowerCase();
  const emailErr = validateEmail(cleanEmail);
  if (emailErr) throw new RemoteApiError(emailErr);
  const passErr = validatePassword(password, { allowAny: true });
  if (passErr) throw new RemoteApiError(passErr);
  const tokens = useMock()
    ? await mockLogin(cleanEmail, password).catch((e: Error) => {
        throw new RemoteApiError(e.message, 401);
      })
    : await postAuth('/auth/login', { email: cleanEmail, password });
  await saveSession(tokens);
  return tokens.user;
}

/** Daftar akun baru (mock atau POST /auth/register). */
export async function register(name: string, email: string, password: string): Promise<SessionUser> {
  const nameErr = validateName(name);
  if (nameErr) throw new RemoteApiError(nameErr);
  const cleanEmail = email.trim().toLowerCase();
  const emailErr = validateEmail(cleanEmail);
  if (emailErr) throw new RemoteApiError(emailErr);
  const passErr = validatePassword(password);
  if (passErr) throw new RemoteApiError(passErr);
  const tokens = useMock()
    ? await mockRegister(name, cleanEmail, password)
    : await postAuth('/auth/register', { name: name.trim(), email: cleanEmail, password });
  await saveSession(tokens);
  return tokens.user;
}

/** Refresh single-flight: banyak pemanggil bersamaan hanya memicu 1 request. */
let inflight: Promise<AuthTokens | null> | null = null;

export function refreshSession(): Promise<AuthTokens | null> {
  if (!inflight) {
    inflight = doRefresh().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

async function doRefresh(): Promise<AuthTokens | null> {
  const current = await loadSession().catch(() => null);
  if (!current?.refreshToken) {
    await clearSession().catch(() => undefined);
    return null;
  }
  try {
    const tokens = useMock()
      ? await mockRefresh(current.refreshToken)
      : await postAuth('/auth/refresh', { refreshToken: current.refreshToken }).catch(() => null);
    if (!tokens) {
      await clearSession().catch(() => undefined);
      return null;
    }
    await saveSession(tokens);
    return tokens;
  } catch {
    await clearSession().catch(() => undefined);
    return null;
  }
}

/** Keluar: cabut refresh di server (best-effort) lalu hapus sesi lokal. */
export async function logout(): Promise<void> {
  const current = await loadSession().catch(() => null);
  if (current && !useMock()) {
    await postAuth('/auth/logout', { refreshToken: current.refreshToken }).catch(() => undefined);
  }
  await clearSession().catch(() => undefined);
}

/** Sesi valid tersimpan? Dipakai saat bootstrap (dengan fallback refresh). */
export async function restoreSession(): Promise<SessionUser | null> {
  const current = await loadSession().catch(() => null);
  if (!current) return null;
  if (!isAccessExpired(current)) return current.user;
  const fresh = await refreshSession().catch(() => null);
  return fresh ? fresh.user : null;
}
