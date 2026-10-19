/**
 * Exchanges screen — the tick-list of Iranian exchanges the bot may use.
 */
import React from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../state/AppContext';
import { EXCHANGES } from '../services/exchanges';
import { Card } from '../components/ui';

export function ExchangesScreen() {
  const { palette } = useTheme();
  const { t, rtl } = useI18n();
  const { exchanges, setExchangeEnabled } = useApp();
  const nav = useNavigation<any>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}>
        <Text style={{ color: palette.text, fontSize: 22, fontWeight: '900', paddingTop: 10 }}>{t('ex.title')}</Text>
        <Text style={{ color: palette.sub, fontSize: 13, marginTop: 4, marginBottom: 14, lineHeight: 19 }}>{t('ex.subtitle')}</Text>

        {EXCHANGES.map((ex, idx) => {
          const enabled = !!exchanges.enabled[ex.id];
          const connected = !!exchanges.connected[ex.id];
          return (
            <Card key={ex.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
                {/* checkbox */}
                <TouchableOpacity onPress={() => setExchangeEnabled(ex.id, !enabled)}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 9,
                      borderWidth: 2,
                      borderColor: enabled ? palette.gold : palette.border,
                      backgroundColor: enabled ? palette.gold : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {enabled ? <Ionicons name="checkmark" size={18} color={palette.onGold} /> : null}
                  </View>
                </TouchableOpacity>

                {/* monogram */}
                <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: ex.color + '22', borderWidth: 1, borderColor: ex.color + '55', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: ex.color, fontWeight: '900', fontSize: 17 }}>{ex.name.slice(0, 2).toUpperCase()}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: palette.text, fontWeight: '800', fontSize: 15 }}>{rtl ? ex.faName : ex.name}</Text>
                    {ex.experimental ? (
                      <View style={{ backgroundColor: palette.surfaceAlt, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: palette.sub, fontSize: 9, fontWeight: '700' }}>{t('ex.experimental')}</Text>
                      </View>
                    ) : (
                      <View style={{ backgroundColor: palette.green + '22', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: palette.green, fontSize: 9, fontWeight: '700' }}>{t('ex.supported')}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: palette.sub, fontSize: 11, marginTop: 2 }}>
                    {t('ex.priority')} {idx + 1} · {connected ? t('common.connected') : t('common.disconnected')}
                  </Text>
                </View>

                <TouchableOpacity onPress={() => nav.navigate('ExchangeDetail', { id: ex.id })}>
                  <Ionicons name="chevron-forward" size={20} color={palette.sub} style={rtl ? { transform: [{ scaleX: -1 }] } : undefined} />
                </TouchableOpacity>
              </View>
            </Card>
          );
        })}

        <Card style={{ marginTop: 6, borderColor: palette.gold + '55' }}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start' }}>
            <Ionicons name="lock-closed" size={18} color={palette.gold} />
            <Text style={{ color: palette.sub, fontSize: 12, lineHeight: 19, flex: 1, textAlign: rtl ? 'right' : 'left' }}>{t('ex.securityNote')}</Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
