import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { levelColors, levelNames, type Palette, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';

import { Icon, type IconName } from './icon';
import { Text } from './text';

export function Badge({ label, tone = 'primary', icon }: { label: string; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted'; icon?: IconName }) {
  const { colors } = useTheme();
  const map: Record<string, [string, keyof Palette]> = {
    primary: [colors.primarySoft, 'primary'], success: [colors.successSoft, 'success'], warning: [colors.warningSoft, 'warning'],
    danger: [colors.dangerSoft, 'danger'], info: [colors.infoSoft, 'info'], muted: [colors.surfaceAlt, 'textMuted'],
  };
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? <Icon name={icon} size={12} color={fg} /> : null}
      <Text variant="tiny" color={fg}>{label}</Text>
    </View>
  );
}

/** App proficiency level (never a certified CEFR/IELTS result). */
export function LevelBadge({ level, provisional, size = 'md' }: { level: string | null | undefined; provisional?: boolean; size?: 'md' | 'lg' }) {
  if (!level) return <Badge label="Not assessed" tone="muted" />;
  const color = levelColors[level] ?? '#888';
  const big = size === 'lg';
  return (
    <View
      accessibilityLabel={`Level ${level}, ${levelNames[level]}${provisional ? ', provisional' : ''}`}
      style={[styles.level, { backgroundColor: color + '26', borderColor: color, paddingVertical: big ? 6 : 3, paddingHorizontal: big ? 12 : 8 }]}>
      <Text variant={big ? 'h3' : 'smallStrong'} style={{ color }}>{level}</Text>
      <Text variant={big ? 'smallStrong' : 'tiny'} style={{ color }}>{levelNames[level]}{provisional ? ' · provisional' : ''}</Text>
    </View>
  );
}

export function StatTile({ icon, label, value, tone = 'primary', style }: { icon: IconName; label: string; value: string | number; tone?: keyof Palette; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }, style]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Icon name={icon} size={18} color={tone} />
      <Text variant="h2">{value}</Text>
      <Text variant="tiny" color="textMuted">{label.toUpperCase()}</Text>
    </View>
  );
}

export function ProgressBar({ value, tone = 'primary', height = 8 }: { value: number; tone?: keyof Palette; height?: number }) {
  const { colors } = useTheme();
  const [anim] = useState(() => new Animated.Value(0));
  const clamped = Math.max(0, Math.min(1, value || 0));
  useEffect(() => {
    Animated.timing(anim, { toValue: clamped, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [anim, clamped]);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ height, borderRadius: height, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
      <Animated.View style={{ height, borderRadius: height, backgroundColor: colors[tone],
        width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

export function ProgressRing({ value, size = 84, stroke = 9, tone = 'primary', children }: { value: number; size?: number; stroke?: number; tone?: keyof Palette; children?: React.ReactNode }) {
  const { colors } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors[tone]} strokeWidth={stroke} fill="none"
          strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - v)} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      {children}
    </View>
  );
}

/** Counts up to `value` — used for XP and score reveals. */
export function AnimatedNumber({ value, variant = 'h2', prefix = '', color }: { value: number; variant?: 'h1' | 'h2' | 'display' | 'h3'; prefix?: string; color?: keyof Palette }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    const diff = value - start;
    if (diff === 0) return;
    const t0 = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / 600);
      setShown(Math.round(start + diff * (1 - Math.pow(1 - p, 3))));
      if (p >= 1) { clearInterval(id); from.current = value; }
    }, 16);
    return () => clearInterval(id);
  }, [value]);
  return <Text variant={variant} color={color}>{prefix}{shown}</Text>;
}

export function Avatar({ emoji, size = 44, ring }: { emoji: string; size?: number; ring?: keyof Palette }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center',
      borderWidth: ring ? 2 : 0, borderColor: ring ? colors[ring] : 'transparent' }}>
      <Text style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }} accessibilityLabel="avatar">{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, alignSelf: 'flex-start' },
  level: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.pill, borderWidth: 1, alignSelf: 'flex-start' },
  stat: { flex: 1, minWidth: 96, borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 2 },
});
