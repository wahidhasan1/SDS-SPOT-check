import { Linking } from 'react-native';

import { Button, Card, Screen, SectionHeader, Text } from '@/components/ui';
import { env } from '@/lib/env';

const FAQ = [
  ['How is my level decided?', 'An adaptive assessment estimates your level from your answers. You cannot choose or edit it. It is a provisional app level inspired by CEFR, not an official IELTS score or certified CEFR result. Retakes are limited and move your level by at most one step.'],
  ['Why is my battle rating different from my level?', 'Your rating measures competitive results against other players (an Elo-style system). Your level measures English proficiency. They are separate on purpose.'],
  ['How are battles kept fair?', 'The server chooses the questions, measures answer time, checks answers and calculates scores and ratings. Repeated games against the same player stop being rated, and suspiciously fast answering is flagged for review.'],
  ['What happens if I lose connection?', 'Stay on the battle screen — you have 30 seconds to reconnect. If only your opponent disconnects, you win. If both players drop (for example a server problem), the match is voided with no rating change and the battle is given back.'],
  ['Who can see my information?', 'Other learners can see your username, avatar, level, battle rating, battle count, win rate and (if you allow) streak and badges. Your email and other private details are never shown. In battles you appear under a temporary pseudonym unless you choose otherwise.'],
  ['Where is the AI reading assistant?', 'Photographing book pages, tap-to-explain words and page translation arrive in Phase 2. You can already save words you meet while reading from the Read tab.'],
  ['How do I delete my account?', 'Settings → Account security → Delete account. Deletion is permanent.'],
];

/** Help and support. */
export default function Help() {
  return (
    <Screen title="Help & support" back>
      {FAQ.map(([q, a]) => (
        <Card key={q}>
          <Text variant="bodyStrong">{q}</Text>
          <Text variant="small" color="textMuted">{a}</Text>
        </Card>
      ))}
      <SectionHeader title="Contact" />
      {env.supportEmail ? (
        <Button title={`Email ${env.supportEmail}`} icon="mail" variant="secondary" onPress={() => Linking.openURL(`mailto:${env.supportEmail}`)} />
      ) : <Text color="textMuted">Support contact is not configured for this build (EXPO_PUBLIC_SUPPORT_EMAIL).</Text>}
    </Screen>
  );
}
