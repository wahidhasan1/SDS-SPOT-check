import { useState } from 'react';
import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { env } from '@/lib/env';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';

/** Social sign-in. Hidden unless providers are enabled in Supabase and listed in EXPO_PUBLIC_OAUTH_PROVIDERS. */
export function SocialButtons({ onError }: { onError: (msg: string) => void }) {
  const { signInWithProvider } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  if (env.oauthProviders.length === 0) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text variant="small" color="textMuted" align="center">or continue with</Text>
      {env.oauthProviders.map((p) => (
        <Button
          key={p}
          title={p === 'google' ? 'Continue with Google' : 'Continue with Apple'}
          icon={p === 'google' ? 'logo-google' : 'logo-apple'}
          variant="secondary"
          loading={busy === p}
          onPress={async () => {
            setBusy(p);
            try { await signInWithProvider(p); } catch (e) { onError(errorMessage(e)); } finally { setBusy(null); }
          }}
        />
      ))}
    </View>
  );
}
