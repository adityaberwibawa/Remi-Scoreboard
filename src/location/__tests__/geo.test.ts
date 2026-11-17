import {
  clampRadius,
  DEFAULT_RADIUS_M,
  distanceMeters,
  formatCoords,
  formatDistance,
  isInsideFence,
  isValidPoint,
  MAX_RADIUS_M,
  MIN_RADIUS_M,
} from '../geo';

const JAKARTA = { latitude: -6.2, longitude: 106.8 };

describe('distanceMeters', () => {
  it('mengembalikan 0 untuk titik yang sama', () => {
    expect(distanceMeters(JAKARTA, JAKARTA)).toBeCloseTo(0, 5);
  });

  it('menghitung jarak lintang sekitar 1,1 km', () => {
    const north = { latitude: -6.19, longitude: 106.8 };
    expect(distanceMeters(JAKARTA, north)).toBeCloseTo(1112, 0);
  });
});

describe('isInsideFence', () => {
  const arena = { ...JAKARTA, radiusM: 150 };

  it('menganggap pusat berada di dalam arena', () => {
    expect(isInsideFence(JAKARTA, arena)).toBe(true);
  });

  it('menolak titik yang jauh di luar radius', () => {
    expect(isInsideFence({ latitude: -6.21, longitude: 106.8 }, arena)).toBe(false);
  });

  it('memberi kelonggaran akurasi GPS', () => {
    const nearEdge = { latitude: -6.202, longitude: 106.8 };
    expect(isInsideFence(nearEdge, arena, 500)).toBe(true);
  });
});

describe('clampRadius', () => {
  it('memakai default untuk nilai tidak terbatas', () => {
    expect(clampRadius(Number.NaN)).toBe(DEFAULT_RADIUS_M);
  });

  it('membatasi ke rentang minimum dan maksimum', () => {
    expect(clampRadius(10)).toBe(MIN_RADIUS_M);
    expect(clampRadius(50_000)).toBe(MAX_RADIUS_M);
    expect(clampRadius(320.4)).toBe(320);
  });
});

describe('formatDistance', () => {
  it('memformat meter dan kilometer dengan koma desimal', () => {
    expect(formatDistance(12)).toBe('±12 m');
    expect(formatDistance(1234)).toBe('±1,2 km');
  });

  it('memakai tanda pisah untuk nilai kosong', () => {
    expect(formatDistance(null)).toBe('—');
    expect(formatDistance(Number.NaN)).toBe('—');
  });
});

describe('formatCoords', () => {
  it('menampilkan lima desimal dengan koma', () => {
    expect(formatCoords(JAKARTA)).toBe('-6,20000, 106,80000');
  });
});

describe('isValidPoint', () => {
  it('menerima koordinat dalam rentang', () => {
    expect(isValidPoint(JAKARTA)).toBe(true);
  });

  it('menolak koordinat di luar rentang atau bukan angka', () => {
    expect(isValidPoint({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidPoint({ latitude: 0, longitude: 181 })).toBe(false);
    expect(isValidPoint({ latitude: Number.NaN, longitude: 0 })).toBe(false);
  });
});
