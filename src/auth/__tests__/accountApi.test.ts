import { AccountApi } from '../accountApi';
import { getAccessToken } from '../supabase';

jest.mock('../supabase', () => ({
  getAccessToken: jest.fn(),
}));

const mockedGetAccessToken = jest.mocked(getAccessToken);

const BASE_URL = 'https://api.test';
const SESSION_TOKEN = 'session-access';
const FRESH_TOKEN = 'session-access-refreshed';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function authHeader(init?: RequestInit): string {
  return (init?.headers as Record<string, string> | undefined)?.Authorization ?? '';
}

function createApi() {
  return new AccountApi(BASE_URL, { timeoutMs: 50, retryBaseDelayMs: 1 });
}

describe('AccountApi', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: jest.Mock<Promise<Response>, [string, RequestInit]>;

  beforeEach(() => {
    mockedGetAccessToken.mockResolvedValue(SESSION_TOKEN);
    fetchMock = jest.fn(
      async (_url: string, _init: RequestInit): Promise<Response> =>
        jsonResponse({ error: 'unexpected' }, 500),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('mengirim Bearer token sesi Supabase saat mengambil cadangan', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ players: [], sessions: [], updatedAt: null }));

    await expect(createApi().pullSnapshot()).resolves.toEqual({
      players: [],
      sessions: [],
      updatedAt: null,
    });
    expect(mockedGetAccessToken).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/sync`,
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${SESSION_TOKEN}` }) }),
    );
  });

  it('menolak tanpa jaringan bila belum ada sesi masuk', async () => {
    mockedGetAccessToken.mockResolvedValue(null);

    await expect(createApi().pullSnapshot()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mengirim snapshot dengan PUT', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, updatedAt: '2026-10-01T10:00:00.000Z' }));

    await expect(createApi().pushSnapshot([], [])).resolves.toBe('2026-10-01T10:00:00.000Z');
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/sync`,
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(authHeader(fetchMock.mock.calls[0][1])).toBe(`Bearer ${SESSION_TOKEN}`);
  });

  it('mencoba ulang sekali dengan token terbaru saat kena 401', async () => {
    fetchMock.mockImplementation(async (url, init) => {
      if (authHeader(init) === `Bearer ${SESSION_TOKEN}`) return jsonResponse({ error: 'expired' }, 401);
      if (authHeader(init) === `Bearer ${FRESH_TOKEN}`) return jsonResponse({ players: [], sessions: [], updatedAt: null });
      return jsonResponse({ error: 'unauthorized' }, 401);
    });
    mockedGetAccessToken.mockResolvedValueOnce(SESSION_TOKEN).mockResolvedValueOnce(FRESH_TOKEN);

    await expect(createApi().pullSnapshot()).resolves.toEqual({
      players: [],
      sessions: [],
      updatedAt: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('tidak mengulang request bila token tidak berubah (sesi benar-benar kedaluwarsa)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'expired' }, 401));

    await expect(createApi().pullSnapshot()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('melaporkan offline saat jaringan gagal', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(createApi().pullSnapshot()).rejects.toMatchObject({ kind: 'offline' });
  });

  it('menolak base URL yang tidak HTTPS', () => {
    expect(() => new AccountApi('http://insecure.test')).toThrow(/HTTPS/);
  });
});
