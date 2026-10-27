/**
 * Validasi payload cadangan cloud sebelum ditulis ke SQLite.
 * Data berasal dari akun sendiri, tetapi tetap disaring agar payload rusak
 * tidak membuat aplikasi gagal saat memulihkan.
 */
import { SUITS } from '../types';
import type {
  Avatar,
  AvatarColorStyle,
  GameSession,
  Participant,
  Player,
  Round,
  SessionStatus,
} from '../types';

const AVATAR_STYLES: AvatarColorStyle[] = ['emerald', 'gold', 'crimson', 'slate'];
const SESSION_STATUSES: SessionStatus[] = ['ongoing', 'completed'];
const MAX_NAME_LENGTH = 80;

export interface Snapshot {
  players: Player[];
  sessions: GameSession[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean.length > 0 ? clean : null;
}

function toInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function toAvatar(value: unknown): Avatar {
  if (isRecord(value)) {
    if (value.type === 'photo') {
      const photoUri = nonEmptyString(value.photoUri);
      if (photoUri) return { type: 'photo', photoUri };
    }
    if (value.type === 'initials' && AVATAR_STYLES.includes(value.colorStyle as AvatarColorStyle)) {
      return { type: 'initials', colorStyle: value.colorStyle as AvatarColorStyle };
    }
  }
  return { type: 'initials', colorStyle: 'emerald' };
}

function toPlayer(value: unknown): Player | null {
  if (!isRecord(value)) return null;
  const id = nonEmptyString(value.id);
  const name = nonEmptyString(value.name);
  if (!id || !name) return null;
  const suit = SUITS.includes(value.suit as Player['suit']) ? (value.suit as Player['suit']) : '♠';
  return {
    id,
    name: name.slice(0, MAX_NAME_LENGTH),
    avatar: toAvatar(value.avatar),
    suit,
    gamesPlayed: Math.max(0, toInt(value.gamesPlayed, 0)),
    wins: Math.max(0, toInt(value.wins, 0)),
    isDealer: value.isDealer === true,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
  };
}

function toParticipant(value: unknown): Participant | null {
  if (!isRecord(value)) return null;
  const playerId = nonEmptyString(value.playerId);
  if (!playerId) return null;
  return {
    playerId,
    seatOrder: Math.max(1, toInt(value.seatOrder, 1)),
    isDealer: value.isDealer === true,
    isActive: value.isActive !== false,
  };
}

function toScores(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null;
  const scores: Record<string, number> = {};
  for (const [playerId, raw] of Object.entries(value)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) scores[playerId] = Math.trunc(raw);
  }
  return scores;
}

function toRound(value: unknown): Round | null {
  if (!isRecord(value)) return null;
  const roundNumber = toInt(value.roundNumber, -1);
  const scores = toScores(value.scores);
  if (roundNumber < 1 || !scores) return null;
  return { roundNumber, scores };
}

function toSession(value: unknown, playerIds: Set<string>): GameSession | null {
  if (!isRecord(value)) return null;
  const id = nonEmptyString(value.id);
  const title = nonEmptyString(value.title);
  if (!id || !title) return null;

  const participants: Participant[] = [];
  const participantIds = new Set<string>();
  if (Array.isArray(value.participants)) {
    for (const item of value.participants) {
      const participant = toParticipant(item);
      if (!participant || !playerIds.has(participant.playerId)) continue;
      if (participantIds.has(participant.playerId)) continue;
      participantIds.add(participant.playerId);
      participants.push(participant);
    }
  }

  const rounds: Round[] = [];
  const roundNumbers = new Set<number>();
  if (Array.isArray(value.rounds)) {
    for (const item of value.rounds) {
      const round = toRound(item);
      if (!round || roundNumbers.has(round.roundNumber)) continue;
      roundNumbers.add(round.roundNumber);
      rounds.push(round);
    }
  }

  const rules = isRecord(value.rules) ? value.rules : {};
  const status = SESSION_STATUSES.includes(value.status as SessionStatus)
    ? (value.status as SessionStatus)
    : 'ongoing';
  const winnerPlayerId = nonEmptyString(value.winnerPlayerId);
  return {
    id,
    title: title.slice(0, MAX_NAME_LENGTH),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    status,
    participants,
    rules: {
      targetScoreEnabled: rules.targetScoreEnabled === true,
      targetScore: Math.max(0, toInt(rules.targetScore, 500)),
    },
    rounds,
    winnerPlayerId: winnerPlayerId && playerIds.has(winnerPlayerId) ? winnerPlayerId : undefined,
  };
}

/** Ubah payload mentah dari `/api/sync` menjadi model aplikasi yang aman. */
export function parseSnapshot(input: unknown): Snapshot {
  if (!isRecord(input) || !Array.isArray(input.players) || !Array.isArray(input.sessions)) {
    throw new Error('Cadangan dari server tidak valid.');
  }

  const players: Player[] = [];
  const playerIds = new Set<string>();
  for (const item of input.players) {
    const player = toPlayer(item);
    if (!player || playerIds.has(player.id)) continue;
    playerIds.add(player.id);
    players.push(player);
  }

  const sessions: GameSession[] = [];
  const sessionIds = new Set<string>();
  for (const item of input.sessions) {
    const session = toSession(item, playerIds);
    if (!session || sessionIds.has(session.id)) continue;
    sessionIds.add(session.id);
    sessions.push(session);
  }

  return { players, sessions };
}
