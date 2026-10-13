/**
 * TASK 01 (login+simpan), TASK 02.3 (GET /programs), TASK 03 (logout).
 * UI (screen) hanya memanggil fungsi di file ini — tidak menyentuh
 * SecureStore atau header Authorization secara langsung.
 */
import { ApiError, API_BASE_URL, ApiUser, LoginResponse, Program, REMI_API_BASE_URL, Score, USE_MOCK_API } from './config';
import { apiFetch } from './client';
import { getToken, removeToken, saveToken } from './tokenStorage';
import { MOCK_CREDENTIALS, MOCK_SCORES, MOCK_TOKEN, MOCK_USER, mockDelay } from './mock';

function extractToken(json: LoginResponse): string | null {
  if (typeof json.access_token === 'string' && json.access_token) return json.access_token;
  if (typeof json.token === 'string' && json.token) return json.token;
  const nested = json.data?.access_token ?? json.data?.token;
  return typeof nested === 'string' && nested ? nested : null;
}

/**
 * TASK 01:
 * 1. POST /login { email, password }
 * 2. Ambil access_token dari JSON
 * 3. Simpan ke SecureStore
 * 4. Lempar Error berbahasa Indonesia bila gagal (untuk ditampilkan di UI)
 */
export async function login(email: string, password: string): Promise<string> {
  const cleanEmail = email.trim();
  if (!cleanEmail || !password) {
    throw new Error('Email dan password wajib diisi.');
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password }),
    });
  } catch {
    throw new Error('Tidak dapat menghubungi server. Periksa koneksi internet.');
  }

  let json: LoginResponse | null = null;
  try {
    json = (await res.json()) as LoginResponse;
  } catch {
    json = null;
  }

  // TASK 01.4 — handle error login gagal (400/401/422 dari server).
  if (!res.ok || !json) {
    const serverMsg =
      (json as unknown as { message?: unknown })?.message ??
      (json as unknown as { error?: unknown })?.error;
    if (res.status === 401 || res.status === 422) {
      throw new Error(
        typeof serverMsg === 'string' && serverMsg
          ? serverMsg
          : 'Email atau password salah.',
      );
    }
    throw new ApiError(res.status, typeof serverMsg === 'string' && serverMsg ? serverMsg : 'Login gagal. Coba lagi.');
  }

  const token = extractToken(json);
  if (!token) {
    throw new Error('Respons server tidak berisi access_token.');
  }

  await saveToken(token);
  return token;
}

/** TASK 02.1 (pakai ulang) — cukup re-export agar screen tidak import SecureStore. */
export { getToken };

/** TASK 02.3 — contoh request ke protected endpoint. Token ditempel otomatis oleh apiFetch. */
export async function fetchPrograms(): Promise<Program[]> {
  const json = await apiFetch<Program[] | { data: Program[] }>('/programs', {
    method: 'GET',
  });
  if (Array.isArray(json)) return json;
  if (json && Array.isArray((json as { data: Program[] }).data)) {
    return (json as { data: Program[] }).data;
  }
  return [];
}

/**
 * TASK 03.1 — hapus token. Pengalihan ke halaman login dilakukan
 * di UI (`router.replace('/login')`) tepat setelah fungsi ini sukses,
 * supaya logika navigasi tetap di layer screen, bukan di API.
 */
export async function logout(): Promise<void> {
  await removeToken();
}

/* ------------------------------------------------------------------ */
/* Week 5 Remi-Scoreboard: login + protected GET /scores (mock-aware) */
/* ------------------------------------------------------------------ */

export interface LoginResult {
  token: string;
  user: ApiUser;
}

/** POST {REMI}/login { email, password } → simpan access_token ke SecureStore. */
export async function loginRemi(email: string, password: string): Promise<LoginResult> {
  const cleanEmail = email.trim();
  if (!cleanEmail || !password) {
    throw new Error('Email dan password wajib diisi.');
  }

  // Belum ada backend asli → mock dengan kontrak respons yang sama.
  if (USE_MOCK_API) {
    await mockDelay();
    if (cleanEmail.toLowerCase() !== MOCK_CREDENTIALS.email || password !== MOCK_CREDENTIALS.password) {
      throw new Error('Email atau password salah.');
    }
    await saveToken(MOCK_TOKEN);
    return { token: MOCK_TOKEN, user: MOCK_USER };
  }

  let res: Response;
  try {
    res = await fetch(`${REMI_API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password }),
    });
  } catch {
    throw new Error('Tidak dapat menghubungi server. Periksa koneksi internet.');
  }

  const json = (await res.json().catch(() => null)) as (LoginResponse & { user?: ApiUser }) | null;
  if (!res.ok || !json) {
    const serverMsg = (json as unknown as { message?: unknown })?.message;
    if (res.status === 401 || res.status === 422) {
      throw new Error(typeof serverMsg === 'string' && serverMsg ? serverMsg : 'Email atau password salah.');
    }
    throw new ApiError(res.status, typeof serverMsg === 'string' && serverMsg ? serverMsg : 'Login gagal. Coba lagi.');
  }
  const token = extractToken(json);
  if (!token) throw new Error('Respons server tidak berisi access_token.');
  await saveToken(token);
  return { token, user: json.user ?? { id: 'me', name: cleanEmail, email: cleanEmail } };
}

/** GET /scores — contoh protected endpoint. Tanpa token valid → 401. */
export async function fetchScores(): Promise<Score[]> {
  if (USE_MOCK_API) {
    const token = await getToken();
    if (!token) {
      throw new ApiError(401, 'Sesi kedaluwarsa. Silakan login ulang.');
    }
    await mockDelay(400);
    return MOCK_SCORES;
  }
  const json = await apiFetch<Score[] | { data: Score[] }>('/scores', { method: 'GET' });
  if (Array.isArray(json)) return json;
  if (json && Array.isArray((json as { data: Score[] }).data)) return (json as { data: Score[] }).data;
  return [];
}
