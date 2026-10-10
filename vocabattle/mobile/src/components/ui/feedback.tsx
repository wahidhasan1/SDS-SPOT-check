import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { toAppError } from '@/lib/errors';
import { useTheme } from '@/providers/theme-provider';

import { Button } from './button';
import { Icon, type IconName } from './icon';
import { Text } from './text';

export function LoadingView({ label = 'Loading…' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text color="textMuted">{label}</Text>
    </View>
  );
}

export function ErrorView({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
  const e = toAppError(error);
  const icon: IconName = e.kind === 'network' ? 'cloud-offline-outline' : e.kind === 'auth' ? 'lock-closed-outline' : 'alert-circle-outline';
  return (
    <View style={styles.center} accessibilityLiveRegion="assertive">
      <Icon name={icon} size={40} color="danger" />
      <Text variant="h3" align="center">{title ?? (e.kind === 'network' ? 'No connection' : 'Something went wrong')}</Text>
      <Text color="textMuted" align="center">{e.message}</Text>
      {onRetry ? <Button title="Try again" icon="refresh" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({ icon, title, message, action }: { icon: IconName; title: string; message?: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.empty, { borderColor: colors.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}><Icon name={icon} size={28} color="primary" /></View>
      <Text variant="h3" align="center">{title}</Text>
      {message ? <Text color="textMuted" align="center">{message}</Text> : null}
      {action}
    </View>
  );
}

/** Inline notice. `tone="phase"` marks features that are planned but not built yet. */
export function Banner({ tone = 'info', icon, title, message, children }: {
  tone?: 'info' | 'warning' | 'success' | 'danger' | 'phase'; icon?: IconName; title?: string; message?: string; children?: ReactNode;
}) {
  const { colors } = useTheme();
  const t = {
    info: { bg: colors.infoSoft, fg: 'info' as const, icon: 'information-circle' },
    warning: { bg: colors.warningSoft, fg: 'warning' as const, icon: 'warning' },
    success: { bg: colors.successSoft, fg: 'success' as const, icon: 'checkmark-circle' },
    danger: { bg: colors.dangerSoft, fg: 'danger' as const, icon: 'alert-circle' },
    phase: { bg: colors.primarySoft, fg: 'primary' as const, icon: 'construct' },
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }]} accessibilityRole="summary">
      <Icon name={icon ?? t.icon} size={20} color={t.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text variant="smallStrong" color={t.fg}>{title}</Text> : null}
        {message ? <Text variant="small" color="text">{message}</Text> : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl, minHeight: 240 },
  empty: { alignItems: 'center', gap: Spacing.sm, padding: Spacing.xl, borderRadius: Radius.lg, borderWidth: 1, borderStyle: 'dashed' },
  emptyIcon: { width: 56, height: 56, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
  banner: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'flex-start' },
});
