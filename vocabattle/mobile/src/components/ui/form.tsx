import { forwardRef, type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, type TextInputProps, View } from 'react-native';

import { Radius, Spacing, Type } from '@/constants/theme';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/providers/theme-provider';

import { Icon } from './icon';
import { Text } from './text';

export const TextField = forwardRef<TextInput, TextInputProps & { label: string; error?: string | null; hint?: string; secure?: boolean }>(
  function TextField({ label, error, hint, secure, style, ...rest }, ref) {
    const { colors } = useTheme();
    const [focused, setFocused] = useState(false);
    const [hidden, setHidden] = useState(!!secure);
    return (
      <View style={{ gap: 6 }}>
        <Text variant="smallStrong" color="textMuted">{label}</Text>
        <View style={[styles.input, { backgroundColor: colors.surface, borderColor: error ? colors.danger : focused ? colors.primary : colors.border }]}>
          <TextInput
            ref={ref}
            {...rest}
            accessibilityLabel={label}
            secureTextEntry={hidden}
            placeholderTextColor={colors.textFaint}
            onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
            style={[Type.body, { flex: 1, color: colors.text, paddingVertical: 12 }, style]}
          />
          {secure ? (
            <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
              <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color="textMuted" />
            </Pressable>
          ) : null}
        </View>
        {error ? <Text variant="small" color="danger" accessibilityLiveRegion="polite">{error}</Text>
          : hint ? <Text variant="small" color="textFaint">{hint}</Text> : null}
      </View>
    );
  },
);

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected }}
      onPress={() => { haptic.tap(); onPress?.(); }}
      style={[styles.chip, { backgroundColor: selected ? colors.primarySoft : colors.surface, borderColor: selected ? colors.primary : colors.border }]}>
      {icon ? <Icon name={icon} size={15} color={selected ? 'primary' : 'textMuted'} /> : null}
      <Text variant="smallStrong" color={selected ? 'primary' : 'text'}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.surfaceAlt }]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: active }}
            onPress={() => { haptic.tap(); onChange(o.value); }}
            style={[styles.segment, active && { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text variant="smallStrong" color={active ? 'text' : 'textMuted'}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({ title, subtitle, value, onChange, disabled, right }: {
  title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; right?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.toggle, { borderBottomColor: colors.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" color={disabled ? 'textFaint' : 'text'}>{title}</Text>
        {subtitle ? <Text variant="small" color="textMuted">{subtitle}</Text> : null}
      </View>
      {right}
      <Switch
        accessibilityLabel={title}
        value={value}
        disabled={disabled}
        onValueChange={(v) => { haptic.tap(); onChange(v); }}
        trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: Radius.md, paddingHorizontal: Spacing.md, gap: Spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1.5 },
  segmented: { flexDirection: 'row', borderRadius: Radius.md, padding: 3, gap: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.sm, borderWidth: 1, borderColor: 'transparent' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
});
