import { useColorScheme } from 'react-native';

const light = { bg: '#f8fafc', card: '#ffffff', border: '#e2e8f0', text: '#0f172a', muted: '#64748b', brand: '#2563eb', brandSoft: '#eff6ff', danger: '#dc2626', success: '#059669', warning: '#d97706', inputBg: '#ffffff' };
const dark: typeof light = { bg: '#020617', card: '#0f172a', border: '#1e293b', text: '#f1f5f9', muted: '#94a3b8', brand: '#60a5fa', brandSoft: '#172554', danger: '#f87171', success: '#34d399', warning: '#fbbf24', inputBg: '#0f172a' };
export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
