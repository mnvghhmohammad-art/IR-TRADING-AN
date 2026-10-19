/**
 * IR.TRADIng.AN — root component.
 * Providers: Theme (dark/light) → I18n (fa/en/fr/de) → App state → LockGate → Navigation
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { I18nProvider, useI18n } from './src/i18n/I18nContext';
import { AppProvider, useApp } from './src/state/AppContext';
import { AppNavigator } from './src/navigation';
import { LockScreen } from './src/screens/LockScreen';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Boot() {
  const { palette } = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: '#000', borderWidth: 2, borderColor: palette.gold, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: palette.gold, fontWeight: '900', fontSize: 30 }}>IT</Text>
      </View>
      <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>IR.TRADIng.AN</Text>
      <Text style={{ color: palette.sub, fontSize: 12 }}>{t('common.loading')}</Text>
      <ActivityIndicator color={palette.gold} />
    </View>
  );
}

function Shell() {
  const { palette } = useTheme();
  const { settings, ready } = useApp();
  const [locked, setLocked] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Cold start: decide lock state once data is loaded
  useEffect(() => {
    if (ready) {
      setMounted(true);
      setLocked(!!settings.twoFAEnabled);
      SplashScreen.hideAsync().catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // If the user turns 2FA off, drop the lock for this session
  useEffect(() => {
    if (!settings.twoFAEnabled) setLocked(false);
  }, [settings.twoFAEnabled]);

  const unlock = useCallback(() => setLocked(false), []);

  if (!ready || !mounted) return <Boot />;
  if (locked && settings.twoFAEnabled) return <LockScreen onUnlock={unlock} />;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <StatusBar style={palette.isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AppProvider>
          <Shell />
        </AppProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
