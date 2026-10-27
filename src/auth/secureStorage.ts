/** Wrapper penyimpanan kredensial native (Keychain/Keystore via expo-secure-store). */
import * as SecureStore from 'expo-secure-store';

const DEVICE_ONLY_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function getItem(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, DEVICE_ONLY_OPTIONS);
}

export async function deleteItem(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
