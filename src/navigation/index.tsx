/**
 * Navigation — bottom tabs (gold accent) + stack detail screens.
 */
import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { DashboardScreen } from '../screens/DashboardScreen';
import { BotScreen } from '../screens/BotScreen';
import { ExchangesScreen } from '../screens/ExchangesScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ExchangeDetailScreen } from '../screens/ExchangeDetailScreen';
import { LanguageScreen } from '../screens/LanguageScreen';
import { AuthenticatorScreen } from '../screens/AuthenticatorScreen';
import { PaymentSettingsScreen } from '../screens/PaymentSettingsScreen';

export type RootStackParamList = {
  Tabs: undefined;
  ExchangeDetail: { id: string } | undefined;
  Language: undefined;
  Authenticator: undefined;
  PaymentSettings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator();

function GoldLogo({ size = 20 }: { size?: number }) {
  return (
    <View style={{ width: size + 14, height: size + 14, borderRadius: (size + 14) * 0.34, backgroundColor: '#000', borderWidth: 1.5, borderColor: '#E8B93E', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#E8B93E', fontWeight: '900', fontSize: size * 0.55 }}>IT</Text>
    </View>
  );
}

function TabIcon({ routeName, color, focused }: { routeName: string; color: string; focused: boolean }) {
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    Home: focused ? 'home' : 'home-outline',
    Bot: focused ? 'flash' : 'flash-outline',
    Exchanges: focused ? 'business' : 'business-outline',
    Wallet: focused ? 'wallet' : 'wallet-outline',
    Settings: focused ? 'settings' : 'settings-outline',
  };
  return <Ionicons name={map[routeName] ?? 'ellipse'} size={22} color={color} />;
}

function MainTabs() {
  const { palette } = useTheme();
  const { t } = useI18n();

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.gold,
        tabBarInactiveTintColor: palette.sub,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 10.5, fontWeight: '700' }}>{t('tab.home')}</Text>,
          tabBarIcon: ({ color, focused }) => <TabIcon routeName="Home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="Bot"
        component={BotScreen}
        options={{
          tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 10.5, fontWeight: '700' }}>{t('tab.bot')}</Text>,
          tabBarIcon: ({ color, focused }) => <TabIcon routeName="Bot" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="Exchanges"
        component={ExchangesScreen}
        options={{
          tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 10.5, fontWeight: '700' }}>{t('tab.exchanges')}</Text>,
          tabBarIcon: ({ color, focused }) => <TabIcon routeName="Exchanges" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 10.5, fontWeight: '700' }}>{t('tab.wallet')}</Text>,
          tabBarIcon: ({ color, focused }) => <TabIcon routeName="Wallet" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 10.5, fontWeight: '700' }}>{t('tab.settings')}</Text>,
          tabBarIcon: ({ color, focused }) => <TabIcon routeName="Settings" color={color} focused={focused} />,
        }}
      />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const { palette, mode } = useTheme();
  const navTheme = {
    ...DefaultTheme,
    dark: mode === 'dark',
    colors: {
      ...DefaultTheme.colors,
      background: palette.bg,
      card: palette.surface,
      text: palette.text,
      border: palette.border,
      primary: palette.gold,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={MainTabs} />
        <Stack.Screen
          name="ExchangeDetail"
          component={ExchangeDetailScreen}
          options={{
            headerShown: true,
            headerTitle: () => <GoldLogo size={16} />,
            headerStyle: { backgroundColor: palette.bg },
            headerTintColor: palette.text,
          }}
        />
        <Stack.Screen
          name="Language"
          component={LanguageScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="Authenticator"
          component={AuthenticatorScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="PaymentSettings"
          component={PaymentSettingsScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
