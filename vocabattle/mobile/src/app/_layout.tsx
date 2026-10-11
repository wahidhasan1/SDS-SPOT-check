import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SplashView } from '@/components/brand';
import { SetupRequired } from '@/components/setup-required';
import { Button, ErrorView } from '@/components/ui';
import { isBackendConfigured } from '@/lib/env';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider, useTheme } from '@/providers/theme-provider';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryProvider>
          {isBackendConfigured ? (
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          ) : (
            <Configless />
          )}
        </QueryProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Configless() {
  useEffect(() => { SplashScreen.hideAsync().catch(() => {}); }, []);
  return <SetupRequired />;
}

function RootNavigator() {
  const { session, initializing, profile, profileLoading, profileError, refreshProfile, signOut } = useAuth();
  const { colors, scheme } = useTheme();
  const ready = !initializing && !(session && profileLoading);

  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);

  if (!ready) return <SplashView />;
  if (session && profileError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
        <ErrorView error={profileError} onRetry={() => refreshProfile()} />
        <Button title="Sign out" variant="ghost" onPress={() => signOut()} />
      </View>
    );
  }

  const signedIn = !!session;
  const onboarded = profile?.onboarding_step === 'done';
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = { ...base, colors: { ...base.colors, background: colors.background, card: colors.surface, text: colors.text, border: colors.border, primary: colors.primary } };

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && onboarded}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="assessment" options={{ gestureEnabled: false }} />
        </Stack.Protected>
        <Stack.Screen name="reset-password" />
      </Stack>
    </NavThemeProvider>
  );
}
