import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';

import { Icon, type IconName } from './icon';
import { Text } from './text';

export interface ScreenProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  contentStyle?: ViewStyle;
  edges?: ('top' | 'bottom')[];
}

/** Standard screen: safe area, optional header with back button, centred max-width content. */
export function Screen({ children, title, subtitle, back, right, scroll = true, refreshing, onRefresh, footer, contentStyle, edges = ['top'] }: ScreenProps) {
  const { colors } = useTheme();
  const header = title || back || right ? (
    <View style={styles.header}>
      {back ? (
        <Pressable
          accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={[styles.backBtn, { backgroundColor: colors.surfaceAlt }]}>
          <Icon name="chevron-back" size={20} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        {title ? <Text variant="h2" numberOfLines={1} accessibilityRole="header">{title}</Text> : null}
        {subtitle ? <Text variant="small" color="textMuted" numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  ) : null;

  const body = (
    <View style={[styles.content, contentStyle]}>
      {header}
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}>
          {body}
        </ScrollView>
      ) : (
        <View style={styles.flex}>{body}</View>
      )}
      {footer ? <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}><View style={styles.footerInner}>{footer}</View></View> : null}
    </SafeAreaView>
  );
}

export function Card({ children, onPress, style, tone = 'surface', accessibilityLabel, testID }: {
  children: ReactNode; onPress?: () => void; style?: ViewStyle; tone?: 'surface' | 'alt' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  accessibilityLabel?: string; testID?: string;
}) {
  const { colors } = useTheme();
  const bg = { surface: colors.surface, alt: colors.surfaceAlt, primary: colors.primarySoft, success: colors.successSoft,
    warning: colors.warningSoft, danger: colors.dangerSoft, info: colors.infoSoft }[tone];
  const base = [styles.card, { backgroundColor: bg, borderColor: tone === 'surface' ? colors.border : 'transparent' }, style];
  if (!onPress) return <View style={base} testID={testID}>{children}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button" accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [...base, pressed && { backgroundColor: colors.surfacePressed, transform: [{ scale: 0.99 }] }]}>
      {children}
    </Pressable>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.section}>
      <Text variant="h3" accessibilityRole="header">{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text variant="smallStrong" color="primary">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Row({ children, gap = Spacing.sm, style, wrap }: { children: ReactNode; gap?: number; style?: ViewStyle; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function ListRow({ icon, title, subtitle, right, onPress, danger, testID }: {
  icon?: IconName; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; danger?: boolean; testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.listRow, { borderBottomColor: colors.border }, pressed && { backgroundColor: colors.surfacePressed }]}>
      {icon ? (
        <View style={[styles.listIcon, { backgroundColor: danger ? colors.dangerSoft : colors.surfaceAlt }]}>
          <Icon name={icon} size={18} color={danger ? 'danger' : 'textMuted'} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" color={danger ? 'danger' : 'text'}>{title}</Text>
        {subtitle ? <Text variant="small" color="textMuted">{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-forward" size={18} color="textFaint" /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: Spacing.xxl },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.lg, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 44 },
  backBtn: { width: 38, height: 38, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  footerInner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.sm },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, gap: Spacing.sm },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: -Spacing.xs },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  listIcon: { width: 34, height: 34, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
});
