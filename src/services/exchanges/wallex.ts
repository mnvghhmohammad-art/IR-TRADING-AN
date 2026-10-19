/**
 * Wallex adapter (experimental public data + API-key private).
 * Docs: https://api.wallex.ir
 */
import { Candle, Ticker, BalanceEntry, ExchangeCreds, OrderSide, PrivateAdapter } from '../../types';
import { httpJson } from '../http';

const BASE = 'https://api.wallex.ir';

export async function fetchTickerWallex(base: string, quote: string): Promise<Ticker> {
  const key = `${base.toUpperCase()}_${quote === 'TMN' ? 'TMN' : quote.toUpperCase()}`;
  const data = await httpJson<{
    result?: { markets?: Record<string, { stats?: { lastPrice?: string; change?: string; highPrice?: string; lowPrice?: string } }> };
  }>(`${BASE}/markets`);
  const st = data.result?.markets?.[key]?.stats;
  if (!st?.lastPrice) throw new Error('wallex market missing');
  return {
    price: Number(st.lastPrice),
    change24h: Number(st.change ?? 0),
    high24h: Number(st.highPrice ?? 0),
    low24h: Number(st.lowPrice ?? 0),
    volume24h: 0,
  };
}

export async function fetchCandlesWallex(base: string, quote: string, resolutionMin: number, limit: number): Promise<Candle[]> {
  const symbol = `${base.toUpperCase()}_${quote === 'TMN' ? 'TMN' : quote.toUpperCase()}`;
  const to = Math.floor(Date.now() / 1000);
  const from = to - resolutionMin * 60 * (limit + 5);
  const data = await httpJson<{
    result?: { t?: number[]; o?: number[]; h?: number[]; l?: number[]; c?: number[]; v?: number[] };
  }>(`${BASE}/candles?symbol=${symbol}&resolution=${resolutionMin}&from=${from}&to=${to}`);
  const r = data.result;
  if (!r?.t?.length) throw new Error('wallex candles empty');
  const out: Candle[] = r.t.map((t, i) => ({
    t: t * 1000,
    o: Number(r.o?.[i] ?? 0),
    h: Number(r.h?.[i] ?? 0),
    l: Number(r.l?.[i] ?? 0),
    c: Number(r.c?.[i] ?? 0),
    v: Number(r.v?.[i] ?? 0),
  }));
  return out.slice(-limit);
}

export function createWallexPrivate(creds: ExchangeCreds): PrivateAdapter {
  return {
    async getBalances(): Promise<BalanceEntry[]> {
      const data = await httpJson<{
        result?: { balances?: Record<string, { asset?: string; value?: { fiatAmount?: string; cryptoAmount?: string } }> };
      }>(`${BASE}/account/balances`, { headers: { 'X-API-KEY': creds.apiKey } });
      const bal = data.result?.balances || {};
      return Object.values(bal)
        .map((b) => ({
          asset: String(b.asset ?? '').toUpperCase(),
          free: Number(b.value?.fiatAmount ?? b.value?.cryptoAmount ?? 0),
        }))
        .filter((b) => !!b.asset);
    },
    async placeMarketOrder(side: OrderSide, base: string, quote: string, quoteAmount: number) {
      const data = await httpJson<{ success?: boolean }>(`${BASE}/account/orders`, {
        method: 'POST',
        headers: { 'X-API-KEY': creds.apiKey },
        body: {
          symbol: `${base.toUpperCase()}_${quote.toUpperCase()}`,
          type: 'MARKET',
          side: side.toUpperCase(),
          quoteQuantity: String(quoteAmount),
        },
      });
      return { ok: !!data?.success };
    },
    async requestCardWithdraw(_amountTMN: number, _cardNumber: string) {
      return { ok: false, message: 'not supported via API', needsManual: true };
    },
  };
}
