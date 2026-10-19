/**
 * Dashboard — big market chart in the middle, bot status, 24h P/L, quick actions.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../state/AppContext';
import { MarketChart } from '../components/Chart';
import { Card, PrimaryButton, Chip, StatCard, SectionTitle, EmptyState, PnlText } from '../components/ui';
import { fetchCandles, fetchTicker } from '../services/exchanges';
import { Candle, Ticker } from '../types';
import { fmtPrice, fmtNumber, fmtPct, fmtMoneyTMN, fmtTime } from '../utils/format';

const RES_MIN = 15;

export function DashboardScreen() {
  const { palette } = useTheme();
  const { t, lang, rtl } = useI18n();
  const { botConfig, settings, trades, bot, botVersion, startBot, stopBot, exchanges } = useApp();
  const nav = useNavigation<any>();

  const [symbol, setSymbol] = useState(botConfig.pairs[0] ?? 'BTC/TMN');
  const [mode, setMode] = useState<'line' | 'candle'>('line');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [loadingChart, setLoadingChart] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const status = bot?.getStatus();
  const pnl24 = status?.pnl24hTMN ?? 0;

  const loadChart = useCallback(async () => {
    setLoadingChart(true);
    try {
      const [c, tk] = await Promise.all([
        fetchCandles(symbol, RES_MIN, 200),
        fetchTicker(symbol).catch(() => null),
      ]);
      setCandles(c);
      if (tk) setTicker(tk.ticker);
    } catch {
      setCandles([]);
    } finally {
      setLoadingChart(false);
    }
  }, [symbol]);

  useEffect(() => {
    void loadChart();
    const iv = setInterval(() => void loadChart(), 60000);
    return () => clearInterval(iv);
  }, [loadChart]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChart();
    setRefreshing(false);
  }, [loadChart]);

  const localBalance = useMemo(() => {
    const deposits = 0;
    const closed = trades.filter((x) => x.status === 'closed').reduce((s, x) => s + (x.pnl ?? 0), 0);
    return deposits + closed;
  }, [trades]);

  const openPositions = trades.filter((x) => x.status === 'open');
  const recent = trades.slice(0, 4);
  const change = ticker?.change24h ?? 0;

  const quick = [
    { icon: 'flash' as const, label: t('tab.bot'), to: 'Bot' },
    { icon: 'business' as const, label: t('tab.exchanges'), to: 'Exchanges' },
    { icon: 'wallet' as const, label: t('tab.wallet'), to: 'Wallet' },
    { icon: 'settings' as const, label: t('tab.settings'), to: 'Settings' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.gold} />}
      >
        {/* header */}
        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: '#000', borderWidth: 1.5, borderColor: palette.gold, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: palette.gold, fontWeight: '900', fontSize: 15 }}>IT</Text>
            </View>
            <View>
              <Text style={{ color: palette.text, fontWeight: '900', fontSize: 17 }}>IR.TRADIng.AN</Text>
              <Text style={{ color: palette.sub, fontSize: 11 }}>{t('app.tagline')}</Text>
            </View>
          </View>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => nav.navigate('Language')} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="language" size={20} color={palette.gold} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => nav.navigate('Authenticator')} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="shield-checkmark" size={20} color={settings.twoFAEnabled ? palette.green : palette.sub} />
            </TouchableOpacity>
          </View>
        </View>

        {/* stats */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatCard label={t('home.totalBalance')} value={fmtMoneyTMN(localBalance, lang)} sub={t('wallet.minCapital')} accent="gold" />
          <StatCard
            label={t('home.pnl24h')}
            value={`${pnl24 >= 0 ? '+' : ''}${fmtNumber(pnl24, lang, 0)} T`}
            sub={pnl24 >= 0 ? t('home.profit') : t('home.loss')}
            accent={pnl24 >= 0 ? 'green' : 'red'}
          />
        </View>

        {/* bot status */}
        <Card style={{ marginTop: 12 }}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: botConfig.running ? palette.green + '22' : palette.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="flash" size={22} color={botConfig.running ? palette.green : palette.sub} />
              </View>
              <View>
                <Text style={{ color: palette.text, fontWeight: '800', fontSize: 15 }}>{t('home.botStatus')}</Text>
                <Text style={{ color: botConfig.running ? palette.green : palette.sub, fontSize: 12, fontWeight: '700' }}>
                  {botConfig.running ? `${t('home.botRunning')} • ${botConfig.mode === 'real' ? t('home.modeReal') : t('home.modePaper')}` : t('home.botStopped')}
                </Text>
              </View>
            </View>
            <View style={{ alignItems: rtl ? 'flex-start' : 'flex-end' }}>
              <Text style={{ color: palette.sub, fontSize: 11 }}>{t('home.openPositions')}</Text>
              <Text style={{ color: palette.text, fontWeight: '800', fontSize: 16 }}>{fmtNumber(status?.openPositions ?? 0, lang)}</Text>
            </View>
          </View>
          <View style={{ height: 12 }} />
          {botConfig.running ? (
            <PrimaryButton label={t('home.stopBot')} icon="stop" onPress={stopBot} danger />
          ) : (
            <PrimaryButton label={t('home.startBot')} icon="play" onPress={() => {
              const anyConnected = Object.values(exchanges.connected).some(Boolean) || botConfig.mode === 'paper';
              if (!anyConnected) {
                Alert.alert(t('common.warning'), t('bot.needExchange'));
                nav.navigate('Exchanges');
                return;
              }
              startBot();
            }} />
          )}
        </Card>

        {/* big chart */}
        <Card style={{ marginTop: 12 }}>
          <SectionTitle
            title={t('home.liveChart')}
            action={
              <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 6 }}>
                <Chip label="line" active={mode === 'line'} onPress={() => setMode('line')} />
                <Chip label="candles" active={mode === 'candle'} onPress={() => setMode('candle')} />
              </View>
            }
          />
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {botConfig.pairs.map((p) => (
              <Chip key={p} label={p.replace('/TMN', '')} active={p === symbol} onPress={() => setSymbol(p)} />
            ))}
          </View>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
            <Text style={{ color: palette.text, fontSize: 24, fontWeight: '900' }}>{ticker ? fmtPrice(ticker.price, lang) : '—'}</Text>
            <Text style={{ color: palette.sub, fontSize: 12 }}>{t('common.price')} (Toman)</Text>
            <PnlText value={change} />
          </View>
          <MarketChart candles={candles} mode={mode} height={260} loading={loadingChart} />
          {status?.lastTickAt ? (
            <Text style={{ color: palette.sub, fontSize: 10, marginTop: 6, textAlign: rtl ? 'right' : 'left' }}>
              {t('bot.lastCheck')}: {fmtTime(status.lastTickAt, lang)}
            </Text>
          ) : null}
        </Card>

        {/* open positions */}
        <View style={{ marginTop: 14 }}>
          <SectionTitle title={t('home.openPositions')} />
          <Card>
            {openPositions.length === 0 ? (
              <EmptyState icon="cube-outline" text={t('home.noPositions')} />
            ) : (
              openPositions.slice(0, 5).map((p) => (
                <View key={p.id} style={{ flexDirection: rtl ? 'row-reverse' : 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.border }}>
                  <Text style={{ color: palette.text, fontWeight: '700' }}>{p.symbol}</Text>
                  <Text style={{ color: palette.sub, fontSize: 12 }}>{fmtPrice(p.entryPrice, lang)} → SL {fmtPrice(p.stopLoss ?? 0, lang)} / TP {fmtPrice(p.takeProfit ?? 0, lang)}</Text>
                </View>
              ))
            )}
          </Card>
        </View>

        {/* recent trades */}
        <View style={{ marginTop: 14 }}>
          <SectionTitle
            title={t('home.recentTrades')}
            action={
              <TouchableOpacity onPress={() => nav.navigate('Bot')}>
                <Text style={{ color: palette.gold, fontSize: 13, fontWeight: '700' }}>{t('common.viewAll')}</Text>
              </TouchableOpacity>
            }
          />
          <Card>
            {recent.length === 0 ? (
              <EmptyState icon="swap-horizontal-outline" text={t('home.noTrades')} />
            ) : (
              recent.map((p) => (
                <View key={p.id} style={{ flexDirection: rtl ? 'row-reverse' : 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.border }}>
                  <View>
                    <Text style={{ color: palette.text, fontWeight: '700' }}>
                      {p.symbol} · {p.status === 'open' ? t('bot.opened') : t('bot.closed')}
                    </Text>
                    <Text style={{ color: palette.sub, fontSize: 11 }}>{fmtTime(p.openedAt, lang)} · {p.mode === 'real' ? t('home.modeReal') : t('home.modePaper')}</Text>
                  </View>
                  {p.status === 'closed' && p.pnlPct !== undefined ? <PnlText value={p.pnlPct} /> : <Text style={{ color: palette.gold, fontWeight: '700' }}>●</Text>}
                </View>
              ))
            )}
          </Card>
        </View>

        {/* quick actions */}
        <View style={{ marginTop: 14 }}>
          <SectionTitle title={t('home.quickActions')} />
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 10 }}>
            {quick.map((q) => (
              <TouchableOpacity
                key={q.to}
                onPress={() => nav.navigate(q.to)}
                style={{ flex: 1, backgroundColor: palette.card, borderRadius: 16, borderWidth: 1, borderColor: palette.border, paddingVertical: 14, alignItems: 'center', gap: 6 }}
              >
                <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: palette.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={q.icon} size={20} color={palette.gold} />
                </View>
                <Text style={{ color: palette.text, fontSize: 11, fontWeight: '700' }}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={{ color: palette.sub, fontSize: 10, textAlign: 'center', marginTop: 18, lineHeight: 16 }}>{t('set.riskWarning')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
