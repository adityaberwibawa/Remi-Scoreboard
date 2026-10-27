/**
 * Rate limit per IP sederhana (in-memory).
 * Catatan: pada Vercel serverless setiap instance punya memori sendiri,
 * jadi ini bersifat best-effort — bukan pengganti rate limit terdistribusi.
 */
const buckets = new Map();
const MAX_BUCKETS = 10_000;

function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const first = forwarded.split(',')[0]?.trim();
  return first || request.headers.get('x-real-ip') || 'unknown';
}

/**
 * Catat satu percobaan untuk IP ini.
 * @returns {number | null} Detik menunggu bila melewati batas, null bila boleh lanjut.
 */
export function rateLimit(request, { max = 10, windowMs = 10 * 60 * 1000, bucket = 'auth' } = {}) {
  const key = `${bucket}:${clientIp(request)}`;
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now >= entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > MAX_BUCKETS) {
      for (const [k, v] of buckets) {
        if (now >= v.resetAt) buckets.delete(k);
      }
    }
    return null;
  }

  entry.count += 1;
  if (entry.count > max) {
    return Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  }
  return null;
}
