import { router, useLocalSearchParams } from 'expo-router';

import { Banner, Button, Card, Icon, type IconName, Row, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';

const FEATURES: Record<string, { title: string; icon: IconName; phase: number; points: string[]; tryNow?: { label: string; href: Parameters<typeof router.push>[0] } }> = {
  'grammar-lessons': { title: 'Grammar lessons', icon: 'reader', phase: 3, points: ['Parts of speech, tenses, articles, prepositions, conditionals, passive voice, reported speech, relative clauses and more.', 'Each lesson: short explanation, examples, exercises and a quiz.'], tryNow: { label: 'Practise grammar questions now', href: { pathname: '/quiz', params: { types: 'grammar', title: 'Grammar practice' } } } },
  reading: { title: 'Reading practice', icon: 'document-text', phase: 3, points: ['Short and IELTS-style passages at every level.', 'Multiple choice, True/False/Not Given, matching headings, sentence completion and vocabulary in context.', 'Reading comprehension scores feed your multi-skill level.'] },
  listening: { title: 'Listening practice', icon: 'headset', phase: 3, points: ['Conversations, academic discussions, announcements and monologues.', 'IELTS-style question types with accuracy tracking.', 'Original or properly licensed audio only.'] },
  writing: { title: 'Writing practice', icon: 'pencil', phase: 3, points: ['Sentence construction, paragraphs, essays, IELTS Task 1 and Task 2.', 'Optional AI feedback on grammar, vocabulary, coherence, cohesion and task completion — clearly labelled as practice feedback, not an official band score.'] },
  speaking: { title: 'Speaking practice', icon: 'mic', phase: 3, points: ['Pronunciation and read-aloud exercises.', 'IELTS Speaking Part 1, Part 2 cue cards and Part 3 discussion.', 'Transcription-based feedback with clearly explained limitations.'] },
};

/** Clearly-labelled placeholder for features scheduled in a later phase. */
export default function Upcoming() {
  const { feature } = useLocalSearchParams<{ feature: string }>();
  const f = FEATURES[feature ?? ''] ?? { title: 'Coming soon', icon: 'construct' as IconName, phase: 3, points: [] };
  return (
    <Screen title={f.title} back>
      <Banner tone="phase" title={`Planned for Phase ${f.phase}`} message="This area is not built yet. Nothing here is simulated." />
      <Card>
        {f.points.map((p) => (
          <Row key={p} gap={Spacing.md} style={{ alignItems: 'flex-start' }}><Icon name={f.icon} color="textMuted" size={18} /><Text style={{ flex: 1 }}>{p}</Text></Row>
        ))}
      </Card>
      {f.tryNow ? <Button title={f.tryNow.label} icon="play" onPress={() => router.push(f.tryNow!.href)} /> : null}
    </Screen>
  );
}
