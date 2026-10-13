import { Redirect } from 'expo-router';
import { Loading, Screen } from '../src/components/ui';
import { useAuth } from '../src/lib/auth';

export default function Index() {
  const { me, loading } = useAuth();
  if (loading) return <Screen><Loading /></Screen>;
  if (!me) return <Redirect href="/welcome" />;
  if (!me.profile.onboardingCompleted) return <Redirect href="/onboarding" />;
  return <Redirect href="/home" />;
}
