/** Lapisan SQLite: skema + CRUD. Sumber kebenaran persistensi (offline-first). */
import * as SQLite from 'expo-sqlite';
import type {
  AvatarColorStyle,
  GameSession,
  Participant,
  Player,
  Round,
  SessionRules,
  Suit,
} from './types';

const AVATAR_STYLES: AvatarColorStyle[] = ['emerald', 'gold', 'crimson', 'slate'];

function toColorStyle(value: string | null): AvatarColorStyle {
  return AVATAR_STYLES.includes(value as AvatarColorStyle)
    ? (value as AvatarColorStyle)
    : 'emerald';
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('pentungscore.db').then(async (db) => {
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA secure_delete = ON;');
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      avatar_type TEXT NOT NULL,
      avatar_color TEXT,
      avatar_photo TEXT,
      suit TEXT NOT NULL,
      games_played INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      is_dealer INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL,
      target_enabled INTEGER NOT NULL DEFAULT 0,
      target_score INTEGER NOT NULL DEFAULT 500,
      winner_id TEXT
    );
    CREATE TABLE IF NOT EXISTS participants (
      session_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      seat_order INTEGER NOT NULL,
      is_dealer INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (session_id, player_id)
    );
    CREATE TABLE IF NOT EXISTS rounds (
      session_id TEXT NOT NULL,
      round_number INTEGER NOT NULL,
      scores_json TEXT NOT NULL,
      PRIMARY KEY (session_id, round_number)
    );
    CREATE TABLE IF NOT EXISTS template_cache (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

interface PlayerRow {
  id: string;
  name: string;
  avatar_type: string;
  avatar_color: string | null;
  avatar_photo: string | null;
  suit: string;
  games_played: number;
  wins: number;
  is_dealer: number;
  created_at: string;
}

function rowToPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    avatar:
      row.avatar_type === 'photo'
        ? { type: 'photo', photoUri: row.avatar_photo ?? '' }
        : { type: 'initials', colorStyle: toColorStyle(row.avatar_color) },
    suit: row.suit as Suit,
    gamesPlayed: row.games_played,
    wins: row.wins,
    isDealer: row.is_dealer === 1,
    createdAt: row.created_at,
  };
}

export async function fetchPlayers(): Promise<Player[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PlayerRow>(
    'SELECT * FROM players ORDER BY created_at ASC',
  );
  return rows.map(rowToPlayer);
}

export async function insertPlayer(p: Player): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO players (id, name, avatar_type, avatar_color, avatar_photo, suit, games_played, wins, is_dealer, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    p.id,
    p.name,
    p.avatar.type,
    p.avatar.type === 'initials' ? p.avatar.colorStyle : null,
    p.avatar.type === 'photo' ? p.avatar.photoUri : null,
    p.suit,
    p.gamesPlayed,
    p.wins,
    p.isDealer ? 1 : 0,
    p.createdAt,
  );
}

