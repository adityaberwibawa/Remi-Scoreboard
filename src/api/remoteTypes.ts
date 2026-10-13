/** Model leaderboard remote: field + tipe untuk data dari server. */

export interface RemoteLeaderboardEntry {
  id: string;
  name: string;
  totalScore: number;
  wins: number;
  gamesPlayed: number;
  rank: number;
  avatarUrl?: string | null;
  updatedAt: string;
}

export interface RemoteListResponse<T> {
  data: T[];
  total: number;
}

/** Bentuk longgar dari server — dinormalisasi sebelum dipakai UI. */
export type RemoteLeaderboardDto = Record<string, unknown>;

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : fallback;
}

function toString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function pickFirst(source: RemoteLeaderboardDto, keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

/**
 * Normalisasi 1 item JSON server menjadi model aplikasi.
 * Kembalikan null bila item tidak valid (tanpa id/nama).
 */
export function normalizeRemoteEntry(raw: unknown): RemoteLeaderboardEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const dto = raw as RemoteLeaderboardDto;
  const id = toString(pickFirst(dto, ['id', '_id', 'playerId', 'player_id']), '').trim();
  const name = toString(pickFirst(dto, ['name', 'playerName', 'player_name']), '').trim();
  if (!id || !name) return null;

  return {
    id,
    name,
    totalScore: toNumber(pickFirst(dto, ['totalScore', 'total_score', 'total', 'score', 'points'])),
    wins: toNumber(pickFirst(dto, ['wins', 'winCount', 'win_count'])),
    gamesPlayed: toNumber(
      pickFirst(dto, ['gamesPlayed', 'games_played', 'games', 'matches', 'played']),
    ),
    rank: Math.max(1, Math.round(toNumber(pickFirst(dto, ['rank', 'position', 'ranking']), 0)) || 0),
    avatarUrl: toString(pickFirst(dto, ['avatarUrl', 'avatar_url', 'avatar', 'photoUrl']) ?? null, '') || null,
    updatedAt: toString(
      pickFirst(dto, ['updatedAt', 'updated_at', 'updated', 'createdAt']) ?? new Date().toISOString(),
      new Date().toISOString(),
    ),
  };
}

/** Normalisasi list + urutkan (rank naik, lalu totalScore turun). */
export function normalizeRemoteList(raw: unknown): RemoteLeaderboardEntry[] {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: unknown })?.data)
      ? ((raw as { data: unknown[] }).data)
      : [];
  const entries = list
    .map(normalizeRemoteEntry)
    .filter((e): e is RemoteLeaderboardEntry => e !== null);
  return entries.sort((a, b) => {
    if (a.rank > 0 && b.rank > 0 && a.rank !== b.rank) return a.rank - b.rank;
    return b.totalScore - a.totalScore;
  });
}
