import { router } from 'expo-router';
import { Card, H1, P, Screen } from '../../src/components/ui';

export default function Learn() {
  return (
    <Screen>
      <H1>Learn</H1>
      {[
        ['📚', 'Vocabulary', 'Words of the day, saved words, quizzes', '/vocabulary'],
        ['🔁', 'Review', 'Spaced-repetition flashcards', '/review'],
        ['✍️', 'Grammar', 'Lessons with practice', '/grammar'],
        ['⚔️', 'Battles', 'Real-time quiz duels and leaderboard', '/battles'],
        ['📷', 'Read with AI', 'Photograph a page and tap any word', '/read'],
        ['🧭', 'Placement test', 'Find or update your English level', '/assessment'],
      ].map(([i, t, d, h]) => (
        <Card key={t} onPress={() => router.push(h as any)}>
          <P>{i} <P style={{ fontWeight: '700' }}>{t}</P></P>
          <P small muted>{d}</P>
        </Card>
      ))}
    </Screen>
  );
}
