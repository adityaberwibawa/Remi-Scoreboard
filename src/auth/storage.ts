/** Penyimpanan kredensial auth (native: SecureStore, web: localStorage fallback). */
import { deleteItem, getItem, setItem } from './secureStorage';

const KEY_HASH = 'pentung.auth.pinHash';
const KEY_SALT = 'pentung.auth.pinSalt';
const KEY_BIO = 'pentung.auth.bioEnabled';
const KEY_FAILED = 'pentung.auth.failed';
const KEY_LOCK_UNTIL = 'pentung.auth.lockUntil';

export async function hasPinSetup(): Promise<boolean> {
  const [hash, salt] = await Promise.all([getItem(KEY_HASH), getItem(KEY_SALT)]);
  return Boolean(hash && salt);
}

export async function loadPinCredentials(): Promise<{ hash: string; salt: string } | null> {
  const [hash, salt] = await Promise.all([getItem(KEY_HASH), getItem(KEY_SALT)]);
  if (!hash || !salt) return null;
  return { hash, salt };
}

export async function savePinCredentials(hash: string, salt: string): Promise<void> {
  await Promise.all([setItem(KEY_HASH, hash), setItem(KEY_SALT, salt)]);
}

export async function clearAuthStorage(): Promise<void> {
  await Promise.all(
    [KEY_HASH, KEY_SALT, KEY_BIO, KEY_FAILED, KEY_LOCK_UNTIL].map((k) =>
      deleteItem(k).catch(() => undefined),
    ),
  );
}

export async function isBiometricEnabled(): Promise<boolean> {
  return (await getItem(KEY_BIO)) === '1';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await setItem(KEY_BIO, '1');
  } else {
    await deleteItem(KEY_BIO).catch(() => undefined);
  }
}

export async function loadThrottle(): Promise<{ failed: number; lockUntil: number | null }> {
  const [f, l] = await Promise.all([getItem(KEY_FAILED), getItem(KEY_LOCK_UNTIL)]);
  return { failed: Number.parseInt(f ?? '0', 10) || 0, lockUntil: l ? Number(l) || null : null };
}

export async function saveThrottle(failed: number, lockUntil: number | null): Promise<void> {
  await Promise.all([
    setItem(KEY_FAILED, String(failed)),
    lockUntil
      ? setItem(KEY_LOCK_UNTIL, String(lockUntil))
      : deleteItem(KEY_LOCK_UNTIL).catch(() => undefined),
  ]);
}
