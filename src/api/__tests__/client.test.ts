import { ApiError } from '../errors';
import { requestJson } from '../http';
import {
  fetchSessionTemplates,
  readCachedTemplateList,
} from '../client';
import { readTemplateCache, writeTemplateCache } from '../../db';

jest.mock('../http', () => ({
  requestJson: jest.fn(),
}));

jest.mock('../../db', () => ({
  readTemplateCache: jest.fn(),
  writeTemplateCache: jest.fn(),
}));

const mockedRequestJson = jest.mocked(requestJson);
const mockedReadCache = jest.mocked(readTemplateCache);
const mockedWriteCache = jest.mocked(writeTemplateCache);

const RAW_TEMPLATE = {
  id: 7,
  name: 'Remi Malam',
  description: 'Sesi santai',
  image: '',
  status: 'active',
  min_players: 4,
  target_score_enabled: true,
  target_score: 300,
};

const MAPPED_TEMPLATE = {
  id: 7,
  title: 'Remi Malam',
  description: 'Sesi santai',
  image: '',
  status: 'active' as const,
  minPlayers: 4,
  targetScoreEnabled: true,
  targetScore: 300,
};

describe('fetchSessionTemplates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedWriteCache.mockResolvedValue(undefined);
    mockedReadCache.mockResolvedValue(null);
  });

  it('memetakan respons jaringan dan menyimpan cache', async () => {
    mockedRequestJson.mockResolvedValue([RAW_TEMPLATE]);

    const result = await fetchSessionTemplates({ baseUrl: 'https://api.test', useMock: false });

    expect(result).toEqual({ templates: [MAPPED_TEMPLATE], source: 'network', cachedAt: null });
    expect(mockedWriteCache).toHaveBeenCalledWith(JSON.stringify([MAPPED_TEMPLATE]));
  });

  it('memakai cache hanya untuk gangguan sementara', async () => {
    mockedRequestJson.mockRejectedValue(new ApiError({ kind: 'offline', message: 'Offline' }));
    mockedReadCache.mockResolvedValue({
      payload: JSON.stringify([MAPPED_TEMPLATE]),
      updatedAt: '2026-10-01T10:00:00.000Z',
    });

    const result = await fetchSessionTemplates({ baseUrl: 'https://api.test', useMock: false });

    expect(result).toEqual({
      templates: [MAPPED_TEMPLATE],
      source: 'cache',
      cachedAt: '2026-10-01T10:00:00.000Z',
    });
  });

  it('tidak menutupi error 4xx dengan cache', async () => {
    mockedRequestJson.mockRejectedValue(
      new ApiError({ kind: 'http', status: 400, message: 'Konfigurasi salah.' }),
    );
    mockedReadCache.mockResolvedValue({
      payload: JSON.stringify([MAPPED_TEMPLATE]),
      updatedAt: '2026-10-01T10:00:00.000Z',
    });

    await expect(
      fetchSessionTemplates({ baseUrl: 'https://api.test', useMock: false }),
    ).rejects.toMatchObject({ kind: 'http', status: 400 });
    expect(mockedReadCache).not.toHaveBeenCalled();
  });

  it('tidak menimpa cache saat payload server tidak valid', async () => {
    mockedRequestJson.mockResolvedValue({ templates: [] });

    await expect(
      fetchSessionTemplates({ baseUrl: 'https://api.test', useMock: false }),
    ).rejects.toMatchObject({ kind: 'parse' });
    expect(mockedWriteCache).not.toHaveBeenCalled();
  });

  it('menolak daftar yang isinya tidak bisa dipetakan', async () => {
    mockedRequestJson.mockResolvedValue([{ id: 1, status: 'aktif' }]);

    await expect(
      fetchSessionTemplates({ baseUrl: 'https://api.test', useMock: false }),
    ).rejects.toMatchObject({ kind: 'parse' });
    expect(mockedWriteCache).not.toHaveBeenCalled();
  });

  it('meneruskan abort tanpa fallback cache', async () => {
    mockedRequestJson.mockRejectedValue(new ApiError({ kind: 'aborted', message: 'Dibatalkan.' }));

    await expect(
      fetchSessionTemplates({ baseUrl: 'https://api.test', useMock: false }),
    ).rejects.toMatchObject({ kind: 'aborted' });
    expect(mockedReadCache).not.toHaveBeenCalled();
  });

  it('menolak base URL yang tidak aman tanpa memanggil jaringan', async () => {
    await expect(
      fetchSessionTemplates({ baseUrl: 'http://api.test', useMock: false }),
    ).rejects.toMatchObject({ kind: 'config' });
    expect(mockedRequestJson).not.toHaveBeenCalled();
  });

  it('memakai mock lokal tanpa menyentuh jaringan', async () => {
    const result = await fetchSessionTemplates({ useMock: true });

    expect(result.source).toBe('mock');
    expect(result.templates.length).toBeGreaterThan(0);
    expect(mockedRequestJson).not.toHaveBeenCalled();
  });
});

describe('readCachedTemplateList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('mengembalikan null saat cache kosong atau rusak', async () => {
    mockedReadCache.mockResolvedValue(null);
    await expect(readCachedTemplateList()).resolves.toBeNull();

    mockedReadCache.mockResolvedValue({ payload: 'bukan json', updatedAt: 'x' });
    await expect(readCachedTemplateList()).resolves.toBeNull();

    mockedReadCache.mockResolvedValue({ payload: '{"a":1}', updatedAt: 'x' });
    await expect(readCachedTemplateList()).resolves.toBeNull();
  });

  it('membaca cache valid beserta waktunya', async () => {
    mockedReadCache.mockResolvedValue({
      payload: JSON.stringify([MAPPED_TEMPLATE]),
      updatedAt: '2026-10-01T10:00:00.000Z',
    });

    await expect(readCachedTemplateList()).resolves.toEqual({
      templates: [MAPPED_TEMPLATE],
      cachedAt: '2026-10-01T10:00:00.000Z',
    });
  });
});
