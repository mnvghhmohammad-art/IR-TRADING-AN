/**
 * Ramzinex adapter (experimental, public data only).
 * Docs: https://api.ramzinex.com/exchange/api/v1
 */
import { Candle, Ticker } from '../../types';
import { httpJson } from '../http';

const BASE = 'https://api.ramzinex.com/exchange/api/v1';

export async function fetchTickerRamzinex(base: string, quote: string): Promise<Ticker> {
  const data = await httpJson<{
    data?: { pairs?: Record<string, { base_symbol?: string; quote_symbol?: string; last?: number; change24h?: number; high24h?: number; low24h?: number }> };
  }>(`${BASE}/exchange/pairs`);
  const pairs = data.data?.pairs || {};
  const b = base.toLowerCase();
  const q = quote === 'TMN' ? 'tmn' : quote.toLowerCase();
  const p = Object.values(pairs).find((x) => x.base_symbol?.toLowerCase() === b && x.quote_symbol?.toLowerCase() === q);
  if (!p?.last) throw new Error('ramzinex pair missing');
  return {
    price: p.last,
    change24h: Number(p.change24h ?? 0),
    high24h: Number(p.high24h ?? 0),
    low24h: Number(p.low24h ?? 0),
    volume24h: 0,
  };
}

export async function fetchCandlesRamzinex(base: string, quote: string, resolutionMin: number, limit: number): Promise<Candle[]> {
  // Ramzinex exposes candlesticks per pair id; resolve id first
  const data = await httpJson<{
    data?: { pairs?: Record<string, { id?: number; base_symbol?: string; quote_symbol?: string }> };
  }>(`${BASE}/exchange/pairs`);
  const pairs = data.data?.pairs || {};
  const b = base.toLowerCase();
  const q = quote === 'TMN' ? 'tmn' : quote.toLowerCase();
  const p = Object.values(pairs).find((x) => x.base_symbol?.toLowerCase() === b && x.quote_symbol?.toLowerCase() === q);
  if (!p?.id) throw new Error('ramzinex pair missing');
  const cd = await httpJson<{ data?: { candlesticks?: [number, number, number, number, number, number][] } }>(
    `${BASE}/exchange/pairs/${p.id}/candlesticks?resolution=${resolutionMin * 60}&limit=${limit}`
  );
  const rows = cd.data?.candlesticks || [];
  if (!rows.length) throw new Error('ramzinex candles empty');
  return rows.map((r) => ({
    t: r[0] * 1000,
    o: r[1],
    h: r[2],
    l: r[3],
    c: r[4],
    v: r[5],
  }));
}
