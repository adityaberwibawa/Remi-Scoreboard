import { db, query } from '../lib/db.js';
import { json, methodNotAllowed, options } from '../lib/http.js';

const BASE_COLUMNS = 'id,name,description,image,status,created_at,updated_at';
const RULE_COLUMNS = 'min_players,target_score_enabled,target_score';

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return options();
    if (request.method !== 'GET') return methodNotAllowed();

    try {
      let rows;
      try {
        rows = await db('session_templates', {
          query: query({ select: `${BASE_COLUMNS},${RULE_COLUMNS}`, order: 'id.asc' }),
        });
      } catch (error) {
        // Sebelum migrasi 002 dijalankan, kolom aturan belum ada. Tetap sajikan
        // template lama agar aplikasi tidak kehilangan data; klien memakai default.
        console.error('Template rules columns unavailable, falling back:', error);
        rows = await db('session_templates', {
          query: query({ select: BASE_COLUMNS, order: 'id.asc' }),
        });
      }
      return json(200, rows ?? []);
    } catch (error) {
      console.error('Templates fetch failed:', error);
      return json(500, { error: 'Gagal mengambil template. Coba lagi nanti.' });
    }
  },
};
