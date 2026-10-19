/**
 * Exchange detail — API key entry, test connection, link to key page.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../state/AppContext';
import { getExchange, getCreds, testCreds, saveCreds, deleteCreds } from '../services/exchanges';
import { Card, PrimaryButton, GhostButton, TextInputGold, SectionTitle, Toggle } from '../components/ui';

export function ExchangeDetailScreen() {
  const { palette } = useTheme();
  const { t, rtl } = useI18n();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { exchanges, setExchangeEnabled, setExchangeConnected } = useApp();
  const ex = getExchange(route.params?.id ?? 'nobitex');

  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!ex) return;
    getCreds(ex.id).then((c) => {
      if (c) {
        setApiKey(c.apiKey);
        setApiSecret(c.apiSecret ?? '');
        setHasKey(true);
      }
    });
  }, [ex]);

  if (!ex) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: palette.text }}>404</Text>
      </SafeAreaView>
    );
  }

  const onSave = async () => {
    if (!apiKey.trim()) return;
    setBusy(true);
    setResult(null);
    await saveCreds(ex.id, { apiKey: apiKey.trim(), apiSecret: apiSecret.trim() || undefined });
    setHasKey(true);
    setBusy(false);
    setResult(t('ex.keysSaved'));
  };

  const onTest = async () => {
    setBusy(true);
    setResult(null);
    const c = await getCreds(ex.id);
    if (!c) {
      setResult(t('ex.notConnectedHint'));
      setBusy(false);
      return;
    }
    const res = await testCreds(ex.id, c);
    setExchangeConnected(ex.id, res.ok);
    setResult(res.ok ? t('ex.testOk') : `${t('ex.testFail')} — ${res.message ?? ''}`);
    setBusy(false);
  };

  const enabled = !!exchanges.enabled[ex.id];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}>
        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, paddingTop: 10, paddingBottom: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 17, backgroundColor: ex.color + '22', borderWidth: 1, borderColor: ex.color + '55', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: ex.color, fontWeight: '900', fontSize: 18 }}>{ex.name.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.text, fontSize: 20, fontWeight: '900' }}>{rtl ? ex.faName : ex.name}</Text>
            <Text style={{ color: palette.sub, fontSize: 12 }}>{hasKey ? t('common.connected') : t('ex.notConnectedHint')}</Text>
          </View>
        </View>

        <Card>
          <SectionTitle title={t('ex.enable')} />
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: palette.sub, fontSize: 13, flex: 1, textAlign: rtl ? 'right' : 'left' }}>{t('ex.subtitle')}</Text>
            <Toggle value={enabled} onChange={(v) => setExchangeEnabled(ex.id, v)} />
          </View>
        </Card>

        <Card style={{ marginTop: 12 }}>
          <SectionTitle title={t('ex.apiKey')} />
          <TextInputGold value={apiKey} onChangeText={setApiKey} placeholder={t('ex.apiKey')} secure />
          <View style={{ height: 10 }} />
          <TextInputGold value={apiSecret} onChangeText={setApiSecret} placeholder={t('ex.apiSecret')} secure />
          <View style={{ height: 14 }} />
          <PrimaryButton label={t('ex.saveKeys')} icon="save" onPress={() => void onSave()} loading={busy} />
          <View style={{ height: 10 }} />
          <GhostButton label={t('ex.testConnection')} icon="pulse" onPress={() => void onTest()} />
          {result ? (
            <Text style={{ color: result.includes('✓') ? palette.green : palette.sub, fontSize: 12, marginTop: 10, textAlign: rtl ? 'right' : 'left' }}>{result}</Text>
          ) : null}
        </Card>

        <Card style={{ marginTop: 12 }}>
          <SectionTitle title={t('ex.getApiKey')} />
          <Text style={{ color: palette.sub, fontSize: 12.5, lineHeight: 20, textAlign: rtl ? 'right' : 'left' }}>{t('ex.securityNote')}</Text>
          {ex.apiKeysUrl ? (
            <View style={{ height: 14 }} />
          ) : null}
          {ex.apiKeysUrl ? (
            <GhostButton label={t('ex.webProfile')} icon="open-outline" onPress={() => void Linking.openURL(ex.apiKeysUrl!)} />
          ) : null}
        </Card>

        {hasKey ? (
          <View style={{ marginTop: 12 }}>
            <GhostButton
              label={t('common.delete') + ' ' + t('ex.apiKey')}
              icon="trash"
              onPress={() => {
                void deleteCreds(ex.id).then(() => {
                  setApiKey('');
                  setApiSecret('');
                  setHasKey(false);
                  setExchangeConnected(ex.id, false);
                });
              }}
            />
          </View>
        ) : null}

        {busy ? <ActivityIndicator color={palette.gold} style={{ marginTop: 14 }} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
