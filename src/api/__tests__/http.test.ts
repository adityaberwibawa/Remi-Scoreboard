import { ApiError } from '../errors';
import { requestJson } from '../http';

type FetchMock = jest.Mock<Promise<Response>, [string, RequestInit]>;

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function installFetch(impl: (url: string, init: RequestInit) => Promise<Response>): FetchMock {
  const mock = jest.fn(impl) as unknown as FetchMock;
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

describe('requestJson', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('mengembalikan body JSON pada respons sukses', async () => {
    installFetch(async () => jsonResponse({ ok: true }));
    await expect(requestJson('https://api.test/data', { method: 'GET' })).resolves.toEqual({
      ok: true,
    });
  });

  it('mengulang request GET yang gagal sementara lalu berhasil', async () => {
    const fetchMock = installFetch(async () => {
      if (fetchMock.mock.calls.length === 1) return jsonResponse({ error: 'down' }, 503);
      return jsonResponse({ items: [1] });
    });

    await expect(
      requestJson('https://api.test/data', { method: 'GET' }, { retryBaseDelayMs: 1 }),
    ).resolves.toEqual({ items: [1] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('tidak mengulang error 4xx non-transient', async () => {
    const fetchMock = installFetch(async () => jsonResponse({ error: 'Data tidak valid.' }, 400));

    await expect(
      requestJson('https://api.test/data', { method: 'GET' }, { retryBaseDelayMs: 1 }),
    ).rejects.toMatchObject({ kind: 'http', status: 400, retryable: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('tidak mengulang POST secara default', async () => {
    const fetchMock = installFetch(async () => jsonResponse({ error: 'down' }, 503));

    await expect(
      requestJson(
        'https://api.test/login',
        { method: 'POST', body: '{}' },
        { retryBaseDelayMs: 1 },
      ),
    ).rejects.toMatchObject({ kind: 'http', status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('menghormati Retry-After sebelum mencoba lagi', async () => {
    const fetchMock = installFetch(async () => {
      if (fetchMock.mock.calls.length === 1) {
        return jsonResponse({ error: 'santai' }, 429, { 'Retry-After': '0' });
      }
      return jsonResponse({ ok: true });
    });

    await expect(
      requestJson('https://api.test/data', { method: 'GET' }, { retryBaseDelayMs: 1 }),
    ).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('menandai timeout saat server tidak merespons', async () => {
    installFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
          });
        }),
    );

    await expect(
      requestJson('https://api.test/slow', { method: 'GET' }, { timeoutMs: 10, retries: 0 }),
    ).rejects.toMatchObject({ kind: 'timeout', retryable: true });
  });

  it('tidak memanggil fetch bila signal sudah dibatalkan', async () => {
    const fetchMock = installFetch(async () => jsonResponse({ ok: true }));
    const controller = new AbortController();
    controller.abort();

    await expect(
      requestJson('https://api.test/data', { method: 'GET' }, { signal: controller.signal }),
    ).rejects.toMatchObject({ kind: 'aborted' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('menandai body non-JSON sebagai parse error', async () => {
    installFetch(async () => new Response('<html>oops</html>', { status: 200 }));

    await expect(
      requestJson('https://api.test/data', { method: 'GET' }, { retries: 0 }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ApiError>>({ kind: 'parse', status: 200 }),
    );
  });

  it('memakai pesan error dari server bila ada', async () => {
    installFetch(async () => jsonResponse({ error: 'Email sudah terdaftar.' }, 409));

    await expect(
      requestJson('https://api.test/register', { method: 'POST', body: '{}' }),
    ).rejects.toMatchObject({ message: 'Email sudah terdaftar.', status: 409 });
  });
});
