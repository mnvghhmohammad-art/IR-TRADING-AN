import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language } from '../types';
import { Dict, translations } from './translations';

interface I18nCtx {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
  rtl: boolean;
}

const Ctx = createContext<I18nCtx | null>(null);
const KEY = 'irtan.lang';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('fa');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'fa' || v === 'en' || v === 'fr' || v === 'de') setLangState(v);
      })
      .catch(() => undefined);
  }, []);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    AsyncStorage.setItem(KEY, l).catch(() => undefined);
  }, []);

  const rtl = lang === 'fa';

  const t = useCallback(
    (key: string): string => {
      const dict: Dict | undefined = translations[lang];
      return (dict && dict[key]) || translations.en[key] || key;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t, rtl }), [lang, setLang, t, rtl]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used inside I18nProvider');
  return v;
}
