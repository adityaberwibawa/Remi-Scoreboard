/**
 * TASK 02.2 — "interceptor" versi fetch: setiap request otomatis
 * membawa header `Authorization: Bearer <token>`.
 *
 * Pola: satu fungsi `apiFetch()` dipakai semua endpoint protected,
 * jadi tidak ada fetch yang lupa pasang token secara manual.
 */
import { API_BASE_URL, ApiError } from './config';
import { getToken, removeToken } from './tokenStorage';

type ApiFetchOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
  /** Default true — isi false hanya untuk endpoint publik seperti /login. */
  auth?: boolean;
};

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return `Request gagal (HTTP ${res.status})`;
    try {
      const json = JSON.parse(text) as { message?: string; error?: string };
      if (typeof json.message === 'string') return json.message;
      if (typeof json.error === 'string') return json.error;
    } catch {
      // Bukan JSON — tampilkan teks mentah (dipotong agar aman di UI).
    }
    return text.slice(0, 200);
  } catch {
    return `Request gagal (HTTP ${res.status})`;
  }
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { auth = true, headers = {}, ...init } = options;

  const finalHeaders: Record<string, string> = { ...headers };

  // Selalu kirim JSON kecuali caller menimpa (mis. FormData).
  if (init.body != null && finalHeaders['Content-Type'] == null) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  // TASK 02.2 — tempel token di sini, bukan di tiap screen.
  if (auth) {
    const token = await getToken();
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: finalHeaders });

  // TASK 03.3 — request tanpa token / token kedaluwarsa ditolak server (401).
  if (res.status === 401) {
    // Hapus token basi agar guard di _layout mengembalikan user ke login.
    await removeToken().catch(() => undefined);
    throw new ApiError(401, 'Sesi kedaluwarsa. Silakan login ulang.');
  }

  if (!res.ok) {
    throw new ApiError(res.status, await readErrorMessage(res));
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
