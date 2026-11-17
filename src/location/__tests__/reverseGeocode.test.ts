import {
  buildReverseGeocodeUrl,
  formatAddressParts,
  geocodeCacheKey,
  parseBigDataCloud,
} from '../reverseGeocode';

jest.mock('../../db', () => ({
  readGeocodeCache: jest.fn().mockResolvedValue(null),
  writeGeocodeCache: jest.fn().mockResolvedValue(undefined),
}));

describe('formatAddressParts', () => {
  it('membuang bagian kosong dan duplikat', () => {
    expect(
      formatAddressParts(['Jakarta', 'jakarta', '   ', null, 'Bandung', 'Jawa Barat']),
    ).toBe('Jakarta, Bandung, Jawa Barat');
  });

  it('membatasi jumlah bagian alamat', () => {
    expect(formatAddressParts(['A', 'B', 'C', 'D', 'E'], 3)).toBe('A, B, C');
  });

  it('mengembalikan null bila tidak ada bagian yang bisa dipakai', () => {
    expect(formatAddressParts([null, '', '   '])).toBeNull();
  });
});

describe('parseBigDataCloud', () => {
  it('menggabungkan locality, kota, dan wilayah administratif', () => {
    const address = parseBigDataCloud({
      locality: 'Menteng',
      city: 'Jakarta Pusat',
      principalSubdivision: 'DKI Jakarta',
      countryName: 'Indonesia',
      postcode: '10310',
      localityInfo: {
        administrative: [
          { name: 'Kecamatan Menteng', order: 2 },
          { name: 'Jakarta', order: 1 },
        ],
      },
    });

    expect(address).toBe('Menteng, Jakarta Pusat, Jakarta, Kecamatan Menteng');
  });

  it('menolak respons yang bukan objek', () => {
    expect(parseBigDataCloud(null)).toBeNull();
    expect(parseBigDataCloud([])).toBeNull();
    expect(parseBigDataCloud('Jakarta')).toBeNull();
  });

  it('mengembalikan null bila semua komponen kosong', () => {
    expect(parseBigDataCloud({ locality: ' ', city: '' })).toBeNull();
  });
});

describe('buildReverseGeocodeUrl', () => {
  it('menyertakan koordinat dan bahasa Indonesia', () => {
    const url = buildReverseGeocodeUrl({ latitude: -6.2, longitude: 106.8 });
    expect(url).toContain('latitude=-6.2');
    expect(url).toContain('longitude=106.8');
    expect(url).toContain('localityLanguage=id');
  });
});

describe('geocodeCacheKey', () => {
  it('membulatkan koordinat ke empat desimal', () => {
    expect(geocodeCacheKey({ latitude: -6.20004, longitude: 106.80004 })).toBe(
      '-6.2000,106.8000',
    );
  });
});
