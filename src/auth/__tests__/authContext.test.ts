import { authErrorMessage, getDisplayName } from '../AuthContext';
import type { User } from '@supabase/supabase-js';

function userWith(metadata: Record<string, unknown>, email = 'budi@example.com'): User {
  return { id: 'u1', email, user_metadata: metadata } as User;
}

describe('authErrorMessage', () => {
  it('menerjemahkan kredensial salah', () => {
    expect(authErrorMessage(new Error('Invalid login credentials'))).toBe(
      'Email atau kata sandi salah.',
    );
  });

  it('menerjemahkan email terdaftar', () => {
    expect(authErrorMessage(new Error('User already registered'))).toBe(
      'Email sudah terdaftar. Silakan masuk.',
    );
  });

  it('menerjemahkan email belum diverifikasi', () => {
    expect(authErrorMessage(new Error('Email not confirmed'))).toBe(
      'Email belum diverifikasi. Buka tautan di kotak masuk email kamu.',
    );
  });

  it('menerjemahkan gangguan jaringan', () => {
    expect(authErrorMessage(new TypeError('Network request failed'))).toBe(
      'Tidak bisa terhubung ke server. Periksa koneksi internet.',
    );
  });

  it('memakai fallback untuk error yang tidak dikenal', () => {
    expect(authErrorMessage('x'.repeat(400), 'Pesan cadangan.')).toBe('Pesan cadangan.');
  });

  it('menerjemahkan limit pengiriman email per proyek (2/jam) berdasarkan error code', () => {
    const error = Object.assign(new Error('email rate limit exceeded'), {
      code: 'over_email_send_rate_limit',
    });
    expect(authErrorMessage(error)).toBe(
      'Terlalu banyak permintaan dari perangkat ini. Tunggu sekitar satu jam lalu coba lagi.',
    );
  });

  it('menerjemahkan jeda 60 detik untuk email yang sama (satu kode, pesan berbeda)', () => {
    const error = Object.assign(
      new Error('For security purposes, you can only request this after 60 seconds.'),
      { code: 'over_email_send_rate_limit' },
    );
    expect(authErrorMessage(error)).toBe(
      'Permintaan terlalu sering untuk email yang sama. Tunggu sekitar satu menit lalu coba lagi.',
    );
  });

  it('menerjemahkan limit permintaan per IP', () => {
    const error = Object.assign(new Error('Rate limit exceeded: too many requests'), {
      code: 'over_request_rate_limit',
    });
    expect(authErrorMessage(error)).toBe(
      'Server sedang membatasi permintaan. Coba lagi beberapa menit lagi.',
    );
  });

  it('mempertahankan pesan generik untuk rate limit tanpa error code', () => {
    expect(authErrorMessage(new Error('Rate limit exceeded'))).toBe(
      'Terlalu banyak percobaan. Coba lagi sebentar lagi.',
    );
  });
});

describe('getDisplayName', () => {
  it('memakai nama dari user_metadata', () => {
    expect(getDisplayName(userWith({ name: 'Budi' }))).toBe('Budi');
  });

  it('fallback ke email bila nama kosong', () => {
    expect(getDisplayName(userWith({}))).toBe('budi@example.com');
  });

  it('fallback ke label bila tidak ada user', () => {
    expect(getDisplayName(null)).toBe('Akun');
  });
});
