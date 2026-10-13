import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';

export function Screen({ children, scroll = true, onRefresh, refreshing }: { children: ReactNode; scroll?: boolean; onRefresh?: () => void; refreshing?: boolean }) {
  const t = useTheme();
  const inner = <View style={{ padding: 16, gap: 14 }}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['left', 'right', 'bottom']}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} /> : undefined}>{inner}</ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function H1({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ fontSize: 26, fontWeight: '800', color: t.text }}>{children}</Text>;
}
export function H2({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ fontSize: 18, fontWeight: '700', color: t.text }}>{children}</Text>;
}
export function P({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  const t = useTheme();
  return <Text style={[{ fontSize: 15, lineHeight: 22, color: muted ? t.muted : t.text }, style]}>{children}</Text>;
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const t = useTheme();
  const s = [{ backgroundColor: t.card, borderColor: t.border, borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: 16, padding: 16, gap: 8 }, style];
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [...s, { opacity: pressed ? 0.85 : 1 }]} accessibilityRole="button">
      {children}
    </Pressable>
  ) : (
    <View style={s}>{children}</View>
  );
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, small }: { title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'; loading?: boolean; disabled?: boolean; small?: boolean }) {
  const t = useTheme();
  const bg = { primary: t.brand, secondary: t.card, danger: t.danger, success: t.success, ghost: 'transparent' }[variant];
  const fg = variant === 'secondary' || variant === 'ghost' ? t.text : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({ backgroundColor: bg, borderRadius: 12, paddingVertical: small ? 8 : 13, paddingHorizontal: small ? 12 : 18, alignItems: 'center', justifyContent: 'center', borderWidth: variant === 'secondary' ? 1 : 0, borderColor: t.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, flexDirection: 'row', gap: 8 })}
    >
      {loading && <ActivityIndicator color={fg} size="small" />}
      <Text style={{ color: fg, fontWeight: '600', fontSize: small ? 14 : 16 }}>{title}</Text>
    </Pressable>
  );
}

export function Input({ label, error, ...rest }: TextInputProps & { label: string; error?: string | null }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>
      <TextInput placeholderTextColor={t.muted} accessibilityLabel={label} style={{ borderWidth: 1, borderColor: error ? t.danger : t.border, borderRadius: 12, padding: 12, fontSize: 16, color: t.text, backgroundColor: t.inputBg }} {...rest} />
      {error ? <Text style={{ color: t.danger, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}

export function Badge({ text, tone = 'brand' }: { text: string; tone?: 'brand' | 'green' | 'amber' | 'red' | 'slate' }) {
  const t = useTheme();
  const color = { brand: t.brand, green: t.success, amber: t.warning, red: t.danger, slate: t.muted }[tone];
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: color + '22' }}>
      <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

export function Notice({ text, tone = 'info' }: { text: string; tone?: 'info' | 'error' | 'success' | 'warning' }) {
  const t = useTheme();
  const color = { info: t.brand, error: t.danger, success: t.success, warning: t.warning }[tone];
  return (
    <View style={{ borderRadius: 12, padding: 12, backgroundColor: color + '18', borderColor: color + '55', borderWidth: 1 }} accessibilityRole={tone === 'error' ? 'alert' : undefined}>
      <Text style={{ color: t.text, fontSize: 14, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={{ padding: 40, alignItems: 'center', gap: 10 }}>
      <ActivityIndicator color={t.brand} />
      <Text style={{ color: t.muted }}>{label}</Text>
    </View>
  );
}

export function Empty({ title, text }: { title: string; text?: string }) {
  const t = useTheme();
  return (
    <View style={{ padding: 24, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: t.border, borderRadius: 16, gap: 4 }}>
      <Text style={{ color: t.text, fontWeight: '700' }}>{title}</Text>
      {text ? <Text style={{ color: t.muted, textAlign: 'center' }}>{text}</Text> : null}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={{ borderWidth: 1, borderColor: selected ? t.brand : t.border, backgroundColor: selected ? t.brandSoft : t.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
      <Text style={{ color: t.text, fontWeight: selected ? '700' : '400' }}>{label}</Text>
    </Pressable>
  );
}

export function Progress({ value, max }: { value: number; max: number }) {
  const t = useTheme();
  const p = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: t.border, overflow: 'hidden' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}>
      <View style={{ height: 8, width: `${p * 100}%`, backgroundColor: t.brand }} />
    </View>
  );
}
