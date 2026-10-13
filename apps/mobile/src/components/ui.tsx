import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parseAvatar } from '@app/shared';
import { useTheme } from '../lib/theme';

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const t = useTheme();
  const inner = <View style={{ padding: padded ? 16 : 0, gap: 14, paddingBottom: 40 }}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'left', 'right']}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{inner}</ScrollView> : <View style={{ flex: 1, padding: padded ? 16 : 0 }}>{children}</View>}
    </SafeAreaView>
  );
}

export function H1({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ fontSize: 26, fontWeight: '800', color: t.text }}>{children}</Text>;
}
export function H2({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ fontSize: 19, fontWeight: '700', color: t.text }}>{children}</Text>;
}
export function P({ children, muted, small, style }: { children: ReactNode; muted?: boolean; small?: boolean; style?: object }) {
  const t = useTheme();
  return <Text style={[{ color: muted ? t.textMuted : t.text, fontSize: small ? 13 : 15, lineHeight: small ? 19 : 22 }, style]}>{children}</Text>;
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const t = useTheme();
  const s = [{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 }, style];
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => [...s, pressed && { opacity: 0.8 }]} accessibilityRole="button">{children}</Pressable> : <View style={s}>{children}</View>;
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, testID, small }: { title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'; disabled?: boolean; loading?: boolean; testID?: string; small?: boolean }) {
  const t = useTheme();
  const bg = { primary: t.primary, secondary: t.surface, danger: t.danger, ghost: 'transparent', success: t.success }[variant];
  const fg = variant === 'secondary' ? t.text : variant === 'ghost' ? t.primary : '#fff';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderColor: variant === 'secondary' ? t.border : 'transparent',
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: small ? 8 : 13,
        paddingHorizontal: small ? 12 : 18,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        minHeight: small ? 36 : 48,
      })}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 14 : 16 }}>{title}</Text>}
    </Pressable>
  );
}

export function Chip({ label, on, onPress, disabled }: { label: string; on?: boolean; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: !!on, disabled: !!disabled }}
      style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: on ? t.primary : t.border, backgroundColor: on ? t.primarySoft : t.surface, opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ color: on ? t.primary : t.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Option({ label, selected, state, onPress, disabled }: { label: string; selected?: boolean; state?: 'correct' | 'wrong' | null; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  const border = state === 'correct' ? t.success : state === 'wrong' ? t.danger : selected ? t.primary : t.border;
  const bg = state === 'correct' ? t.successSoft : state === 'wrong' ? t.dangerSoft : selected ? t.primarySoft : t.surface;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="radio" accessibilityState={{ selected: !!selected }}
      style={{ borderWidth: 1, borderColor: border, backgroundColor: bg, borderRadius: 12, padding: 13 }}>
      <Text style={{ color: t.text, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {props.label && <Text style={{ color: t.text, fontWeight: '600' }}>{props.label}</Text>}
      <TextInput placeholderTextColor={t.textMuted} {...props} style={[{ borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 12, color: t.text, backgroundColor: t.surface, fontSize: 16 }, props.style]} />
    </View>
  );
}

export function Badge({ label, tone = 'default' }: { label: string; tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' }) {
  const t = useTheme();
  const map = { default: [t.surface2, t.textMuted], primary: [t.primarySoft, t.primary], success: [t.successSoft, t.success], warning: [t.warningSoft, t.warning], danger: [t.dangerSoft, t.danger] } as const;
  const [bg, fg] = map[tone];
  return <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}><Text style={{ color: fg, fontWeight: '700', fontSize: 12 }}>{label}</Text></View>;
}

export function Row({ children, gap = 10, wrap, between, style }: { children: ReactNode; gap?: number; wrap?: boolean; between?: boolean; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap', justifyContent: between ? 'space-between' : 'flex-start' }, style]}>{children}</View>;
}

export function Loading() {
  const t = useTheme();
  return <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator color={t.primary} /></View>;
}

export function ErrorText({ error }: { error?: string | null }) {
  const t = useTheme();
  if (!error) return null;
  return <View style={{ backgroundColor: t.dangerSoft, borderRadius: 10, padding: 12 }} accessibilityRole="alert"><Text style={{ color: t.danger }}>{error}</Text></View>;
}

export function Notice({ text, tone = 'info' }: { text: string; tone?: 'info' | 'success' | 'warning' }) {
  const t = useTheme();
  const bg = tone === 'success' ? t.successSoft : tone === 'warning' ? t.warningSoft : t.primarySoft;
  const fg = tone === 'success' ? t.success : tone === 'warning' ? t.warning : t.primary;
  return <View style={{ backgroundColor: bg, borderRadius: 10, padding: 12 }}><Text style={{ color: fg }}>{text}</Text></View>;
}

export function Empty({ icon = '📭', title, sub }: { icon?: string; title: string; sub?: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: 24, gap: 6 }}>
      <Text style={{ fontSize: 34 }}>{icon}</Text>
      <Text style={{ color: t.text, fontWeight: '700' }}>{title}</Text>
      {sub && <Text style={{ color: t.textMuted, textAlign: 'center' }}>{sub}</Text>}
    </View>
  );
}

export function Avatar({ avatar, size = 44 }: { avatar?: string | null; size?: number }) {
  const { emoji, color } = parseAvatar(avatar);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color, backgroundColor: color + '33', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
    </View>
  );
}

export function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const t = useTheme();
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return <View style={{ height: 8, backgroundColor: t.surface2, borderRadius: 99, overflow: 'hidden' }}><View style={{ width: `${pct}%`, height: '100%', backgroundColor: t.primary }} /></View>;
}

export function Disclaimer() {
  return <P small muted>Practice estimate only — not an official IELTS score.</P>;
}

export const styles = StyleSheet.create({ grow: { flex: 1 } });
