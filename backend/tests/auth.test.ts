import { describe, expect, test, beforeEach } from 'bun:test';
import { createApp } from '../src/app';

process.env.JWT_SECRET = 'test-secret-minimal-32-karakter-00000000';

let base: typeof appFetch;
let appFetch: (path: string, init?: RequestInit) => Promise<Response>;

beforeEach(() => {
  const { app } = createApp({ dbPath: ':memory:' });
  appFetch = (path, init) => Promise.resolve(app.request(path, init));
  base = appFetch;
});

async function register(email = 'dika@pentung.app', password = 'demo1234', name = 'Dika') {
  const res = await base('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

describe('auth', () => {
  test('register 201 + /me 200', async () => {
    const { status, json } = await register();
    expect(status).toBe(201);
    expect(json).toHaveProperty('accessToken');
    expect(json).toHaveProperty('refreshToken');
    const me = await base('/me', {
      headers: { Authorization: `Bearer ${json.accessToken}` },
    });
    expect(me.status).toBe(200);
  });

  test('email duplikat 409', async () => {
    await register();
    const dup = await register();
    expect(dup.status).toBe(409);
  });

  test('login benar 200, salah 401 generik', async () => {
    await register();
    const ok = await base('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dika@pentung.app', password: 'demo1234' }),
    });
    expect(ok.status).toBe(200);
    const bad = await base('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dika@pentung.app', password: 'salah-salah' }),
    });
    expect(bad.status).toBe(401);
  });

  test('leaderboard butuh token', async () => {
    expect((await base('/leaderboard')).status).toBe(401);
    const { json } = await register('b@pentung.app');
    const res = await base('/leaderboard', {
      headers: { Authorization: `Bearer ${json.accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[]; total: number };
    expect(body.total).toBeGreaterThan(0);
  });

  test('refresh rotasi: lama ditolak, baru jalan', async () => {
    const { json } = await register('c@pentung.app');
    const r1 = await base('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: json.refreshToken }),
    });
    expect(r1.status).toBe(200);
    const reuse = await base('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: json.refreshToken }),
    });
    expect(reuse.status).toBe(401);
  });

  test('logout mencabut refresh', async () => {
    const { json } = await register('d@pentung.app');
    const out = await base('/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: json.refreshToken }),
    });
    expect(out.status).toBe(200);
    const again = await base('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: json.refreshToken }),
    });
    expect(again.status).toBe(401);
  });
});
