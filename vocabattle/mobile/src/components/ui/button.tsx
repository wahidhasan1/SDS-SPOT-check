import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/providers/theme-provider';

import { Icon, type IconName } from './icon';
import { Text } from './text';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'md' | 'lg' | 'sm';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
  testID?: string;
}

export function Button({ title, onPress, variant = 'primary', size = 'md', icon, loading, disabled, style, accessibilityHint, testID }: ButtonProps) {
  const { colors } = useTheme();
  const palette = {
    primary: { bg: colors.primary, fg: colors.primaryText, border: colors.primary },
    secondary: { bg: colors.surfaceAlt, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
    success: { bg: colors.success, fg: '#06180E', border: colors.success },
  }[variant];
  const inactive = disabled || loading;
  const height = size === 'lg' ? 54 : size === 'sm' ? 36 : 46;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => { haptic.tap(); onPress?.(); }}
      style={({ pressed }) => [
        styles.base,
        { height, backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.55 : pressed ? 0.85 : 1,
          paddingHorizontal: size === 'sm' ? Spacing.md : Spacing.lg, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 19} rawColor={palette.fg} /> : null}
          <Text variant={size === 'sm' ? 'smallStrong' : 'bodyStrong'} style={{ color: palette.fg }}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
