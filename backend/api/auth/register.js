import { db, query } from '../../lib/db.js';
import { createAccessToken, createRefreshToken, hashPassword, hashRefreshToken, publicUser, refreshExpiresAt } from '../../lib/auth.js';
import { json, methodNotAllowed, options, readJson } from '../../lib/http.js';

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return options();
    if (request.method !== 'POST') return methodNotAllowed();

    const body = await readJson(request);
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (name.length < 2 || name.length > 80) return json(400, { error: 'Nama harus berisi 2 sampai 80 karakter.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json(400, { error: 'Alamat email tidak valid.' });
    if (password.length < 8 || password.length > 128) return json(400, { error: 'Kata sandi harus berisi 8 sampai 128 karakter.' });

    try {
      const existing = await db('account_users', { query: query({ email: `eq.${email}`, select: 'id', limit: '1' }) });
      if (existing?.length) return json(409, { error: 'Email sudah terdaftar.' });

      const rows = await db('account_users', {
        method: 'POST',
        query: query({ select: 'id,email,name' }),
        body: { name, email, password_hash: await hashPassword(password) },
        returning: true,
      });
      const user = rows?.[0];
      if (!user) return json(500, { error: 'Akun tidak berhasil dibuat.' });

      const refreshToken = createRefreshToken();
      await db('refresh_tokens', {
        method: 'POST',
        body: { user_id: user.id, token_hash: hashRefreshToken(refreshToken), expires_at: refreshExpiresAt() },
      });
      return json(201, { user: publicUser(user), accessToken: createAccessToken(user), refreshToken, tokenType: 'Bearer', expiresIn: 900 });
    } catch (error) {
      if (error?.code === '23505') return json(409, { error: 'Email sudah terdaftar.' });
      console.error('Register failed:', error);
      return json(500, { error: 'Pendaftaran gagal. Periksa konfigurasi server.' });
    }
  },
};
