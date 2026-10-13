/** Hono app: /health, /auth/*, /me, /leaderboard (proteksi Bearer). */
import type { Database } from 'bun:sqlite';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { newId, openDb, type UserRow, type RefreshRow } from './db';
import {
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_MS,
  hashToken,
  newRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from './tokens';

export interface AppEnv {
  Variables: { userId: string; email: string };
}

const emailSchema = z.string().trim().toLowerCase().email('Email tidak valid.');
const passwordSchema = z
  .string()
  .min(8, 'Kata sandi minimal 8 karakter.')
  .max(72, 'Kata sandi maksimal 72 karakter.');
const registerSchema = z.object({
  name: z.string().trim().min(1, 'Nama tidak boleh kosong.').max(32, 'Nama maksimal 32 karakter.'),
  email: emailSchema,
  password: passwordSchema,
});
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Kata sandi wajib diisi.') });
const refreshSchema = z.object({ refreshToken: z.string().min(1, 'Refresh token wajib diisi.') });

const SESSION_EXPIRED = 'Sesi kedaluwarsa. Masuk lagi.';

/** Rate limit sederhana di memori untuk endpoint auth (per IP). */
const hits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const slot = hits.get(ip);
  if (!slot || now >= slot.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  slot.count += 1;
  return slot.count > RATE_LIMIT;
}

export function clientIp(c: { req: { header: (n: string) => string | undefined } }): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  );
}

function publicUser(u: UserRow) {
  return { id: u.id, name: u.name, email: u.email, createdAt: u.created_at };
}

const LEADERBOARD = [
  { id: 'r1', name: 'Bowo', totalScore: 1250, wins: 8, gamesPlayed: 12, rank: 1 },
  { id: 'r2', name: 'Dika', totalScore: 1120, wins: 6, gamesPlayed: 12, rank: 2 },
  { id: 'r3', name: 'Sari', totalScore: 980, wins: 5, gamesPlayed: 11, rank: 3 },
  { id: 'r4', name: 'Agus', totalScore: 870, wins: 4, gamesPlayed: 10, rank: 4 },
  { id: 'r5', name: 'Rina', totalScore: 760, wins: 3, gamesPlayed: 10, rank: 5 },
  { id: 'r6', name: 'Joko', totalScore: 640, wins: 2, gamesPlayed: 9, rank: 6 },
  { id: 'r7', name: 'Putri', totalScore: 520, wins: 1, gamesPlayed: 8, rank: 7 },
  { id: 'r8', name: 'Hendra', totalScore: 410, wins: 0, gamesPlayed: 7, rank: 8 },
];

