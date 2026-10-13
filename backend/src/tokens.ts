/** Token: JWT access (pendek) + refresh opaque (panjang, dirotasi). */
import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? '';
  if (secret.length < 32) {
    throw new Error('JWT_SECRET minimal 32 karakter. Lihat backend/.env.example.');
  }
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ uid: userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('pentungscore')
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyAccessToken(
  token: string,
): Promise<{ userId: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: 'pentungscore' });
    if (typeof payload.uid !== 'string' || typeof payload.email !== 'string') return null;
    return { userId: payload.uid, email: payload.email };
  } catch {
    return null;
  }
}

/** Refresh token opaque 96 hex — yang disimpan di DB hanya hash-nya. */
export function newRefreshToken(): string {
  return randomBytes(48).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
