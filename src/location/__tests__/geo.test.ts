import {
  MAX_GEOFENCE_RADIUS,
  MIN_GEOFENCE_RADIUS,
  clampRadius,
  distanceMeters,
  formatDistance,
  formatGeocodedAddress,
  geofenceSnapshot,
  isValidCoordinate,
} from '../geo';

describe('distanceMeters', () => {
  it('mengembalikan 0 untuk titik yang sama', () => {
    expect(distanceMeters({ latitude: -6.2, longitude: 106.8 }, { latitude: -6.2, longitude: 106.8 })).toBe(0);
  });

  it('menghitung jarak satu derajat bujur di ekuator', () => {
    const distance = distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 });
    expect(distance).toBeCloseTo(111194.93, 1);
  });

  it('mengembalikan NaN untuk koordinat tidak valid', () => {
    expect(distanceMeters({ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 0 })).toBeNaN();
    expect(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: Number.NaN })).toBeNaN();
  });
});

describe('isValidCoordinate', () => {
  it('menerima koordinat dalam rentang dan menolak di luar rentang', () => {
    expect(isValidCoordinate({ latitude: -90, longitude: 180 })).toBe(true);
    expect(isValidCoordinate({ latitude: 90, longitude: -180 })).toBe(true);
    expect(isValidCoordinate({ latitude: 90.1, longitude: 0 })).toBe(false);
    expect(isValidCoordinate({ latitude: 0, longitude: 180.1 })).toBe(false);
  });
});

describe('clampRadius', () => {
  it('membatasi radius ke rentang yang didukung', () => {
    expect(clampRadius(50)).toBe(MIN_GEOFENCE_RADIUS);
    expect(clampRadius(Number.NaN)).toBe(MIN_GEOFENCE_RADIUS);
    expect(clampRadius(999999)).toBe(MAX_GEOFENCE_RADIUS);
  });

  it('membulatkan radius valid', () => {
    expect(clampRadius(249.6)).toBe(250);
    expect(clampRadius(1000)).toBe(1000);
  });
});

describe('geofenceSnapshot', () => {
  const area = { latitude: 0, longitude: 0, radius: 100 };
  const metersPerDegree = 111194.93;

  it('menandai titik di dalam radius', () => {
    const snapshot = geofenceSnapshot({ latitude: 90 / metersPerDegree, longitude: 0 }, area);
    expect(snapshot.inside).toBe(true);
    expect(snapshot.distance).toBeCloseTo(90, 0);
  });

  it('menandai titik tepat di batas sebagai di dalam', () => {
    const snapshot = geofenceSnapshot({ latitude: 100 / metersPerDegree, longitude: 0 }, area);
    expect(snapshot.inside).toBe(true);
    expect(snapshot.edgeDistance).toBeCloseTo(0, 0);
  });

  it('menandai titik di luar radius', () => {
    const snapshot = geofenceSnapshot({ latitude: 110 / metersPerDegree, longitude: 0 }, area);
    expect(snapshot.inside).toBe(false);
    expect(snapshot.edgeDistance).toBeCloseTo(10, 0);
  });

  it('memakai radius yang sudah dibatasi', () => {
    const snapshot = geofenceSnapshot(
      { latitude: 200 / metersPerDegree, longitude: 0 },
      { latitude: 0, longitude: 0, radius: 50 },
    );
    expect(snapshot.inside).toBe(false);
    expect(snapshot.edgeDistance).toBeCloseTo(100, 0);
  });

  it('mengembalikan jarak NaN untuk titik tidak valid', () => {
    const snapshot = geofenceSnapshot({ latitude: 0, longitude: 0 }, { ...area, radius: Number.NaN });
    expect(snapshot.distance).toBe(0);
    expect(snapshot.inside).toBe(true);
    expect(geofenceSnapshot({ latitude: Number.NaN, longitude: 0 }, area).distance).toBeNaN();
  });
});

describe('formatDistance', () => {
  it('memformat meter dan kilometer', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(999)).toBe('999 m');
    expect(formatDistance(1000)).toBe('1.0 km');
    expect(formatDistance(1500)).toBe('1.5 km');
    expect(formatDistance(15000)).toBe('15 km');
  });

  it('memakai tanda pisah untuk nilai tidak valid', () => {
    expect(formatDistance(Number.NaN)).toBe('—');
    expect(formatDistance(-1)).toBe('—');
  });
});

describe('formatGeocodedAddress', () => {
  it('menggabungkan komponen alamat tanpa duplikasi', () => {
    expect(
      formatGeocodedAddress({
        name: 'Gambir',
        street: 'Jl. Medan Merdeka Barat',
        streetNumber: '12',
        district: 'Gambir',
        city: 'Jakarta Pusat',
        region: 'DKI Jakarta',
        country: 'Indonesia',
      }),
    ).toBe('Gambir, Jl. Medan Merdeka Barat 12, Jakarta Pusat, DKI Jakarta, Indonesia');
  });

  it('membuang duplikasi tanpa memandang huruf besar-kecil', () => {
    expect(
      formatGeocodedAddress({
        city: 'Jakarta',
        region: 'JAKARTA',
        country: 'Indonesia',
      }),
    ).toBe('Jakarta, Indonesia');
  });

  it('memakai formattedAddress bila komponen kosong', () => {
    expect(formatGeocodedAddress({ formattedAddress: '  Jalan Contoh 1  ' })).toBe('Jalan Contoh 1');
    expect(formatGeocodedAddress(null)).toBe('');
    expect(formatGeocodedAddress({})).toBe('');
  });
});
