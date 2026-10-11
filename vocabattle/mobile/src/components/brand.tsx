import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';

export function Logo({ size = 56 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.logo, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: colors.primary }]}>
      <Text style={{ color: '#fff', fontSize: size * 0.5, lineHeight: size * 0.62, fontWeight: '900' }}>V</Text>
      <View style={[styles.spark, { backgroundColor: colors.success, width: size * 0.22, height: size * 0.22, borderRadius: size }]} />
    </View>
  );
}

export function SplashView() {
  const { colors } = useTheme();
  return (
    <View style={[styles.splash, { backgroundColor: colors.background }]} accessibilityLabel="Vocabattle is loading">
      <Logo size={84} />
      <Text variant="h1">Vocabattle</Text>
      <Text color="textMuted">Learn English. Battle smarter.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute', right: -3, top: -3 },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: Radius.sm },
});
