/**
 * TASK 01.3 / TASK 02.1 / TASK 03.1 — Secure storage untuk token.
 *
 * Kenapa expo-secure-store (bukan AsyncStorage)?
 * - iOS: disimpan di Keychain, Android: di EncryptedSharedPreferences/Keystore.
 * - Tidak terbaca plaintext oleh app lain / backup biasa.
 * - Mendukung opsi WHEN_UNLOCKED_THIS_DEVICE_ONLY (tidak ikut iCloud backup).
 */
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'presidentku.access_token';

const OPTS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** TASK 02.1 — baca token untuk ditempel ke header Authorization. */
export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** TASK 01.3 — simpan access_token tepat setelah login sukses. */
export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token, OPTS);
}

/** TASK 03.1 — hapus token saat logout / saat server menjawab 401. */
export async function removeToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Token memang sudah tidak ada — anggap logout sukses.
  }
}
