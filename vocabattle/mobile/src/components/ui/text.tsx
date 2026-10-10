import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { type Palette, Type } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';

export type TextVariant = keyof typeof Type;

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: keyof Palette;
  align?: 'left' | 'center' | 'right';
}

export function Text({ variant = 'body', color = 'text', align, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={1.6}
      style={[Type[variant], { color: colors[color], textAlign: align }, style]}
    />
  );
}
