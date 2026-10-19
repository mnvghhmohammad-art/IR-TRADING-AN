/**
 * Risk management — position sizing, capital guards, profit share math.
 * User requirements: min capital 1 USD / 50,000 Toman; auto profit share 40%.
 */
import { BotConfig } from '../../types';

export interface RiskCheck {
  allowed: boolean;
  reason?: string;
}

export function positionSize(quoteFree: number, cfg: BotConfig): number {
  let amt = (quoteFree * cfg.tradeAmountPct) / 100;
  // never below user's minimum starting capital
  amt = Math.max(amt, Math.min(cfg.tradeAmountPct > 0 ? 1 : 0, amt));
  return Math.floor(amt);
}

export function canOpenPosition(params: {
  openCount: number;
  cfg: BotConfig;
  quoteFree: number;
  dailyPnlPct: number;
  minNotionalTMN: number;
}): RiskCheck {
  const { openCount, cfg, quoteFree, dailyPnlPct, minNotionalTMN } = params;
  if (openCount >= cfg.maxOpenPositions) return { allowed: false, reason: 'max positions reached' };
  if (quoteFree < Math.max(50000, minNotionalTMN)) return { allowed: false, reason: 'balance below minimum (50,000 Toman / 1 USD)' };
  if (dailyPnlPct <= -cfg.dailyLossLimitPct) return { allowed: false, reason: 'daily loss limit reached' };
  return { allowed: true };
}

export function levelsFor(entryPrice: number, cfg: BotConfig): { stopLoss: number; takeProfit: number } {
  const sl = entryPrice * (1 - cfg.stopLossPct / 100);
  const tp = entryPrice * (1 + cfg.takeProfitPct / 100);
  return { stopLoss: sl, takeProfit: tp };
}

export function profitShareOf(netProfitTMN: number, cfg: BotConfig): number {
  if (netProfitTMN <= 0) return 0;
  return Math.floor((netProfitTMN * cfg.profitSharePct) / 100);
}

/** Value of a base-asset amount in TMN using a price map. */
export function valueInTMN(balances: { asset: string; free: number }[], prices: Record<string, number>): number {
  let total = 0;
  for (const b of balances) {
    if (b.asset === 'TMN' || b.asset === 'IRT') total += b.free;
    else {
      const p = prices[b.asset];
      if (p) total += b.free * p;
    }
  }
  return total;
}
