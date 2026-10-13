import { bearerUser } from '../lib/auth.js';
import { json, methodNotAllowed, options } from '../lib/http.js';

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return options();
    if (request.method !== 'GET') return methodNotAllowed();
    const user = bearerUser(request);
    if (!user) return json(401, { error: 'Token tidak valid atau sudah kedaluwarsa.' });
    return json(200, { user });
  },
};
