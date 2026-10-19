/**
 * IR.TRADIng.AN — Server bot (Node.js 18+, zero dependencies)
 * 24/7 trading on Nobitex via the same signal logic as the mobile app.
 *
 * Usage:
 *   cp config.example.json config.json   (fill your API key)
 *   node index.js
 *
 * Optional Telegram alerts: set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { analyzeCandles } = require('./strategy');

const STATE_FILE = path.join(__dirname, 'state', 'trades.json');
const BASE = 'https://api.nobitex.ir';

// ---------- config ----------
let config = {
  apiKey: '',
  mode: 'paper', // 'paper' | 'real'
  pairs: ['BTC/TMN', 'ETH/TMN', 'USDT/TMN'],
  riskProfile: 'balanced',
  stopLossPct: 2,
  takeProfitPct: 4,
  maxOpenPositions: 3,
  tradeAmountPct: 20,
  tickIntervalSec: 30,
  profitSharePct: 40,
  minProfitToWithdraw: 500000,
  dailyLossLimitPct: 8,
};

try {
  const user = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  config = { ...config, ...user };
} catch {
  /* use defaults */
}

// ---------- helpers ----------
function httpJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = opts.body !== undefined ? JSON.stringify(opts.body) : null;
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: opts.method || (body ? 'POST' : 'GET'),
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
          ...(opts.headers || {}),
        },
        timeout: 15000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : null;
            if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
            else resolve(parsed);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    if (body) req.write(body);
    req.end();
  });
}

async function notify(text) {
  console.log(`[${new Date().toISOString()}] ${text}`);
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    try {
      await httpJson(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        body: { chat_id: process.env.TELEGRAM_CHAT_ID, text },
      });
    } catch (e) {
      console.error('telegram error:', e.message);
    }
  }
}

// ---------- market data (public) ----------
function nobitexSymbol(pair) {
  const [base, quote] = pair.split('/');
  if (quote === 'TMN') return `${base.toUpperCase()}IRT`;
  return `${base.toUpperCase()}${quote.toUpperCase()}`;
}

async function fetchCandles(pair, resolutionMin = 15, limit = 120) {
  const symbol = nobitexSymbol(pair);
  const to = Math.floor(Date.now() / 1000);
  const from = to - resolutionMin * 60 * (limit + 5);
  const d = await httpJson(`${BASE}/market/udf/history?symbol=${symbol}&resolution=${resolutionMin}&from=${from}&to=${to}`);
  if (!d || d.s !== 'ok') throw new Error('history error');
  const scale = symbol.endsWith('IRT') ? 0.1 : 1; // Rial -> Toman
  return d.t.map((t, i) => ({
    t: t * 1000,
    o: Number(d.o[i]) * scale,
    h: Number(d.h[i]) * scale,
    l: Number(d.l[i]) * scale,
    c: Number(d.c[i]) * scale,
    v: Number(d.v[i] || 0),
  }));
}

// ---------- private (Nobitex, Token auth) ----------
function authHeaders() {
  return { Authorization: `Token ${config.apiKey}` };
}

async function placeOrder(side, pair, quoteAmount) {
  if (config.mode !== 'real') return { ok: true, ref: 'paper' };
  const [base, quote] = pair.split('/');
  const dst = quote === 'TMN' ? 'rls' : quote.toLowerCase();
  const body = {
    type: side,
    srcCurrency: base.toLowerCase(),
    dstCurrency: dst,
    execution: 'market',
    amountQuote: String(quote === 'TMN' ? quoteAmount * 10 : quoteAmount),
    mode: 'quote',
  };
  const res = await httpJson(`${BASE}/market/orders/add`, { method: 'POST', headers: authHeaders(), body });
  if (res.status === 'ok') return { ok: true, ref: String(res.order && res.order.id) };
  return { ok: false, message: JSON.stringify(res).slice(0, 200) };
}

async function requestWithdraw(amountTMN) {
  try {
    const res = await httpJson(`${BASE}/users/withdraws`, {
      method: 'POST',
      headers: authHeaders(),
      body: { coin: 'rls', amount: amountTMN * 10 },
    });
    return res.status === 'ok';
  } catch {
    return false;
  }
}

// ---------- state ----------
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { trades: [], ledger: [] };
  }
}
function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
let state = loadState();

