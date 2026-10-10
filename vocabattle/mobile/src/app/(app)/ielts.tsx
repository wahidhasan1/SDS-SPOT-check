import { router } from 'expo-router';
import { View } from 'react-native';

import { Badge, Banner, Button, Card, Icon, type IconName, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useAuth } from '@/providers/auth-provider';

const SKILLS: { key: string; title: string; icon: IconName }[] = [
  { key: 'listening', title: 'Listening', icon: 'headset' },
  { key: 'reading', title: 'Reading', icon: 'document-text' },
  { key: 'writing', title: 'Writing', icon: 'pencil' },
  { key: 'speaking', title: 'Speaking', icon: 'mic' },
];

/** IELTS preparation center (dashboard). Full skills practice and mock tests are Phase 3. */
export default function Ielts() {
  const { profile } = useAuth();
  const now = useNow(60_000);
  const days = profile?.ielts_exam_date ? Math.ceil((new Date(profile.ielts_exam_date).getTime() - now) / 86_400_000) : null;
  return (
    <Screen title="IELTS Center" subtitle="Practice only — Vocabattle is not affiliated with IELTS and gives no official band scores." back>
      <Card tone="primary">
        <Row gap={Spacing.lg}>
          <View style={{ flex: 1 }}>
            <Text variant="tiny" color="textMuted">TARGET BAND</Text>
            <Text variant="h1">{profile?.ielts_target_band ? Number(profile.ielts_target_band).toFixed(1) : '—'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="tiny" color="textMuted">EXAM</Text>
            <Text variant="h3">{days !== null ? (days >= 0 ? `in ${days} days` : 'date passed') : 'not set'}</Text>
          </View>
          <Button title="Edit" variant="ghost" size="sm" onPress={() => router.push('/profile-edit')} />
        </Row>
      </Card>

      <SectionHeader title="Available now" />
      <Card onPress={() => router.push('/vocab/ielts_academic')}>
        <Row gap={Spacing.md}><Icon name="ribbon" color="primary" /><View style={{ flex: 1 }}><Text variant="bodyStrong">IELTS academic vocabulary</Text><Text variant="small" color="textMuted">High-value words for Writing Task 1 & 2 with usage notes.</Text></View></Row>
      </Card>
      <Card onPress={() => router.push({ pathname: '/quiz', params: { topic: 'ielts_academic', kind: 'topic', title: 'IELTS vocabulary quiz' } })}>
        <Row gap={Spacing.md}><Icon name="create" color="primary" /><View style={{ flex: 1 }}><Text variant="bodyStrong">IELTS vocabulary quiz</Text><Text variant="small" color="textMuted">Objective, scored instantly with explanations.</Text></View></Row>
      </Card>

      <SectionHeader title="Skills" />
      <Row wrap gap={Spacing.sm}>
        {SKILLS.map((s) => (
          <Card key={s.key} style={{ flexGrow: 1, flexBasis: '45%' }} onPress={() => router.push(`/upcoming/${s.key}`)}>
            <Icon name={s.icon} color="textMuted" />
            <Text variant="bodyStrong">{s.title}</Text>
            <Badge label="Phase 3" tone="muted" />
          </Card>
        ))}
      </Row>
      <Banner tone="phase" title="Practice tests & results — Phase 3"
        message="Timed mock tests, per-skill progress, weak-area analysis and practice-test history. Writing and speaking will receive clearly labelled estimated practice feedback, never an official band score." />
    </Screen>
  );
}
