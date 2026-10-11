import { Stack } from 'expo-router';

import { useTheme } from '@/providers/theme-provider';

export default function AssessmentLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false, contentStyle: { backgroundColor: colors.background } }} />;
}
