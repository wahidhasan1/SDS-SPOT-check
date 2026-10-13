import { useState } from 'react';
import { router } from 'expo-router';
import { PRACTICE_MODE_LABELS } from '@app/shared';
import { api, errorMessage } from '../src/lib/api';
import { useCall } from '../src/lib/call';
import { fmtDuration } from '../src/lib/hooks';
import { Button, Card, Chip, ErrorText, H1, H2, Input, Notice, P, Row, Screen } from '../src/components/ui';
import { ReportPanel } from './call';

const END: Record<string, string> = {
  hangup: 'You ended the call.', partner_ended: 'Your partner ended the call.', partner_disconnected: 'Your partner lost their connection.',
  connection_failed: 'The connection failed.', connect_timeout: 'An audio connection could not be established in time.', time_limit: 'The call reached your plan’s time limit.',
  mic_denied: 'Microphone access was denied.', blocked: 'The call ended because a user was blocked.', moderation: 'The call was ended by moderation.',
};

export default function Summary() {
  const { session, snapshot, clear } = useCall();
  const [rating, setRating] = useState(0);
  const [sent, setSent] = useState(false);
  const [word, setWord] = useState('');
  const [saved, setSaved] = useState<string[]>([]);
  const [report, setReport] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!session || !snapshot) {
    return <Screen><Button title="Back to speaking" onPress={() => router.replace('/(tabs)/speaking')} /></Screen>;
  }
  const info = session.info;
  const connected = snapshot.connectedAt != null;
  return (
    <Screen>
      <H1>{connected ? '🎉 Call completed' : 'Call ended'}</H1>
      <P muted>{END[snapshot.endReason ?? ''] ?? 'The call has ended.'}</P>
      <Card>
        <Row between><P>Duration</P><P>{fmtDuration(snapshot.durationSec)}</P></Row>
        <Row between><P>Mode</P><P>{PRACTICE_MODE_LABELS[info.mode]}</P></Row>
        <Row between><P>Topic</P><P>{info.topicLabel}</P></Row>
        <Row between><P>Status</P><P>{snapshot.endStatus}</P></Row>
      </Card>
      <Button title="🔁 Find another partner" onPress={() => { clear(); router.replace('/(tabs)/speaking'); }} />
      <Button title="🚩 Report or block" variant="secondary" onPress={() => setReport(true)} />
      {report && <ReportPanel callId={info.id} onDone={() => setReport(false)} />}
      <ErrorText error={err} />
      {connected && (
        <>
          <Card>
            <H2>Rate your partner</H2>
            {sent ? <Notice tone="success" text="Thanks for your feedback." /> : (
              <>
                <Row>{[1, 2, 3, 4, 5].map((n) => <Chip key={n} label="★" on={rating >= n} onPress={() => setRating(n)} />)}</Row>
                <Button small title="Send" disabled={!rating} onPress={async () => { try { await api.post(`/calls/${info.id}/feedback`, { rating }); setSent(true); } catch (e) { setErr(errorMessage(e)); } }} />
              </>
            )}
          </Card>
          <Card>
            <H2>Save new words</H2>
            <P small muted>Calls aren't recorded or transcribed, so add words you want to remember.</P>
            <Row><Input style={{ flex: 1 }} value={word} onChangeText={setWord} placeholder="e.g. itinerary" /><Button small title="Save" onPress={async () => { if (!word.trim()) return; await api.post('/vocabulary/saved', { word: word.trim(), source: 'call' }); setSaved((s) => [...s, word.trim()]); setWord(''); }} /></Row>
            {saved.length > 0 && <P small>Saved: {saved.join(', ')}</P>}
          </Card>
        </>
      )}
      <Card onPress={() => router.push('/ielts/speaking')}><P>🗣️ Next: solo speaking practice with feedback</P></Card>
    </Screen>
  );
}
