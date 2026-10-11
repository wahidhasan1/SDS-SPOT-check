import { Redirect } from 'expo-router';

import { useAuth } from '@/providers/auth-provider';

export default function OnboardingIndex() {
  const { profile } = useAuth();
  return <Redirect href={profile?.onboarding_step === 'assessment' ? '/onboarding/assessment-intro' : '/onboarding/profile'} />;
}
