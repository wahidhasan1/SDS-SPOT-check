import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { APP_NAME } from '../src/lib/api';
import { Button, Card, P, Screen } from '../src/components/ui';
import { useTheme } from '../src/lib/theme';

export default function Welcome() {
  const t = useTheme();
  return (
    <Screen>
      <View style={{ backgroundColor: t.primary, borderRadius: 24, padding: 24, gap: 10, marginTop: 20 }}>
        <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>{APP_NAME}</Text>
        <Text style={{ color: '#fff', fontSize: 18 }}>Speak English with real people. Prepare for IELTS with confidence.</Text>
      </View>
      {[
        ['🎧', 'Anonymous live speaking partners'],
        ['🎯', 'IELTS Academic & General Training'],
        ['📷', 'Photograph a page and tap any word'],
        ['⚔️', 'Real-time vocabulary battles'],
      ].map(([i, s]) => (
        <Card key={s} style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ fontSize: 26 }}>{i}</Text><P>{s}</P></Card>
      ))}
      <Button title="Create free account" onPress={() => router.push('/register')} testID="go-register" />
      <Button title="I already have an account" variant="secondary" onPress={() => router.push('/login')} />
      <P small muted>Scores shown in the app are unofficial practice estimates.</P>
    </Screen>
  );
}