export function createApp(opts?: { dbPath?: string }): { app: Hono<AppEnv>; db: Database } {
  const db = openDb(opts?.dbPath ?? process.env.DATABASE_PATH ?? 'pentungscore.db');
  const app = new Hono<AppEnv>();

  const origins = (process.env.CORS_ORIGIN ?? '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.use('*', cors({ origin: origins.includes('*') ? '*' : origins, allowMethods: ['GET', 'POST', 'OPTIONS'] }));

  const qUserByEmail = db.query<UserRow, [string]>('SELECT * FROM users WHERE email = ?');
  const qUserById = db.query<UserRow, [string]>('SELECT * FROM users WHERE id = ?');
  const qRefreshByHash = db.query<RefreshRow, [string]>('SELECT * FROM refresh_tokens WHERE token_hash = ?');

  async function issueSession(user: UserRow) {
    const accessToken = await signAccessToken(user.id, user.email);
    const refreshToken = newRefreshToken();
    const now = Date.now();
    db.run(
      'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked, created_at) VALUES (?, ?, ?, ?, 0, ?)',
      [newId(), user.id, hashToken(refreshToken), now + REFRESH_TTL_MS, new Date(now).toISOString()],
    );
    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TTL_SECONDS,
      user: publicUser(user),
    };
  }

  app.get('/health', (c) => c.json({ ok: true, time: new Date().toISOString() }));

  app.post('/auth/register', async (c) => {
    if (rateLimited(clientIp(c))) return c.json({ error: 'Terlalu banyak percobaan. Coba lagi semenit.' }, 429);
    const parsed = registerSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid.' }, 400);
    }
    const { name, email, password } = parsed.data;
    if (qUserByEmail.get(email) as UserRow | null) {
      return c.json({ error: 'Email sudah terdaftar. Masuk saja.' }, 409);
    }
    const passwordHash = await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 10 });
    const now = new Date().toISOString();
    const user: UserRow = { id: newId(), name, email, password_hash: passwordHash, created_at: now };
    db.run('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      [user.id, user.name, user.email, user.password_hash, user.created_at]);
    return c.json(await issueSession(user), 201);
  });

  app.post('/auth/login', async (c) => {
    if (rateLimited(clientIp(c))) return c.json({ error: 'Terlalu banyak percobaan. Coba lagi semenit.' }, 429);
    const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid.' }, 400);
    }
    const { email, password } = parsed.data;
    const user = qUserByEmail.get(email) as UserRow | null;
    const ok = user ? await Bun.password.verify(password, user.password_hash) : false;
    if (!user || !ok) {
      return c.json({ error: 'Email atau kata sandi salah.', code: 'INVALID_CREDENTIALS' }, 401);
    }
    return c.json(await issueSession(user));
  });

  app.post('/auth/refresh', async (c) => {
    const parsed = refreshSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: 'Refresh token wajib diisi.' }, 400);
    }
    const row = qRefreshByHash.get(hashToken(parsed.data.refreshToken)) as RefreshRow | null;
    if (!row) return c.json({ error: SESSION_EXPIRED, code: 'SESSION_EXPIRED' }, 401);
    // Deteksi reuse: token yang sudah dirotasi dipakai lagi → cabut semua sesi user.
    if (row.revoked === 1 || row.expires_at <= Date.now()) {
      db.run('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', [row.user_id]);
      return c.json({ error: SESSION_EXPIRED, code: 'SESSION_EXPIRED' }, 401);
    }
    const user = qUserById.get(row.user_id) as UserRow | null;
    if (!user) return c.json({ error: SESSION_EXPIRED, code: 'SESSION_EXPIRED' }, 401);
    db.run('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?', [row.token_hash]);
    return c.json(await issueSession(user));
  });

  app.post('/auth/logout', async (c) => {
    const parsed = refreshSchema.safeParse(await c.req.json().catch(() => null));
    if (parsed.success) {
      db.run('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?', [hashToken(parsed.data.refreshToken)]);
    }
    return c.json({ ok: true });
  });

  // Middleware Bearer untuk rute di bawahnya.
  app.use('/me', async (c, next) => {
    const auth = c.req.header('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const claims = token ? await verifyAccessToken(token) : null;
    if (!claims) return c.json({ error: SESSION_EXPIRED, code: 'SESSION_EXPIRED' }, 401);
    const user = qUserById.get(claims.userId) as UserRow | null;
    if (!user) return c.json({ error: SESSION_EXPIRED, code: 'SESSION_EXPIRED' }, 401);
    c.set('userId', user.id);
    c.set('email', user.email);
    await next();
  });
  app.use('/leaderboard', async (c, next) => {
    const auth = c.req.header('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const claims = token ? await verifyAccessToken(token) : null;
    if (!claims) return c.json({ error: SESSION_EXPIRED, code: 'SESSION_EXPIRED' }, 401);
    const user = qUserById.get(claims.userId) as UserRow | null;
    if (!user) return c.json({ error: SESSION_EXPIRED, code: 'SESSION_EXPIRED' }, 401);
    c.set('userId', user.id);
    c.set('email', user.email);
    await next();
  });

  app.get('/me', (c) => {
    const user = qUserById.get(c.get('userId')) as UserRow | null;
    if (!user) return c.json({ error: SESSION_EXPIRED, code: 'SESSION_EXPIRED' }, 401);
    return c.json({ user: publicUser(user) });
  });

  app.get('/leaderboard', (c) => {
    const now = new Date().toISOString();
    return c.json({
      data: LEADERBOARD.map((r) => ({ ...r, avatarUrl: null, updatedAt: now })),
      total: LEADERBOARD.length,
    });
  });

  app.notFound((c) => c.json({ error: 'Tidak ditemukan.' }, 404));

  return { app, db };
}
