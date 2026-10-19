/**
 * IR.TRADIng.AN — signal engine (server mirror of src/services/bot/*)
 * Pure JS port: EMA, RSI, MACD, Bollinger + candlestick patterns.
 */
function ema(values, period) {
  const out = [];
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

function rsi(closes, period = 14) {
  const out = new Array(closes.length).fill(NaN);
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = Math.max(diff, 0);
    const loss = Math.max(-diff, 0);
    if (i <= period) {
      avgGain += gain / period;
      avgLoss += loss / period;
      if (i === period) out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
  }
  return out;
}

function macd(closes, fast = 12, slow = 26, sig = 9) {
  const ef = ema(closes, fast);
  const es = ema(closes, slow);
  const line = closes.map((_, i) => ef[i] - es[i]);
  const valid = line.map((v) => (isFinite(v) ? v : 0));
  const signal = ema(valid, sig);
  const hist = line.map((v, i) => v - signal[i]);
  return { line, signal, hist };
}

function bollinger(closes, period = 20, mult = 2) {
  const mid = [];
  const upper = [];
  const lower = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      mid.push(NaN);
      upper.push(NaN);
      lower.push(NaN);
      continue;
    }
    const seg = closes.slice(i - period + 1, i + 1);
    const m = seg.reduce((s, v) => s + v, 0) / period;
    const sd = Math.sqrt(seg.reduce((s, v) => s + (v - m) ** 2, 0) / period);
    mid.push(m);
    upper.push(m + mult * sd);
    lower.push(m - mult * sd);
  }
  return { mid, upper, lower };
}

function volumeAvg(candles, period = 20) {
  const seg = candles.slice(-period);
  if (!seg.length) return 0;
  return seg.reduce((s, c) => s + c.v, 0) / seg.length;
}

function swings(candles, lookback = 40) {
  const seg = candles.slice(-lookback);
  if (!seg.length) return { high: NaN, low: NaN };
  return { high: Math.max(...seg.map((c) => c.h)), low: Math.min(...seg.map((c) => c.l)) };
}

function bullishEngulfing(candles) {
  if (candles.length < 2) return false;
  const a = candles[candles.length - 2];
  const b = candles[candles.length - 1];
  return a.c < a.o && b.c > b.o && b.c >= a.o && b.o <= a.c;
}

function bearishEngulfing(candles) {
  if (candles.length < 2) return false;
  const a = candles[candles.length - 2];
  const b = candles[candles.length - 1];
  return a.c > a.o && b.c < b.o && b.c <= a.o && b.o >= a.c;
}

function hammer(candles) {
  if (!candles.length) return false;
  const c = candles[candles.length - 1];
  const body = Math.abs(c.c - c.o);
  const wick = c.h - c.l;
  const lowerWick = Math.min(c.o, c.c) - c.l;
  return wick > body * 2 && lowerWick >= body * 1.5 && body > 0;
}

function doji(candles) {
  if (!candles.length) return false;
  const c = candles[candles.length - 1];
  const body = Math.abs(c.c - c.o);
  const wick = c.h - c.l;
  return wick > 0 && body <= wick * 0.1;
}

function analyzeCandles(candles, profile = 'balanced') {
  if (!candles || candles.length < 40) return null;
  const closes = candles.map((c) => c.c);
  const price = closes[closes.length - 1];
  const i = closes.length - 1;

  const e9 = ema(closes, 9);
  const e21 = ema(closes, 21);
  const r = rsi(closes, 14);
  const m = macd(closes);
  const bb = bollinger(closes, 20, 2);

  const ema9 = e9[i];
  const ema21 = e21[i];
  const rsi14 = r[i];
  const macdHist = m.hist[i];
  const macdHistPrev = m.hist[i - 1];
  const { high: resistance, low: support } = swings(candles);
  const vAvg = volumeAvg(candles);
  const volOk = vAvg > 0 && candles[i].v > vAvg * 1.15;

  let score = 0;
  const reasons = [];
  const trendUp = ema9 > ema21;
  if (trendUp) {
    score += 18;
    reasons.push('EMA9>EMA21');
  } else {
    score -= 18;
    reasons.push('EMA9<EMA21');
  }
  if (macdHist > 0 && macdHist > macdHistPrev) {
    score += 15;
    reasons.push('MACD up');
  } else if (macdHist < 0 && macdHist < macdHistPrev) {
    score -= 15;
    reasons.push('MACD down');
  }

  const th = profile === 'aggressive' ? { os: 40, ob: 63 } : profile === 'conservative' ? { os: 30, ob: 72 } : { os: 35, ob: 68 };
  if (rsi14 < th.os) {
    score += 20;
    reasons.push(`RSI ${Math.round(rsi14)} oversold`);
  } else if (rsi14 > th.ob) {
    score -= 20;
    reasons.push(`RSI ${Math.round(rsi14)} overbought`);
  }
  if (isFinite(bb.lower[i]) && price <= bb.lower[i] * 1.005) {
    score += 12;
    reasons.push('BB lower bounce');
  } else if (isFinite(bb.upper[i]) && price >= bb.upper[i] * 0.995) {
    score -= 12;
    reasons.push('BB upper reject');
  }
  const range = Math.max(resistance - support, 1e-9);
  if (price <= support + range * 0.08) {
    score += 12;
    reasons.push('near support');
  } else if (price >= resistance - range * 0.08) {
    score -= 12;
    reasons.push('near resistance');
  }
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
    reasons.push('doji');
    score *= 0.9;
  }
  if (volOk) {
    reasons.push('volume ok');
    score *= 1.1;
  }
  if (profile === 'conservative' && !trendUp) score = Math.min(score, 30);

  const entryTh = profile === 'aggressive' ? 48 : profile === 'conservative' ? 66 : 58;
  const exitTh = profile === 'aggressive' ? -46 : profile === 'conservative' ? -60 : -52;

  let action = 'hold';
  if (score >= entryTh) action = 'buy';
  else if (score <= exitTh) action = 'sell';

  return {
    signal: { action, confidence: Math.min(100, Math.round(Math.abs(score) * 1.15)), reasons },
    price,
  };
}

module.exports = { analyzeCandles, ema, rsi, macd, bollinger };
