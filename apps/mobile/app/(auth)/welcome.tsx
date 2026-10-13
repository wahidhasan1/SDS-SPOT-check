import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, H1, P, Screen } from '../../src/components/ui';
import { API_URL } from '../../src/lib/config';

export default function Welcome() {
  return (
    <Screen>
      <View style={{ height: 40 }} />
      <H1>FluentPath</H1>
      <P>Learn English, prepare for IELTS and practise speaking with real people — anonymously.</P>
      <Card>
        <P>• Grammar lessons and vocabulary flashcards</P>
        <P>• IELTS Reading, Listening, Writing and Speaking practice</P>
        <P>• Anonymous voice calls and live battles</P>
        <P>• Scan book pages and tap words for meanings</P>
      </Card>
      <Button title="Create a free account" onPress={() => router.push('/register')} />
      <Button title="I already have an account" variant="secondary" onPress={() => router.push('/login')} />
      <P muted style={{ fontSize: 12, textAlign: 'center' }}>Server: {API_URL}</P>
    </Screen>
  );
}
