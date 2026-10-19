/**
 * Wallet — balances, ZarinPal deposit, card transfer settings, auto profit share, transactions.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, Alert, Linking, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../state/AppContext';
import { Card, PrimaryButton, GhostButton, TextInputGold, SectionTitle, Toggle, SettingRow, EmptyState, StatCard } from '../components/ui';
import { fetchPortfolio, PortfolioSummary } from '../services/portfolio';
import { zarinRequest, zarinVerify } from '../services/payments/zarinpal';
import { fmtNumber, fmtDateTime } from '../utils/format';

const CALLBACK_URL = 'https://ir-trading-an.local/zarinpal/callback';

export function WalletScreen() {
  const { palette } = useTheme();
  const { t, lang, rtl } = useI18n();
  const { exchanges, ledger, bot, refresh, settings, patchSettings, botConfig, patchBotConfig } = useApp();

  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loadingP, setLoadingP] = useState(false);
  const [amount, setAmount] = useState('500000');
  const [pendingAuthority, setPendingAuthority] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState(settings.cardNumber);
  const [sheba, setSheba] = useState(settings.sheba);

  const loadPortfolio = useCallback(async () => {
    setLoadingP(true);
    try {
      const ids = Object.entries(exchanges.enabled).filter(([, v]) => v).map(([k]) => k);
      setPortfolio(await fetchPortfolio(ids));
    } finally {
      setLoadingP(false);
    }
  }, [exchanges.enabled]);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  const pnl24 = bot?.getStatus().pnl24hTMN ?? 0;
  const deposits = ledger.filter((l) => l.type === 'deposit' && l.status === 'done').reduce((s, l) => s + l.amount, 0);
  const profitPaid = ledger.filter((l) => l.type === 'profit_share').reduce((s, l) => s + l.amount, 0);
  const total = Math.max(deposits, 0) + pnl24;

  const onDeposit = async () => {
    const amt = parseInt(amount.replace(/\D/g, ''), 10) || 0;
    if (amt < settings.minCapitalTMN) {
      Alert.alert(t('wallet.enterAmount'), t('wallet.minCapital'));
      return;
    }
    if (!settings.paymentEnabled) {
      Alert.alert(t('common.warning'), t('wallet.gatewayOff'));
      return;
    }
    if (!settings.zarinpalMerchantId) {
      Alert.alert(t('common.warning'), t('wallet.merchantMissing'));
      return;
    }
    setBusy(true);
    const res = await zarinRequest({
      merchantId: settings.zarinpalMerchantId,
      amountToman: amt,
      description: `${t('wallet.deposit')} — IR.TRADIng.AN`,
      callbackUrl: CALLBACK_URL,
    });
    setBusy(false);
    if (res.ok && res.startUrl) {
      setPendingAuthority(res.authority ?? null);
      bot?.recordDeposit(amt, 'pending zarinpal');
      Linking.openURL(res.startUrl);
    } else {
      Alert.alert(t('common.error'), res.message ?? t('zarin.requestFail'));
    }
  };

  const onVerify = async () => {
    if (!pendingAuthority) return;
    const amt = parseInt(amount.replace(/\D/g, ''), 10) || 0;
    setBusy(true);
    const res = await zarinVerify({ merchantId: settings.zarinpalMerchantId, amountToman: amt, authority: pendingAuthority });
    setBusy(false);
    if (res.ok) {
      Alert.alert(t('wallet.depositDone'), `Ref: ${res.refId ?? '—'}`);
      setPendingAuthority(null);
      refresh();
    } else {
      Alert.alert(t('wallet.depositFailed'), res.message ?? '');
    }
  };

  const onWithdrawNow = async () => {
    const amt = Math.max(0, pnl24);
    if (amt <= 0) {
      Alert.alert(t('common.warning'), t('wallet.enterAmount'));
      return;
    }
    if (!settings.cardNumber) {
      Alert.alert(t('common.warning'), t('wallet.cardNumber'));
      return;
    }
    const entry = bot?.recordWithdraw(amt, 'pending');
    // attempt via connected exchange (best effort; OTP may be required)
    Alert.alert(t('wallet.withdrawRequested'), t('wallet.withdrawManual'));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={loadingP} onRefresh={loadPortfolio} tintColor={palette.gold} />}
      >
        <Text style={{ color: palette.text, fontSize: 22, fontWeight: '900', paddingTop: 10 }}>{t('wallet.title')}</Text>

        {/* balances */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <StatCard label={t('wallet.balance')} value={`${fmtNumber(total, lang)} T`} accent="gold" />
          <StatCard label={t('home.pnl24h')} value={`${pnl24 >= 0 ? '+' : ''}${fmtNumber(pnl24, lang)} T`} accent={pnl24 >= 0 ? 'green' : 'red'} />
          <StatCard label={t('wallet.profitShare')} value={`${fmtNumber(profitPaid, lang)} T`} accent="green" />
        </View>

        {/* exchange balances */}
        {portfolio && portfolio.balances.length > 0 ? (
          <Card style={{ marginTop: 12 }}>
            <SectionTitle title={t('wallet.exBalances')} />
            {portfolio.balances.slice(0, 8).map((b) => (
              <View key={b.asset} style={{ flexDirection: rtl ? 'row-reverse' : 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text style={{ color: palette.text, fontWeight: '700' }}>{b.asset}</Text>
                <Text style={{ color: palette.sub }}>{fmtNumber(b.free, lang, b.free % 1 ? 4 : 0)}</Text>
              </View>
            ))}
            {portfolio.errors.map((e) => (
              <Text key={e} style={{ color: palette.red, fontSize: 11, marginTop: 4 }}>⚠ {e}</Text>
            ))}
          </Card>
        ) : null}

        {/* deposit */}
        <Card style={{ marginTop: 12 }}>
          <SectionTitle title={t('wallet.depositTitle')} />
          <SettingRow
            icon="globe"
            title={t('set.payment')}
            desc={t('set.paymentDesc')}
            right={<Toggle value={settings.paymentEnabled} onChange={(v) => patchSettings({ paymentEnabled: v })} />}
          />
          <TextInputGold value={amount} onChangeText={setAmount} placeholder={t('wallet.depositAmount')} keyboardType="number-pad" />
          <View style={{ height: 10 }} />
          <PrimaryButton label={t('wallet.payNow')} icon="card-outline" onPress={() => void onDeposit()} loading={busy} />
          {pendingAuthority ? (
            <View style={{ height: 10 }} />
          ) : null}
          {pendingAuthority ? <GhostButton label={t('wallet.checkPayment')} icon="refresh" onPress={() => void onVerify()} /> : null}
        </Card>

        {/* card + auto withdraw */}
        <Card style={{ marginTop: 12 }}>
          <SectionTitle title={t('wallet.autoWithdrawTitle')} />
          <Text style={{ color: palette.sub, fontSize: 12, marginBottom: 10, lineHeight: 19, textAlign: rtl ? 'right' : 'left' }}>{t('wallet.autoWithdrawDesc')}</Text>
          <SettingRow
            icon="card"
            title={t('bot.autoWithdraw')}
            desc={`${t('bot.profitSharePct')}: ${botConfig.profitSharePct}`}
            right={<Toggle value={botConfig.autoWithdraw} onChange={(v) => patchBotConfig({ autoWithdraw: v })} />}
          />
          <TextInputGold value={card} onChangeText={setCard} placeholder={t('wallet.cardNumber')} keyboardType="number-pad" />
          <View style={{ height: 10 }} />
          <TextInputGold value={sheba} onChangeText={setSheba} placeholder={t('wallet.sheba')} keyboardType="default" />
          <View style={{ height: 10 }} />
          <GhostButton
            label={t('common.save')}
            icon="save"
            onPress={() => {
              patchSettings({ cardNumber: card.trim(), sheba: sheba.trim() });
              Alert.alert(t('common.success'), t('common.done'));
            }}
          />
          <View style={{ height: 10 }} />
          <GhostButton label={t('wallet.withdrawNow')} icon="arrow-up-circle" onPress={() => void onWithdrawNow()} />
        </Card>

        {/* transactions */}
        <View style={{ marginTop: 14 }}>
          <SectionTitle title={t('wallet.transactions')} />
          <Card>
            {ledger.length === 0 ? (
              <EmptyState icon="receipt-outline" text={t('wallet.noTransactions')} />
            ) : (
              ledger.slice(0, 20).map((l) => (
                <View key={l.id} style={{ flexDirection: rtl ? 'row-reverse' : 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.border }}>
                  <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons
                      name={l.type === 'deposit' ? 'arrow-down-circle' : 'arrow-up-circle'}
                      size={18}
                      color={l.type === 'deposit' ? palette.green : palette.gold}
                    />
                    <View>
                      <Text style={{ color: palette.text, fontWeight: '700', fontSize: 13 }}>{t(`wallet.${l.type === 'profit_share' ? 'profitShare' : l.type}`)}</Text>
                      <Text style={{ color: palette.sub, fontSize: 10 }}>{fmtDateTime(l.ts, lang)}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: rtl ? 'flex-start' : 'flex-end' }}>
                    <Text style={{ color: palette.text, fontWeight: '800', fontSize: 13 }}>{fmtNumber(l.amount, lang)} T</Text>
                    <Text style={{ color: l.status === 'done' ? palette.green : l.status === 'failed' ? palette.red : palette.sub, fontSize: 10 }}>{l.status}</Text>
                  </View>
                </View>
              ))
            )}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
