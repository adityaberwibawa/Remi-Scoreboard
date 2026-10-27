/**
 * Fallback web: expo-secure-store tidak mendukung web.
 * PENTING: localStorage TIDAK terenkripsi. Ini hanya untuk preview/development web;
 * yang disimpan adalah hash PIN + salt + throttle (PIN mentah tidak pernah disimpan).
 */
function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export async function getItem(key: string): Promise<string | null> {
  return getStorage()?.getItem(key) ?? null;
}

export async function setItem(key: string, value: string): Promise<void> {
  getStorage()?.setItem(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  getStorage()?.removeItem(key);
}
