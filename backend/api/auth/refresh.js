import { db, query } from '../../lib/db.js';
import { createAccessToken, createRefreshToken, hashRefreshToken, publicUser, refreshExpiresAt } from '../../lib/auth.js';
import { json, methodNotAllowed, options, readJson, tooMany } from '../../lib/http.js';
import { rateLimit } from '../../lib/rate-limit.js';

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return options();
    if (request.method !== 'POST') return methodNotAllowed();

    const retryAfter = rateLimit(request, { max: 30, bucket: 'refresh' });
    if (retryAfter) return tooMany(retryAfter);

    const body = await readJson(request);
    const oldToken = typeof body?.refreshToken === 'string' ? body.refreshToken : '';
    if (!oldToken) return json(400, { error: 'Refresh token wajib diisi.' });

    try {
      const oldHash = hashRefreshToken(oldToken);
      const rows = await db('refresh_tokens', {
        query: query({ token_hash: `eq.${oldHash}`, revoked_at: 'is.null', expires_at: `gt.${new Date().toISOString()}`, select: 'id,user_id' }),
      });
      const session = rows?.[0];
      if (!session) return json(401, { error: 'Sesi sudah berakhir. Silakan login kembali.' });

      const users = await db('account_users', {
        query: query({ id: `eq.${session.user_id}`, select: 'id,email,name', limit: '1' }),
      });
      const user = users?.[0];
      if (!user) return json(401, { error: 'Akun tidak ditemukan.' });

      const revoked = await db('refresh_tokens', {
        method: 'PATCH',
        query: query({ id: `eq.${session.id}`, revoked_at: 'is.null', select: 'id' }),
        body: { revoked_at: new Date().toISOString() },
        returning: true,
      });
      if (!revoked?.length) return json(401, { error: 'Refresh token sudah digunakan. Silakan login kembali.' });

      const refreshToken = createRefreshToken();
      await db('refresh_tokens', {
        method: 'POST',
        body: { user_id: user.id, token_hash: hashRefreshToken(refreshToken), expires_at: refreshExpiresAt() },
      });
      return json(200, { user: publicUser(user), accessToken: createAccessToken(user), refreshToken, tokenType: 'Bearer', expiresIn: 900 });
    } catch (error) {
      console.error('Token refresh failed:', error);
      return json(500, { error: 'Sesi gagal diperbarui.' });
    }
  },
};
