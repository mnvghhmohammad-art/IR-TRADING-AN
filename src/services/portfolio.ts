/**
 * Portfolio aggregation — balances across connected exchanges valued in Toman.
 */
import { BalanceEntry } from '../types';
import { getStoredPrivateAdapter } from './exchanges';
import { fetchTicker } from './exchanges';

export interface PortfolioSummary {
  balances: BalanceEntry[];
  totalTMN: number;
  errors: string[];
}

/** Fetch combined balances from all exchanges that have stored API keys. */
export async function fetchPortfolio(exchangeIds: string[]): Promise<PortfolioSummary> {
  const balances: BalanceEntry[] = [];
  const errors: string[] = [];

  for (const id of exchangeIds) {
    const adapter = await getStoredPrivateAdapter(id);
    if (!adapter) continue;
    try {
      const rows = await adapter.getBalances();
      for (const r of rows) {
        const found = balances.find((b) => b.asset === r.asset);
        if (found) found.free += r.free;
        else balances.push({ ...r });
      }
    } catch (e) {
      errors.push(`${id}: ${e instanceof Error ? e.message : 'failed'}`);
    }
  }

  // price map for valuation in TMN
  const prices: Record<string, number> = { TMN: 1, IRT: 1 };
  const assets = [...new Set(balances.map((b) => b.asset))].filter((a) => a !== 'TMN' && a !== 'IRT');
  await Promise.all(
    assets.map(async (a) => {
      try {
        const { ticker } = await fetchTicker(`${a}/TMN`);
        prices[a] = ticker.price;
      } catch {
        /* leave unvalued */
      }
    })
  );

  const totalTMN = balances.reduce((s, b) => {
    if (b.asset === 'TMN' || b.asset === 'IRT') return s + b.free;
    return s + (prices[b.asset] ?? 0) * b.free;
  }, 0);

  return { balances, totalTMN, errors };
}
