import {
  clearDealerExcept,
  deleteLastRound,
  deleteSessionRow,
  fetchPlayers,
  fetchSessions,
  getDb,
  insertPlayer,
  insertRound,
  replaceAllData,
  updatePlayer,
  updateSessionMeta,
} from '../db';
import { useStore } from '../store';
import type { GameSession, Player } from '../types';

jest.mock('../db', () => ({
  clearDealerExcept: jest.fn(),
  deleteLastRound: jest.fn(),
  deletePlayerRow: jest.fn(),
  deleteSessionRow: jest.fn(),
  fetchPlayers: jest.fn(),
  fetchSessions: jest.fn(),
  getDb: jest.fn(),
  insertPlayer: jest.fn(),
  insertRound: jest.fn(),
  insertSession: jest.fn(),
  replaceAllData: jest.fn(),
  updatePlayer: jest.fn(),
  updateRound: jest.fn(),
  updateSessionMeta: jest.fn(),
}));

const mockedGetDb = jest.mocked(getDb);
const mockedFetchPlayers = jest.mocked(fetchPlayers);
const mockedFetchSessions = jest.mocked(fetchSessions);
const mockedInsertPlayer = jest.mocked(insertPlayer);
const mockedDeleteSessionRow = jest.mocked(deleteSessionRow);
const mockedReplaceAllData = jest.mocked(replaceAllData);
const mockedDeleteLastRound = jest.mocked(deleteLastRound);
const mockedInsertRound = jest.mocked(insertRound);
const mockedUpdateSessionMeta = jest.mocked(updateSessionMeta);
const mockedClearDealerExcept = jest.mocked(clearDealerExcept);
const mockedUpdatePlayer = jest.mocked(updatePlayer);

const PLAYER: Player = {
  id: 'p1',
  name: 'Bowo',
  avatar: { type: 'initials', colorStyle: 'emerald' },
  suit: '♠',
  gamesPlayed: 0,
  wins: 0,
  isDealer: true,
  createdAt: '2026-10-01T10:00:00.000Z',
};

const SESSION: GameSession = {
  id: 's1',
  title: 'Remi Malam',
  createdAt: '2026-10-01T10:00:00.000Z',
  status: 'ongoing',
  participants: [{ playerId: 'p1', seatOrder: 0, isDealer: true, isActive: true }],
  rules: { targetScoreEnabled: false, targetScore: 0 },
  rounds: [],
};

describe('useStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useStore.setState({
      ready: false,
      hasLoadedOnce: false,
      loadError: null,
      players: [],
      sessions: [],
    });
    mockedGetDb.mockResolvedValue({} as never);
    mockedFetchPlayers.mockResolvedValue([]);
    mockedFetchSessions.mockResolvedValue([]);
    mockedInsertPlayer.mockResolvedValue(undefined);
    mockedDeleteSessionRow.mockResolvedValue(undefined);
    mockedReplaceAllData.mockResolvedValue(undefined);
    mockedDeleteLastRound.mockResolvedValue(undefined);
  });

  it('menandai load sukses dan menyimpan data', async () => {
    mockedFetchPlayers.mockResolvedValue([PLAYER]);
    mockedFetchSessions.mockResolvedValue([SESSION]);

    await useStore.getState().loadAll();

    const state = useStore.getState();
    expect(state.ready).toBe(true);
    expect(state.hasLoadedOnce).toBe(true);
    expect(state.loadError).toBeNull();
    expect(state.players).toEqual([PLAYER]);
    expect(state.sessions).toEqual([SESSION]);
  });

  it('melaporkan loadError saat database gagal dibuka', async () => {
    mockedGetDb.mockRejectedValue(new Error('db rusak'));

    await useStore.getState().loadAll();

    const state = useStore.getState();
    expect(state.ready).toBe(true);
    expect(state.hasLoadedOnce).toBe(false);
    expect(state.loadError).toMatch(/Gagal memuat data tersimpan/);
  });

  it('tetap menandai hasLoadedOnce setelah load pertama sukses', async () => {
    await useStore.getState().loadAll();
    mockedGetDb.mockRejectedValue(new Error('db rusak'));

    await useStore.getState().loadAll();

    expect(useStore.getState().hasLoadedOnce).toBe(true);
    expect(useStore.getState().loadError).toMatch(/Gagal memuat/);
  });

  it('mengembalikan pesan saat gagal menambah pemain', async () => {
    mockedInsertPlayer.mockRejectedValue(new Error('disk penuh'));

    const error = await useStore.getState().addPlayer('Bowo', {
      type: 'initials',
      colorStyle: 'emerald',
    });

    expect(error).toMatch(/Gagal menambah pemain/);
    expect(useStore.getState().players).toHaveLength(0);
  });

  it('mengembalikan pesan saat gagal menghapus sesi dan data tetap ada', async () => {
    useStore.setState({ sessions: [SESSION] });
    mockedDeleteSessionRow.mockRejectedValue(new Error('gagal'));

    const error = await useStore.getState().deleteSession(SESSION.id);

    expect(error).toMatch(/Gagal menghapus sesi/);
    expect(useStore.getState().sessions).toEqual([SESSION]);
  });

  it('tidak mengganti data lokal bila restore gagal', async () => {
    useStore.setState({ players: [PLAYER] });
    mockedReplaceAllData.mockRejectedValue(new Error('gagal'));

    const error = await useStore.getState().applySnapshot([], []);

    expect(error).toMatch(/Gagal memulihkan cadangan/);
    expect(useStore.getState().players).toEqual([PLAYER]);
  });

  it('mengembalikan error saat undo gagal', async () => {
    useStore.setState({
      sessions: [{ ...SESSION, rounds: [{ roundNumber: 1, scores: { p1: 10 } }] }],
    });
    mockedDeleteLastRound.mockRejectedValue(new Error('gagal'));

    const result = await useStore.getState().undoLastRound(SESSION.id);

    expect(result.undone).toBe(false);
    expect(result.error).toMatch(/Gagal menghapus ronde/);
    expect(useStore.getState().sessions[0].rounds).toHaveLength(1);
  });

  it('mengembalikan error saat menyimpan ronde gagal', async () => {
    useStore.setState({ players: [PLAYER], sessions: [SESSION] });
    mockedInsertRound.mockRejectedValue(new Error('gagal'));

    const result = await useStore.getState().saveRound(SESSION.id, { p1: 10 });

    expect(result.completed).toBe(false);
    expect(result.error).toMatch(/Gagal menyimpan ronde/);
    expect(useStore.getState().sessions[0].rounds).toHaveLength(0);
  });

  it('memakai write DB untuk aksi yang berhasil', async () => {
    useStore.setState({ players: [PLAYER], sessions: [SESSION] });

    await expect(useStore.getState().cycleSuit(PLAYER.id)).resolves.toBeNull();
    expect(mockedUpdatePlayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: PLAYER.id, suit: '♥' }),
    );

    await expect(useStore.getState().setDealer(PLAYER.id)).resolves.toBeNull();
    expect(mockedClearDealerExcept).toHaveBeenCalledWith(PLAYER.id);

    await expect(useStore.getState().renameSession(SESSION.id, 'Baru')).resolves.toBeNull();
    expect(mockedUpdateSessionMeta).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Baru' }),
    );
  });
});
