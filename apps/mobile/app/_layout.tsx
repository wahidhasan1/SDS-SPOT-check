import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/lib/auth';
import { CallProvider } from '../src/lib/call';
import { useTheme } from '../src/lib/theme';

function Nav() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.surface },
        headerTintColor: t.text,
        contentStyle: { backgroundColor: t.bg },
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="call" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="call-summary" options={{ title: 'Call summary', headerBackVisible: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CallProvider>
          <StatusBar style="auto" />
          <Nav />
        </CallProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
