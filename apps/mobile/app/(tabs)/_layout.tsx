import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { useTheme } from '../../src/lib/theme';

export default function TabsLayout() {
  const { me, loading } = useAuth();
  const t = useTheme();
  if (!loading && !me) return <Redirect href="/welcome" />;
  if (me && !me.profile.onboardingCompleted) return <Redirect href="/onboarding" />;
  const icon = (name: keyof typeof Ionicons.glyphMap) => ({ color, size }: { color: string; size: number }) => <Ionicons name={name} color={color} size={size} />;
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: t.brand, headerStyle: { backgroundColor: t.card }, headerTintColor: t.text, tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border } }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: icon('book-outline') }} />
      <Tabs.Screen name="ielts" options={{ title: 'IELTS', tabBarIcon: icon('school-outline') }} />
      <Tabs.Screen name="speak" options={{ title: 'Speak', tabBarIcon: icon('call-outline') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('menu-outline') }} />
    </Tabs>
  );
}
