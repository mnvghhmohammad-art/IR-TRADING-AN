/**
 * Bot screen — full bot control: mode, risk, pairs, profit share, trade log.
 */
import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, Alert, TextInput as RNInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../state/AppContext';
import { Card, PrimaryButton, Chip, SectionTitle, Toggle, SettingRow, EmptyState, PnlText } from '../components/ui';
import { RiskProfile, BotConfig } from '../types';
import { fmtPrice, fmtNumber, fmtDateTime } from '../utils/format';

export function BotScreen() {
  const { palette } = useTheme();
  const { t, lang, rtl } = useI18n();
  const { botConfig, patchBotConfig, trades, bot, startBot, stopBot, botVersion } = useApp();

  const status = bot?.getStatus();
  const num = (key: keyof BotConfig, title: string, opts: { min: number; max: number; step: number }) => {
    const val = Number(botConfig[key]) || 0;
    return (
      <View style={{ paddingVertical: 8 }}>
        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: palette.text, fontWeight: '700', fontSize: 14 }}>{title}</Text>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => patchBotConfig({ [key]: Math.max(opts.min, val - opts.step) } as Partial<BotConfig>)} style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: palette.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="remove" size={18} color={palette.gold} />
            </TouchableOpacity>
            <Text style={{ color: palette.gold, fontWeight: '900', fontSize: 16, minWidth: 42, textAlign: 'center' }}>{fmtNumber(val, lang, val % 1 ? 1 : 0)}</Text>
            <TouchableOpacity onPress={() => patchBotConfig({ [key]: Math.min(opts.max, val + opts.step) } as Partial<BotConfig>)} style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: palette.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={18} color={palette.gold} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const togglePair = (p: string) => {
    const set = new Set(botConfig.pairs);
    if (set.has(p)) {
      if (set.size <= 1) return;
      set.delete(p);
    } else set.add(p);
    patchBotConfig({ pairs: [...set] });
  };

  const confirmRealMode = (on: boolean) => {
    if (!on) {
      patchBotConfig({ mode: 'paper' });
      return;
    }
    Alert.alert(t('set.realConfirmTitle'), t('set.realConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.yes'), style: 'destructive', onPress: () => patchBotConfig({ mode: 'real' }) },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}>
        <Text style={{ color: palette.text, fontSize: 22, fontWeight: '900', paddingTop: 10 }}>{t('bot.title')}</Text>
        <Text style={{ color: palette.sub, fontSize: 13, marginTop: 4, marginBottom: 14, lineHeight: 19 }}>{t('bot.desc')}</Text>

        {/* master switch */}
        <Card>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: botConfig.running ? palette.green + '22' : palette.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="flash" size={24} color={botConfig.running ? palette.green : palette.sub} />
              </View>
              <View>
                <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>
                  {botConfig.running ? t('home.botRunning') : t('home.botStopped')}
                </Text>
                <Text style={{ color: palette.sub, fontSize: 11 }}>
                  {botConfig.mode === 'real' ? t('bot.realMode') : t('bot.paperMode')}
                  {status?.pausedByDailyLoss ? ` · ${t('bot.pausedDailyLoss')}` : ''}
                </Text>
              </View>
            </View>
            <Toggle value={!!botConfig.running} onChange={(v) => (v ? startBot() : stopBot())} />
          </View>
        </Card>

        {/* how it works */}
        <Card style={{ marginTop: 12 }}>
          <SectionTitle title={t('bot.howItWorks')} />
          <Text style={{ color: palette.sub, fontSize: 12.5, lineHeight: 20 }}>{t('bot.explainer')}</Text>
        </Card>

        {/* mode */}
        <Card style={{ marginTop: 12 }}>
          <SectionTitle title={t('bot.mode')} />
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => confirmRealMode(true)}
              style={{ flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: botConfig.mode === 'real' ? palette.red : palette.border, backgroundColor: botConfig.mode === 'real' ? palette.red + '18' : palette.surfaceAlt, paddingVertical: 11, alignItems: 'center' }}
            >
              <Text style={{ color: botConfig.mode === 'real' ? palette.red : palette.sub, fontWeight: '800', fontSize: 13 }}>{t('bot.realMode')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => confirmRealMode(false)}
              style={{ flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: botConfig.mode === 'paper' ? palette.gold : palette.border, backgroundColor: botConfig.mode === 'paper' ? palette.gold + '18' : palette.surfaceAlt, paddingVertical: 11, alignItems: 'center' }}
            >
              <Text style={{ color: botConfig.mode === 'paper' ? palette.gold : palette.sub, fontWeight: '800', fontSize: 13 }}>{t('bot.paperMode')}</Text>
            </TouchableOpacity>
          </View>
          {botConfig.mode === 'real' ? (
            <Text style={{ color: palette.red, fontSize: 11.5, marginTop: 8, lineHeight: 17 }}>{t('bot.realWarning')}</Text>
          ) : null}
        </Card>

        {/* config */}
        <Card style={{ marginTop: 12 }}>
          <SectionTitle title={t('bot.config')} />
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 8, marginBottom: 10 }}>
            {(['conservative', 'balanced', 'aggressive'] as RiskProfile[]).map((p) => (
              <Chip
                key={p}
                label={t(`bot.${p}`)}
                active={botConfig.riskProfile === p}
                onPress={() =>
                  patchBotConfig({
                    riskProfile: p,
                    stopLossPct: p === 'conservative' ? 1 : p === 'balanced' ? 2 : 1.5,
                    takeProfitPct: p === 'conservative' ? 2 : p === 'balanced' ? 4 : 6,
                    maxOpenPositions: p === 'conservative' ? 1 : p === 'balanced' ? 3 : 5,
                  })
                }
              />
            ))}
          </View>
          {num('stopLossPct', t('bot.stopLoss'), { min: 0.5, max: 10, step: 0.5 })}
          {num('takeProfitPct', t('bot.takeProfit'), { min: 1, max: 20, step: 0.5 })}
          {num('maxOpenPositions', t('bot.maxPositions'), { min: 1, max: 5, step: 1 })}
          {num('tickIntervalSec', t('bot.tickInterval'), { min: 15, max: 300, step: 15 })}
          {num('tradeAmountPct', t('bot.tradeAmount'), { min: 5, max: 100, step: 5 })}
          {num('dailyLossLimitPct', t('bot.dailyLossLimit'), { min: 2, max: 50, step: 1 })}
        </Card>

        {/* pairs */}
        <Card style={{ marginTop: 12 }}>
          <SectionTitle title={t('bot.pairs')} />
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
            {['BTC/TMN', 'ETH/TMN', 'USDT/TMN', 'XRP/TMN', 'DOGE/TMN', 'SOL/TMN', 'TON/TMN', 'SHIB/TMN'].map((p) => (
              <Chip key={p} label={p} active={botConfig.pairs.includes(p)} onPress={() => togglePair(p)} />
            ))}
          </View>
        </Card>

        {/* profit share */}
        <Card style={{ marginTop: 12 }}>
          <SectionTitle title={t('bot.autoProfitShare')} />
          <SettingRow icon="card" title={t('bot.autoWithdraw')} desc={t('wallet.autoWithdrawDesc')} right={<Toggle value={botConfig.autoWithdraw} onChange={(v) => patchBotConfig({ autoWithdraw: v })} />} />
          {num('profitSharePct', t('bot.profitSharePct'), { min: 10, max: 100, step: 10 })}
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: palette.text, fontWeight: '700', fontSize: 14 }}>{t('bot.minProfitWithdraw')}</Text>
            <RNInput
              value={String(botConfig.minProfitToWithdraw)}
              onChangeText={(v) => patchBotConfig({ minProfitToWithdraw: Math.max(0, parseInt(v.replace(/\D/g, '') || '0', 10) || 0) })}
              keyboardType="number-pad"
              style={{ color: palette.gold, fontWeight: '900', textAlign: 'center', minWidth: 110, backgroundColor: palette.surfaceAlt, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: palette.border }}
            />
          </View>
        </Card>

        {/* trade log */}
        <View style={{ marginTop: 14 }}>
          <SectionTitle title={t('bot.tradeLog')} />
          <Card>
            {trades.length === 0 ? (
              <EmptyState icon="document-text-outline" text={t('home.noTrades')} />
            ) : (
              trades.slice(0, 25).map((tr) => (
                <View key={tr.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
                  <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: tr.status === 'open' ? palette.gold + '22' : palette.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={tr.status === 'open' ? 'open-outline' : 'checkmark-done-outline'} size={16} color={tr.status === 'open' ? palette.gold : palette.sub} />
                      </View>
                      <View>
                        <Text style={{ color: palette.text, fontWeight: '800', fontSize: 14 }}>
                          {tr.symbol} · {t(`trade.${tr.side}`)}
                        </Text>
                        <Text style={{ color: palette.sub, fontSize: 11 }}>
                          {fmtDateTime(tr.openedAt, lang)} · {tr.mode === 'real' ? t('home.modeReal') : t('home.modePaper')}
                        </Text>
                      </View>
                    </View>
                    {tr.status === 'closed' && tr.pnlPct !== undefined ? (
                      <PnlText value={tr.pnlPct} />
                    ) : (
                      <TouchableOpacity onPress={() => void bot?.closeManually(tr.id)}>
                        <Text style={{ color: palette.red, fontWeight: '800', fontSize: 12 }}>{t('trade.sell')} ✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={{ color: palette.sub, fontSize: 11, marginTop: 6, textAlign: rtl ? 'right' : 'left' }}>
                    {t('trade.entry')}: {fmtPrice(tr.entryPrice, lang)} · {tr.reason?.slice(0, 80)}
                  </Text>
                </View>
              ))
            )}
          </Card>
        </View>

        {status?.lastError ? (
          <Card style={{ marginTop: 12, borderColor: palette.red + '66' }}>
            <Text style={{ color: palette.red, fontSize: 12 }}>{t('common.error')}: {status.lastError}</Text>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
