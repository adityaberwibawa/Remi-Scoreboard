import {
  clearDealerExcept,
  deleteLastRound,
  deleteSessionLocationData,
  deleteSessionRow,
  fetchGeofenceEvents,
  fetchPlayers,
  fetchSessionLocations,
  fetchSessions,
  getDb,
  insertGeofenceEvent,
  insertPlayer,
  insertRound,
  replaceAllData,
  updatePlayer,
  updateSessionMeta,
  upsertSessionLocation,
} from '../db';
import { useStore } from '../store';
import type { GameSession, Player } from '../types';
import type { GeofenceEvent, SessionLocation } from '../location/types';

jest.mock('../db', () => ({
  clearDealerExcept: jest.fn(),
  deleteLastRound: jest.fn(),
  deletePlayerRow: jest.fn(),
  deleteSessionLocationData: jest.fn(),
  deleteSessionRow: jest.fn(),
  fetchGeofenceEvents: jest.fn(),
  fetchPlayers: jest.fn(),
  fetchSessionLocations: jest.fn(),
  fetchSessions: jest.fn(),
  getDb: jest.fn(),
  insertGeofenceEvent: jest.fn(),
  insertPlayer: jest.fn(),
  insertRound: jest.fn(),
  insertSession: jest.fn(),
  replaceAllData: jest.fn(),
  updatePlayer: jest.fn(),
  updateRound: jest.fn(),
  updateSessionMeta: jest.fn(),
  upsertSessionLocation: jest.fn(),
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
const mockedFetchSessionLocations = jest.mocked(fetchSessionLocations);
const mockedUpsertSessionLocation = jest.mocked(upsertSessionLocation);
const mockedDeleteSessionLocationData = jest.mocked(deleteSessionLocationData);
const mockedFetchGeofenceEvents = jest.mocked(fetchGeofenceEvents);
const mockedInsertGeofenceEvent = jest.mocked(insertGeofenceEvent);

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

const LOCATION: SessionLocation = {
  sessionId: SESSION.id,
  latitude: -6.2,
  longitude: 106.8,
  address: 'Lapangan RW 05',
  placeName: 'Lapangan RW 05',
  radiusM: 200,
  geofenceEnabled: false,
  updatedAt: '2026-10-01T10:00:00.000Z',
};

const GEOFENCE_EVENT: GeofenceEvent = {
  id: 1,
  sessionId: SESSION.id,
  type: 'enter',
  source: 'foreground',
  latitude: -6.2,
  longitude: 106.8,
  occurredAt: '2026-10-01T10:05:00.000Z',
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
      sessionLocations: {},
      geofenceEvents: [],
    });
    mockedGetDb.mockResolvedValue({} as never);
    mockedFetchPlayers.mockResolvedValue([]);
    mockedFetchSessions.mockResolvedValue([]);
    mockedFetchSessionLocations.mockResolvedValue([]);
    mockedFetchGeofenceEvents.mockResolvedValue([]);
    mockedUpsertSessionLocation.mockResolvedValue(undefined);
    mockedDeleteSessionLocationData.mockResolvedValue(undefined);
    mockedInsertGeofenceEvent.mockResolvedValue(undefined);
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

  it('memuat arena sesi dari database', async () => {
    mockedFetchSessionLocations.mockResolvedValue([LOCATION]);

    await useStore.getState().loadAll();

    expect(useStore.getState().sessionLocations).toEqual({ [SESSION.id]: LOCATION });
  });

  it('menyimpan arena dan mencatat event geofence', async () => {
    await expect(useStore.getState().saveSessionLocation(LOCATION)).resolves.toBeNull();
    expect(mockedUpsertSessionLocation).toHaveBeenCalledWith(LOCATION);
    expect(useStore.getState().sessionLocations[SESSION.id]).toEqual(LOCATION);

    mockedFetchGeofenceEvents.mockResolvedValue([GEOFENCE_EVENT]);
    await useStore.getState().recordGeofenceEvent({
      sessionId: SESSION.id,
      type: 'enter',
      source: 'foreground',
      latitude: -6.2,
      longitude: 106.8,
      occurredAt: GEOFENCE_EVENT.occurredAt,
    });
    expect(mockedInsertGeofenceEvent).toHaveBeenCalled();
    expect(useStore.getState().geofenceEvents).toEqual([GEOFENCE_EVENT]);
  });

  it('mengubah status geofence dan menghapus data arena', async () => {
    useStore.setState({ sessionLocations: { [SESSION.id]: LOCATION } });

    await expect(useStore.getState().setGeofenceEnabled(SESSION.id, true)).resolves.toBeNull();
    expect(mockedUpsertSessionLocation).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION.id, geofenceEnabled: true }),
    );

    await expect(useStore.getState().removeSessionLocation(SESSION.id)).resolves.toBeNull();
    expect(mockedDeleteSessionLocationData).toHaveBeenCalledWith(SESSION.id);
    expect(useStore.getState().sessionLocations).toEqual({});
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
