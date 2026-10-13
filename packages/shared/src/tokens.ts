/** Design tokens shared by web (CSS variables) and mobile (StyleSheet). */
export const colors = {
  light: {
    bg: '#f6f7fb',
    surface: '#ffffff',
    surface2: '#f0f2f8',
    border: '#e2e6ef',
    text: '#141a2a',
    textMuted: '#5b6478',
    primary: '#4f46e5',
    primarySoft: '#eceafd',
    accent: '#0ea5a4',
    accentSoft: '#e0f5f5',
    success: '#15803d',
    successSoft: '#e3f6e9',
    warning: '#b45309',
    warningSoft: '#fdf1df',
    danger: '#dc2626',
    dangerSoft: '#fde8e8',
  },
  dark: {
    bg: '#0d111c',
    surface: '#151b2b',
    surface2: '#1c2438',
    border: '#2a3450',
    text: '#e8ecf6',
    textMuted: '#98a2ba',
    primary: '#8b85ff',
    primarySoft: '#262457',
    accent: '#2dd4bf',
    accentSoft: '#113a3a',
    success: '#4ade80',
    successSoft: '#123222',
    warning: '#fbbf24',
    warningSoft: '#3a2c0d',
    danger: '#f87171',
    dangerSoft: '#3d1717',
  },
} as const;

export const radius = { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
