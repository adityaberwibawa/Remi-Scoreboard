import { db, query } from '../../lib/db.js';
import { createAccessToken, createRefreshToken, hashRefreshToken, publicUser, refreshExpiresAt, verifyPassword } from '../../lib/auth.js';
import { json, methodNotAllowed, options, readJson, tooMany } from '../../lib/http.js';
import { rateLimit } from '../../lib/rate-limit.js';

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return options();
    if (request.method !== 'POST') return methodNotAllowed();

    const retryAfter = rateLimit(request, { max: 10, bucket: 'login' });
    if (retryAfter) return tooMany(retryAfter);

    const body = await readJson(request);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!email || !password) return json(400, { error: 'Email dan kata sandi wajib diisi.' });

    try {
      const rows = await db('account_users', {
        query: query({ email: `eq.${email}`, select: 'id,email,name,password_hash', limit: '1' }),
      });
      const user = rows?.[0];
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        return json(401, { error: 'Email atau kata sandi salah.' });
      }

      const refreshToken = createRefreshToken();
      await db('refresh_tokens', {
        method: 'POST',
        body: { user_id: user.id, token_hash: hashRefreshToken(refreshToken), expires_at: refreshExpiresAt() },
      });
      return json(200, { user: publicUser(user), accessToken: createAccessToken(user), refreshToken, tokenType: 'Bearer', expiresIn: 900 });
    } catch (error) {
      console.error('Login failed:', error);
      return json(500, { error: 'Login gagal. Periksa konfigurasi server.' });
    }
  },
};
