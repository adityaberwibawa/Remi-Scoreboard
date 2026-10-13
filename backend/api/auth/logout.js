import { db, query } from '../../lib/db.js';
import { hashRefreshToken } from '../../lib/auth.js';
import { json, methodNotAllowed, options, readJson } from '../../lib/http.js';

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return options();
    if (request.method !== 'POST') return methodNotAllowed();

    const body = await readJson(request);
    const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : '';
    if (!refreshToken) return json(200, { success: true });
    try {
      await db('refresh_tokens', {
        method: 'PATCH',
        query: query({ token_hash: `eq.${hashRefreshToken(refreshToken)}`, revoked_at: 'is.null' }),
        body: { revoked_at: new Date().toISOString() },
      });
      return json(200, { success: true });
    } catch (error) {
      console.error('Logout failed:', error);
      return json(500, { error: 'Logout gagal.' });
    }
  },
};
