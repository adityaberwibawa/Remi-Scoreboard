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
 * cache dipakai supaya bagian template tetap tampil. Cache hanya dipakai untuk
 * gangguan sementara — error 4xx tetap dilaporkan agar konfigurasi/data salah
 * tidak tersembunyi.
 */
import { readTemplateCache, writeTemplateCache } from '../db';
import { mapServerTemplateList } from './dto';
import type { SessionTemplate } from './dto';
import {
  ApiError,
  isAbortError,
  isCacheFallbackError,
  normalizeApiError,
} from './errors';
import { requestJson } from './http';
import { MOCK_SERVER_TEMPLATES } from './mock';

export interface FetchTemplatesOptions {
  /** Contoh: "https://api.example.com". Kosong → pakai mock lokal. */
  baseUrl?: string;
  /** Paksa pakai mock lokal; default mengikuti ada/tidaknya base URL. */
  useMock?: boolean;
  signal?: AbortSignal;
}

export type TemplateSource = 'network' | 'cache' | 'mock';

export interface FetchTemplatesResult {
  templates: SessionTemplate[];
  source: TemplateSource;
  /** Waktu cache ditulis; hanya terisi saat source = "cache". */
  cachedAt: string | null;
}

export interface CachedTemplates {
  templates: SessionTemplate[];
  cachedAt: string;
}

const MOCK_DELAY_MS = 400;

/** Base URL backend dari env build-time (trailing slash dibuang). */
export const DEFAULT_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') ?? '';
/** Tanpa base URL → demo pakai mock lokal agar aplikasi tetap berfungsi. */
export const DEFAULT_USE_MOCK = DEFAULT_BASE_URL === '';

function assertValidBaseUrl(baseUrl: string): void {
  if (!/^https:\/\//i.test(baseUrl) && !/^http:\/\/localhost(?::\d+)?$/i.test(baseUrl)) {
    throw new ApiError({
      kind: 'config',
      message: 'URL backend tidak valid. Periksa EXPO_PUBLIC_API_URL.',
    });
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Baca cache template tanpa menyentuh jaringan (dipakai untuk tampilan awal). */
export async function readCachedTemplateList(): Promise<CachedTemplates | null> {
  try {
    const entry = await readTemplateCache();
    if (!entry) return null;
    const parsed = JSON.parse(entry.payload) as unknown;
    if (!Array.isArray(parsed)) return null;
    return { templates: parsed as SessionTemplate[], cachedAt: entry.updatedAt };
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
): Promise<FetchTemplatesResult> {
  const { baseUrl = DEFAULT_BASE_URL, useMock = DEFAULT_USE_MOCK, signal } = options;

  if (useMock || !baseUrl) {
    await delay(MOCK_DELAY_MS, signal);
    return {
      templates: mapServerTemplateList(MOCK_SERVER_TEMPLATES),
      source: 'mock',
      cachedAt: null,
    };
  }

  assertValidBaseUrl(baseUrl);

  try {
    const data = await requestJson<unknown>(
      `${baseUrl}/api/templates`,
      { method: 'GET', headers: { Accept: 'application/json' } },
      { signal },
    );
    if (!Array.isArray(data)) {
      throw new ApiError({ kind: 'parse', message: 'Respon server bukan daftar template.' });
    }
    const templates = mapServerTemplateList(data);
    if (data.length > 0 && templates.length === 0) {
      throw new ApiError({ kind: 'parse', message: 'Format template dari server tidak dikenali.' });
    }
    await saveTemplateCache(templates);
    return { templates, source: 'network', cachedAt: null };
  } catch (error) {
    const apiError = normalizeApiError(error);
    if (isAbortError(apiError)) throw apiError;
    if (!isCacheFallbackError(apiError)) throw apiError;
    const cached = await readCachedTemplateList();
    if (cached) {
      return { templates: cached.templates, source: 'cache', cachedAt: cached.cachedAt };
    }
    throw apiError;
  }
}
