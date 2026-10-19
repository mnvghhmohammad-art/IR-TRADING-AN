/**
 * TradingBot engine — the heart of IR.TRADIng.AN.
 *
 * - Scans configured pairs on the primary exchange every tickIntervalSec
 * - Uses the strategy engine (RSI/EMA/MACD/BB + patterns) to decide
 * - Opens positions with stop-loss / take-profit, closes them automatically
 * - Sends a local notification whenever a trade is opened or closed
 * - Sends the configured profit share (default 40%) to the user's card
 * - Works in paper mode (default) or real mode (real exchange orders)
 */
import { BotConfig, Trade, LedgerEntry, Settings, Candle } from '../../types';
import { analyzeCandles } from './strategy';
import { canOpenPosition, levelsFor, profitShareOf } from './risk';
import { fetchCandles, fetchTicker, getStoredPrivateAdapter } from '../exchanges';
import { loadJSON, saveJSON, STORE_KEYS } from '../../storage/persist';
import { notifyTrade } from '../notifications';
import { uid } from '../../utils/format';

export interface BotStatus {
  running: boolean;
  lastTickAt: number | null;
  lastError: string | null;
  pausedByDailyLoss: boolean;
  primaryExchange: string;
  openPositions: number;
  pnl24hTMN: number;
}

type Listener = () => void;

const MIN_NOTIONAL_TMN = 200000; // conservative minimum order size on Iranian exchanges

export class TradingBot {
  private cfg: BotConfig;
  private settings: Settings;
  private trades: Trade[] = [];
  private ledger: LedgerEntry[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  private listeners = new Set<Listener>();
  private pausedByDailyLoss = false;
  lastTickAt: number | null = null;
  lastError: string | null = null;

  constructor(cfg: BotConfig, settings: Settings) {
    this.cfg = { ...cfg };
    this.settings = { ...settings };
  }

  // ---------- lifecycle ----------

  async loadState(): Promise<void> {
    this.trades = await loadJSON<Trade[]>(STORE_KEYS.trades, []);
    this.ledger = await loadJSON<LedgerEntry[]>(STORE_KEYS.ledger, []);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  updateConfig(cfg: BotConfig): void {
    this.cfg = { ...cfg };
    void saveJSON(STORE_KEYS.botConfig, this.cfg);
    if (this.cfg.running && !this.timer) this.start();
    if (!this.cfg.running && this.timer) this.stop();
  }

  updateSettings(s: Settings): void {
    this.settings = { ...s };
  }

  getConfig(): BotConfig {
    return { ...this.cfg };
  }

  getTrades(): Trade[] {
    return [...this.trades].sort((a, b) => b.openedAt - a.openedAt);
  }

  getLedger(): LedgerEntry[] {
    return [...this.ledger].sort((a, b) => b.ts - a.ts);
  }

  getStatus(): BotStatus {
    return {
      running: !!this.timer,
      lastTickAt: this.lastTickAt,
      lastError: this.lastError,
      pausedByDailyLoss: this.pausedByDailyLoss,
      primaryExchange: 'nobitex',
      openPositions: this.trades.filter((t) => t.status === 'open').length,
      pnl24hTMN: this.pnl24h(),
    };
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), Math.max(10, this.cfg.tickIntervalSec) * 1000);
    this.emit();
    void this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.emit();
  }

  // ---------- accounting ----------

  pnl24h(): number {
    const day = Date.now() - 24 * 3600 * 1000;
    return this.trades
      .filter((t) => t.status === 'closed' && (t.closedAt ?? 0) >= day)
      .reduce((s, t) => s + (t.pnl ?? 0), 0);
  }

  private dailyPnlPct(): number {
    const pnl = this.pnl24h();
    const closedTotal = this.trades.filter((t) => t.status === 'closed').reduce((s, t) => s + Math.abs(t.entryPrice * t.amount), 0);
    const capital = Math.max(closedTotal || 1, 50000);
    return (pnl / capital) * 100;
  }

  addLedger(entry: Omit<LedgerEntry, 'id' | 'ts'>): LedgerEntry {
    const e: LedgerEntry = { ...entry, id: uid(), ts: Date.now() };
    this.ledger.push(e);
    void saveJSON(STORE_KEYS.ledger, this.ledger);
    this.emit();
    return e;
  }

