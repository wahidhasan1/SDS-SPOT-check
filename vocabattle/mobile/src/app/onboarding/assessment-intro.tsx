import { router } from 'expo-router';
import { View } from 'react-native';

import { Banner, Button, Card, Icon, type IconName, ProgressBar, Row, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';

const POINTS: { icon: IconName; text: string }[] = [
  { icon: 'list', text: '15 vocabulary questions — meanings, synonyms, antonyms and words in context.' },
  { icon: 'trending-up', text: 'Adaptive: questions get harder or easier based on your answers.' },
  { icon: 'time', text: 'No time limit. About 5 minutes. You can resume if you leave.' },
  { icon: 'shield-checkmark', text: 'Your level is assessed — it cannot be chosen or edited manually.' },
];

/** Initial assessment introduction. */
export default function AssessmentIntro() {
  return (
    <Screen
      title="Find your level"
      subtitle="Step 2 of 2"
      footer={<Button testID="assessment-start" title="Start assessment" size="lg" icon="play" onPress={() => router.push('/assessment/run')} />}>
      <ProgressBar value={1} />
      <Card>
        {POINTS.map((p) => (
          <Row key={p.text} gap={Spacing.md} style={{ alignItems: 'flex-start', paddingVertical: 4 }}>
            <Icon name={p.icon} color="primary" size={20} />
            <Text style={{ flex: 1 }}>{p.text}</Text>
          </Row>
        ))}
      </Card>
      <Banner tone="info" title="An estimate, not a certificate"
        message="The result is a provisional app level inspired by CEFR (A1–C2). It is not an official IELTS score or a certified CEFR assessment. It will be refined as you practise all four skills." />
      <View style={{ height: Spacing.sm }} />
    </Screen>
  );
}
