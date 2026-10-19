/**
 * Tabdeal adapter (experimental).
 * Docs: https://api.tabdeal.org — scheme may change; failures degrade gracefully.
 */
import { Candle, Ticker, BalanceEntry, ExchangeCreds, OrderSide, PrivateAdapter } from '../../types';
import { httpJson } from '../http';

const BASE = 'https://api.tabdeal.org';

export async function fetchTickerTabdeal(base: string, quote: string): Promise<Ticker> {
  const symbol = `${base.toUpperCase()}${quote === 'TMN' ? 'TMN' : quote.toUpperCase()}`;
  const data = await httpJson<{ last?: string; percentChange?: string; high?: string; low?: string }>(
    `${BASE}/api/v1/ticker/24hr?symbol=${symbol}`
  );
  if (!data?.last) throw new Error('tabdeeel ticker missing');
  return {
    price: Number(data.last),
    change24h: Number(data.percentChange ?? 0),
    high24h: Number(data.high ?? 0),
    low24h: Number(data.low ?? 0),
    volume24h: 0,
  };
}

export async function fetchCandlesTabdeal(base: string, quote: string, resolutionMin: number, limit: number): Promise<Candle[]> {
  const symbol = `${base.toUpperCase()}${quote === 'TMN' ? 'TMN' : quote.toUpperCase()}`;
  const interval = resolutionMin < 15 ? '15m' : resolutionMin < 60 ? '1h' : resolutionMin < 240 ? '4h' : '1d';
  const data = await httpJson<unknown[][]>(
    `${BASE}/api/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  );
  if (!Array.isArray(data) || !data.length) throw new Error('tabdeal candles empty');
  return data.map((row) => ({
    t: Number(row[0]),
    o: Number(row[1]),
    h: Number(row[2]),
    l: Number(row[3]),
    c: Number(row[4]),
    v: Number(row[5]),
  }));
}

export function createTabdealPrivate(creds: ExchangeCreds): PrivateAdapter {
  return {
    async getBalances(): Promise<BalanceEntry[]> {
      const data = await httpJson<{ balances?: Record<string, { free?: string; locked?: string }> }>(
        `${BASE}/api/v1/account`,
        { headers: { Authorization: creds.apiKey } }
      );
      return Object.entries(data.balances || {}).map(([asset, v]) => ({
        asset: asset.toUpperCase(),
        free: Number(v.free ?? 0),
        locked: Number(v.locked ?? 0),
      }));
    },
    async placeMarketOrder(side: OrderSide, base: string, quote: string, quoteAmount: number) {
      await httpJson(`${BASE}/api/v1/orders`, {
        method: 'POST',
        headers: { Authorization: creds.apiKey },
        body: { symbol: `${base.toUpperCase()}${quote.toUpperCase()}`, side, type: 'MARKET', quoteOrderQty: String(quoteAmount) },
      });
      return { ok: true };
    },
    async requestCardWithdraw(_amountTMN: number, _cardNumber: string) {
      return { ok: false, message: 'not supported via API', needsManual: true };
    },
  };
}
