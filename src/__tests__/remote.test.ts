import { normalizeRemoteEntry, normalizeRemoteList } from '../api/remoteTypes';
import { MOCK_LEADERBOARD } from '../api/mock';

describe('normalizeRemoteEntry', () => {
  it('memetakan field standar', () => {
    expect(
      normalizeRemoteEntry({ id: 'a', name: 'Bowo', totalScore: 100, wins: 2, gamesPlayed: 3, rank: 1 }),
    ).toMatchObject({ id: 'a', name: 'Bowo', totalScore: 100, rank: 1 });
  });

  it('toleran alias field server', () => {
    expect(
      normalizeRemoteEntry({ _id: 'b', playerName: 'Dika', total: 50, position: 2 }),
    ).toMatchObject({ id: 'b', name: 'Dika', totalScore: 50, rank: 2 });
  });

  it('null bila tanpa id/nama', () => {
    expect(normalizeRemoteEntry({ totalScore: 10 })).toBeNull();
    expect(normalizeRemoteEntry(null)).toBeNull();
  });
});

describe('normalizeRemoteList', () => {
  it('mendukung array langsung dan {data}', () => {
    const raw = [{ id: 'a', name: 'A', totalScore: 30, rank: 2 }, { id: 'b', name: 'B', totalScore: 90, rank: 1 }];
    expect(normalizeRemoteList(raw).map((r) => r.id)).toEqual(['b', 'a']);
    expect(normalizeRemoteList({ data: raw, total: 2 }).map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('mock sudah terurut rank', () => {
    const rows = normalizeRemoteList(MOCK_LEADERBOARD);
    expect(rows[0].rank).toBe(1);
    expect(rows.length).toBe(MOCK_LEADERBOARD.length);
  });
});
