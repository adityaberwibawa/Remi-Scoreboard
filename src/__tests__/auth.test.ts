import {
  BASE_LOCKOUT_MS,
  lockoutMsFor,
  MAX_ATTEMPTS,
  remainingLockoutMs,
  timingSafeEqual,
  validatePin,
} from '../auth/pin';
import { hashPin, verifyPin } from '../auth/cryptoPin';

jest.mock('expo-crypto', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nc = require('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    getRandomBytesAsync: async (n: number) => new Uint8Array(nc.randomBytes(n)),
    digestStringAsync: async (_algo: string, data: string) =>
      nc.createHash('sha256').update(data, 'utf8').digest('hex'),
  };
});

describe('validatePin', () => {
  it('menolak kosong', () => {
    expect(validatePin('   ')).toMatch(/kosong/);
  });
  it('menolak non-angka', () => {
    expect(validatePin('12ab56')).toMatch(/angka/);
  });
  it('menolak panjang salah', () => {
    expect(validatePin('12345')).toMatch(/6 digit/);
    expect(validatePin('1234567')).toMatch(/6 digit/);
  });
  it('menerima 6 digit', () => {
    expect(validatePin('123456')).toBeNull();
  });
});

describe('lockout', () => {
  it('tidak dikunci di bawah ambang', () => {
    expect(lockoutMsFor(MAX_ATTEMPTS - 1)).toBe(0);
  });
  it('dikunci 30 detik tepat di ambang', () => {
    expect(lockoutMsFor(MAX_ATTEMPTS)).toBe(BASE_LOCKOUT_MS);
  });
  it('backoff bertingkat dan dibatasi', () => {
    expect(lockoutMsFor(MAX_ATTEMPTS + 1)).toBe(BASE_LOCKOUT_MS * 2);
    expect(lockoutMsFor(MAX_ATTEMPTS + 99)).toBe(BASE_LOCKOUT_MS * 16);
  });
  it('sisa lockout 0 bila null/kedaluwarsa', () => {
    expect(remainingLockoutMs(null)).toBe(0);
    expect(remainingLockoutMs(Date.now() - 1000)).toBe(0);
    expect(remainingLockoutMs(Date.now() + 5000)).toBeGreaterThan(4000);
  });
});

describe('timingSafeEqual', () => {
  it('benar hanya bila sama persis', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('hashPin', () => {
  it('hash beda salt beda hasil, verify benar/salah tepat', async () => {
    const h1 = await hashPin('123456', 'salt-a');
    const h2 = await hashPin('123456', 'salt-b');
    expect(h1).not.toBe(h2);
    await expect(verifyPin('123456', 'salt-a', h1)).resolves.toBe(true);
    await expect(verifyPin('654321', 'salt-a', h1)).resolves.toBe(false);
  });
});
