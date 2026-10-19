/**
 * Signal engine — combines indicators + candlestick patterns into a score.
 * Designed to be portable (also mirrored in bot-server/strategy.js).
 */
import { Candle, RiskProfile, Signal } from '../../types';
import {
  ema,
  rsi,
  macd,
  bollinger,
  volumeAvg,
  swings,
  bullishEngulfing,
  bearishEngulfing,
  hammer,
  doji,
} from './indicators';

export interface Analysis {
  signal: Signal;
  price: number;
  ema9: number;
  ema21: number;
  rsi14: number;
  macdHist: number;
  support: number;
  resistance: number;
}

export function analyzeCandles(candles: Candle[], profile: RiskProfile = 'balanced'): Analysis | null {
  if (!candles || candles.length < 40) return null;
  const closes = candles.map((c) => c.c);
  const price = closes[closes.length - 1];

  const e9 = ema(closes, 9);
  const e21 = ema(closes, 21);
  const r = rsi(closes, 14);
  const m = macd(closes);
  const bb = bollinger(closes, 20, 2);
  const i = closes.length - 1;

  const ema9 = e9[i];
  const ema21 = e21[i];
  const rsi14 = r[i];
  const macdHist = m.hist[i];
  const macdHistPrev = m.hist[i - 1];
  const bbLower = bb.lower[i];
  const bbUpper = bb.upper[i];
  const vAvg = volumeAvg(candles, 20);
  const lastVol = candles[i].v;
  const volOk = vAvg > 0 && lastVol > vAvg * 1.15;
  const { high: resistance, low: support } = swings(candles, 40);

  let score = 0;
  const reasons: string[] = [];

  // --- trend ---
  const trendUp = ema9 > ema21;
  if (trendUp) {
    score += 18;
    reasons.push('EMA9>EMA21');
  } else {
    score -= 18;
    reasons.push('EMA9<EMA21');
  }

  // --- momentum ---
  if (macdHist > 0 && macdHist > macdHistPrev) {
    score += 15;
    reasons.push('MACD↑');
  } else if (macdHist < 0 && macdHist < macdHistPrev) {
    score -= 15;
    reasons.push('MACD↓');
  }

  // --- RSI zones ---
  const thresholds =
    profile === 'aggressive' ? { os: 40, ob: 63 } : profile === 'conservative' ? { os: 30, ob: 72 } : { os: 35, ob: 68 };
  if (rsi14 < thresholds.os) {
    score += 20;
    reasons.push(`RSI ${Math.round(rsi14)} oversold`);
  } else if (rsi14 > thresholds.ob) {
    score -= 20;
    reasons.push(`RSI ${Math.round(rsi14)} overbought`);
  }

  // --- Bollinger bounce ---
  if (isFinite(bbLower) && price <= bbLower * 1.005) {
    score += 12;
    reasons.push('BB lower bounce');
  } else if (isFinite(bbUpper) && price >= bbUpper * 0.995) {
    score -= 12;
    reasons.push('BB upper reject');
  }

  // --- support / resistance ---
  const range = Math.max(resistance - support, 1e-9);
  if (price <= support + range * 0.08) {
    score += 12;
    reasons.push('near support');
  } else if (price >= resistance - range * 0.08) {
    score -= 12;
    reasons.push('near resistance');
  }

  // --- patterns ---
  if (bullishEngulfing(candles)) {
    score += 14;
    reasons.push('bullish engulfing');
  }
  if (bearishEngulfing(candles)) {
    score -= 14;
    reasons.push('bearish engulfing');
  }
  if (hammer(candles)) {
    score += 8;
    reasons.push('hammer');
  }
  if (doji(candles)) {
    reasons.push('doji (wait)');
    score *= 0.9;
  }

  // --- volume confirmation ---
  if (volOk) {
    reasons.push('volume ✓');
    score *= 1.1;
  }

  // conservative requires trend agreement
  if (profile === 'conservative' && !trendUp) score = Math.min(score, 30);

  const entryThreshold = profile === 'aggressive' ? 48 : profile === 'conservative' ? 66 : 58;
  const exitThreshold = profile === 'aggressive' ? -46 : profile === 'conservative' ? -60 : -52;

  let action: 'buy' | 'sell' | 'hold' = 'hold';
  if (score >= entryThreshold) action = 'buy';
  else if (score <= exitThreshold) action = 'sell';

  const confidence = Math.min(100, Math.round(Math.abs(score) * 1.15));
  return {
    signal: { action, confidence, reasons },
    price,
    ema9,
    ema21,
    rsi14,
    macdHist,
    support,
    resistance,
  };
}
