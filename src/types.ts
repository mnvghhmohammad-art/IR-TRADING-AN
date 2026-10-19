/**
 * IR.TRADIng.AN — Shared domain types
 */

export interface Candle {
  t: number; // open time (ms)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface Ticker {
  price: number;
  change24h: number; // percent
  high24h: number;
  low24h: number;
  volume24h: number;
}

export type OrderSide = 'buy' | 'sell';
export type TradeMode = 'real' | 'paper';
export type TradeStatus = 'open' | 'closed';

export interface Trade {
  id: string;
  exchangeId: string;
  symbol: string; // e.g. "BTC/TMN"
  side: OrderSide;
  amount: number; // base asset amount
  entryPrice: number;
  exitPrice?: number;
  openedAt: number;
  closedAt?: number;
  status: TradeStatus;
  pnl?: number; // quote currency (TMN)
  pnlPct?: number;
  mode: TradeMode;
  reason?: string;
  stopLoss?: number;
  takeProfit?: number;
}

export type RiskProfile = 'conservative' | 'balanced' | 'aggressive';

export interface BotConfig {
  running: boolean;
  mode: TradeMode;
  riskProfile: RiskProfile;
  tradeAmountPct: number; // % of free balance used per trade
  stopLossPct: number;
  takeProfitPct: number;
  maxOpenPositions: number;
  tickIntervalSec: number;
  pairs: string[];
  profitSharePct: number; // 40 => 40% of net profit sent to card
  autoWithdraw: boolean;
  minProfitToWithdraw: number; // TMN
  dailyLossLimitPct: number; // pause trading after -x% in 24h
}

export type Language = 'fa' | 'en' | 'fr' | 'de';
export type ThemeMode = 'dark' | 'light' | 'system';

export interface Settings {
  language: Language;
  themeMode: ThemeMode;
  realTradingConfirmed: boolean;
  paymentEnabled: boolean;
  notificationsEnabled: boolean;
  twoFAEnabled: boolean;
  zarinpalMerchantId: string;
  cardNumber: string;
  sheba: string;
  minCapitalUSD: number; // user requested: from 1 USD
  minCapitalTMN: number; // user requested: from 50,000 Toman
}

export interface LedgerEntry {
  id: string;
  type: 'deposit' | 'withdraw' | 'profit_share';
  amount: number; // TMN
  ts: number;
  note?: string;
  status: 'pending' | 'done' | 'failed';
}

export interface BalanceEntry {
  asset: string;
  free: number;
  locked?: number;
}

export interface ExchangeCreds {
  apiKey: string;
  apiSecret?: string;
}

export type CredsTestResult = {
  ok: boolean;
  message: string;
  balances?: BalanceEntry[];
};

export interface Signal {
  action: 'buy' | 'sell' | 'hold';
  confidence: number; // 0..100
  reasons: string[];
}

export interface PrivateAdapter {
  getBalances(): Promise<BalanceEntry[]>;
  placeMarketOrder(side: OrderSide, base: string, quote: string, quoteAmount: number): Promise<{ ok: boolean; ref?: string; message?: string }>;
  requestCardWithdraw(amountTMN: number, cardNumber: string): Promise<{ ok: boolean; message: string; needsManual?: boolean }>;
}

export const DEFAULT_BOT_CONFIG: BotConfig = {
  running: false,
  mode: 'paper',
  riskProfile: 'balanced',
  tradeAmountPct: 20,
  stopLossPct: 2,
  takeProfitPct: 4,
  maxOpenPositions: 3,
  tickIntervalSec: 30,
  pairs: ['BTC/TMN', 'ETH/TMN', 'USDT/TMN', 'XRP/TMN', 'DOGE/TMN'],
  profitSharePct: 40,
  autoWithdraw: true,
  minProfitToWithdraw: 500000,
  dailyLossLimitPct: 8,
};

export const DEFAULT_SETTINGS: Settings = {
  language: 'fa',
  themeMode: 'dark',
  realTradingConfirmed: false,
  paymentEnabled: false,
  notificationsEnabled: true,
  twoFAEnabled: false,
  zarinpalMerchantId: '',
  cardNumber: '',
  sheba: '',
  minCapitalUSD: 1,
  minCapitalTMN: 50000,
};
