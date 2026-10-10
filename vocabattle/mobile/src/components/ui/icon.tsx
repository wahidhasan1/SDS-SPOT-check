import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { Palette } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color = 'text', rawColor }: { name: IconName | string; size?: number; color?: keyof Palette; rawColor?: string }) {
  const { colors } = useTheme();
  const valid = (name in Ionicons.glyphMap ? name : 'ellipse-outline') as IconName;
  return <Ionicons name={valid} size={size} color={rawColor ?? colors[color]} />;
}
