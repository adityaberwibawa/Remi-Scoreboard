/**
 * Verifikasi identitas untuk endpoint backend (Supabase Auth).
 *
 * Token akses diverifikasi server-side dengan memanggil GET /auth/v1/user memakai
 * secret key proyek. Pendekatan ini:
 * - berlaku untuk signing key asimetris (PS256/EdDSA) maupun JWT lama HS256,
 *   tanpa dependensi kriptografi tambahan;
 * - selalu mengikuti status terbaru token di Supabase (termasuk pencabutan);
 * - tidak pernah mengekspos secret key ke aplikasi klien.
 *
 * Endpoint auth sendiri (register/login/refresh/logout) dihapus: akun dikelola
 * oleh Supabase Auth dari sisi aplikasi.
 */
const VERIFY_TIMEOUT_MS = 5000;

function supabaseBaseUrl() {
  return process.env.SUPABASE_URL?.replace(/\/$/, '') ?? '';
}

function secretKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

/** → { id, name, email } bila token valid; null bila tidak valid/kedaluwarsa/gagal jaring. */
export async function verifySupabaseUser(token) {
  const base = supabaseBaseUrl();
  const key = secretKey();
  if (!base || !key || !token) return null;
  try {
    const response = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const user = await response.json();
    if (!user || typeof user.id !== 'string') return null;
    return publicUser(user);
  } catch {
    return null;
  }
}

/** Ambil pengguna dari header Authorization: Bearer <access token Supabase>. */
export async function bearerUser(request) {
  const value = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match ? verifySupabaseUser(match[1].trim()) : null;
}

export function publicUser(user) {
  const metadata = user.user_metadata ?? {};
  const name = typeof metadata.name === 'string' ? metadata.name.trim() : '';
  return {
    id: user.id,
    name: name || user.email || '',
    email: user.email || '',
  };
}
