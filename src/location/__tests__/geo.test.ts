import {
  clampRadius,
  formatDistance,
  haversineMeters,
  isInsideRadius,
  roundCoordinate,
} from '../geo';

describe('haversineMeters', () => {
  it('mengembalikan 0 untuk titik yang sama', () => {
    expect(haversineMeters({ latitude: -6.2, longitude: 106.8 }, { latitude: -6.2, longitude: 106.8 })).toBe(0);
  });

  it('mendekati 111,2 km untuk satu derajat lintang', () => {
    const distance = haversineMeters(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 0 },
    );
    expect(distance).toBeGreaterThan(111_000);
    expect(distance).toBeLessThan(111_400);
  });

  it('menghitung jarak pendek dalam meter', () => {
    const distance = haversineMeters(
      { latitude: -6.2, longitude: 106.8 },
      { latitude: -6.2009, longitude: 106.8 },
    );
    expect(distance).toBeGreaterThan(99);
    expect(distance).toBeLessThan(101);
  });
});

describe('isInsideRadius', () => {
  const center = { latitude: -6.2, longitude: 106.8 };

  it('menganggap titik pusat selalu di dalam radius', () => {
    expect(isInsideRadius(center, center, 100)).toBe(true);
  });

  it('memakai batas radius inklusif', () => {
    const point = { latitude: -6.2009, longitude: 106.8 };
    const distance = haversineMeters(center, point);
    expect(isInsideRadius(center, point, distance)).toBe(true);
    expect(isInsideRadius(center, point, distance - 1)).toBe(false);
  });
});

describe('formatDistance', () => {
  it('memformat meter dan kilometer', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(999)).toBe('999 m');
    expect(formatDistance(1000)).toBe('1.0 km');
    expect(formatDistance(1540)).toBe('1.5 km');
  });

  it('memakai tanda pisah untuk nilai kosong', () => {
    expect(formatDistance(null)).toBe('—');
    expect(formatDistance(Number.NaN)).toBe('—');
  });
});

describe('clampRadius & roundCoordinate', () => {
  it('membatasi radius ke rentang aman', () => {
    expect(clampRadius(10)).toBe(50);
    expect(clampRadius(2000)).toBe(1000);
    expect(clampRadius(Number.NaN)).toBe(100);
  });

  it('membulatkan koordinat sesuai jumlah desimal', () => {
    expect(roundCoordinate({ latitude: -6.2009123, longitude: 106.8005123 }, 3)).toEqual({
      latitude: -6.201,
      longitude: 106.801,
    });
  });
});
