/**
 * Penyimpanan sesi Supabase Auth — pola resmi Supabase untuk Expo ("LargeSecureStore"):
 * kunci AES-256 disimpan di Keychain/Keystore (expo-secure-store) dan payload sesi
 * dienkripsi AES-256-CTR sebelum masuk ke AsyncStorage.
 *
 * Alasan: expo-secure-store dibatasi 2048 byte per nilai, sedangkan sesi Supabase
 * (access + refresh token) bisa melebihi batas itu. AsyncStorage hanya menyimpan
 * ciphertext; kunci enkripsi tidak pernah meninggalkan SecureStore.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import { getRandomValues } from 'expo-crypto';
import { deleteItem, getItem, setItem } from './secureStorage';

/** Suffix key kunci AES di SecureStore, per kunci penyimpanan sesi. */
const KEY_SUFFIX = '.sbkey';

interface EncryptedValue {
  keyHex: string;
  cipherHex: string;
}

function encrypt(value: string): EncryptedValue {
  const key = getRandomValues(new Uint8Array(32));
  const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1));
  const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  return {
    keyHex: aesjs.utils.hex.fromBytes(key),
    cipherHex: aesjs.utils.hex.fromBytes(encrypted),
  };
}

/** null bila kunci tidak cocok / ciphertext rusak (dianggap sesi kedaluwarsa). */
function decrypt(keyHex: string, cipherHex: string): string | null {
  try {
    const key = aesjs.utils.hex.toBytes(keyHex);
    const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1));
    const plain = aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(cipherHex)));
    // Sesi Supabase selalu JSON; nilai acak berarti kunci/ciphertext tidak cocok.
    return plain.startsWith('{') ? plain : null;
  } catch {
    return null;
  }
}

async function getItemSafe(key: string): Promise<string | null> {
  try {
    const packed = await AsyncStorage.getItem(key);
    if (!packed) return null;

    const keyHex = await getItem(`${key}${KEY_SUFFIX}`);
    if (!keyHex) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    const plain = decrypt(keyHex, packed);
    if (plain === null) {
      await removeItemSafe(key);
      return null;
    }
    return plain;
  } catch {
    return null;
  }
}

async function setItemSafe(key: string, value: string): Promise<void> {
  const { keyHex, cipherHex } = encrypt(value);
  await setItem(`${key}${KEY_SUFFIX}`, keyHex);
  await AsyncStorage.setItem(key, cipherHex);
}

async function removeItemSafe(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Penyimpanan bersifat opsional; kegagalan hapus tidak boleh menggagalkan alur.
  }
  try {
    await deleteItem(`${key}${KEY_SUFFIX}`);
  } catch {
    // abaikan
  }
}

/** Adapter `storage` untuk supabase-js (auth.storage). */
export const supabaseSessionStorage = {
  getItem: getItemSafe,
  setItem: setItemSafe,
  removeItem: removeItemSafe,
};
