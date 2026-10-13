import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { useTheme } from '../../src/lib/theme';

export default function AuthLayout() {
  const { me } = useAuth();
  const t = useTheme();
  if (me) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerStyle: { backgroundColor: t.card }, headerTintColor: t.text, contentStyle: { backgroundColor: t.bg } }}><Stack.Screen name="welcome" options={{ headerShown: false }} /><Stack.Screen name="login" options={{ title: 'Sign in' }} /><Stack.Screen name="register" options={{ title: 'Create account' }} /><Stack.Screen name="forgot" options={{ title: 'Reset password' }} /></Stack>;
}
