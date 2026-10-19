/**
 * Secure storage (expo-secure-store) — API keys, PIN hash, TOTP secret.
 */
import * as SecureStore from 'expo-secure-store';

const PREFIX = 'irtan.sec.';

export async function secureSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(PREFIX + key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    } as never);
  } catch {
    await SecureStore.setItemAsync(PREFIX + key, value);
  }
}

export async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PREFIX + key);
  } catch {
    return null;
  }
}

export async function secureDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PREFIX + key);
  } catch {
    /* ignore */
  }
}

export const SEC_KEYS = {
  pinHash: 'pin.hash',
  totpSecret: 'totp.secret',
  creds: (exchangeId: string) => `creds.${exchangeId}`,
};
