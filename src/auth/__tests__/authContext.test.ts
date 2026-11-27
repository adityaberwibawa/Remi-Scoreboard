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
