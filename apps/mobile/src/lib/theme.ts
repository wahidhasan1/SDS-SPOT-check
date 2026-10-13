import { useColorScheme } from 'react-native';
import { colors } from '@app/shared';

export type Theme = (typeof colors)['light'] | (typeof colors)['dark'];

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? colors.dark : colors.light;
}
