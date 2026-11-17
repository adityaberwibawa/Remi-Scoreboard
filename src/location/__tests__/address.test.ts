import { formatAddress } from '../address';

describe('formatAddress', () => {
  it('menggabungkan komponen alamat yang tersedia', () => {
    expect(
      formatAddress({
        name: 'Lapangan RW 05',
        street: 'Jl. Merdeka',
        streetNumber: '10',
        district: 'Cilengkrang',
        city: 'Bandung',
        region: 'Jawa Barat',
        country: 'Indonesia',
      }),
    ).toEqual({
      address:
        'Lapangan RW 05, Jl. Merdeka No. 10, Cilengkrang, Bandung, Jawa Barat, Indonesia',
      placeName: 'Lapangan RW 05',
    });
  });

  it('memakai formattedAddress dari Android bila tersedia', () => {
    expect(
      formatAddress({
        name: 'Gedung Serbaguna',
        formattedAddress: 'Gedung Serbaguna, Jl. Asia Afrika, Bandung',
      }),
    ).toEqual({
      address: 'Gedung Serbaguna, Jl. Asia Afrika, Bandung',
      placeName: 'Gedung Serbaguna',
    });
  });

  it('membuang komponen duplikat', () => {
    expect(
      formatAddress({
        city: 'Bandung',
        region: 'bandung',
        country: 'Indonesia',
      })?.address,
    ).toBe('Bandung, Indonesia');
  });

  it('mengembalikan null bila tidak ada komponen alamat', () => {
    expect(formatAddress({})).toBeNull();
    expect(formatAddress({ name: '   ', city: null })).toBeNull();
  });
});
