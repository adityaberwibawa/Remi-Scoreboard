import { supabaseSessionStorage } from '../sessionStorage';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key);
      }),
    },
  };
});

jest.mock('../secureStorage', () => {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => store.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItem: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

jest.mock('expo-crypto', () => ({
  // Deterministik agar hasil enkripsi bisa direproduksi di test.
  getRandomValues: <T extends Uint8Array>(array: T): T => {
    for (let i = 0; i < array.length; i += 1) array[i] = (i * 31 + 17) % 256;
    return array;
  },
}));

const STORAGE_KEY = 'sb-test-auth-token';
const SESSION = JSON.stringify({ access_token: 'rahasia', refresh_token: 'rahasia2' });

async function rawAsyncStorage(): Promise<Record<string, string>> {
  const storage = jest.requireMock('@react-native-async-storage/async-storage').default;
  const value: string | null = await storage.getItem(STORAGE_KEY);
  return { raw: value ?? '' };
}

describe('supabaseSessionStorage', () => {
  it('menyimpan dan membaca kembali sesi dengan utuh', async () => {
    await supabaseSessionStorage.setItem(STORAGE_KEY, SESSION);

    await expect(supabaseSessionStorage.getItem(STORAGE_KEY)).resolves.toBe(SESSION);
  });

  it('menyimpan ciphertext di AsyncStorage dan kunci AES terpisah di SecureStore', async () => {
    await supabaseSessionStorage.setItem(STORAGE_KEY, SESSION);

    const { raw } = await rawAsyncStorage();
    expect(raw).not.toContain('rahasia');
    expect(raw).toMatch(/^[0-9a-f]+$/);

    const { getItem } = jest.requireMock('../secureStorage');
    const keyHex: string | null = await getItem(`${STORAGE_KEY}.sbkey`);
    expect(keyHex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('menghapus sesi beserta kunci enkripsinya', async () => {
    await supabaseSessionStorage.setItem(STORAGE_KEY, SESSION);
    await supabaseSessionStorage.removeItem(STORAGE_KEY);

    await expect(supabaseSessionStorage.getItem(STORAGE_KEY)).resolves.toBeNull();
    const { getItem } = jest.requireMock('../secureStorage');
    await expect(getItem(`${STORAGE_KEY}.sbkey`)).resolves.toBeNull();
  });

  it('menganggap sesi kedaluwarsa bila ciphertext rusak', async () => {
    await supabaseSessionStorage.setItem(STORAGE_KEY, SESSION);
    const storage = jest.requireMock('@react-native-async-storage/async-storage').default;
    await storage.setItem(STORAGE_KEY, 'deadbeef'.repeat(8));

    await expect(supabaseSessionStorage.getItem(STORAGE_KEY)).resolves.toBeNull();
  });

  it('mengembalikan null saat belum pernah menyimpan sesi', async () => {
    await expect(supabaseSessionStorage.getItem('belum-ada')).resolves.toBeNull();
  });
});
