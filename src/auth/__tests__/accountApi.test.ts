import { AccountApi, type AccountTokens } from '../accountApi';
import { deleteItem, getItem, setItem } from '../secureStorage';

jest.mock('../secureStorage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  deleteItem: jest.fn(),
}));

const mockedGetItem = jest.mocked(getItem);
const mockedSetItem = jest.mocked(setItem);
const mockedDeleteItem = jest.mocked(deleteItem);

const TOKEN_KEY = 'pentung.auth.accountTokens';
const BASE_URL = 'https://api.test';

const OLD_ACCESS = 'access-old';
const NEW_ACCESS = 'access-new';
const USER = { id: 'u1', name: 'Bowo', email: 'bowo@example.com' };

function tokens(overrides: Partial<AccountTokens> = {}): AccountTokens {
  return {
    user: USER,
    accessToken: OLD_ACCESS,
    refreshToken: 'refresh-old',
    tokenType: 'Bearer',
    expiresIn: 900,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function authHeader(init?: RequestInit): string {
  return (init?.headers as Record<string, string> | undefined)?.Authorization ?? '';
}

let storage: Record<string, string>;

function createApi() {
  return new AccountApi(BASE_URL, { timeoutMs: 50, retryBaseDelayMs: 1 });
}

describe('AccountApi', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: jest.Mock<Promise<Response>, [string, RequestInit]>;

  beforeEach(() => {
    storage = { [TOKEN_KEY]: JSON.stringify(tokens()) };
    mockedGetItem.mockImplementation(async (key) => storage[key] ?? null);
    mockedSetItem.mockImplementation(async (key, value) => {
      storage[key] = value;
    });
    mockedDeleteItem.mockImplementation(async (key) => {
      delete storage[key];
    });
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

  it('menyimpan token setelah login', async () => {
    const fresh = tokens({ accessToken: 'login-access' });
    fetchMock.mockResolvedValue(jsonResponse(fresh));

    const result = await createApi().login('bowo@example.com', 'rahasia123');

    expect(result).toEqual(fresh);
    expect(JSON.parse(storage[TOKEN_KEY])).toEqual(fresh);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/auth/login`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('me-refresh sekali saat access token kedaluwarsa', async () => {
    const fresh = tokens({ accessToken: NEW_ACCESS, refreshToken: 'refresh-new' });
    fetchMock.mockImplementation(async (url, init) => {
      if (url.endsWith('/api/auth/refresh')) return jsonResponse(fresh);
      if (authHeader(init) === `Bearer ${OLD_ACCESS}`) return jsonResponse({ error: 'expired' }, 401);
      if (authHeader(init) === `Bearer ${NEW_ACCESS}`) return jsonResponse({ user: USER });
      return jsonResponse({ error: 'unauthorized' }, 401);
    });

    await expect(createApi().currentUser()).resolves.toEqual(USER);
    const refreshCalls = fetchMock.mock.calls.filter(([url]) => url.endsWith('/api/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
    expect(JSON.parse(storage[TOKEN_KEY]).accessToken).toBe(NEW_ACCESS);
  });

  it('mendeduplikasi refresh untuk request 401 yang bersamaan', async () => {
    const fresh = tokens({ accessToken: NEW_ACCESS, refreshToken: 'refresh-new' });
    fetchMock.mockImplementation(async (url, init) => {
      if (url.endsWith('/api/auth/refresh')) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return jsonResponse(fresh);
      }
      if (authHeader(init) === `Bearer ${OLD_ACCESS}`) return jsonResponse({ error: 'expired' }, 401);
      return jsonResponse({ user: USER });
    });

    const api = createApi();
    await Promise.all([api.currentUser(), api.currentUser()]);

    const refreshCalls = fetchMock.mock.calls.filter(([url]) => url.endsWith('/api/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });

  it('mempertahankan token saat offline', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(createApi().currentUser()).rejects.toMatchObject({ kind: 'offline' });
    expect(storage[TOKEN_KEY]).toBeDefined();
    expect(mockedDeleteItem).not.toHaveBeenCalled();
  });

  it('menghapus sesi bila refresh ditolak 401', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (url.endsWith('/api/auth/refresh')) return jsonResponse({ error: 'invalid' }, 401);
      return jsonResponse({ error: 'expired' }, 401);
    });

    await expect(createApi().currentUser()).rejects.toMatchObject({ status: 401 });
    expect(storage[TOKEN_KEY]).toBeUndefined();
  });

  it('mengirim snapshot dengan PUT', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, updatedAt: '2026-10-01T10:00:00.000Z' }));

    await expect(createApi().pushSnapshot([], [])).resolves.toBe('2026-10-01T10:00:00.000Z');
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/api/sync`,
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('mengosongkan token saat logout meski jaringan gagal', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(createApi().logout()).resolves.toBeUndefined();
    expect(storage[TOKEN_KEY]).toBeUndefined();
  });

  it('logout lokal tidak memanggil jaringan', async () => {
    await expect(createApi().logout({ remote: false })).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storage[TOKEN_KEY]).toBeUndefined();
  });

  it('membaca profil tersimpan tanpa jaringan', async () => {
    const api = createApi();
    await expect(api.hasSession()).resolves.toBe(true);
    await expect(api.getCachedUser()).resolves.toEqual(USER);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
