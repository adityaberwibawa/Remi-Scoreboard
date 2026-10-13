import { validateEmail, validateName, validatePassword } from '../api/auth';
import { clearSession, loadSession, saveSession } from '../api/session';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../api/authMock';
import { login } from '../api/auth';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
    getItemAsync: async (k: string) => store.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => {
      store.set(k, v);
    },
    deleteItemAsync: async (k: string) => {
      store.delete(k);
    },
  };
});

describe('validasi auth', () => {
  it('email wajib & format benar', () => {
    expect(validateEmail('')).toMatch(/kosong/);
    expect(validateEmail('bukan-email')).toMatch(/valid/);
    expect(validateEmail('Dika@Pentung.App ')).toBeNull();
  });
  it('password min 8 (login boleh pendek? tidak — tetap validasi format)', () => {
    expect(validatePassword('')).toMatch(/kosong/);
    expect(validatePassword('pendek')).toMatch(/8/);
    expect(validatePassword('demo1234')).toBeNull();
  });
  it('nama wajib max 32', () => {
    expect(validateName('  ')).toMatch(/kosong/);
    expect(validateName('x'.repeat(33))).toMatch(/32/);
    expect(validateName('Dika')).toBeNull();
  });
});

describe('session storage', () => {
  it('save → load → clear roundtrip', async () => {
    await saveSession({
      accessToken: 'a1',
      refreshToken: 'r1',
      expiresAt: Date.now() + 1000,
      user: { id: 'u1', name: 'Dika', email: DEMO_EMAIL },
    });
    const loaded = await loadSession();
    expect(loaded).toMatchObject({ accessToken: 'a1', refreshToken: 'r1' });
    await clearSession();
    await expect(loadSession()).resolves.toBeNull();
  });
});

describe('login mock', () => {
  it('demo sukses, salah 401', async () => {
    await expect(login(DEMO_EMAIL, DEMO_PASSWORD)).resolves.toMatchObject({ email: DEMO_EMAIL });
    await expect(login(DEMO_EMAIL, 'salah1234')).rejects.toThrow(/salah/);
  });
});
