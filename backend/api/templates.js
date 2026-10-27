import { db, query } from '../lib/db.js';
import { json, methodNotAllowed, options } from '../lib/http.js';

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return options();
    if (request.method !== 'GET') return methodNotAllowed();

    try {
      const rows = await db('session_templates', {
        query: query({
          select:
            'id,name,description,image,status,min_players,target_score_enabled,target_score,created_at,updated_at',
          order: 'id.asc',
        }),
      });
      return json(200, rows ?? []);
    } catch (error) {
      console.error('Templates fetch failed:', error);
      return json(500, { error: 'Gagal mengambil template. Coba lagi nanti.' });
    }
  },
};
