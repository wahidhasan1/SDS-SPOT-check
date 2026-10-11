import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/brand';
import { Banner, Card, Text } from '@/components/ui';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';

/** Shown instead of the app when the backend environment variables are missing. */
export function SetupRequired() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.xl, gap: Spacing.lg, maxWidth: 640, alignSelf: 'center', width: '100%' }}>
        <Logo />
        <Text variant="h1">Backend not configured</Text>
        <Banner tone="warning" title="Vocabattle needs a Supabase project"
          message="All accounts, assessments, battles and progress are stored on the server. Nothing is simulated, so the app cannot run without it." />
        <Card>
          <Text variant="bodyStrong">1. Create a Supabase project and apply the migrations</Text>
          <Text color="textMuted">supabase link --project-ref &lt;ref&gt; && supabase db push</Text>
          <Text variant="bodyStrong">2. Create mobile/.env with:</Text>
          <View style={{ backgroundColor: colors.surfaceAlt, padding: Spacing.md, borderRadius: 8 }}>
            <Text style={{ fontFamily: Fonts.mono }}>EXPO_PUBLIC_SUPABASE_URL=https://&lt;ref&gt;.supabase.co{'\n'}EXPO_PUBLIC_SUPABASE_ANON_KEY=&lt;anon key&gt;</Text>
          </View>
          <Text variant="bodyStrong">3. Restart the dev server</Text>
          <Text color="textMuted">npx expo start --clear</Text>
        </Card>
        <Text variant="small" color="textMuted">See vocabattle/README.md for the full setup guide.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
