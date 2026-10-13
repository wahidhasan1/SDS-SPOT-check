import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { PRACTICE_MODE_LABELS, type PracticeMode } from '@app/shared';
import { useAuth } from '../../src/lib/auth';
import { useCall } from '../../src/lib/call';
import { fmtDuration, useApi, useInterval } from '../../src/lib/hooks';
import { Button, Card, Chip, H1, H2, Loading, Notice, P, Row, Screen } from '../../src/components/ui';

export default function Speaking() {
  const { user, entitlements, refreshEntitlements } = useAuth();
  const { phase, match, start, cancel } = useCall();
  const topics = useApi<any[]>('/calls/topics');
  const [mode, setMode] = useState<PracticeMode>('free_talk');
  const [topic, setTopic] = useState('random');
  const [now, setNow] = useState(Date.now());
  useInterval(() => setNow(Date.now()), phase === 'queued' ? 1000 : null);
  useEffect(() => {
    void refreshEntitlements();
  }, [refreshEntitlements]);
  const limits = entitlements?.limits;
  const left = limits?.callsPerDay == null ? null : Math.max(0, limits.callsPerDay - (entitlements?.usageToday.calls ?? 0));
  const visible = (topics.data ?? []).filter((t) => t.mode === 'any' || t.mode === mode);
  if (phase === 'queued') {
    return (
      <Screen>
        <H1>Finding a speaking partner…</H1>
        <P muted>{PRACTICE_MODE_LABELS[mode]} · {visible.find((t) => t.id === topic)?.label}</P>
        <H2>{fmtDuration((now - (match.queuedAt ?? now)) / 1000)}</H2>
        <P>{match.waitingCount == null ? 'Looking for learners online…' : match.waitingCount === 0 ? 'No one else is searching right now. Stay here and we will connect you as soon as someone joins.' : `${match.waitingCount} other learner(s) searching.`}</P>
        {match.levelRange != null && match.levelRange > 1 && <Notice text={`Widening level range to ±${match.levelRange}`} />}
        <Button title="Cancel matching" variant="secondary" onPress={cancel} />
      </Screen>
    );
  }
  return (
    <Screen>
      <H1>Speaking</H1>
      <Card>
        <H2>🎧 Find a speaking partner</H2>
        <P small muted>Anonymous live voice call. Not recorded. Your partner sees only {user?.anonName}.</P>
        <Row wrap>
          {(['free_talk', 'ielts_speaking'] as PracticeMode[]).map((m) => <Chip key={m} label={PRACTICE_MODE_LABELS[m]} on={mode === m} onPress={() => { setMode(m); setTopic(m === 'ielts_speaking' ? 'ielts_part1' : 'random'); }} />)}
        </Row>
        {topics.loading ? <Loading /> : (
          <Row wrap>
            {visible.map((t) => {
              const locked = t.premium && !limits?.premiumTopics;
              return <Chip key={t.id} label={`${t.label}${locked ? ' 🔒' : ''}`} on={topic === t.id} disabled={locked} onPress={() => setTopic(t.id)} />;
            })}
          </Row>
        )}
        {match.message && <Notice text={match.message} tone="warning" />}
        <Button title="🎙️ Start call" disabled={left === 0} onPress={() => void start(mode, topic)} testID="start-call" />
        <P small muted>{left == null ? 'Unlimited calls' : `${left} of ${limits?.callsPerDay} calls left today`} · up to {limits?.maxCallMinutes ?? '…'} min</P>
      </Card>
      <Card onPress={() => router.push('/ielts/speaking')}><H2>🤖 Practise without a partner</H2><P small muted>IELTS Parts 1–3 with timers, transcription and feedback.</P></Card>
      <Card onPress={() => router.push('/call-history')}><H2>📞 Call history</H2></Card>
      <Card><P small muted>Safety: never share personal contact details. Use Report or Block at any time. Blocked users are never matched with you again on any device.</P></Card>
    </Screen>
  );
}
