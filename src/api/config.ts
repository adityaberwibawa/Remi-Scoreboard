/** Base URL + tipe response API (Remi-Scoreboard + legacy PresidentKu). */

// HTTPS wajib — semua komunikasi API harus terenkripsi (TASK 03.5).
export const REMI_API_BASE_URL = 'https://api.remi-scoreboard.id';

// true = pakai mock lokal (belum ada backend). Matikan (false) saat API asli siap.
export const USE_MOCK_API = true;

if (!REMI_API_BASE_URL.startsWith('https://')) {
  throw new Error('API base URL harus HTTPS.');
}

export interface ApiUser {
  id: string;
  name: string;
  email: string;
}

export interface Score {
  id: string | number;
  title: string;
  total: number;
  winner?: string;
  updatedAt: string;
  [key: string]: unknown;
}

/** Legacy — dipakai flow lama, dipertahankan agar tidak breaking. */
export const API_BASE_URL = 'https://api.presidentku.id';

export interface LoginResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  // Dukung variasi backend umum tanpa merusak tipe utama:
  token?: string;
  data?: { access_token?: string; token?: string };
}

export interface Program {
  id: string | number;
  title?: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
