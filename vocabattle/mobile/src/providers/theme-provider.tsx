import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { type ColorScheme, type Palette, palettes } from '@/constants/theme';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  scheme: ColorScheme;
  colors: Palette;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const STORAGE_KEY = 'vocabattle.theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => { if (v === 'light' || v === 'dark' || v === 'system') setPref(v); })
      .catch(() => {});
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  // Dark navy is the brand default when the system gives no preference.
  const scheme: ColorScheme = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  const value = useMemo(() => ({ scheme, colors: palettes[scheme], preference, setPreference }), [scheme, preference, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
