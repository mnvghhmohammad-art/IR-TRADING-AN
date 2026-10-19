/**
 * Typed AsyncStorage persistence helpers.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function saveJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable */
  }
}

export const STORE_KEYS = {
  settings: 'irtan.settings',
  botConfig: 'irtan.bot.config',
  trades: 'irtan.trades',
  ledger: 'irtan.ledger',
  exchanges: 'irtan.exchanges.enabled',
  botStatus: 'irtan.bot.status',
};
