import { buildGeofenceRegions } from '../geofenceRegions';
import type { SessionLocation } from '../types';
import type { GameSession } from '../../types';

const ongoing: GameSession = {
  id: 'ongoing-1',
  title: 'Remi Berjalan',
  createdAt: '2026-11-17T10:00:00.000Z',
  status: 'ongoing',
  participants: [],
  rules: { targetScoreEnabled: false, targetScore: 0 },
  rounds: [],
};

const completed: GameSession = {
  ...ongoing,
  id: 'done-1',
  title: 'Remi Selesai',
  status: 'completed',
};

function location(sessionId: string, enabled = true): SessionLocation {
  return {
    sessionId,
    latitude: -6.2,
    longitude: 106.8,
    address: 'Arena',
    placeName: 'Arena',
    radiusM: 200,
    geofenceEnabled: enabled,
    updatedAt: '2026-11-17T10:00:00.000Z',
  };
}

describe('buildGeofenceRegions', () => {
  it('hanya mendaftarkan sesi ongoing dengan geofence aktif', () => {
    const regions = buildGeofenceRegions(
      {
        [ongoing.id]: location(ongoing.id),
        [completed.id]: location(completed.id),
        'disabled-1': location('disabled-1', false),
      },
      [ongoing, completed],
    );

    expect(regions).toEqual([
      {
        identifier: ongoing.id,
        latitude: -6.2,
        longitude: 106.8,
        radius: 200,
        notifyOnEnter: true,
        notifyOnExit: true,
      },
    ]);
  });

  it('mengembalikan array kosong bila tidak ada arena aktif', () => {
    expect(buildGeofenceRegions({}, [ongoing])).toEqual([]);
    expect(
      buildGeofenceRegions({ [ongoing.id]: location(ongoing.id, false) }, [ongoing]),
    ).toEqual([]);
  });
});
