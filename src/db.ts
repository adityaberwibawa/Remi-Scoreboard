/** Lapisan SQLite: skema + CRUD. Sumber kebenaran persistensi (offline-first). */
import * as SQLite from 'expo-sqlite';
import type {
  Arena,
  AvatarColorStyle,
  GameSession,
  GeofenceEvent,
  GeofenceEventType,
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
    dbPromise = SQLite.openDatabaseAsync('pentungscore.db')
      .then(async (db) => {
        await db.execAsync('PRAGMA journal_mode = WAL;');
        await db.execAsync('PRAGMA secure_delete = ON;');
        await migrate(db);
        return db;
      })
      .catch((error: unknown) => {
        // Jangan simpan promise yang sudah gagal: retry berikutnya harus membuka ulang DB.
        dbPromise = null;
        throw error;
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
      winner_id TEXT,
      loc_lat REAL,
      loc_lng REAL,
      loc_accuracy REAL,
      loc_address TEXT,
      loc_captured_at TEXT
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
    CREATE TABLE IF NOT EXISTS arena (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius_m INTEGER NOT NULL,
      address TEXT,
      monitoring INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS geofence_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      arena_name TEXT NOT NULL,
      event_type TEXT NOT NULL,
      at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS geocode_cache (
      key TEXT PRIMARY KEY NOT NULL,
      address TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Database lama dibuat sebelum fitur lokasi ada: tambahkan kolom tanpa menghapus data.
  await ensureColumn(db, 'sessions', 'loc_lat', 'REAL');
  await ensureColumn(db, 'sessions', 'loc_lng', 'REAL');
  await ensureColumn(db, 'sessions', 'loc_accuracy', 'REAL');
  await ensureColumn(db, 'sessions', 'loc_address', 'TEXT');
  await ensureColumn(db, 'sessions', 'loc_captured_at', 'TEXT');
}

async function ensureColumn(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!rows.some((row) => row.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
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
  loc_lat: number | null;
  loc_lng: number | null;
  loc_accuracy: number | null;
  loc_address: string | null;
  loc_captured_at: string | null;
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
      location:
        s.loc_lat != null && s.loc_lng != null
          ? {
              latitude: s.loc_lat,
              longitude: s.loc_lng,
              accuracy: s.loc_accuracy ?? null,
              address: s.loc_address ?? null,
              capturedAt: s.loc_captured_at ?? s.created_at,
            }
          : undefined,
    });
  }
  return sessions;
}

export async function insertSession(s: GameSession): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO sessions (
       id, title, created_at, status, target_enabled, target_score, winner_id,
       loc_lat, loc_lng, loc_accuracy, loc_address, loc_captured_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    s.id,
    s.title,
    s.createdAt,
    s.status,
    s.rules.targetScoreEnabled ? 1 : 0,
    s.rules.targetScore,
    s.winnerPlayerId ?? null,
    s.location?.latitude ?? null,
    s.location?.longitude ?? null,
    s.location?.accuracy ?? null,
    s.location?.address ?? null,
    s.location?.capturedAt ?? null,
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
export interface TemplateCacheEntry {
  payload: string;
  updatedAt: string;
}

export async function readTemplateCache(): Promise<TemplateCacheEntry | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ payload: string; updated_at: string }>(
    'SELECT payload, updated_at FROM template_cache WHERE id = 1',
  );
  if (!row) return null;
  return { payload: row.payload, updatedAt: row.updated_at };
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

/* ------------------------------------------------------------------ */
/* Arena & geofence                                                    */
/* ------------------------------------------------------------------ */

interface ArenaRow {
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  address: string | null;
  monitoring: number;
  updated_at: string;
}

export async function fetchArena(): Promise<Arena | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ArenaRow>('SELECT * FROM arena WHERE id = 1');
  if (!row) return null;
  return {
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    radiusM: row.radius_m,
    address: row.address,
    monitoring: row.monitoring === 1,
    updatedAt: row.updated_at,
  };
}

export async function saveArenaRow(arena: Arena): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO arena (id, name, latitude, longitude, radius_m, address, monitoring, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       latitude = excluded.latitude,
       longitude = excluded.longitude,
       radius_m = excluded.radius_m,
       address = excluded.address,
       monitoring = excluded.monitoring,
       updated_at = excluded.updated_at`,
    arena.name,
    arena.latitude,
    arena.longitude,
    arena.radiusM,
    arena.address,
    arena.monitoring ? 1 : 0,
    arena.updatedAt,
  );
}

export async function deleteArenaRow(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM arena WHERE id = 1');
}

interface GeofenceEventRow {
  arena_name: string;
  event_type: string;
  at: string;
}

function rowToGeofenceEvent(row: GeofenceEventRow): GeofenceEvent {
  return {
    type: (row.event_type === 'enter' ? 'enter' : 'exit') as GeofenceEventType,
    arenaName: row.arena_name,
    at: row.at,
  };
}

export async function insertGeofenceEvent(event: GeofenceEvent): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO geofence_events (arena_name, event_type, at) VALUES (?, ?, ?)',
    event.arenaName,
    event.type,
    event.at,
  );
}

export async function fetchGeofenceEvents(limit = 5): Promise<GeofenceEvent[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<GeofenceEventRow>(
    'SELECT arena_name, event_type, at FROM geofence_events ORDER BY at DESC, id DESC LIMIT ?',
    Math.max(1, Math.min(50, Math.trunc(limit))),
  );
  return rows.map(rowToGeofenceEvent);
}

export async function fetchLastGeofenceEvent(): Promise<GeofenceEvent | null> {
  const events = await fetchGeofenceEvents(1);
  return events[0] ?? null;
}

export async function clearGeofenceEvents(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM geofence_events');
}

/* ------------------------------------------------------------------ */
/* Cache reverse geocoding                                             */
/* ------------------------------------------------------------------ */

export interface GeocodeCacheEntry {
  address: string;
  updatedAt: string;
}

export async function readGeocodeCache(key: string): Promise<GeocodeCacheEntry | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ address: string; updated_at: string }>(
    'SELECT address, updated_at FROM geocode_cache WHERE key = ?',
    key,
  );
  if (!row) return null;
  return { address: row.address, updatedAt: row.updated_at };
}

export async function writeGeocodeCache(key: string, address: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO geocode_cache (key, address, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET address = excluded.address, updated_at = excluded.updated_at`,
    key,
    address,
    new Date().toISOString(),
  );
}
