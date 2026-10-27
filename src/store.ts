/** Store Zustand: state UI + tulis-melalui ke SQLite. */
import { create } from 'zustand';
import {
  clearDealerExcept,
  deleteLastRound,
  deletePlayerRow,
  deleteSessionRow,
  fetchPlayers,
  fetchSessions,
  getDb,
  insertPlayer,
  insertRound,
  insertSession,
  replaceAllData,
  updatePlayer,
  updateRound,
  updateSessionMeta,
} from './db';
import {
  checkTargetReached,
  defaultSessionTitle,
  MIN_PLAYERS,
  nextSuit,
  validatePlayerName,
} from './scoring';
import { Avatar, GameSession, newId, Player, SessionRules, Suit } from './types';

interface CreateSessionInput {
  title?: string;
  playerIds: string[];
  dealerPlayerId?: string;
  rules: SessionRules;
}

interface PentungState {
  ready: boolean;
  loadError: string | null;
  players: Player[];
  sessions: GameSession[];
  loadAll: () => Promise<void>;
  addPlayer: (name: string, avatar: Avatar) => Promise<string | null>;
  renamePlayer: (id: string, name: string) => Promise<string | null>;
  updateAvatar: (id: string, avatar: Avatar) => Promise<void>;
  cycleSuit: (id: string) => Promise<void>;
  setDealer: (id: string) => Promise<void>;
  removePlayer: (id: string) => Promise<string | null>;
  movePlayer: (id: string, direction: -1 | 1) => Promise<void>;
  createSession: (input: CreateSessionInput) => Promise<{ id?: string; error?: string }>;
  renameSession: (id: string, title: string) => Promise<void>;
  saveRound: (
    sessionId: string,
    scores: Record<string, number>,
    editRoundNumber?: number,
  ) => Promise<{ completed: boolean; winnerName?: string }>;
  undoLastRound: (sessionId: string) => Promise<boolean>;
  deleteSession: (sessionId: string) => Promise<void>;
  /** Ganti seluruh data lokal dengan snapshot cloud (pulihkan cadangan). */
  applySnapshot: (players: Player[], sessions: GameSession[]) => Promise<void>;
}

function suitForSeat(seatIndex: number): Suit {
  return nextSuit(seatIndex);
}

