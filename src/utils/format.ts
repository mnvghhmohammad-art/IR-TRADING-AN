import { Language } from '../types';

/** Format numbers with locale-aware separators; Persian digits for fa. */
export function fmtNumber(n: number, lang: Language, digits = 0): string {
  if (!isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : lang === 'de' ? 'de-DE' : lang === 'fr' ? 'fr-FR' : 'en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(n);
  } catch {
    return n.toFixed(digits);
  }
}

/** Price formatting — big numbers no decimals, small ones with decimals. */
export function fmtPrice(n: number, lang: Language): string {
  if (!isFinite(n)) return '—';
  const digits = n >= 10000 ? 0 : n >= 100 ? 1 : n >= 1 ? 2 : 6;
  return fmtNumber(n, lang, digits);
}

export function fmtMoneyTMN(n: number, lang: Language): string {
  return `${fmtNumber(n, lang, 0)} ${lang === 'fa' ? 'تومان' : 'Toman'}`;
}

export function fmtPct(n: number, lang: Language): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${fmtNumber(n, lang, 2)}%`;
}

export function fmtDateTime(ts: number, lang: Language): string {
  try {
    return new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR' : lang, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

export function fmtTime(ts: number, lang: Language): string {
  try {
    return new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR' : lang, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleTimeString();
  }
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Split "BTC/TMN" into base and quote. */
export function splitSymbol(symbol: string): { base: string; quote: string } {
  const [base, quote] = symbol.split('/');
  return { base: (base || '').toUpperCase(), quote: (quote || 'TMN').toUpperCase() };
}
