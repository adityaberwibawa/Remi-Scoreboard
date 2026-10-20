import { mapServerTemplateList, mapServerTemplateToTemplate } from '../../api/dto';

describe('mapServerTemplateToTemplate', () => {
  it('memetakan name → title dan membuang created_at/updated_at', () => {
    const mapped = mapServerTemplateToTemplate({
      id: 1,
      name: 'Remi Santai',
      description: 'Sesi santai',
      image: '',
      status: 'active',
      created_at: '2024-01-01',
      updated_at: '2024-01-10',
    });
    expect(mapped).toEqual({
      id: 1,
      title: 'Remi Santai',
      description: 'Sesi santai',
      image: '',
      status: 'active',
    });
    expect(mapped).not.toHaveProperty('created_at');
    expect(mapped).not.toHaveProperty('updated_at');
    expect(mapped).not.toHaveProperty('name');
  });

  it('menolak item tanpa nama atau status tak dikenal', () => {
    expect(
      mapServerTemplateToTemplate({
        id: 2,
        name: '   ',
        description: '',
        image: '',
        status: 'active',
      }),
    ).toBeNull();
    expect(
      mapServerTemplateToTemplate({
        id: 3,
        name: 'X',
        description: '',
        image: '',
        status: 'archived',
      }),
    ).toBeNull();
    expect(
      mapServerTemplateToTemplate({
        id: Number.NaN,
        name: 'X',
        description: '',
        image: '',
        status: 'active',
      }),
    ).toBeNull();
  });
});

describe('mapServerTemplateList', () => {
  it('membuang item invalid dan non-array menjadi list kosong', () => {
    const out = mapServerTemplateList([
      { id: 1, name: 'A', description: '', image: '', status: 'active' },
      { id: 2, name: '', description: '', image: '', status: 'active' },
      { id: 3, name: 'C', description: '', image: '', status: 'rusak' },
    ]);
    expect(out.map((t) => t.id)).toEqual([1]);
    expect(mapServerTemplateList(null)).toEqual([]);
    expect(mapServerTemplateList({})).toEqual([]);
  });
});
