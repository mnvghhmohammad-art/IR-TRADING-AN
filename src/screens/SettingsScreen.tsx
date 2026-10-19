/**
 * Settings — language, theme, notifications, payment, 2FA, real trading, about.
 */
import React, { useState } from 'react';
import { ScrollView, View, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../state/AppContext';
import { Card, SectionTitle, Toggle, SettingRow, Chip } from '../components/ui';
import { LANGUAGES } from '../i18n/translations';
import { ThemeMode } from '../types';

export function SettingsScreen() {
  const { palette, themeMode, setThemeMode, mode } = useTheme();
  const { t, lang } = useI18n();
  const { settings, patchSettings } = useApp();
  const nav = useNavigation<any>();
  const [realBusy, setRealBusy] = useState(false);

  const confirmReal = (on: boolean) => {
    if (!on) {
      patchSettings({ realTradingConfirmed: false });
      return;
    }
    Alert.alert(t('set.realConfirmTitle'), t('set.realConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.yes'), style: 'destructive', onPress: () => patchSettings({ realTradingConfirmed: true }) },
    ]);
  };

  const currentLang = LANGUAGES.find((l) => l.code === lang);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}>
        <Text style={{ color: palette.text, fontSize: 22, fontWeight: '900', paddingTop: 10 }}>{t('set.title')}</Text>

        {/* general */}
        <Card style={{ marginTop: 14 }}>
          <SectionTitle title={t('set.general')} />
          <SettingRow icon="language" title={t('set.language')} desc={currentLang ? `${currentLang.flag} ${currentLang.native}` : undefined} onPress={() => nav.navigate('Language')} right={<Ionicons name="chevron-forward" size={18} color={palette.sub} />} />
          <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 8 }}>
            {(['dark', 'light', 'system'] as ThemeMode[]).map((m) => (
              <Chip key={m} label={t(`set.${m}`)} active={themeMode === m} onPress={() => setThemeMode(m)} />
            ))}
          </View>
        </Card>

        {/* security */}
        <Card style={{ marginTop: 12 }}>
          <SectionTitle title={t('set.security')} />
          <SettingRow
            icon="notifications"
            title={t('set.notifications')}
            desc={t('set.notificationsDesc')}
            right={<Toggle value={settings.notificationsEnabled} onChange={(v) => patchSettings({ notificationsEnabled: v })} />}
          />
          <SettingRow
            icon="shield-checkmark"
            title={t('set.twoFA')}
            desc={t('set.twoFADesc')}
            onPress={() => nav.navigate('Authenticator')}
            right={<Ionicons name="chevron-forward" size={18} color={palette.sub} />}
          />
        </Card>

        {/* trading */}
        <Card style={{ marginTop: 12 }}>
          <SectionTitle title={t('set.trading')} />
          <SettingRow
            icon="trending-up"
            title={t('set.realTrading')}
            desc={t('set.realTradingDesc')}
            right={<Toggle value={settings.realTradingConfirmed} onChange={confirmReal} />}
          />
          <SettingRow
            icon="card"
            title={t('set.payment')}
            desc={t('set.paymentDesc')}
            right={<Toggle value={settings.paymentEnabled} onChange={(v) => patchSettings({ paymentEnabled: v })} />}
          />
          <SettingRow
            icon="key"
            title={t('set.merchantId')}
            desc={settings.zarinpalMerchantId ? '••••' + settings.zarinpalMerchantId.slice(-4) : t('wallet.merchantMissing')}
            onPress={() => nav.navigate('PaymentSettings')}
            right={<Ionicons name="chevron-forward" size={18} color={palette.sub} />}
          />
        </Card>

        {/* about */}
        <Card style={{ marginTop: 12 }}>
          <SectionTitle title={t('set.about')} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={{ color: palette.sub, fontSize: 13 }}>{t('set.version')}</Text>
            <Text style={{ color: palette.text, fontWeight: '700', fontSize: 13 }}>1.0.0</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={{ color: palette.sub, fontSize: 13 }}>{t('set.theme')}</Text>
            <Text style={{ color: palette.text, fontWeight: '700', fontSize: 13 }}>{t(`set.${mode}`)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={{ color: palette.sub, fontSize: 13 }}>{t('set.minCapital')}</Text>
            <Text style={{ color: palette.text, fontWeight: '700', fontSize: 13 }}>1$ / 50,000 T</Text>
          </View>
          <Text style={{ color: palette.sub, fontSize: 11, marginTop: 10, lineHeight: 18 }}>{t('set.riskWarning')}</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
