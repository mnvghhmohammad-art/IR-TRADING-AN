/**
 * Technical indicators — pure functions over OHLCV arrays.
 */
import { Candle } from '../../types';

export function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : NaN);
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out: number[] = [];
  const k = 2 / (period + 1);
  let prev = NaN;
  for (let i = 0; i < values.length; i++) {
    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += values[j];
      prev = sum / period;
    } else if (i >= period) {
      prev = values[i] * k + prev * (1 - k);
    }
    out.push(i >= period - 1 ? prev : NaN);
  }
  return out;
}

export function rsi(closes: number[], period = 14): number[] {
  const out: number[] = new Array(closes.length).fill(NaN);
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = Math.max(diff, 0);
    const loss = Math.max(-diff, 0);
    if (i <= period) {
      avgGain += gain / period;
      avgLoss += loss / period;
      if (i === period) {
        out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
  }
  return out;
}

export interface MacdResult {
  macd: number[];
  signal: number[];
  hist: number[];
}

export function macd(closes: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = closes.map((_, i) => emaFast[i] - emaSlow[i]);
  const valid = macdLine.map((v) => (isFinite(v) ? v : 0));
  const sig = ema(valid, signalPeriod);
  const hist = macdLine.map((v, i) => v - sig[i]);
  return { macd: macdLine, signal: sig, hist };
}

export function bollinger(closes: number[], period = 20, mult = 2): { upper: number[]; mid: number[]; lower: number[] } {
  const mid = sma(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1 || !isFinite(mid[i])) {
      upper.push(NaN);
      lower.push(NaN);
      continue;
    }
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (closes[j] - mid[i]) ** 2;
    const sd = Math.sqrt(variance / period);
    upper.push(mid[i] + mult * sd);
    lower.push(mid[i] - mult * sd);
  }
  return { upper, mid, lower };
}

export function atr(candles: Candle[], period = 14): number[] {
  const tr: number[] = candles.map((c, i) => {
    if (i === 0) return c.h - c.l;
    const prevClose = candles[i - 1].c;
    return Math.max(c.h - c.l, Math.abs(c.h - prevClose), Math.abs(c.l - prevClose));
  });
  return ema(tr, period);
}

export function volumeAvg(candles: Candle[], period = 20): number {
  const recent = candles.slice(-period);
  if (!recent.length) return 0;
  return recent.reduce((s, c) => s + c.v, 0) / recent.length;
}

/** Last swing high / low over lookback window. */
export function swings(candles: Candle[], lookback = 30): { high: number; low: number } {
  const seg = candles.slice(-lookback);
  if (!seg.length) return { high: NaN, low: NaN };
  return {
    high: Math.max(...seg.map((c) => c.h)),
    low: Math.min(...seg.map((c) => c.l)),
  };
}

// ---------- candlestick patterns ----------

export function bullishEngulfing(candles: Candle[]): boolean {
  if (candles.length < 2) return false;
  const a = candles[candles.length - 2];
  const b = candles[candles.length - 1];
  return a.c < a.o && b.c > b.o && b.c >= a.o && b.o <= a.c;
}

export function bearishEngulfing(candles: Candle[]): boolean {
  if (candles.length < 2) return false;
  const a = candles[candles.length - 2];
  const b = candles[candles.length - 1];
  return a.c > a.o && b.c < b.o && b.c <= a.o && b.o >= a.c;
}

export function hammer(candles: Candle[]): boolean {
  if (candles.length < 1) return false;
  const c = candles[candles.length - 1];
  const body = Math.abs(c.c - c.o);
  const wick = c.h - c.l;
  const lowerWick = Math.min(c.o, c.c) - c.l;
  return wick > body * 2 && lowerWick >= body * 1.5 && body > 0;
}

export function doji(candles: Candle[]): boolean {
  if (candles.length < 1) return false;
  const c = candles[candles.length - 1];
  const body = Math.abs(c.c - c.o);
  const wick = c.h - c.l;
  return wick > 0 && body <= wick * 0.1;
}
