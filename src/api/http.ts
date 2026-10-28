/**
 * Lapisan HTTP bersama: timeout, retry terbatas untuk request idempoten,
 * backoff eksponensial, dan error yang selalu terklasifikasi sebagai ApiError.
 */
import {
  ApiError,
  defaultHttpMessage,
  isAbortError,
  isRetryableStatus,
  parseRetryAfter,
} from './errors';

export interface RequestJsonOptions {
  /** Batas waktu satu percobaan. Default 10 detik. */
  timeoutMs?: number;
  /** Jumlah percobaan ulang setelah percobaan pertama. */
  retries?: number;
  /** Jeda dasar backoff; dipakai juga oleh test agar cepat. */
  retryBaseDelayMs?: number;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 8_000;
const MAX_RETRY_AFTER_MS = 10_000;
const RETRY_SAFE_METHODS = new Set(['GET', 'HEAD', 'PUT']);

function abortError(): ApiError {
  return new ApiError({ kind: 'aborted', message: 'Permintaan dibatalkan.' });
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function backoffDelay(attempt: number, base: number): number {
  const exponential = Math.min(MAX_RETRY_DELAY_MS, base * 2 ** attempt);
  return Math.round(exponential * (0.8 + Math.random() * 0.4));
}

function messageFromBody(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const message = (body as { error?: unknown }).error;
    if (typeof message === 'string' && message.trim().length > 0) return message;
  }
  return defaultHttpMessage(status);
}

async function readBody(response: Response): Promise<unknown> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return null;
  }
  if (text.trim().length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

async function requestOnce<T>(
  url: string,
  init: RequestInit,
  options: RequestJsonOptions,
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const externalSignal = options.signal;
  let timedOut = false;

  const onExternalAbort = () => controller.abort();
  if (externalSignal?.aborted) throw abortError();
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (timedOut) {
        throw new ApiError({
          kind: 'timeout',
          message: 'Server terlalu lama merespons. Coba lagi.',
          retryable: true,
          cause: error,
        });
      }
      if (externalSignal?.aborted) throw abortError();
      if (isAbortError(error)) throw error;
      throw new ApiError({
        kind: 'offline',
        message: 'Tidak dapat terhubung ke server. Periksa koneksi internet.',
        retryable: true,
        cause: error,
      });
    }

    const body = await readBody(response);
    if (externalSignal?.aborted) throw abortError();
    if (timedOut) {
      throw new ApiError({
        kind: 'timeout',
        message: 'Server terlalu lama merespons. Coba lagi.',
        retryable: true,
      });
    }
    if (!response.ok) {
      throw new ApiError({
        kind: 'http',
        status: response.status,
        message: messageFromBody(body, response.status),
        retryable: isRetryableStatus(response.status),
        retryAfterMs: parseRetryAfter(response.headers.get('retry-after')),
      });
    }

    if (body === undefined) {
      throw new ApiError({
        kind: 'parse',
        message: 'Respon server bukan JSON yang valid.',
        status: response.status,
      });
    }
    return body as T;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

export async function requestJson<T>(
  url: string,
  init: RequestInit = {},
  options: RequestJsonOptions = {},
): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const retries = options.retries ?? (RETRY_SAFE_METHODS.has(method) ? DEFAULT_RETRIES : 0);
  const retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await requestOnce<T>(url, init, options);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError({
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'Terjadi kesalahan. Coba lagi.',
        cause: error,
      });
      if (apiError.kind === 'aborted' || !apiError.retryable || attempt >= retries) {
        throw apiError;
      }
      if (apiError.retryAfterMs != null && apiError.retryAfterMs > MAX_RETRY_AFTER_MS) {
        throw apiError;
      }
      const delay = apiError.retryAfterMs ?? backoffDelay(attempt, retryBaseDelayMs);
      await sleep(delay, options.signal);
    }
  }
}
