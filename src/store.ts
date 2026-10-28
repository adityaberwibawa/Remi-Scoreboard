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
  /** True setelah data lokal pernah berhasil dimuat minimal sekali. */
  hasLoadedOnce: boolean;
  loadError: string | null;
  players: Player[];
  sessions: GameSession[];
  loadAll: () => Promise<void>;
  addPlayer: (name: string, avatar: Avatar) => Promise<string | null>;
  renamePlayer: (id: string, name: string) => Promise<string | null>;
  updateAvatar: (id: string, avatar: Avatar) => Promise<string | null>;
  cycleSuit: (id: string) => Promise<string | null>;
  setDealer: (id: string) => Promise<string | null>;
  removePlayer: (id: string) => Promise<string | null>;
  movePlayer: (id: string, direction: -1 | 1) => Promise<string | null>;
  createSession: (input: CreateSessionInput) => Promise<{ id?: string; error?: string }>;
  renameSession: (id: string, title: string) => Promise<string | null>;
  saveRound: (
    sessionId: string,
    scores: Record<string, number>,
    editRoundNumber?: number,
  ) => Promise<{ completed: boolean; winnerName?: string; error?: string }>;
  undoLastRound: (sessionId: string) => Promise<{ undone: boolean; error?: string }>;
  deleteSession: (sessionId: string) => Promise<string | null>;
  /** Ganti seluruh data lokal dengan snapshot cloud (pulihkan cadangan). */
  applySnapshot: (players: Player[], sessions: GameSession[]) => Promise<string | null>;
}

function suitForSeat(seatIndex: number): Suit {
  return nextSuit(seatIndex);
}

export const useStore = create<PentungState>((set, get) => ({
  ready: false,
  hasLoadedOnce: false,
  loadError: null,
  players: [],
  sessions: [],

  loadAll: async () => {
    try {
      await getDb();
      const [players, sessions] = await Promise.all([fetchPlayers(), fetchSessions()]);
      set({ players, sessions, ready: true, hasLoadedOnce: true, loadError: null });
    } catch {
      set({ ready: true, loadError: 'Gagal memuat data tersimpan. Coba lagi.' });
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
    try {
      await insertPlayer(player);
    } catch {
      return 'Gagal menambah pemain. Coba lagi.';
    }
    set({ players: [...get().players, player] });
    return null;
  },

  renamePlayer: async (id, name) => {
    const { players } = get();
    const error = validatePlayerName(name, players, id);
    if (error) return error;
    const updated = players.map((p) => (p.id === id ? { ...p, name: name.trim() } : p));
    const target = updated.find((p) => p.id === id);
    try {
      if (target) await updatePlayer(target);
    } catch {
      return 'Gagal mengganti nama pemain. Coba lagi.';
    }
    set({ players: updated });
    return null;
  },

  updateAvatar: async (id, avatar) => {
    const updated = get().players.map((p) => (p.id === id ? { ...p, avatar } : p));
    const target = updated.find((p) => p.id === id);
    try {
      if (target) await updatePlayer(target);
    } catch {
      return 'Gagal menyimpan avatar. Coba lagi.';
    }
    set({ players: updated });
    return null;
  },

  cycleSuit: async (id) => {
    const order: Suit[] = ['♠', '♥', '♦', '♣'];
    const updated = get().players.map((p) => {
      if (p.id !== id) return p;
      const next = order[(order.indexOf(p.suit) + 1) % order.length];
      return { ...p, suit: next };
    });
    const target = updated.find((p) => p.id === id);
    try {
      if (target) await updatePlayer(target);
    } catch {
      return 'Gagal mengganti simbol pemain. Coba lagi.';
    }
    set({ players: updated });
    return null;
  },

  setDealer: async (id) => {
    try {
      await clearDealerExcept(id);
    } catch {
      return 'Gagal menetapkan dealer. Coba lagi.';
    }
    set({ players: get().players.map((p) => ({ ...p, isDealer: p.id === id })) });
    return null;
  },

  removePlayer: async (id) => {
    const { players, sessions } = get();
    const inOngoing = sessions.some(
      (s) => s.status === 'ongoing' && s.participants.some((p) => p.playerId === id),
    );
    if (inOngoing) return 'Pemain ini ikut game yang sedang berjalan.';
    const remaining = players.filter((p) => p.id !== id);
    const needsNewDealer = remaining.length > 0 && !remaining.some((p) => p.isDealer);
    if (needsNewDealer) {
      remaining[0] = { ...remaining[0], isDealer: true };
    }
    try {
      await deletePlayerRow(id);
      if (needsNewDealer) await updatePlayer(remaining[0]);
    } catch {
      return 'Gagal menghapus pemain. Coba lagi.';
    }
    set({ players: remaining });
    return null;
  },

  /** Pindah posisi pemain (naik/turun) — roster disimpan terurut. */
  movePlayer: async (id, direction) => {
    const players = [...get().players];
    const index = players.findIndex((p) => p.id === id);
    const swapWith = index + direction;
    if (index < 0 || swapWith < 0 || swapWith >= players.length) return null;
    [players[index], players[swapWith]] = [players[swapWith], players[index]];
    set({ players });
    return null;
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
    try {
      await insertSession(session);
    } catch {
      return { error: 'Gagal menyimpan sesi baru. Coba lagi.' };
    }
    set({ sessions: [session, ...get().sessions] });
    return { id: session.id };
  },

  renameSession: async (id, title) => {
    const clean = title.trim();
    if (!clean) return null;
    const sessions = get().sessions.map((s) => (s.id === id ? { ...s, title: clean } : s));
    const target = sessions.find((s) => s.id === id);
    try {
      if (target) await updateSessionMeta(target);
    } catch {
      return 'Gagal mengganti nama sesi. Coba lagi.';
    }
    set({ sessions });
    return null;
  },

  saveRound: async (sessionId, scores, editRoundNumber) => {
    const { sessions, players } = get();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session || session.status !== 'ongoing') return { completed: false };
    try {
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
    } catch {
      return { completed: false, error: 'Gagal menyimpan ronde. Coba lagi.' };
    }
  },

  undoLastRound: async (sessionId) => {
    const { sessions } = get();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session || session.rounds.length === 0 || session.status !== 'ongoing') {
      return { undone: false };
    }
    const last = session.rounds[session.rounds.length - 1];
    try {
      await deleteLastRound(sessionId, last.roundNumber);
    } catch {
      return { undone: false, error: 'Gagal menghapus ronde terakhir. Coba lagi.' };
    }
    const updated: GameSession = { ...session, rounds: session.rounds.slice(0, -1) };
    set({ sessions: sessions.map((s) => (s.id === sessionId ? updated : s)) });
    return { undone: true };
  },

  deleteSession: async (sessionId) => {
    try {
      await deleteSessionRow(sessionId);
    } catch {
      return 'Gagal menghapus sesi. Coba lagi.';
    }
    set({ sessions: get().sessions.filter((s) => s.id !== sessionId) });
    return null;
  },

  applySnapshot: async (players, sessions) => {
    try {
      await replaceAllData(players, sessions);
    } catch {
      return 'Gagal memulihkan cadangan. Data lokal tidak diubah.';
    }
    set({ players, sessions, loadError: null });
    return null;
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