export const useStore = create<PentungState>((set, get) => ({
  ready: false,
  loadError: null,
  players: [],
  sessions: [],

  loadAll: async () => {
    try {
      await getDb();
      const [players, sessions] = await Promise.all([fetchPlayers(), fetchSessions()]);
      set({ players, sessions, ready: true, loadError: null });
    } catch {
      set({ ready: true, loadError: 'Gagal memuat data tersimpan.' });
    }
  },

  addPlayer: async (name, avatar) => {
    const { players } = get();
    const error = validatePlayerName(name, players);
    if (error) return error;
    const player: Player = {
      id: newId(),
      name: name.trim(),
      avatar,
      suit: suitForSeat(players.length),
      gamesPlayed: 0,
      wins: 0,
      isDealer: players.length === 0,
      createdAt: new Date().toISOString(),
    };
    await insertPlayer(player);
    set({ players: [...get().players, player] });
    return null;
  },

  renamePlayer: async (id, name) => {
    const { players } = get();
    const error = validatePlayerName(name, players, id);
    if (error) return error;
    const updated = players.map((p) => (p.id === id ? { ...p, name: name.trim() } : p));
    const target = updated.find((p) => p.id === id);
    if (target) await updatePlayer(target);
    set({ players: updated });
    return null;
  },

  updateAvatar: async (id, avatar) => {
    const updated = get().players.map((p) => (p.id === id ? { ...p, avatar } : p));
    const target = updated.find((p) => p.id === id);
    if (target) await updatePlayer(target);
    set({ players: updated });
  },

  cycleSuit: async (id) => {
    const order: Suit[] = ['♠', '♥', '♦', '♣'];
    const updated = get().players.map((p) => {
      if (p.id !== id) return p;
      const next = order[(order.indexOf(p.suit) + 1) % order.length];
      return { ...p, suit: next };
    });
    const target = updated.find((p) => p.id === id);
    if (target) await updatePlayer(target);
    set({ players: updated });
  },

  setDealer: async (id) => {
    await clearDealerExcept(id);
    set({ players: get().players.map((p) => ({ ...p, isDealer: p.id === id })) });
  },

  removePlayer: async (id) => {
    const { players, sessions } = get();
    const inOngoing = sessions.some(
      (s) => s.status === 'ongoing' && s.participants.some((p) => p.playerId === id),
    );
    if (inOngoing) return 'Pemain ini ikut game yang sedang berjalan.';
    await deletePlayerRow(id);
    const remaining = players.filter((p) => p.id !== id);
    if (remaining.length > 0 && !remaining.some((p) => p.isDealer)) {
      remaining[0] = { ...remaining[0], isDealer: true };
      await updatePlayer(remaining[0]);
    }
    set({ players: remaining });
    return null;
  },

  /** Pindah posisi pemain (naik/turun) — roster disimpan terurut. */
  movePlayer: async (id, direction) => {
    const players = [...get().players];
    const index = players.findIndex((p) => p.id === id);
    const swapWith = index + direction;
    if (index < 0 || swapWith < 0 || swapWith >= players.length) return;
    [players[index], players[swapWith]] = [players[swapWith], players[index]];
    set({ players });
  },

  createSession: async (input) => {
    const { players, sessions } = get();
    if (input.playerIds.length < MIN_PLAYERS) {
      return { error: `Minimal ${MIN_PLAYERS} pemain untuk memulai permainan.` };
    }
    const byId = new Map(players.map((p) => [p.id, p]));
    if (input.playerIds.some((id) => !byId.has(id))) {
      return { error: 'Ada pemain yang tidak dikenal.' };
    }
    const session: GameSession = {
      id: newId(),
      title: input.title?.trim() || defaultSessionTitle(sessions.length),
      createdAt: new Date().toISOString(),
      status: 'ongoing',
      participants: input.playerIds.map((playerId, index) => ({
        playerId,
        seatOrder: index + 1,
        isDealer: playerId === (input.dealerPlayerId ?? input.playerIds[0]),
        isActive: true,
      })),
      rules: input.rules,
      rounds: [],
    };
    await insertSession(session);
    set({ sessions: [session, ...get().sessions] });
    return { id: session.id };
  },

  renameSession: async (id, title) => {
    const clean = title.trim();
    if (!clean) return;
    const sessions = get().sessions.map((s) => (s.id === id ? { ...s, title: clean } : s));
    const target = sessions.find((s) => s.id === id);
    if (target) await updateSessionMeta(target);
    set({ sessions });
  },

  saveRound: async (sessionId, scores, editRoundNumber) => {
    const { sessions, players } = get();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session || session.status !== 'ongoing') return { completed: false };
    let rounds = session.rounds;
    if (editRoundNumber != null) {
      rounds = rounds.map((r) =>
        r.roundNumber === editRoundNumber ? { ...r, scores: { ...r.scores, ...scores } } : r,
      );
      await updateRound(sessionId, editRoundNumber, {
        ...session.rounds.find((r) => r.roundNumber === editRoundNumber)?.scores,
        ...scores,
      });
    } else {
      const roundNumber = rounds.length + 1;
      rounds = [...rounds, { roundNumber, scores }];
      await insertRound(sessionId, roundNumber, scores);
    }
    let updated: GameSession = { ...session, rounds };
    const winnerId = checkTargetReached(updated);
    if (winnerId) {
      updated = { ...updated, status: 'completed', winnerPlayerId: winnerId };
      const winner = players.find((p) => p.id === winnerId);
      const touched = new Set(Object.keys(scores));
      const withStats = players.map((p) => {
        if (!touched.has(p.id)) return p;
        return {
          ...p,
          gamesPlayed: p.gamesPlayed + 1,
          wins: p.id === winnerId ? p.wins + 1 : p.wins,
        };
      });
      for (const p of withStats) {
        const before = players.find((b) => b.id === p.id);
        if (before && (before.gamesPlayed !== p.gamesPlayed || before.wins !== p.wins)) {
          await updatePlayer(p);
        }
      }
      await updateSessionMeta(updated);
      set({
        players: withStats,
        sessions: get().sessions.map((s) => (s.id === sessionId ? updated : s)),
      });
      return { completed: true, winnerName: winner?.name };
    }
    await updateSessionMeta(updated);
    set({ sessions: get().sessions.map((s) => (s.id === sessionId ? updated : s)) });
    return { completed: false };
  },

  undoLastRound: async (sessionId) => {
    const { sessions } = get();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session || session.rounds.length === 0 || session.status !== 'ongoing') return false;
    const last = session.rounds[session.rounds.length - 1];
    await deleteLastRound(sessionId, last.roundNumber);
    const updated: GameSession = { ...session, rounds: session.rounds.slice(0, -1) };
    set({ sessions: sessions.map((s) => (s.id === sessionId ? updated : s)) });
    return true;
  },

  deleteSession: async (sessionId) => {
    await deleteSessionRow(sessionId);
    set({ sessions: get().sessions.filter((s) => s.id !== sessionId) });
  },

  applySnapshot: async (players, sessions) => {
    await replaceAllData(players, sessions);
    set({ players, sessions, loadError: null });
  },
}));

/** Selektor: sesi aktif berdasarkan id. */
export function selectSession(sessions: GameSession[], id: string | undefined) {
  return sessions.find((s) => s.id === id);
}

/** Nama pemain berdasarkan id (fallback '—'). */
export function playerName(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? '—';
}