export async function updatePlayer(p: Player): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE players SET name = ?, avatar_type = ?, avatar_color = ?, avatar_photo = ?,
     suit = ?, games_played = ?, wins = ?, is_dealer = ? WHERE id = ?`,
    p.name,
    p.avatar.type,
    p.avatar.type === 'initials' ? p.avatar.colorStyle : null,
    p.avatar.type === 'photo' ? p.avatar.photoUri : null,
    p.suit,
    p.gamesPlayed,
    p.wins,
    p.isDealer ? 1 : 0,
    p.id,
  );
}

export async function clearDealerExcept(playerId: string | null): Promise<void> {
  const db = await getDb();
  if (playerId) {
    await db.runAsync('UPDATE players SET is_dealer = CASE WHEN id = ? THEN 1 ELSE 0 END', playerId);
  } else {
    await db.runAsync('UPDATE players SET is_dealer = 0');
  }
}

export async function deletePlayerRow(playerId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM players WHERE id = ?', playerId);
}

interface SessionRow {
  id: string;
  title: string;
  created_at: string;
  status: string;
  target_enabled: number;
  target_score: number;
  winner_id: string | null;
}

interface ParticipantRow {
  player_id: string;
  seat_order: number;
  is_dealer: number;
  is_active: number;
}

interface RoundRow {
  round_number: number;
  scores_json: string;
}

export async function fetchSessions(): Promise<GameSession[]> {
  const db = await getDb();
  const sessionRows = await db.getAllAsync<SessionRow>(
    'SELECT * FROM sessions ORDER BY created_at DESC',
  );
  const sessions: GameSession[] = [];
  for (const s of sessionRows) {
    const partRows = await db.getAllAsync<ParticipantRow>(
      'SELECT player_id, seat_order, is_dealer, is_active FROM participants WHERE session_id = ? ORDER BY seat_order ASC',
      s.id,
    );
    const roundRows = await db.getAllAsync<RoundRow>(
      'SELECT round_number, scores_json FROM rounds WHERE session_id = ? ORDER BY round_number ASC',
      s.id,
    );
    const participants: Participant[] = partRows.map((r) => ({
      playerId: r.player_id,
      seatOrder: r.seat_order,
      isDealer: r.is_dealer === 1,
      isActive: r.is_active === 1,
    }));
    const rounds: Round[] = roundRows.map((r) => ({
      roundNumber: r.round_number,
      scores: JSON.parse(r.scores_json) as Record<string, number>,
    }));
    const rules: SessionRules = {
      targetScoreEnabled: s.target_enabled === 1,
      targetScore: s.target_score,
    };
    sessions.push({
      id: s.id,
      title: s.title,
      createdAt: s.created_at,
      status: s.status as GameSession['status'],
      participants,
      rules,
      rounds,
      winnerPlayerId: s.winner_id ?? undefined,
    });
  }
  return sessions;
}

export async function insertSession(s: GameSession): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO sessions (id, title, created_at, status, target_enabled, target_score, winner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    s.id,
    s.title,
    s.createdAt,
    s.status,
    s.rules.targetScoreEnabled ? 1 : 0,
    s.rules.targetScore,
    s.winnerPlayerId ?? null,
  );
  for (const p of s.participants) {
    await db.runAsync(
      `INSERT INTO participants (session_id, player_id, seat_order, is_dealer, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      s.id,
      p.playerId,
      p.seatOrder,
      p.isDealer ? 1 : 0,
      p.isActive ? 1 : 0,
    );
  }
}

export async function updateSessionMeta(s: GameSession): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE sessions SET title = ?, status = ?, winner_id = ? WHERE id = ?',
    s.title,
    s.status,
    s.winnerPlayerId ?? null,
    s.id,
  );
}

export async function insertRound(
  sessionId: string,
  roundNumber: number,
  scores: Record<string, number>,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO rounds (session_id, round_number, scores_json) VALUES (?, ?, ?)',
    sessionId,
    roundNumber,
    JSON.stringify(scores),
  );
}

export async function updateRound(
  sessionId: string,
  roundNumber: number,
  scores: Record<string, number>,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE rounds SET scores_json = ? WHERE session_id = ? AND round_number = ?',
    JSON.stringify(scores),
    sessionId,
    roundNumber,
  );
}

export async function deleteLastRound(sessionId: string, roundNumber: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'DELETE FROM rounds WHERE session_id = ? AND round_number = ?',
    sessionId,
    roundNumber,
  );
}

export async function deleteSessionRow(sessionId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM rounds WHERE session_id = ?', sessionId);
  await db.runAsync('DELETE FROM participants WHERE session_id = ?', sessionId);
  await db.runAsync('DELETE FROM sessions WHERE id = ?', sessionId);
}

/** Cache JSON daftar template terakhir agar bagian template tetap tampil offline. */
export async function readTemplateCache(): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM template_cache WHERE id = 1',
  );
  return row?.payload ?? null;
}

export async function writeTemplateCache(payload: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO template_cache (id, payload, updated_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    payload,
    new Date().toISOString(),
  );
}

/** Ganti seluruh data lokal dengan snapshot cloud (pulihkan cadangan). */
export async function replaceAllData(players: Player[], sessions: GameSession[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM rounds');
    await db.runAsync('DELETE FROM participants');
    await db.runAsync('DELETE FROM sessions');
    await db.runAsync('DELETE FROM players');
  });
  for (const player of players) await insertPlayer(player);
  for (const session of sessions) {
    await insertSession(session);
    for (const round of session.rounds) {
      await insertRound(session.id, round.roundNumber, round.scores);
    }
  }
}
