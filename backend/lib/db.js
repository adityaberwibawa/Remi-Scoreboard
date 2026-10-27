function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const legacyServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = secretKey || legacyServiceRoleKey;
  if (!url || !key) throw new Error('Konfigurasi database server belum lengkap.');
  return { url, key, usesNewSecretKey: Boolean(secretKey) };
}

export async function db(table, { method = 'GET', query = '', body, returning = false, prefer } = {}) {
  const { url, key, usesNewSecretKey } = config();
  const preferHeader = [returning ? 'return=representation' : null, prefer].filter(Boolean).join(',');
  const response = await fetch(`${url}/rest/v1/${table}${query ? `?${query}` : ''}`, {
    method,
    headers: {
      apikey: key,
      // New sb_secret_* keys are sent as apikey only. Legacy service_role JWTs
      // still need the Authorization header to select the service_role role.
      ...(usesNewSecretKey ? {} : { Authorization: `Bearer ${key}` }),
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(preferHeader ? { Prefer: preferHeader } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = new Error('Permintaan database gagal.');
    error.status = response.status;
    error.code = data?.code;
    throw error;
  }
  return data;
}

export function query(values) {
  return new URLSearchParams(values).toString();
}
