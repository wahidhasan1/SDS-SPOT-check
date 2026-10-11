/**
 * Vocabattle design tokens. Dark navy foundation with violet (primary),
 * blue (info) and green (success) accents. Every screen reads colours from
 * `useTheme()` so light and dark mode stay consistent.
 */
import { Platform } from 'react-native';

export const palettes = {
  dark: {
    background: '#0B1020',
    surface: '#131A2E',
    surfaceAlt: '#1A2340',
    surfacePressed: '#212B4D',
    border: '#26304F',
    text: '#EEF1FA',
    textMuted: '#9AA4C2',
    textFaint: '#6B7596',
    primary: '#8B6CFF',
    primaryText: '#FFFFFF',
    primarySoft: '#251F4F',
    info: '#4C95FF',
    infoSoft: '#16284A',
    success: '#2BD47D',
    successSoft: '#123526',
    warning: '#F5B83D',
    warningSoft: '#3A2E12',
    danger: '#FF6B78',
    dangerSoft: '#3D1A22',
    overlay: 'rgba(5, 8, 18, 0.7)',
  },
  light: {
    background: '#F4F6FB',
    surface: '#FFFFFF',
    surfaceAlt: '#EEF1F8',
    surfacePressed: '#E3E8F3',
    border: '#DDE2EE',
    text: '#121833',
    textMuted: '#5B6585',
    textFaint: '#8A93AE',
    primary: '#5B3DF5',
    primaryText: '#FFFFFF',
    primarySoft: '#ECE8FF',
    info: '#1F6FEB',
    infoSoft: '#E3EEFF',
    success: '#15964A',
    successSoft: '#E1F6EA',
    warning: '#A86C0A',
    warningSoft: '#FDF1D8',
    danger: '#D7263D',
    dangerSoft: '#FDE6E9',
    overlay: 'rgba(18, 24, 51, 0.45)',
  },
} as const;

export type Palette = { [K in keyof typeof palettes.dark]: string };
export type ColorScheme = keyof typeof palettes;

export const levelColors: Record<string, string> = {
  A1: '#2BB673',
  A2: '#1FA5A0',
  B1: '#2E8BEA',
  B2: '#4C6CF5',
  C1: '#7B57F2',
  C2: '#B44FE0',
};

export const levelNames: Record<string, string> = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper Intermediate',
  C1: 'Advanced',
  C2: 'Proficient',
};

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const Radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export const Type = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800' as const },
  h1: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const },
  h3: { fontSize: 17, lineHeight: 23, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  smallStrong: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  tiny: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const },
};

export const Fonts = Platform.select({
  web: { mono: 'ui-monospace, Menlo, monospace' },
  default: { mono: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});

export const MaxContentWidth = 720;
