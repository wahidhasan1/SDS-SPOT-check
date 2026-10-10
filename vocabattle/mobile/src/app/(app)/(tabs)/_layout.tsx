import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { Icon, type IconName } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';

const TABS: { name: string; title: string; icon: IconName; active: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', active: 'home' },
  { name: 'learn', title: 'Learn', icon: 'book-outline', active: 'book' },
  { name: 'battle', title: 'Battle', icon: 'flash-outline', active: 'flash' },
  { name: 'read', title: 'Read', icon: 'scan-outline', active: 'scan' },
  { name: 'profile', title: 'Profile', icon: 'person-circle-outline', active: 'person-circle' },
];

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: Platform.OS === 'ios' ? 86 : 64, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', paddingBottom: Platform.OS === 'ios' ? 0 : 8 },
      }}>
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarButtonTestID: `tab-${t.name}`,
            tabBarIcon: ({ color, focused }) => <Icon name={focused ? t.active : t.icon} rawColor={String(color)} size={24} />,
          }}
        />
      ))}
    </Tabs>
  );
}
