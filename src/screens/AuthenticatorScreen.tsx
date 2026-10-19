/**
 * Authenticator / 2FA screen — app lock master switch (ON/OFF),
 * PIN setup and optional Google Authenticator (TOTP) pairing.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../state/AppContext';
import { Card, PrimaryButton, GhostButton, TextInputGold, SectionTitle, Toggle } from '../components/ui';
import { secureGet, secureSet, secureDelete, SEC_KEYS } from '../storage/secure';
import { randomTotpSecret, verifyTotp, sha256Hex } from '../utils/totp';

export function AuthenticatorScreen() {
  const { palette } = useTheme();
  const { t, rtl } = useI18n();
  const { settings, patchSettings } = useApp();

  const [hasPin, setHasPin] = useState(false);
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const pinHash = await secureGet(SEC_KEYS.pinHash);
      setHasPin(!!pinHash);
      const secret = await secureGet(SEC_KEYS.totpSecret);
      if (secret) {
        setTotpSecret(secret);
        setTotpEnabled(true);
      }
    })();
  }, []);

  const savePin = async () => {
    if (pin1.length < 4) {
      Alert.alert(t('common.error'), t('auth.pinMin'));
      return;
    }
    if (pin1 !== pin2) {
      Alert.alert(t('common.error'), t('auth.pinMismatch'));
      return;
    }
    setBusy(true);
    await secureSet(SEC_KEYS.pinHash, await sha256Hex(pin1));
    setBusy(false);
    setHasPin(true);
    setPin1('');
    setPin2('');
    Alert.alert(t('common.success'), t('auth.pinSaved'));
  };

  const setupTotp = () => {
    setTotpSecret(randomTotpSecret());
    setTotpEnabled(false);
  };

  const verifyTotpCode = async () => {
    if (!totpSecret) return;
    setBusy(true);
    const ok = await verifyTotp(totpSecret, code);
    setBusy(false);
    if (ok) {
      await secureSet(SEC_KEYS.totpSecret, totpSecret);
      setTotpEnabled(true);
      Alert.alert(t('common.success'), t('auth.totpOk'));
    } else {
      Alert.alert(t('common.error'), t('auth.totpBad'));
    }
  };

  const disableAll = async () => {
    await secureDelete(SEC_KEYS.totpSecret);
    setTotpSecret(null);
    setTotpEnabled(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}>
        <Text style={{ color: palette.text, fontSize: 22, fontWeight: '900', paddingTop: 10 }}>{t('auth.title')}</Text>

        {/* master switch */}
        <Card style={{ marginTop: 14 }}>
          <SectionTitle title={t('auth.master')} />
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: settings.twoFAEnabled ? palette.green + '22' : palette.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={settings.twoFAEnabled ? 'shield-checkmark' : 'shield-outline'} size={22} color={settings.twoFAEnabled ? palette.green : palette.sub} />
              </View>
              <Text style={{ color: palette.sub, fontSize: 12.5, flex: 1, textAlign: rtl ? 'right' : 'left' }}>{t('auth.masterDesc')}</Text>
            </View>
            <Toggle value={settings.twoFAEnabled} onChange={(v) => patchSettings({ twoFAEnabled: v })} />
          </View>
        </Card>

        {/* PIN */}
        <Card style={{ marginTop: 12 }}>
          <SectionTitle title={t('auth.pinSetup')} />
          {hasPin ? (
            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="checkmark-circle" size={22} color={palette.green} />
              <Text style={{ color: palette.text, fontWeight: '700' }}>{t('common.active')} ✓</Text>
              <View style={{ flex: 1 }} />
              <GhostButton
                label={t('common.delete')}
                icon="trash"
                onPress={() =>
                  void secureDelete(SEC_KEYS.pinHash).then(() => {
                    setHasPin(false);
                  })
                }
              />
            </View>
          ) : (
            <>
              <TextInputGold value={pin1} onChangeText={setPin1} placeholder={t('auth.enterPin')} secure keyboardType="number-pad" />
              <View style={{ height: 10 }} />
              <TextInputGold value={pin2} onChangeText={setPin2} placeholder={t('auth.confirmPin')} secure keyboardType="number-pad" />
              <View style={{ height: 12 }} />
              <PrimaryButton label={t('common.save')} icon="save" onPress={() => void savePin()} loading={busy} />
            </>
          )}
        </Card>

        {/* TOTP */}
        <Card style={{ marginTop: 12 }}>
          <SectionTitle title={t('auth.totpSetup')} />
          {totpEnabled ? (
            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="checkmark-circle" size={22} color={palette.green} />
              <Text style={{ color: palette.text, fontWeight: '700' }}>{t('auth.totpEnabled')}</Text>
            </View>
          ) : totpSecret ? (
            <>
              <Text style={{ color: palette.sub, fontSize: 12.5, lineHeight: 19, textAlign: rtl ? 'right' : 'left' }}>{t('auth.totpDesc')}</Text>
              <View style={{ backgroundColor: palette.surfaceAlt, borderRadius: 13, padding: 14, marginTop: 10, alignItems: 'center' }}>
                <Text selectable style={{ color: palette.gold, fontWeight: '900', fontSize: 18, letterSpacing: 3 }}>{totpSecret}</Text>
              </View>
              <View style={{ height: 12 }} />
              <TextInputGold value={code} onChangeText={setCode} placeholder={t('auth.totpVerify')} keyboardType="number-pad" />
              <View style={{ height: 12 }} />
              <PrimaryButton label={t('common.confirm')} icon="checkmark" onPress={() => void verifyTotpCode()} loading={busy} />
            </>
          ) : (
            <GhostButton label={t('auth.totpSetup') + ` (${t('auth.optional')})`} icon="key" onPress={setupTotp} />
          )}
          {totpSecret && !totpEnabled ? (
            <View style={{ height: 10 }} />
          ) : null}
          {totpSecret && !totpEnabled ? <GhostButton label={t('common.cancel')} icon="close" onPress={() => void disableAll()} /> : null}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
