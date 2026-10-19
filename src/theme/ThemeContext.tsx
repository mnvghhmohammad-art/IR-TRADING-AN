import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Palette {
  bg: string;
  bgSoft: string;
  surface: string;
  surfaceAlt: string;
  card: string;
  border: string;
  text: string;
  sub: string;
  gold: string;
  goldSoft: string;
  goldDark: string;
  onGold: string;
  green: string;
  red: string;
  blue: string;
  chartGrid: string;
  overlay: string;
  isDark: boolean;
}

export const darkPalette: Palette = {
  bg: '#0A0A0C',
  bgSoft: '#121215',
  surface: '#16161A',
  surfaceAlt: '#1D1D22',
  card: '#17171B',
  border: '#2A2A31',
  text: '#F5F5F7',
  sub: '#9B9BA4',
  gold: '#E8B93E',
  goldSoft: '#FFE294',
  goldDark: '#A87C20',
  onGold: '#141414',
  green: '#22C55E',
  red: '#EF4444',
  blue: '#3B82F6',
  chartGrid: '#232329',
  overlay: 'rgba(0,0,0,0.55)',
  isDark: true,
};

export const lightPalette: Palette = {
  bg: '#F7F5EF',
  bgSoft: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F1EEE5',
  card: '#FFFFFF',
  border: '#E6E1D4',
  text: '#191A1F',
  sub: '#6C7078',
  gold: '#C0932B',
  goldSoft: '#E8C36A',
  goldDark: '#8F6C1C',
  onGold: '#FFFFFF',
  green: '#16A34A',
  red: '#DC2626',
  blue: '#2563EB',
  chartGrid: '#ECE8DC',
  overlay: 'rgba(20,20,20,0.45)',
  isDark: false,
};

export type ThemeModeResolved = 'dark' | 'light';

interface ThemeCtx {
  mode: ThemeModeResolved;
  palette: Palette;
  themeMode: 'dark' | 'light' | 'system';
  setThemeMode: (m: 'dark' | 'light' | 'system') => void;
}

const Ctx = createContext<ThemeCtx | null>(null);
const KEY = 'irtan.theme.mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<'dark' | 'light' | 'system'>('dark');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'dark' || v === 'light' || v === 'system') setThemeModeState(v);
      })
      .catch(() => undefined);
  }, []);

  const setThemeMode = useCallback((m: 'dark' | 'light' | 'system') => {
    setThemeModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => undefined);
  }, []);

  const mode: ThemeModeResolved = themeMode === 'system' ? (scheme === 'light' ? 'light' : 'dark') : themeMode;
  const palette = mode === 'dark' ? darkPalette : lightPalette;

  const value = useMemo(
    () => ({ mode, palette, themeMode, setThemeMode }),
    [mode, palette, themeMode, setThemeMode]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme must be used inside ThemeProvider');
  return v;
}
