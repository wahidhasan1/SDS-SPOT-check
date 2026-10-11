import { useQuery } from '@tanstack/react-query';
import { type Href, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Badge, Card, Icon, type IconName, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { useTheme } from '@/providers/theme-provider';

type Item = { title: string; subtitle: string; icon: IconName; href: Href; badge?: string; phase?: number; testID?: string };

const PRACTICE: Item[] = [
  { title: 'Daily quiz', subtitle: '10 questions at your level', icon: 'today', href: { pathname: '/quiz', params: { kind: 'daily', title: 'Daily quiz' } }, testID: 'learn-daily-quiz' },
  { title: 'Synonyms & antonyms', subtitle: 'Closest and opposite meanings', icon: 'swap-horizontal', href: { pathname: '/quiz', params: { types: 'synonym,antonym', title: 'Synonyms & antonyms' } } },
  { title: 'Words in context', subtitle: 'Choose the meaning that fits the sentence', icon: 'text', href: { pathname: '/quiz', params: { types: 'context,meaning', title: 'Words in context' } } },
  { title: 'Sentence completion', subtitle: 'Pick the right word form', icon: 'create', href: { pathname: '/quiz', params: { types: 'fill_blank', title: 'Sentence completion' } } },
];

const SKILLS: Item[] = [
  { title: 'Grammar practice', subtitle: 'Tenses, articles, conditionals and more', icon: 'construct', href: { pathname: '/quiz', params: { types: 'grammar', title: 'Grammar practice' } } },
  { title: 'Grammar lessons', subtitle: 'Explanations, examples and exercises', icon: 'reader', href: '/upcoming/grammar-lessons', phase: 3 },
  { title: 'Reading practice', subtitle: 'Passages, T/F/NG, matching headings', icon: 'document-text', href: '/upcoming/reading', phase: 3 },
  { title: 'Listening practice', subtitle: 'Conversations, lectures, announcements', icon: 'headset', href: '/upcoming/listening', phase: 3 },
  { title: 'Writing practice', subtitle: 'Sentences to IELTS Task 1 & 2', icon: 'pencil', href: '/upcoming/writing', phase: 3 },
  { title: 'Speaking practice', subtitle: 'Pronunciation and IELTS Parts 1–3', icon: 'mic', href: '/upcoming/speaking', phase: 3 },
];

/** Learn dashboard. */
export default function Learn() {
  const { colors } = useTheme();
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: api.getDashboard });
  const status = useQuery({ queryKey: ['assessment-status'], queryFn: api.getAssessmentStatus });
  const due = dash.data?.vocabulary.due ?? 0;

  const row = (it: Item) => (
    <Card key={it.title} onPress={() => router.push(it.href)} testID={it.testID} accessibilityLabel={it.title}>
      <Row gap={Spacing.md}>
        <View style={[styles.icon, { backgroundColor: it.phase ? colors.surfaceAlt : colors.primarySoft }]}>
          <Icon name={it.icon} color={it.phase ? 'textMuted' : 'primary'} />
        </View>
        <View style={{ flex: 1 }}>
          <Row gap={6}>
            <Text variant="bodyStrong">{it.title}</Text>
            {it.phase ? <Badge label={`Phase ${it.phase}`} tone="muted" /> : null}
          </Row>
          <Text variant="small" color="textMuted">{it.subtitle}</Text>
        </View>
        <Icon name="chevron-forward" color="textFaint" />
      </Row>
    </Card>
  );

  return (
    <Screen title="Learn" subtitle="Every activity is matched to your assessed level.">
      <Row gap={Spacing.sm}>
        <Card style={{ flex: 1 }} onPress={() => router.push('/vocab')} testID="learn-vocabulary">
          <Icon name="library" color="primary" size={26} />
          <Text variant="bodyStrong">Vocabulary</Text>
          <Text variant="small" color="textMuted">12 topics · A1–C2</Text>
        </Card>
        <Card style={{ flex: 1 }} tone={due ? 'warning' : 'surface'} onPress={() => router.push('/review')} testID="learn-review">
          <Icon name="repeat" color={due ? 'warning' : 'primary'} size={26} />
          <Text variant="bodyStrong">Review</Text>
          <Text variant="small" color="textMuted">{due ? `${due} word${due === 1 ? '' : 's'} due` : 'Nothing due'}</Text>
        </Card>
        <Card style={{ flex: 1 }} onPress={() => router.push('/saved-words')} testID="learn-saved">
          <Icon name="bookmarks" color="primary" size={26} />
          <Text variant="bodyStrong">Saved</Text>
          <Text variant="small" color="textMuted">{dash.data?.vocabulary.saved ?? 0} words</Text>
        </Card>
      </Row>

      <SectionHeader title="Vocabulary practice" />
      {PRACTICE.map(row)}

      <SectionHeader title="Skills" />
      {SKILLS.map(row)}

      <SectionHeader title="Level check" />
      <Card onPress={status.data?.can_start ? () => router.push('/assessment/run') : undefined}>
        <Row gap={Spacing.md}>
          <Icon name="analytics" color="info" size={26} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">Retake the vocabulary assessment</Text>
            <Text variant="small" color="textMuted">
              {status.data?.can_start
                ? 'Re-estimate your level. A single check moves your level by at most one step.'
                : status.data?.next_available_at
                  ? `Available again on ${new Date(status.data.next_available_at).toLocaleDateString()}.`
                  : 'Loading…'}
            </Text>
          </View>
        </Row>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: { width: 42, height: 42, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
