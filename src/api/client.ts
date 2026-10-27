/**
 * Task 02 — Connect to REST API (Week 4).
 * Mengambil data dari REST API memakai Fetch API bawaan (tanpa dependensi baru),
 * lalu `response.json()` + mapping DTO → data model aplikasi.
 *
 * Base URL backend diambil dari env build-time `EXPO_PUBLIC_API_URL`
 * (mis. "https://remi-scoreboard-backend.vercel.app"). Tanpa env itu,
 * pemanggil otomatis memakai mock lokal.
 *
 * Offline-first: hasil terakhir disimpan di SQLite; bila jaringan gagal,
 * cache dipakai supaya bagian template tetap tampil.
 */
import { readTemplateCache, writeTemplateCache } from '../db';
import { mapServerTemplateList } from './dto';
import type { SessionTemplate } from './dto';
import { MOCK_SERVER_TEMPLATES } from './mock';

export interface FetchTemplatesOptions {
  /** Contoh: "https://api.example.com". Kosong → pakai mock lokal. */
  baseUrl?: string;
  /** Paksa pakai mock lokal; default mengikuti ada/tidaknya base URL. */
  useMock?: boolean;
  signal?: AbortSignal;
}

const MOCK_DELAY_MS = 400;

/** Base URL backend dari env build-time (trailing slash dibuang). */
export const DEFAULT_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') ?? '';
/** Tanpa base URL → demo pakai mock lokal agar aplikasi tetap berfungsi. */
export const DEFAULT_USE_MOCK = DEFAULT_BASE_URL === '';

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

async function readCachedTemplates(): Promise<SessionTemplate[] | null> {
  try {
    const raw = await readTemplateCache();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SessionTemplate[]) : null;
  } catch {
    return null;
  }
}

async function saveTemplateCache(templates: SessionTemplate[]): Promise<void> {
  try {
    await writeTemplateCache(JSON.stringify(templates));
  } catch {
    // Cache bersifat opsional; kegagalan menulis tidak boleh menggagalkan fetch.
  }
}

/**
 * GET daftar template sesi. Selalu kembalikan data model aplikasi (bukan JSON mentah).
 * Error memakai Bahasa Indonesia mengikuti gaya store/db yang sudah ada.
 */
export async function fetchSessionTemplates(
  options: FetchTemplatesOptions = {},
): Promise<SessionTemplate[]> {
  const { baseUrl = DEFAULT_BASE_URL, useMock = DEFAULT_USE_MOCK, signal } = options;

  if (useMock || !baseUrl) {
    await delay(MOCK_DELAY_MS, signal);
    return mapServerTemplateList(MOCK_SERVER_TEMPLATES);
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/templates`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    const cached = await readCachedTemplates();
    if (cached) return cached;
    throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet.');
  }
  if (!res.ok) {
    const cached = await readCachedTemplates();
    if (cached) return cached;
    throw new Error(`Server mengembalikan status ${res.status}. Coba lagi nanti.`);
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    const cached = await readCachedTemplates();
    if (cached) return cached;
    throw new Error('Respon server bukan JSON yang valid.');
  }
  const templates = mapServerTemplateList(data);
  await saveTemplateCache(templates);
  return templates;
}
