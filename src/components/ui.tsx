/**
 * Shared UI components — rounded, medium-sized, gold-accented.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { palette } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: palette.card,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: palette.border,
          padding: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  const { palette } = useTheme();
  const { rtl } = useI18n();
  return (
    <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <Text style={{ color: palette.text, fontSize: 16, fontWeight: '800' }}>{title}</Text>
      {action}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  danger,
  icon,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  danger?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { palette } = useTheme();
  const { rtl } = useI18n();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <LinearGradient
        colors={danger ? ['#EF4444', '#B91C1C'] : [palette.gold, palette.goldDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 14, paddingVertical: 13, alignItems: 'center', flexDirection: rtl ? 'row-reverse' : 'row', justifyContent: 'center', gap: 8 }}
      >
        {loading ? (
          <ActivityIndicator color={danger ? '#fff' : palette.onGold} />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={18} color={danger ? '#fff' : palette.onGold} /> : null}
            <Text style={{ color: danger ? '#fff' : palette.onGold, fontWeight: '800', fontSize: 15 }}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function GhostButton({
  label,
  onPress,
  icon,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { palette } = useTheme();
  const { rtl } = useI18n();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: 'center',
        flexDirection: rtl ? 'row-reverse' : 'row',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceAlt,
      }}
    >
      {icon ? <Ionicons name={icon} size={17} color={palette.gold} /> : null}
      <Text style={{ color: palette.text, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { palette } = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: palette.surfaceAlt, true: palette.gold }}
      thumbColor={value ? palette.onGold : palette.sub}
      ios_backgroundColor={palette.surfaceAlt}
    />
  );
}

export function SettingRow({
  icon,
  title,
  desc,
  right,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const { palette } = useTheme();
  const { rtl } = useI18n();
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.8 : 1}
      onPress={onPress}
      disabled={!onPress}
      style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}
    >
      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: palette.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color={palette.gold} />
      </View>
      <View style={{ flex: 1, alignItems: rtl ? 'flex-end' : 'flex-start' }}>
        <Text style={{ color: palette.text, fontWeight: '700', fontSize: 15 }}>{title}</Text>
        {desc ? (
          <Text style={{ color: palette.sub, fontSize: 12, marginTop: 2, textAlign: rtl ? 'right' : 'left' }}>{desc}</Text>
        ) : null}
      </View>
      {right}
    </TouchableOpacity>
  );
}

export function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: 'green' | 'red' | 'gold' }) {
  const { palette } = useTheme();
  const color = accent === 'green' ? palette.green : accent === 'red' ? palette.red : accent === 'gold' ? palette.gold : palette.text;
  return (
    <Card style={{ flex: 1, padding: 14 }}>
      <Text style={{ color: palette.sub, fontSize: 12 }}>{label}</Text>
      <Text style={{ color, fontSize: 17, fontWeight: '800', marginTop: 6 }}>{value}</Text>
      {sub ? <Text style={{ color: palette.sub, fontSize: 11, marginTop: 3 }}>{sub}</Text> : null}
    </Card>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const { palette } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: active ? palette.gold : palette.border,
        backgroundColor: active ? palette.gold + '22' : palette.surfaceAlt,
      }}
    >
      <Text style={{ color: active ? palette.gold : palette.sub, fontWeight: '700', fontSize: 12 }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function TextInputGold({
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  multiline,
  style,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'number-pad' | 'decimal-pad';
  multiline?: boolean;
  style?: TextStyle;
}) {
  const { palette } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={palette.sub}
      secureTextEntry={secure}
      keyboardType={keyboardType}
      multiline={multiline}
      textAlign={undefined}
      style={[
        {
          backgroundColor: palette.surfaceAlt,
          borderColor: palette.border,
          borderWidth: 1,
          borderRadius: 13,
          paddingHorizontal: 14,
          paddingVertical: 11,
          color: palette.text,
          fontSize: 14,
        },
        style,
      ]}
    />
  );
}

/** Rounded icon badge with a letter monogram (for exchanges etc.) */
export function MonogramBadge({ letter, color, size = 46 }: { letter: string; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: color + '26',
        borderWidth: 1,
        borderColor: color + '66',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color, fontWeight: '900', fontSize: size * 0.42 }}>{letter}</Text>
    </View>
  );
}

export function EmptyState({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { palette } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 22, gap: 10 }}>
      <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: palette.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={24} color={palette.sub} />
      </View>
      <Text style={{ color: palette.sub, fontSize: 13 }}>{text}</Text>
    </View>
  );
}

export function PnlText({ value, suffix }: { value: number; suffix?: string }) {
  const { palette } = useTheme();
  const sign = value > 0 ? '+' : '';
  return <Text style={{ color: value >= 0 ? palette.green : palette.red, fontWeight: '800' }}>{sign}{value.toFixed(2)}{suffix ?? '%'}</Text>;
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
