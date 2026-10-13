function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Konfigurasi database server belum lengkap.');
  return { url, key };
}

export async function db(table, { method = 'GET', query = '', body, returning = false } = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${table}${query ? `?${query}` : ''}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(returning ? { Prefer: 'return=representation' } : {}),
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
