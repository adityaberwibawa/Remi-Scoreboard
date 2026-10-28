import {
  ApiError,
  apiErrorMessage,
  defaultHttpMessage,
  isAbortError,
  isCacheFallbackError,
  isSessionExpired,
  normalizeApiError,
  parseRetryAfter,
} from '../errors';

describe('ApiError helpers', () => {
  it('mempertahankan ApiError yang sudah terklasifikasi', () => {
    const error = new ApiError({ kind: 'offline', message: 'Tidak ada koneksi.' });
    expect(normalizeApiError(error)).toBe(error);
  });

  it('menormalkan AbortError dan Error biasa', () => {
    const abort = Object.assign(new Error('Aborted'), { name: 'AbortError' });
    expect(normalizeApiError(abort).kind).toBe('aborted');
    expect(isAbortError(abort)).toBe(true);

    const plain = normalizeApiError(new Error('rusak'));
    expect(plain.kind).toBe('unknown');
    expect(plain.message).toBe('rusak');
  });

  it('memberi pesan fallback saat pesan kosong', () => {
    const error = new ApiError({ kind: 'unknown', message: '   ' });
    expect(apiErrorMessage(error, 'Coba lagi.')).toBe('Coba lagi.');
    expect(apiErrorMessage('bukan error', 'Coba lagi.')).toBe('Terjadi kesalahan. Coba lagi.');
  });

  it('hanya memakai cache untuk gangguan sementara', () => {
    expect(isCacheFallbackError(new ApiError({ kind: 'offline', message: 'x' }))).toBe(true);
    expect(isCacheFallbackError(new ApiError({ kind: 'timeout', message: 'x' }))).toBe(true);
    expect(
      isCacheFallbackError(new ApiError({ kind: 'http', status: 503, message: 'x', retryable: true })),
    ).toBe(true);
    expect(
      isCacheFallbackError(new ApiError({ kind: 'http', status: 400, message: 'x', retryable: false })),
    ).toBe(false);
    expect(
      isCacheFallbackError(new ApiError({ kind: 'http', status: 401, message: 'x', retryable: false })),
    ).toBe(false);
  });

  it('mendeteksi sesi kedaluwarsa hanya untuk HTTP 401', () => {
    expect(isSessionExpired(new ApiError({ kind: 'http', status: 401, message: 'x' }))).toBe(true);
    expect(isSessionExpired(new ApiError({ kind: 'http', status: 403, message: 'x' }))).toBe(false);
    expect(isSessionExpired(new ApiError({ kind: 'offline', message: 'x' }))).toBe(false);
  });

  it('membaca Retry-After dalam detik maupun tanggal HTTP', () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('2')).toBe(2000);
    expect(parseRetryAfter('0')).toBe(0);
    expect(parseRetryAfter('bukan angka')).toBeNull();
    const future = new Date(Date.now() + 5000).toUTCString();
    expect(parseRetryAfter(future)).toBeGreaterThan(3000);
  });

  it('menyediakan pesan HTTP Bahasa Indonesia', () => {
    expect(defaultHttpMessage(401)).toMatch(/login/i);
    expect(defaultHttpMessage(404)).toMatch(/tidak ditemukan/i);
    expect(defaultHttpMessage(429)).toMatch(/terlalu banyak/i);
    expect(defaultHttpMessage(503)).toMatch(/server/i);
    expect(defaultHttpMessage(418)).toBe('Server mengembalikan status 418.');
  });
});
