import { Redirect, Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { useAuth } from '../../src/lib/auth';
import { useTheme } from '../../src/lib/theme';

const icon = (e: string) => ({ color }: { color: ColorValue }) => <Text style={{ fontSize: 20, color }}>{e}</Text>;

export default function TabsLayout() {
  const t = useTheme();
  const { user, ready } = useAuth();
  if (ready && !user) return <Redirect href="/welcome" />;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: t.primary, tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border } }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="ielts" options={{ title: 'IELTS', tabBarIcon: icon('🎯') }} />
      <Tabs.Screen name="speaking" options={{ title: 'Speaking', tabBarIcon: icon('🎙️') }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: icon('📚') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('👤') }} />
    </Tabs>
  );
}
