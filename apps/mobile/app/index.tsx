import { Redirect } from 'expo-router';
import { useAuth } from '../src/lib/auth';
import { Loading } from '../src/components/ui';

export default function Index() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/welcome" />;
  if (!user.onboardingCompleted) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/home" />;
}
