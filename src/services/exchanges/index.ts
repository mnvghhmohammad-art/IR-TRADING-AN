/**
 * Exchange registry — the list the user ticks in the Exchanges tab,
 * credentials management (SecureStore) and data aggregation with fallback.
 */
import { Candle, Ticker, ExchangeCreds, PrivateAdapter, BalanceEntry } from '../../types';
import { secureGet, secureSet, secureDelete } from '../../storage/secure';
import { splitSymbol } from '../../utils/format';
import * as Nobitex from './nobitex';
import * as Bitpin from './bitpin';
import * as Wallex from './wallex';
import * as Tabdeal from './tabdeal';
import * as Ramzinex from './ramzinex';
import { httpJson } from '../http';

export interface ExchangeDef {
  id: string;
  name: string;
  faName: string;
  priority: number;
  experimental: boolean;
  hasPrivate: boolean;
  apiKeysUrl?: string;
  color: string;
}

export const EXCHANGES: ExchangeDef[] = [
  { id: 'nobitex', name: 'Nobitex', faName: 'نوبیتکس', priority: 1, experimental: false, hasPrivate: true, apiKeysUrl: 'https://nobitex.ir/panel/settings/api', color: '#F5A623' },
  { id: 'bitpin', name: 'Bitpin', faName: 'بیت‌پین', priority: 2, experimental: false, hasPrivate: true, apiKeysUrl: 'https://bitpin.ir/profile/api-keys', color: '#38BDF8' },
  { id: 'wallex', name: 'Wallex', faName: 'والکس', priority: 3, experimental: true, hasPrivate: true, apiKeysUrl: 'https://wallex.ir/settings/api', color: '#34D399' },
  { id: 'tabdeal', name: 'Tabdeal', faName: 'تبدیل', priority: 4, experimental: true, hasPrivate: true, apiKeysUrl: 'https://tabdeal.org/api', color: '#F472B6' },
  { id: 'ramzinex', name: 'Ramzinex', faName: 'رمزینکس', priority: 5, experimental: true, hasPrivate: false, apiKeysUrl: 'https://ramzinex.com', color: '#A78BFA' },
];

export function getExchange(id: string): ExchangeDef | undefined {
  return EXCHANGES.find((e) => e.id === id);
}

// ---------- credentials (SecureStore) ----------

export async function saveCreds(exchangeId: string, creds: ExchangeCreds): Promise<void> {
  await secureSet(`creds.${exchangeId}`, JSON.stringify(creds));
}

export async function getCreds(exchangeId: string): Promise<ExchangeCreds | null> {
  const raw = await secureGet(`creds.${exchangeId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ExchangeCreds;
    if (!parsed.apiKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function deleteCreds(exchangeId: string): Promise<void> {
  await secureDelete(`creds.${exchangeId}`);
}

export async function testCreds(exchangeId: string, creds: ExchangeCreds): Promise<{ ok: boolean; balances?: BalanceEntry[]; message?: string }> {
  const adapter = createPrivateAdapter(exchangeId, creds);
  if (!adapter) return { ok: false, message: 'no adapter' };
  try {
    const balances = await adapter.getBalances();
    return { ok: true, balances };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'failed' };
  }
}

export function createPrivateAdapter(exchangeId: string, creds: ExchangeCreds): PrivateAdapter | null {
  switch (exchangeId) {
    case 'nobitex':
      return Nobitex.createNobitexPrivate(creds);
    case 'bitpin':
      return Bitpin.createBitpinPrivate(creds);
    case 'wallex':
      return Wallex.createWallexPrivate(creds);
    case 'tabdeal':
      return Tabdeal.createTabdealPrivate(creds);
    default:
      return null;
  }
}

/** Private adapter for an exchange using stored creds (or null if not configured). */
export async function getStoredPrivateAdapter(exchangeId: string): Promise<PrivateAdapter | null> {
  const creds = await getCreds(exchangeId);
  if (!creds) return null;
  return createPrivateAdapter(exchangeId, creds);
}

// ---------- public data with fallback chain ----------

const CANDLE_PRIORITY = ['nobitex', 'bitpin', 'wallex', 'tabdeal', 'ramzinex'];

export async function fetchCandles(symbol: string, resolutionMin: number, limit: number, preferred?: string): Promise<Candle[]> {
  const { base, quote } = splitSymbol(symbol);
  const chain = preferred ? [preferred, ...CANDLE_PRIORITY.filter((x) => x !== preferred)] : CANDLE_PRIORITY;
  let lastErr: unknown = null;
  for (const id of chain) {
    try {
      let candles: Candle[] = [];
      if (id === 'nobitex') candles = await Nobitex.fetchCandlesNobitex(base, quote, resolutionMin, limit);
      else if (id === 'bitpin') candles = await Bitpin.fetchCandlesBitpin(base, quote, resolutionMin, limit);
      else if (id === 'wallex') candles = await Wallex.fetchCandlesWallex(base, quote, resolutionMin, limit);
      else if (id === 'tabdeal') candles = await Tabdeal.fetchCandlesTabdeal(base, quote, resolutionMin, limit);
      else if (id === 'ramzinex') candles = await Ramzinex.fetchCandlesRamzinex(base, quote, resolutionMin, limit);
      if (candles.length >= Math.min(20, limit)) return candles;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('no candle source available');
}

export async function fetchTicker(symbol: string, preferred?: string): Promise<{ ticker: Ticker; exchangeId: string }> {
  const { base, quote } = splitSymbol(symbol);
  const chain = preferred ? [preferred, ...CANDLE_PRIORITY.filter((x) => x !== preferred)] : CANDLE_PRIORITY;
  for (const id of chain) {
    try {
      let ticker: Ticker | null = null;
      if (id === 'nobitex') ticker = await Nobitex.fetchTickerNobitex(base, quote);
      else if (id === 'bitpin') ticker = await Bitpin.fetchTickerBitpin(base, quote);
      else if (id === 'wallex') ticker = await Wallex.fetchTickerWallex(base, quote);
      else if (id === 'tabdeal') ticker = await Tabdeal.fetchTickerTabdeal(base, quote);
      else if (id === 'ramzinex') ticker = await Ramzinex.fetchTickerRamzinex(base, quote);
      if (ticker && isFinite(ticker.price) && ticker.price > 0) return { ticker, exchangeId: id };
    } catch {
      /* try next */
    }
  }
  throw new Error(`no ticker for ${symbol}`);
}

/** Quick connectivity probe used by "Test connection" for public data. */
export async function pingPublic(): Promise<boolean> {
  try {
    await httpJson('https://api.nobitex.ir/market/stats', { method: 'POST', body: { srcCurrency: 'btc', dstCurrency: 'rls' }, timeoutMs: 8000 });
    return true;
  } catch {
    return false;
  }
}
