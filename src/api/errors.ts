/** Error API terklasifikasi agar UI bisa membedakan offline, timeout, HTTP, dan payload rusak. */

export type ApiErrorKind =
  | 'offline'
  | 'timeout'
  | 'http'
  | 'parse'
  | 'aborted'
  | 'config'
  | 'unknown';

interface ApiErrorInit {
  kind: ApiErrorKind;
  message: string;
  status?: number | null;
  retryable?: boolean;
  retryAfterMs?: number | null;
  cause?: unknown;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly retryable: boolean;
  readonly retryAfterMs: number | null;

  constructor({ kind, message, status = null, retryable = false, retryAfterMs = null, cause }: ApiErrorInit) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
    if (cause !== undefined) this.cause = cause;
  }
}

const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export function isRetryableStatus(status: number): boolean {
  return TRANSIENT_STATUSES.has(status);
}

export function isAbortError(error: unknown): boolean {
  return (
    (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') ||
    (error instanceof ApiError && error.kind === 'aborted')
  );
}

/** True bila data cache masih layak dipakai saat request gagal. */
export function isCacheFallbackError(error: unknown): boolean {
  const apiError = normalizeApiError(error);
  if (apiError.kind === 'offline' || apiError.kind === 'timeout' || apiError.kind === 'parse') {
    return true;
  }
  return apiError.kind === 'http' && apiError.retryable;
}

export function isSessionExpired(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'http' && error.status === 401;
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isAbortError(error)) {
    return new ApiError({ kind: 'aborted', message: 'Permintaan dibatalkan.', cause: error });
  }
  if (error instanceof Error) {
    return new ApiError({ kind: 'unknown', message: error.message, cause: error });
  }
  return new ApiError({ kind: 'unknown', message: 'Terjadi kesalahan. Coba lagi.' });
}

/** Pesan siap tampil; server tetap menjadi sumber utama pesan error HTTP. */
export function apiErrorMessage(error: unknown, fallback = 'Terjadi kesalahan. Coba lagi.'): string {
  const apiError = normalizeApiError(error);
  return apiError.message.trim().length > 0 ? apiError.message : fallback;
}

export function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - Date.now());
}

export function defaultHttpMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Permintaan tidak valid.';
    case 401:
      return 'Sesi sudah berakhir. Silakan login kembali.';
    case 403:
      return 'Kamu tidak punya akses untuk tindakan ini.';
    case 404:
      return 'Data yang diminta tidak ditemukan.';
    case 409:
      return 'Data sudah berubah. Muat ulang lalu coba lagi.';
    case 429:
      return 'Terlalu banyak permintaan. Coba lagi sebentar lagi.';
    default:
      return status >= 500
        ? `Server sedang bermasalah (${status}). Coba lagi nanti.`
        : `Server mengembalikan status ${status}.`;
  }
}