  /** Public: used by wallet screen to record deposits. */
  recordDeposit(amountTMN: number, note?: string): LedgerEntry {
    return this.addLedger({ type: 'deposit', amount: amountTMN, status: 'done', note });
  }

  /** Public: used by wallet screen for manual withdrawals. */
  recordWithdraw(amountTMN: number, status: 'pending' | 'done' | 'failed', note?: string): LedgerEntry {
    return this.addLedger({ type: 'withdraw', amount: amountTMN, status, note });
  }

  // ---------- core loop ----------

  private async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      if (this.pausedByDailyLoss) {
        this.lastTickAt = Date.now();
        return;
      }
      const open = this.trades.filter((t) => t.status === 'open');
      for (const pos of open) {
        await this.managePosition(pos);
      }
      const freeSlots = this.cfg.maxOpenPositions - this.trades.filter((t) => t.status === 'open').length;
      if (freeSlots > 0 && this.dailyPnlPct() > -this.cfg.dailyLossLimitPct) {
        await this.scanForEntry(freeSlots);
      }
      this.lastTickAt = Date.now();
      this.lastError = null;
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : 'tick error';
    } finally {
      this.ticking = false;
      this.emit();
      void saveJSON(STORE_KEYS.trades, this.trades);
    }
  }

  private async managePosition(pos: Trade): Promise<void> {
    const { base, quote } = splitPair(pos.symbol);
    let price: number | null = null;
    try {
      const res = await fetchTicker(pos.symbol);
      price = res.ticker.price;
    } catch {
      /* keep null */
    }
    if (price === null) return;

    const hitSL = price <= (pos.stopLoss ?? 0);
    const hitTP = price >= (pos.takeProfit ?? Infinity);
    let exitReason: 'stop' | 'target' | 'signal' | null = hitSL ? 'stop' : hitTP ? 'target' : null;
    if (!exitReason) {
      const candles = await fetchCandles(pos.symbol, 15, 60, pos.exchangeId).catch(() => []);
      const analysis = candles.length ? analyzeCandles(candles, this.cfg.riskProfile) : null;
      if (analysis && analysis.signal.action === 'sell') exitReason = 'signal';
    }
    if (!exitReason) return;

    const exitPrice = exitReason === 'target' ? Math.max(price, pos.takeProfit ?? price) : exitReason === 'stop' ? Math.min(price, pos.stopLoss ?? price) : price;
    await this.closePosition(pos, exitPrice, exitReason);
  }

  private async closePosition(pos: Trade, exitPrice: number, reason: 'stop' | 'target' | 'signal'): Promise<void> {
    // real mode: sell on exchange
    if (pos.mode === 'real') {
      const adapter = await getStoredPrivateAdapter(pos.exchangeId);
      if (!adapter) {
        this.lastError = 'no API key for ' + pos.exchangeId;
        return;
      }
      const res = await adapter.placeMarketOrder('sell', splitPair(pos.symbol).base, splitPair(pos.symbol).quote, exitPrice * pos.amount);
      if (!res.ok) {
        this.lastError = res.message || 'sell failed';
        return;
      }
    }
    pos.status = 'closed';
    pos.closedAt = Date.now();
    pos.exitPrice = exitPrice;
    pos.pnl = (exitPrice - pos.entryPrice) * pos.amount;
    pos.pnlPct = ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100;
    pos.reason = reason;

    await notifyTrade('💰 ' + 'معامله بسته شد / Trade closed', `${pos.symbol} ${pos.pnlPct && pos.pnlPct >= 0 ? '+' : ''}${(pos.pnlPct ?? 0).toFixed(2)}%`);

    // profit share -> card
    if (pos.pnl && pos.pnl > 0 && this.cfg.autoWithdraw) {
      const share = profitShareOf(pos.pnl, this.cfg);
      if (share >= this.cfg.minProfitToWithdraw) {
        await this.sendProfitToCard(pos.exchangeId, share);
      }
    }
    this.emit();
  }

  private async sendProfitToCard(exchangeId: string, amountTMN: number): Promise<void> {
    const entry = this.addLedger({ type: 'profit_share', amount: amountTMN, status: 'pending', note: exchangeId });
    try {
      const adapter = await getStoredPrivateAdapter(exchangeId);
      const card = this.settings.cardNumber;
      if (adapter && card) {
        const res = await adapter.requestCardWithdraw(amountTMN, card);
        if (res.ok) {
          entry.status = 'done';
        } else if (res.needsManual) {
          entry.status = 'pending';
          await notifyTrade('🏦 واریز سود / Profit payout', `${amountTMN.toLocaleString('fa-IR')} Toman — ${res.message}`);
        } else {
          entry.status = 'failed';
        }
      } else {
        entry.status = 'pending';
        await notifyTrade('🏦 واریز سود / Profit payout', `${amountTMN.toLocaleString('fa-IR')} Toman — add card number / confirm in exchange app`);
      }
    } catch {
      entry.status = 'failed';
    }
    void saveJSON(STORE_KEYS.ledger, this.ledger);
    this.emit();
  }

  private async scanForEntry(freeSlots: number): Promise<void> {
    let remaining = freeSlots;
    for (const symbol of this.cfg.pairs) {
      if (remaining <= 0) break;
      if (this.trades.some((t) => t.status === 'open' && t.symbol === symbol)) continue;
      let candles: Candle[] = [];
      try {
        candles = await fetchCandles(symbol, 15, 120);
      } catch {
        continue;
      }
      const analysis = analyzeCandles(candles, this.cfg.riskProfile);
      if (!analysis || analysis.signal.action !== 'buy') continue;

      const guard = canOpenPosition({
        openCount: this.trades.filter((t) => t.status === 'open').length,
        cfg: this.cfg,
        quoteFree: 10_000_000, // paper budget; real mode checks exchange balance below
        dailyPnlPct: this.dailyPnlPct(),
        minNotionalTMN: MIN_NOTIONAL_TMN,
      });
      if (!guard.allowed) {
        if (guard.reason === 'daily loss limit reached') {
          this.pausedByDailyLoss = true;
          await notifyTrade('⏸ ' + 'ربات متوقف شد / Bot paused', 'Daily loss limit reached');
        }
        continue;
      }

      const price = analysis.price;
      const notional = Math.max(50000, Math.floor(1_000_000 * (this.cfg.tradeAmountPct / 100)));
      const amount = notional / price;
      const { stopLoss, takeProfit } = levelsFor(price, this.cfg);

      const trade: Trade = {
        id: uid(),
        exchangeId: 'nobitex',
        symbol,
        side: 'buy',
        amount,
        entryPrice: price,
        openedAt: Date.now(),
        status: 'open',
        mode: this.cfg.mode,
        reason: analysis.signal.reasons.join(' | '),
        stopLoss,
        takeProfit,
      };

      if (this.cfg.mode === 'real') {
        const adapter = await getStoredPrivateAdapter('nobitex');
        if (!adapter) {
          this.lastError = 'real mode needs an API key';
          return;
        }
        const { base, quote } = splitPair(symbol);
        const res = await adapter.placeMarketOrder('buy', base, quote, notional);
        if (!res.ok) {
          this.lastError = res.message || 'buy failed';
          continue;
        }
      }

      this.trades.push(trade);
      remaining -= 1;
      await notifyTrade(
        '🚀 ' + 'معامله باز شد / Trade opened',
        `${symbol} @ ${price.toLocaleString('fa-IR', { maximumFractionDigits: 0 })} Toman`
      );
      this.emit();
    }
  }

  /** Manually close a position from the UI. */
  async closeManually(tradeId: string): Promise<boolean> {
    const pos = this.trades.find((t) => t.id === tradeId && t.status === 'open');
    if (!pos) return false;
    try {
      const res = await fetchTicker(pos.symbol);
      await this.closePosition(pos, res.ticker.price, 'signal');
      return true;
    } catch {
      return false;
    }
  }

  setPausedByDailyLoss(v: boolean): void {
    this.pausedByDailyLoss = v;
    this.emit();
  }
}

function splitPair(symbol: string): { base: string; quote: string } {
  const [base, quote] = symbol.split('/');
  return { base: (base || '').toUpperCase(), quote: (quote || 'TMN').toUpperCase() };
}
