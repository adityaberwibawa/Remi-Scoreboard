import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const ISSUER = 'pentungscore-api';
const ACCESS_SECONDS = 15 * 60;
const REFRESH_DAYS = 30;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_BYTES = 64;

function secret() {
  const value = process.env.TOKEN_SECRET;
  if (!value || value.length < 32) {
    throw new Error('TOKEN_SECRET harus berisi minimal 32 karakter.');
  }
  return value;
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(input) {
  return createHmac('sha256', secret()).update(input).digest('base64url');
}

export function hashRefreshToken(token) {
  return createHmac('sha256', secret()).update(`refresh:${token}`).digest('hex');
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, SCRYPT_BYTES, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

export async function verifyPassword(password, encoded) {
  const [algorithm, nText, rText, pText, saltText, hashText] = String(encoded).split('$');
  if (algorithm !== 'scrypt' || !saltText || !hashText) return false;

  const n = Number(nText);
  const r = Number(rText);
  const p = Number(pText);
  if (n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) return false;

  const salt = Buffer.from(saltText, 'base64url');
  const expected = Buffer.from(hashText, 'base64url');
  const actual = Buffer.from(await scrypt(password, salt, expected.length, {
    N: n,
    r,
    p,
    maxmem: 64 * 1024 * 1024,
  }));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createAccessToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    iss: ISSUER,
    sub: user.id,
    email: user.email,
    name: user.name,
    iat: now,
    exp: now + ACCESS_SECONDS,
  });
  const input = `${header}.${payload}`;
  return `${input}.${sign(input)}`;
}

export function verifyAccessToken(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const input = `${parts[0]}.${parts[1]}`;
  const actual = Buffer.from(parts[2], 'base64url');
  const expected = Buffer.from(sign(input), 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (header.alg !== 'HS256' || payload.iss !== ISSUER) return null;
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return { id: payload.sub, email: payload.email, name: payload.name };
  } catch {
    return null;
  }
}

export function createRefreshToken() {
  return randomBytes(48).toString('base64url');
}

export function refreshExpiresAt() {
  return new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function bearerUser(request) {
  const value = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match ? verifyAccessToken(match[1]) : null;
}

export function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}
