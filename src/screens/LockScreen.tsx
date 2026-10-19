/**
 * Lock screen — shown at startup when 2FA is ON.
 * Requires the saved PIN and/or the Google Authenticator code.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { PrimaryButton } from '../components/ui';
import { secureGet, SEC_KEYS } from '../storage/secure';
import { sha256Hex, verifyTotp } from '../utils/totp';

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { palette } = useTheme();
  const { t } = useI18n();
  const [pin, setPin] = useState('');
  const [code, setCode] = useState('');
  const [needPin, setNeedPin] = useState(false);
  const [needTotp, setNeedTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const pinHash = await secureGet(SEC_KEYS.pinHash);
      const secret = await secureGet(SEC_KEYS.totpSecret);
      setNeedPin(!!pinHash);
      setNeedTotp(!!secret);
      if (!pinHash && !secret) onUnlock();
    })();
  }, [onUnlock]);

  const tryUnlock = async () => {
    setBusy(true);
    setError(null);
    try {
      if (needPin) {
        const stored = await secureGet(SEC_KEYS.pinHash);
        const hash = await sha256Hex(pin);
        if (!stored || stored !== hash) {
          setError(t('auth.wrongPin'));
          setBusy(false);
          return;
        }
      }
      if (needTotp) {
        const secret = await secureGet(SEC_KEYS.totpSecret);
        const ok = secret ? await verifyTotp(secret, code) : false;
        if (!ok) {
          setError(t('auth.totpBad'));
          setBusy(false);
          return;
        }
      }
      onUnlock();
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={['#0A0A0C', '#16161A']} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: '#000', borderWidth: 2, borderColor: palette.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
          <Text style={{ color: palette.gold, fontWeight: '900', fontSize: 30 }}>IT</Text>
        </View>
        <Text style={{ color: '#F5F5F7', fontSize: 20, fontWeight: '900' }}>IR.TRADIng.AN</Text>
        <Text style={{ color: '#9B9BA4', fontSize: 13, marginTop: 6, marginBottom: 26 }}>{t('auth.title')}</Text>

        {needPin ? (
          <TextInput
            value={pin}
            onChangeText={setPin}
            placeholder={t('auth.enterPin')}
            placeholderTextColor="#6B6F76"
            secureTextEntry
            keyboardType="number-pad"
            maxLength={8}
            style={{
              width: '100%',
              backgroundColor: '#1D1D22',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#2A2A31',
              color: '#F5F5F7',
              paddingHorizontal: 16,
              paddingVertical: 13,
              fontSize: 16,
              textAlign: 'center',
              marginBottom: 12,
            }}
          />
        ) : null}

        {needTotp ? (
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder={t('auth.totpVerify')}
            placeholderTextColor="#6B6F76"
            keyboardType="number-pad"
            maxLength={6}
            style={{
              width: '100%',
              backgroundColor: '#1D1D22',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#2A2A31',
              color: '#F5F5F7',
              paddingHorizontal: 16,
              paddingVertical: 13,
              fontSize: 16,
              textAlign: 'center',
              letterSpacing: 6,
              marginBottom: 12,
            }}
          />
        ) : null}

        {error ? <Text style={{ color: palette.red, fontSize: 13, marginBottom: 10 }}>{error}</Text> : null}

        <View style={{ width: '100%' }}>
          <PrimaryButton label={t('auth.unlock')} icon="lock-open" onPress={() => void tryUnlock()} loading={busy} />
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
