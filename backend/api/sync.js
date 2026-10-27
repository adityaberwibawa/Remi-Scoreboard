import { bearerUser } from '../lib/auth.js';
import { db, query } from '../lib/db.js';
import { json, methodNotAllowed, options, readJson } from '../lib/http.js';

const MAX_ITEMS = 500;

/** Cadangan cloud per akun: GET = pulihkan, PUT = cadangkan (snapshot terakhir menang). */
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return options();
    const user = bearerUser(request);
    if (!user) return json(401, { error: 'Token tidak valid atau sudah kedaluwarsa.' });

    if (request.method === 'GET') {
      try {
        const rows = await db('user_snapshots', {
          query: query({
            user_id: `eq.${user.id}`,
            select: 'players,sessions,updated_at',
            limit: '1',
          }),
        });
        const row = rows?.[0];
        return json(200, {
          players: Array.isArray(row?.players) ? row.players : [],
          sessions: Array.isArray(row?.sessions) ? row.sessions : [],
          updatedAt: row?.updated_at ?? null,
        });
      } catch (error) {
        console.error('Snapshot fetch failed:', error);
        return json(500, { error: 'Gagal memuat cadangan. Coba lagi nanti.' });
      }
    }

    if (request.method === 'PUT') {
      const body = await readJson(request);
      const players = body?.players;
      const sessions = body?.sessions;
      if (!Array.isArray(players) || !Array.isArray(sessions)) {
        return json(400, { error: 'Payload cadangan tidak valid.' });
      }
      if (players.length > MAX_ITEMS || sessions.length > MAX_ITEMS) {
        return json(400, { error: 'Cadangan melebihi batas ukuran.' });
      }
      const updatedAt = new Date().toISOString();
      try {
        await db('user_snapshots', {
          method: 'POST',
          query: query({ on_conflict: 'user_id' }),
          body: { user_id: user.id, players, sessions, updated_at: updatedAt },
          returning: true,
          prefer: 'resolution=merge-duplicates',
        });
        return json(200, { ok: true, updatedAt });
      } catch (error) {
        console.error('Snapshot save failed:', error);
        return json(500, { error: 'Gagal menyimpan cadangan. Coba lagi nanti.' });
      }
    }

    return methodNotAllowed();
  },
};
