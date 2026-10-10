import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Logo } from '@/components/brand';
import { Button, Icon, type IconName, Screen, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'flash', title: 'Anonymous battles', text: 'Challenge learners at your level in real-time vocabulary duels.' },
  { icon: 'analytics', title: 'Know your level', text: 'A short adaptive assessment estimates where you are — no guessing.' },
  { icon: 'repeat', title: 'Words that stick', text: 'Spaced repetition brings difficult words back right before you forget.' },
  { icon: 'school', title: 'IELTS-ready', text: 'Academic vocabulary and practice paths for test candidates.' },
];

/** Welcome screen. */
export default function Welcome() {
  const { colors } = useTheme();
  return (
    <Screen
      footer={
        <>
          <Button testID="welcome-get-started" title="Get started" size="lg" onPress={() => router.push('/(auth)/sign-up')} />
          <Button testID="welcome-sign-in" title="I already have an account" variant="ghost" onPress={() => router.push('/(auth)/sign-in')} />
        </>
      }>
      <View style={styles.hero}>
        <Logo size={72} />
        <Text variant="display" align="center">Vocabattle</Text>
        <Text variant="body" color="textMuted" align="center">Improve your English by competing, practising and reading — every game builds real skill.</Text>
      </View>
      <View style={{ gap: Spacing.md }}>
        {FEATURES.map((f) => (
          <View key={f.title} style={[styles.feature, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}><Icon name={f.icon} color="primary" size={22} /></View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{f.title}</Text>
              <Text variant="small" color="textMuted">{f.text}</Text>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  feature: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center' },
  icon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
