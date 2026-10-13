/** Mock leaderboard remote — dipakai sampai server asli siap. */
import type { RemoteLeaderboardEntry } from './remoteTypes';

export const MOCK_LEADERBOARD: RemoteLeaderboardEntry[] = [
  { id: 'r1', name: 'Bowo', totalScore: 1250, wins: 8, gamesPlayed: 12, rank: 1, avatarUrl: null, updatedAt: new Date().toISOString() },
  { id: 'r2', name: 'Dika', totalScore: 1120, wins: 6, gamesPlayed: 12, rank: 2, avatarUrl: null, updatedAt: new Date().toISOString() },
  { id: 'r3', name: 'Sari', totalScore: 980, wins: 5, gamesPlayed: 11, rank: 3, avatarUrl: null, updatedAt: new Date().toISOString() },
  { id: 'r4', name: 'Agus', totalScore: 870, wins: 4, gamesPlayed: 10, rank: 4, avatarUrl: null, updatedAt: new Date().toISOString() },
  { id: 'r5', name: 'Rina', totalScore: 760, wins: 3, gamesPlayed: 10, rank: 5, avatarUrl: null, updatedAt: new Date().toISOString() },
  { id: 'r6', name: 'Joko', totalScore: 640, wins: 2, gamesPlayed: 9, rank: 6, avatarUrl: null, updatedAt: new Date().toISOString() },
  { id: 'r7', name: 'Putri', totalScore: 520, wins: 1, gamesPlayed: 8, rank: 7, avatarUrl: null, updatedAt: new Date().toISOString() },
  { id: 'r8', name: 'Hendra', totalScore: 410, wins: 0, gamesPlayed: 7, rank: 8, avatarUrl: null, updatedAt: new Date().toISOString() },
];

/** Simulasi latency network agar state loading bisa diuji. */
export function getMockLeaderboard(delayMs = 800): Promise<RemoteLeaderboardEntry[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve([...MOCK_LEADERBOARD]), delayMs);
  });
}
