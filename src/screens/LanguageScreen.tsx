/**
 * Language screen — fa / en / fr / de.
 */
import React from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../state/AppContext';
import { Card } from '../components/ui';
import { LANGUAGES } from '../i18n/translations';

export function LanguageScreen() {
  const { palette } = useTheme();
  const { t, lang } = useI18n();
  const { patchSettings } = useApp();
  const nav = useNavigation<any>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16 }}>
        <TouchableOpacity onPress={() => nav.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10 }}>
          <Ionicons name="chevron-back" size={22} color={palette.gold} />
          <Text style={{ color: palette.gold, fontWeight: '700', fontSize: 15 }}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={{ color: palette.text, fontSize: 22, fontWeight: '900', paddingTop: 14, paddingBottom: 14 }}>{t('set.language')}</Text>

        {LANGUAGES.map((l) => {
          const active = l.code === lang;
          return (
            <Card
              key={l.code}
              style={{
                marginBottom: 10,
                borderColor: active ? palette.gold : palette.border,
                borderWidth: active ? 1.5 : 1,
              }}
            >
              <TouchableOpacity onPress={() => { patchSettings({ language: l.code }); nav.goBack(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 26 }}>{l.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontWeight: '800', fontSize: 16 }}>{l.native}</Text>
                  <Text style={{ color: palette.sub, fontSize: 12 }}>{l.label}</Text>
                </View>
                {active ? <Ionicons name="checkmark-circle" size={24} color={palette.gold} /> : null}
              </TouchableOpacity>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
