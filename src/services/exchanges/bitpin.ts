/**
 * Bitpin adapter (priority #2).
 * Public docs: https://api.bitpin.ir/v1/... — private v1.1 uses HMAC signature.
 * Marked "supported" for public data; private trading is experimental.
 */
import jsSHA from 'jssha';
import { Candle, Ticker, BalanceEntry, ExchangeCreds, OrderSide, PrivateAdapter } from '../../types';
import { httpJson } from '../http';

const BASE = 'https://api.bitpin.ir';

interface BitpinMarket {
  id: number;
  code_title: { base: string; quote: string };
  price_info?: { price?: string; change?: string; high?: string; low?: string };
}

let marketsCache: BitpinMarket[] | null = null;

async function getMarkets(): Promise<BitpinMarket[]> {
  if (marketsCache && marketsCache.length) return marketsCache;
  const data = await httpJson<BitpinMarket[]>(`${BASE}/v1/mkt/markets/`);
  marketsCache = Array.isArray(data) ? data : [];
  return marketsCache;
}

async function findMarket(base: string, quote: string): Promise<BitpinMarket> {
  const ms = await getMarkets();
  const b = base.toLowerCase();
  const q = quote === 'TMN' ? 'toman' : quote.toLowerCase();
  const m = ms.find((x) => x.code_title?.base?.toLowerCase() === b && x.code_title?.quote?.toLowerCase() === q);
  if (!m) throw new Error(`bitpin market not found: ${base}/${quote}`);
  return m;
}

export async function fetchTickerBitpin(base: string, quote: string): Promise<Ticker> {
  const m = await findMarket(base, quote);
  const p = m.price_info || {};
  if (p.price === undefined) throw new Error('bitpin price missing');
  return {
    price: Number(p.price),
    change24h: Number(p.change ?? 0),
    high24h: Number((p as { high?: string }).high ?? 0),
    low24h: Number((p as { low?: string }).low ?? 0),
    volume24h: 0,
  };
}

export async function fetchCandlesBitpin(base: string, quote: string, resolutionMin: number, limit: number): Promise<Candle[]> {
  // Build candles from recent trades, bucketed by resolution
  const m = await findMarket(base, quote);
  const data = await httpJson<{ time: number; price: string; amount: string }[]>(
    `${BASE}/v1/mth/trades/${m.id}/?limit=${Math.min(500, limit * Math.max(1, Math.ceil((resolutionMin * 60) / 30)))}`
  );
  if (!Array.isArray(data) || !data.length) throw new Error('bitpin trades empty');
  const bucketMs = resolutionMin * 60 * 1000;
  const map = new Map<number, Candle>();
  for (const tr of data) {
    const t0 = Math.floor(tr.time * 1000 / bucketMs) * bucketMs;
    const price = Number(tr.price);
    const amt = Number(tr.amount);
    const cur = map.get(t0);
    if (!cur) {
      map.set(t0, { t: t0, o: price, h: price, l: price, c: price, v: amt });
    } else {
      cur.h = Math.max(cur.h, price);
      cur.l = Math.min(cur.l, price);
      cur.c = price;
      cur.v += amt;
    }
  }
  return [...map.values()].sort((a, b) => a.t - b.t).slice(-limit);
}

function hmacSha256Hex(key: string, message: string): string {
  const sha = new jsSHA('SHA-256', 'TEXT', { hmacKey: { value: key, format: 'TEXT' } });
  sha.update(message);
  return sha.getHMAC('HEX');
}

/** Bitpin private (v1.1) — experimental, signature scheme per public docs. */
export function createBitpinPrivate(creds: ExchangeCreds): PrivateAdapter {
  const sign = (method: string, path: string, body: string): Record<string, string> => {
    const ts = Date.now().toString();
    const payload = `${creds.apiKey}${ts}${method}${path}${body}`;
    return {
      'X-API-KEY': creds.apiKey,
      'X-TIMESTAMP': ts,
      'X-SIGNATURE': hmacSha256Hex(creds.apiSecret || '', payload),
    };
  };

  async function authed<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const bodyStr = body !== undefined ? JSON.stringify(body) : '';
    const headers = sign(method, path, bodyStr);
    return httpJson<T>(`${BASE}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body } : {}),
    });
  }

  return {
    async getBalances(): Promise<BalanceEntry[]> {
      const data = await authed<{ results?: { coin?: { symbol?: string } ; balance?: string; active_balance?: string }[] } | BalanceEntry[]>(
        'GET',
        '/v1.1/mth/wallets/'
      );
      const rows = Array.isArray(data) ? data : (data as { results?: unknown[] }).results || [];
      return (rows as Record<string, unknown>[]).map((w) => ({
        asset: String((w.coin as { symbol?: string })?.symbol ?? w.asset ?? '').toUpperCase(),
        free: Number(w.active_balance ?? w.free ?? 0),
        locked: Number(w.balance ?? 0) - Number(w.active_balance ?? w.free ?? 0),
      }));
    },

    async placeMarketOrder(side: OrderSide, base: string, quote: string, quoteAmount: number) {
      const m = await findMarket(base, quote);
      const data = await authed<{ id?: number }>('POST', '/v1.1/mth/orders/', {
        market_id: m.id,
        type: side === 'buy' ? 'buy' : 'sell',
        execution: 'market',
        amount_quote: String(quoteAmount),
      });
      return { ok: true, ref: String(data?.id ?? '') };
    },

    async requestCardWithdraw(_amountTMN: number, _cardNumber: string) {
      return { ok: false, message: 'not supported via API', needsManual: true };
    },
  };
}
