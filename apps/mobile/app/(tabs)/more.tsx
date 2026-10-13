import { router, type Href } from 'expo-router';
import { Alert, Text } from 'react-native';
import { Badge, Button, Card, P, Row, Screen } from '../../src/components/ui';
import { useAuth } from '../../src/lib/auth';
import { useTheme } from '../../src/lib/theme';

const LINKS: { href: Href; title: string; text: string }[] = [
  { href: '/reader', title: 'Book reader', text: 'Photograph a page and tap words for meanings' },
  { href: '/battles', title: 'Speaking battles', text: 'Quick vocabulary and grammar duels' },
  { href: '/progress', title: 'Progress', text: 'Streaks, minutes, scores and achievements' },
  { href: '/notifications', title: 'Notifications', text: 'Feedback, reminders and messages' },
  { href: '/profile', title: 'Profile', text: 'Name, level, goals and IELTS target' },
  { href: '/settings', title: 'Settings & privacy', text: 'Notifications, calls, blocked users, account' },
  { href: '/premium', title: 'Plan', text: 'Free and Premium features' },
];

export default function More() {
  const { me, logout } = useAuth();
  const t = useTheme();
  return (
    <Screen>
      {me && (
        <Card>
          <Text style={{ color: t.text, fontWeight: '800', fontSize: 18 }}>{me.profile.displayName}</Text>
          <Row><Badge text={me.plan === 'premium' ? 'Premium' : 'Free plan'} tone={me.plan === 'premium' ? 'amber' : 'slate'} />{me.profile.cefrLevel && <Badge text={`Level ${me.profile.cefrLevel} (estimate)`} />}</Row>
          <P muted>{me.email}</P>
        </Card>
      )}
      {LINKS.map((l) => (
        <Card key={String(l.href)} onPress={() => router.push(l.href)}>
          <Text style={{ color: t.text, fontWeight: '700' }}>{l.title}</Text>
          <P muted>{l.text}</P>
        </Card>
      ))}
      <Button variant="secondary" title="Log out" onPress={() => Alert.alert('Log out?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', onPress: () => logout() }])} />
    </Screen>
  );
}
