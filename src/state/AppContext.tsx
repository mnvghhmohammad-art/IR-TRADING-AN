/**
 * Global app state — settings, bot config, trades, ledger, exchange toggles.
 * Single source of truth shared by all screens; persists to AsyncStorage.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Settings, BotConfig, Trade, LedgerEntry, DEFAULT_SETTINGS, DEFAULT_BOT_CONFIG } from '../types';
import { loadJSON, saveJSON, STORE_KEYS } from '../storage/persist';
import { TradingBot } from '../services/bot/engine';
import { configureNotifications, ensurePermission, notifyTrade } from '../services/notifications';
import { secureSet, secureDelete, SEC_KEYS } from '../storage/secure';
import { useI18n } from '../i18n/I18nContext';

export interface ExchangeState {
  enabled: Record<string, boolean>;
  connected: Record<string, boolean>;
}

interface AppCtx {
  ready: boolean;
  settings: Settings;
  patchSettings: (p: Partial<Settings>) => void;
  botConfig: BotConfig;
  patchBotConfig: (p: Partial<BotConfig>) => void;
  trades: Trade[];
  ledger: LedgerEntry[];
  exchanges: ExchangeState;
  setExchangeEnabled: (id: string, enabled: boolean) => void;
  setExchangeConnected: (id: string, connected: boolean) => void;
  saveApiKey: (exchangeId: string, apiKey: string, apiSecret: string) => Promise<void>;
  removeApiKey: (exchangeId: string) => Promise<void>;
  bot: TradingBot | null;
  botVersion: number;
  startBot: () => void;
  stopBot: () => void;
  refresh: () => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [botConfig, setBotConfig] = useState<BotConfig>(DEFAULT_BOT_CONFIG);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [exchanges, setExchanges] = useState<ExchangeState>({ enabled: {}, connected: {} });
  const [botVersion, setBotVersion] = useState(0);
  const botRef = useRef<TradingBot | null>(null);
  const { t } = useI18n();

  // ---- initial load ----
  useEffect(() => {
    (async () => {
      const s = await loadJSON<Settings>(STORE_KEYS.settings, DEFAULT_SETTINGS);
      const c = await loadJSON<BotConfig>(STORE_KEYS.botConfig, DEFAULT_BOT_CONFIG);
      setSettings({ ...DEFAULT_SETTINGS, ...s });
      setBotConfig({ ...DEFAULT_BOT_CONFIG, ...c, running: false });

      const bot = new TradingBot({ ...DEFAULT_BOT_CONFIG, ...c, running: false }, { ...DEFAULT_SETTINGS, ...s });
      await bot.loadState();
      bot.subscribe(() => {
        setTrades(bot.getTrades());
        setLedger(bot.getLedger());
        setBotVersion((v) => v + 1);
      });
      botRef.current = bot;
      setTrades(bot.getTrades());
      setLedger(bot.getLedger());

      const ex = await loadJSON<Record<string, boolean>>(STORE_KEYS.exchanges, {});
      setExchanges({ enabled: ex, connected: {} });

      configureNotifications();
      if (s.notificationsEnabled !== false) void ensurePermission();

      setReady(true);
    })();
  }, []);

  const refresh = useCallback(() => {
    setTrades(botRef.current?.getTrades() ?? []);
    setLedger(botRef.current?.getLedger() ?? []);
    setBotVersion((v) => v + 1);
  }, []);

  // ---- settings ----
  const patchSettings = useCallback((p: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...p };
      void saveJSON(STORE_KEYS.settings, next);
      botRef.current?.updateSettings(next);
      return next;
    });
  }, []);

  // ---- bot config ----
  const patchBotConfig = useCallback((p: Partial<BotConfig>) => {
    setBotConfig((prev) => {
      const next = { ...prev, ...p };
      void saveJSON(STORE_KEYS.botConfig, next);
      botRef.current?.updateConfig(next);
      return next;
    });
  }, []);

  const startBot = useCallback(() => {
    const bot = botRef.current;
    if (!bot) return;
    bot.updateConfig({ ...botConfig, running: true });
    bot.start();
    void notifyTrade('🤖 ' + t('notif.botResumed'), t('bot.startConfirm'));
    setBotVersion((v) => v + 1);
  }, [botConfig, t]);

  const stopBot = useCallback(() => {
    const bot = botRef.current;
    if (!bot) return;
    bot.updateConfig({ ...bot.getConfig(), running: false });
    bot.stop();
    setBotVersion((v) => v + 1);
  }, []);

  // ---- exchanges ----
  const setExchangeEnabled = useCallback((id: string, enabled: boolean) => {
    setExchanges((prev) => {
      const next = { ...prev, enabled: { ...prev.enabled, [id]: enabled } };
      void saveJSON(STORE_KEYS.exchanges, next.enabled);
      return next;
    });
  }, []);

  const setExchangeConnected = useCallback((id: string, connected: boolean) => {
    setExchanges((prev) => ({ ...prev, connected: { ...prev.connected, [id]: connected } }));
  }, []);

  const saveApiKey = useCallback(async (exchangeId: string, apiKey: string, apiSecret: string) => {
    await secureSet(SEC_KEYS.creds(exchangeId), JSON.stringify({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim() || undefined }));
    setExchangeConnected(exchangeId, true);
  }, [setExchangeConnected]);

  const removeApiKey = useCallback(async (exchangeId: string) => {
    await secureDelete(SEC_KEYS.creds(exchangeId));
    setExchangeConnected(exchangeId, false);
  }, [setExchangeConnected]);

  const value = useMemo<AppCtx>(
    () => ({
      ready,
      settings,
      patchSettings,
      botConfig,
      patchBotConfig,
      trades,
      ledger,
      exchanges,
      setExchangeEnabled,
      setExchangeConnected,
      saveApiKey,
      removeApiKey,
      bot: botRef.current,
      botVersion,
      startBot,
      stopBot,
      refresh,
    }),
    [ready, settings, patchSettings, botConfig, patchBotConfig, trades, ledger, exchanges, setExchangeEnabled, setExchangeConnected, saveApiKey, removeApiKey, botVersion, startBot, stopBot, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
