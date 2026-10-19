/**
 * Payment settings — ZarinPal merchant ID.
 */
import React, { useState } from 'react';
import { ScrollView, View, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../state/AppContext';
import { Card, PrimaryButton, TextInputGold, SectionTitle, Toggle } from '../components/ui';

export function PaymentSettingsScreen() {
  const { palette } = useTheme();
  const { t, rtl } = useI18n();
  const { settings, patchSettings } = useApp();
  const nav = useNavigation<any>();
  const [merchant, setMerchant] = useState(settings.zarinpalMerchantId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}>
        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, paddingTop: 10 }}>
          <Ionicons name="chevron-back" size={22} color={palette.gold} onPress={() => nav.goBack()} />
          <Text style={{ color: palette.text, fontSize: 22, fontWeight: '900' }}>{t('set.payment')}</Text>
        </View>

        <Card style={{ marginTop: 14 }}>
          <SectionTitle title={t('set.payment')} />
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: palette.sub, fontSize: 13, flex: 1, textAlign: rtl ? 'right' : 'left' }}>{t('set.paymentDesc')}</Text>
            <Toggle value={settings.paymentEnabled} onChange={(v) => patchSettings({ paymentEnabled: v })} />
          </View>
          <TextInputGold value={merchant} onChangeText={setMerchant} placeholder={t('set.merchantId')} />
          <View style={{ height: 12 }} />
          <PrimaryButton
            label={t('common.save')}
            icon="save"
            onPress={() => {
              patchSettings({ zarinpalMerchantId: merchant.trim() });
              Alert.alert(t('common.success'), t('common.done'));
              nav.goBack();
            }}
          />
        </Card>

        <Card style={{ marginTop: 12, borderColor: palette.gold + '55' }}>
          <Text style={{ color: palette.sub, fontSize: 12.5, lineHeight: 20, textAlign: rtl ? 'right' : 'left' }}>
            {rtl
              ? 'مرچنت‌کد را از پنل زرین‌پال (zarinpal.com) دریافت کن. برای تست می‌توانی از حالت Sandbox استفاده کنی. درگاه فقط برای واریز استفاده می‌شود و با سوییچ بالا می‌توانی کل قابلیت را خاموش کنی.'
              : 'Get your merchant ID from the ZarinPal panel (zarinpal.com). Use Sandbox for testing. The gateway is only used for deposits and can be switched off any time.'}
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
