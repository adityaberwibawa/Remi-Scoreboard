import { parseSnapshot } from '../snapshot';

const validPlayer = {
  id: 'p1',
  name: 'Andi',
  avatar: { type: 'initials', colorStyle: 'gold' },
  suit: '♥',
  gamesPlayed: 2,
  wins: 1,
  isDealer: true,
  createdAt: '2024-01-01T00:00:00.000Z',
};

const validSession = {
  id: 's1',
  title: 'Game #1',
  createdAt: '2024-01-02T00:00:00.000Z',
  status: 'completed',
  participants: [{ playerId: 'p1', seatOrder: 1, isDealer: true, isActive: true }],
  rules: { targetScoreEnabled: true, targetScore: 500 },
  rounds: [{ roundNumber: 1, scores: { p1: 40 } }],
  winnerPlayerId: 'p1',
};

describe('parseSnapshot', () => {
  it('mengembalikan pemain & sesi valid', () => {
    const snapshot = parseSnapshot({ players: [validPlayer], sessions: [validSession] });
    expect(snapshot.players).toHaveLength(1);
    expect(snapshot.players[0].avatar).toEqual({ type: 'initials', colorStyle: 'gold' });
    expect(snapshot.sessions[0].rounds[0].scores).toEqual({ p1: 40 });
    expect(snapshot.sessions[0].winnerPlayerId).toBe('p1');
  });

  it('menolak payload yang bukan objek dengan dua array', () => {
    expect(() => parseSnapshot(null)).toThrow('tidak valid');
    expect(() => parseSnapshot({ players: [] })).toThrow('tidak valid');
  });

  it('menyaring item rusak, duplikat, dan peserta tanpa pemain', () => {
    const snapshot = parseSnapshot({
      players: [
        validPlayer,
        { ...validPlayer, name: 'Duplikat' },
        { id: 'p2', name: '   ' },
        { ...validPlayer, id: 'p3', gamesPlayed: -4, avatar: { type: 'photo', photoUri: '' } },
      ],
      sessions: [
        {
          ...validSession,
          participants: [
            { playerId: 'p1', seatOrder: 1, isDealer: false, isActive: true },
            { playerId: 'hilang', seatOrder: 2, isDealer: false, isActive: true },
          ],
          rounds: [
            { roundNumber: 1, scores: { p1: 10 } },
            { roundNumber: 1, scores: { p1: 99 } },
            { roundNumber: 0, scores: { p1: 5 } },
          ],
          winnerPlayerId: 'hilang',
        },
        { ...validSession, id: 's1', title: 'Duplikat sesi' },
      ],
    });

    expect(snapshot.players.map((p) => p.id)).toEqual(['p1', 'p3']);
    expect(snapshot.players[1].gamesPlayed).toBe(0);
    expect(snapshot.players[1].avatar).toEqual({ type: 'initials', colorStyle: 'emerald' });
    expect(snapshot.sessions).toHaveLength(1);
    expect(snapshot.sessions[0].participants.map((p) => p.playerId)).toEqual(['p1']);
    expect(snapshot.sessions[0].rounds).toHaveLength(1);
    expect(snapshot.sessions[0].winnerPlayerId).toBeUndefined();
  });
});
