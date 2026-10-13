/** Mock lokal Week 5 — bentuk respons identik dengan kontrak API asli. */
import type { ApiUser, Score } from './config';

export const MOCK_CREDENTIALS = { email: 'demo@remi.id', password: 'remi123' };

export const MOCK_TOKEN = 'mock-jwt-token-demo';

export const MOCK_USER: ApiUser = {
  id: 'u-demo',
  name: 'Pemain Demo',
  email: MOCK_CREDENTIALS.email,
};

export const MOCK_SCORES: Score[] = [
  { id: 's1', title: 'Meja Jumat — Remi 100', total: 100, winner: 'Andi', updatedAt: '2026-10-10T10:00:00Z' },
  { id: 's2', title: 'Meja Sabtu — Remi 50', total: 50, winner: 'Sari', updatedAt: '2026-10-11T15:30:00Z' },
  { id: 's3', title: 'Meja Minggu — Remi 100', total: 100, winner: 'Budi', updatedAt: '2026-10-12T20:00:00Z' },
];

/** Jeda buatan agar loading state terlihat saat demo. */
export function mockDelay(ms = 600): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
