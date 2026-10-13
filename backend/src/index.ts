import { createApp } from './app';

const port = Number(process.env.PORT ?? 3000);

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET wajib diisi di production.');
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'dev-only-secret-minimal-32-karakter-000000';
  console.warn('[backend] JWT_SECRET belum diisi — memakai secret dev. Jangan dipakai di production.');
}

const { app } = createApp();

Bun.serve({ port, fetch: app.fetch });
console.log(`[backend] PentungScore API jalan di http://localhost:${port}`);