function pnl24() {
  const day = Date.now() - 86400000;
  return state.trades.filter((t) => t.status === 'closed' && (t.closedAt || 0) >= day).reduce((s, t) => s + (t.pnl || 0), 0);
}

async function profitShare(amountTMN) {
  const entry = { id: Date.now(), type: 'profit_share', amount: amountTMN, ts: Date.now(), status: 'pending' };
  state.ledger.push(entry);
  saveState(state);
  const ok = config.mode === 'real' ? await requestWithdraw(amountTMN) : true;
  entry.status = ok ? 'done' : 'pending';
  saveState(state);
  await notify(`🏦 Profit payout ${ok ? 'submitted' : 'needs manual confirmation'}: ${amountTMN.toLocaleString()} Toman`);
}

// ---------- engine ----------
let ticking = false;
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    // manage open positions
    for (const pos of state.trades.filter((t) => t.status === 'open')) {
      const candles = await fetchCandles(pos.symbol).catch(() => null);
      if (!candles) continue;
      const price = candles[candles.length - 1].c;
      const hitSL = price <= (pos.stopLoss || 0);
      const hitTP = price >= (pos.takeProfit || Infinity);
      const analysis = analyzeCandles(candles, config.riskProfile);
      const sellSignal = analysis && analysis.signal.action === 'sell';
      if (!hitSL && !hitTP && !sellSignal) continue;

      const exitPrice = hitTP ? Math.max(price, pos.takeProfit) : hitSL ? Math.min(price, pos.stopLoss) : price;
      const sell = await placeOrder('sell', pos.symbol, exitPrice * pos.amount);
      if (!sell.ok) {
        console.error('sell failed:', sell.message);
        continue;
      }
      pos.status = 'closed';
      pos.closedAt = Date.now();
      pos.exitPrice = exitPrice;
      pos.pnl = (exitPrice - pos.entryPrice) * pos.amount;
      pos.pnlPct = ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100;
      saveState(state);
      await notify(`💰 CLOSED ${pos.symbol} ${pos.pnlPct >= 0 ? '+' : ''}${pos.pnlPct.toFixed(2)}% (${pos.pnl.toFixed(0)} T)`);

      if (pos.pnl > 0 && config.profitSharePct > 0) {
        const share = Math.floor((pos.pnl * config.profitSharePct) / 100);
        if (share >= config.minProfitToWithdraw) await profitShare(share);
      }
    }

    // look for entries
    const openCount = state.trades.filter((t) => t.status === 'open').length;
    if (openCount < config.maxOpenPositions) {
      for (const pair of config.pairs) {
        if (state.trades.some((t) => t.status === 'open' && t.symbol === pair)) continue;
        if (openCount >= config.maxOpenPositions) break;
        const candles = await fetchCandles(pair).catch(() => null);
        if (!candles) continue;
        const analysis = analyzeCandles(candles, config.riskProfile);
        if (!analysis || analysis.signal.action !== 'buy') continue;

        const price = analysis.price;
        const notional = Math.max(50000, Math.floor(1000000 * (config.tradeAmountPct / 100)));
        const buy = await placeOrder('buy', pair, notional);
        if (!buy.ok) {
          console.error('buy failed:', buy.message);
          continue;
        }
        const trade = {
          id: Date.now(),
          symbol: pair,
          side: 'buy',
          amount: notional / price,
          entryPrice: price,
          openedAt: Date.now(),
          status: 'open',
          mode: config.mode,
          reason: analysis.signal.reasons.join(' | '),
          stopLoss: price * (1 - config.stopLossPct / 100),
          takeProfit: price * (1 + config.takeProfitPct / 100),
        };
        state.trades.push(trade);
        saveState(state);
        await notify(`🚀 OPENED ${pair} @ ${price.toFixed(0)} Toman\nReason: ${trade.reason}`);
      }
    }
  } catch (e) {
    console.error('tick error:', e.message);
  } finally {
    ticking = false;
  }
}

async function main() {
  if (!config.apiKey && config.mode === 'real') {
    console.error('⚠️  Set your Nobitex API key in config.json before real mode.');
    process.exit(1);
  }
  await notify(`🤖 IR.TRADIng.AN server bot started (${config.mode} mode, pairs: ${config.pairs.join(', ')})`);
  setInterval(() => void tick(), Math.max(15, config.tickIntervalSec) * 1000);
  void tick();
}

main();
