/**
 * Nobitex adapter — primary Iranian exchange (full support).
 * Docs: https://docs.nobitex.ir
 * Note: Nobitex prices for IRT markets are in Rial; the app displays Toman (÷10).
 */
import { Candle, Ticker, BalanceEntry, ExchangeCreds, OrderSide, PrivateAdapter } from '../../types';
import { httpJson } from '../http';

const BASE = 'https://api.nobitex.ir';
export const NOBITEX_QUOTE_SCALE = 0.1; // Rial -> Toman

/** app symbol quote TMN -> nobitex dstCurrency rls; USDT stays usdt. */
function nobitexSymbol(base: string, quote: string): { src: string; dst: string; rial: boolean } {
  const src = base.toLowerCase();
  if (quote === 'TMN') return { src, dst: 'rls', rial: true };
  return { src, dst: quote.toLowerCase(), rial: false };
}

export async function fetchCandlesNobitex(base: string, quote: string, resolutionMin: number, limit: number): Promise<Candle[]> {
  const { src, dst, rial } = nobitexSymbol(base, quote);
  const symbol = `${src}${dst}`.toUpperCase().replace('RLS', 'IRT');
  const to = Math.floor(Date.now() / 1000);
  const from = to - resolutionMin * 60 * (limit + 5);
  const data = await httpJson<{
    s: string;
    t: number[];
    o: string[];
    h: string[];
    l: string[];
    c: string[];
    v: string[];
  }>(`${BASE}/market/udf/history?symbol=${symbol}&resolution=${resolutionMin}&from=${from}&to=${to}`);
  if (!data || data.s !== 'ok' || !Array.isArray(data.t)) throw new Error('nobitex history error');
  const scale = rial ? NOBITEX_QUOTE_SCALE : 1;
  const out: Candle[] = [];
  for (let i = 0; i < data.t.length; i++) {
    out.push({
      t: data.t[i] * 1000,
      o: Number(data.o?.[i] ?? 0) * scale,
      h: Number(data.h?.[i] ?? 0) * scale,
      l: Number(data.l?.[i] ?? 0) * scale,
      c: Number(data.c?.[i] ?? 0) * scale,
      v: Number(data.v?.[i] ?? 0),
    });
  }
  return out.slice(-limit);
}

export async function fetchTickerNobitex(base: string, quote: string): Promise<Ticker> {
  const { src, dst, rial } = nobitexSymbol(base, quote);
  const data = await httpJson<{
    status: string;
    stats: Record<string, { latest: string; dayChange: string; dayHigh: string; dayLow: string; volumeSrc: string }>;
  }>(`${BASE}/market/stats`, { method: 'POST', body: { srcCurrency: src, dstCurrency: dst } });
  const key = `${src}-${dst}`;
  const st = data.stats?.[key];
  if (!st) throw new Error('nobitex stats missing');
  const scale = rial ? NOBITEX_QUOTE_SCALE : 1;
  return {
    price: Number(st.latest) * scale,
    change24h: Number(st.dayChange),
    high24h: Number(st.dayHigh) * scale,
    low24h: Number(st.dayLow) * scale,
    volume24h: Number(st.volumeSrc),
  };
}

function authHeaders(creds: ExchangeCreds, scheme: 'Token' | 'Bearer'): Record<string, string> {
  return { Authorization: `${scheme} ${creds.apiKey.trim()}` };
}

/** Create the private adapter for Nobitex with API key. */
export function createNobitexPrivate(creds: ExchangeCreds): PrivateAdapter {
  async function authed<T>(url: string, opts: Parameters<typeof httpJson>[1] = {}): Promise<T> {
    try {
      return await httpJson<T>(url, { ...opts, headers: { ...opts.headers, ...authHeaders(creds, 'Token') } });
    } catch (e) {
      // fallback: some keys accept Bearer
      const err = e as { status?: number };
      if (err?.status === 401 || err?.status === 403) {
        return await httpJson<T>(url, { ...opts, headers: { ...opts.headers, ...authHeaders(creds, 'Bearer') } });
      }
      throw e;
    }
  }

  return {
    async getBalances(): Promise<BalanceEntry[]> {
      const data = await authed<{ status: string; wallets: { currency: string; balance: string; activeBalance?: string; blockedBalance?: string }[] }>(
        `${BASE}/users/wallets/list`
      );
      const out: BalanceEntry[] = [];
      for (const w of data.wallets || []) {
        let asset = w.currency.toUpperCase();
        let scale = 1;
        if (asset === 'RLS') {
          asset = 'TMN';
          scale = NOBITEX_QUOTE_SCALE;
        }
        out.push({ asset, free: Number(w.activeBalance ?? w.balance) * scale, locked: Number(w.blockedBalance ?? 0) * scale });
      }
      return out;
    },

    async placeMarketOrder(side: OrderSide, base: string, quote: string, quoteAmount: number) {
      const { src, dst, rial } = nobitexSymbol(base, quote);
      const amountQuote = rial ? quoteAmount / NOBITEX_QUOTE_SCALE : quoteAmount;
      const data = await authed<{ status: string; order?: { id?: number } }>(`${BASE}/market/orders/add`, {
        method: 'POST',
        body: {
          type: side,
          srcCurrency: src,
          dstCurrency: dst,
          // Nobitex market order: price omitted + execution=market
          execution: 'market',
          amountQuote: String(amountQuote),
          mode: 'quote',
        },
      });
      if (data?.status === 'ok') return { ok: true as const, ref: String(data.order?.id ?? '') };
      return { ok: false as const, message: 'nobitex order rejected' };
    },

    async requestCardWithdraw(amountTMN: number, _cardNumber: string) {
      try {
        const data = await authed<{ status?: string; message?: string }>(`${BASE}/users/withdraws`, {
          method: 'POST',
          body: { coin: 'rls', amount: amountTMN * 10 },
        });
        if (data?.status === 'ok') return { ok: true, message: 'withdraw submitted' };
        return { ok: false, message: data?.message || 'rejected', needsManual: true };
      } catch {
        // Exchange may require manual OTP confirmation for withdrawals
        return { ok: false, message: 'needs manual confirmation', needsManual: true };
      }
    },
  };
}
