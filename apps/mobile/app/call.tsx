import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { CEFR_LABELS, PRACTICE_MODE_LABELS } from '@app/shared';
import { api, errorMessage } from '../src/lib/api';
import { useCall } from '../src/lib/call';
import { fmtDuration, useInterval } from '../src/lib/hooks';
import { useTheme } from '../src/lib/theme';
import { Avatar, Badge, Button, Card, Chip, ErrorText, H2, Notice, P, Row, Screen } from '../src/components/ui';

const LABEL: Record<string, string> = { requesting_mic: 'Starting microphone…', connecting: 'Establishing connection…', connected: 'Connected', reconnecting: 'Reconnecting…', ended: 'Call completed', failed: 'Connection failed' };
const REASONS: [string, string][] = [['harassment', 'Harassment'], ['hate_speech', 'Hate speech'], ['sexual_content', 'Sexual content'], ['spam_or_scam', 'Spam or scam'], ['underage', 'Appears under 18'], ['other', 'Something else']];

export function ReportPanel({ callId, onDone }: { callId: string; onDone: () => void }) {
  const [reason, setReason] = useState('harassment');
  const [details, setDetails] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const send = async (block: boolean, reportToo: boolean) => {
    try {
      if (reportToo) await api.post('/safety/report', { callId, reason, details: details || undefined, alsoBlock: block });
      else await api.post('/safety/block', { callId });
      setDone(true);
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  if (done) return <Card><Notice tone="success" text="Thank you. Moderators will review this, and you won't be matched again." /><Button title="Close" onPress={onDone} /></Card>;
  return (
    <Card>
      <H2>Report or block</H2>
      <Row wrap>{REASONS.map(([k, l]) => <Chip key={k} label={l} on={reason === k} onPress={() => setReason(k)} />)}</Row>
      <ErrorText error={err} />
      <Button variant="danger" title="Report and block" onPress={() => send(true, true)} />
      <Button variant="secondary" title="Block only" onPress={() => send(true, false)} />
      <Button variant="ghost" title="Cancel" onPress={onDone} />
    </Card>
  );
}

export default function CallScreen() {
  useKeepAwake();
  const t = useTheme();
  const { session, snapshot } = useCall();
  const [now, setNow] = useState(Date.now());
  const [prompt, setPrompt] = useState(0);
  const [report, setReport] = useState(false);
  useInterval(() => setNow(Date.now()), 500);
  useEffect(() => {
    if (!session) router.replace('/(tabs)/speaking');
  }, [session]);
  useEffect(() => {
    if (snapshot && (snapshot.state === 'ended' || snapshot.state === 'failed')) router.replace('/call-summary');
  }, [snapshot]);
  if (!session || !snapshot) return null;
  const info = session.info;
  const elapsed = snapshot.connectedAt ? Math.floor((now - snapshot.connectedAt) / 1000) : 0;
  return (
    <Screen>
      <Row><View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: snapshot.state === 'connected' ? t.success : t.warning }} /><P>{LABEL[snapshot.state]}</P></Row>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Avatar avatar={info.partner.avatar} size={110} />
        <H2>{info.partner.anonName}</H2>
        <Row><Badge label={info.partner.level ? `${info.partner.level} · ${CEFR_LABELS[info.partner.level]}` : 'Level hidden'} tone="primary" />{snapshot.partnerMuted && <Badge label="🔇 Partner muted" tone="warning" />}</Row>
        <P muted>{PRACTICE_MODE_LABELS[info.mode]} · {info.topicLabel}</P>
        <Text style={{ fontSize: 40, fontWeight: '800', color: t.text, fontVariant: ['tabular-nums'] }}>{fmtDuration(elapsed)}</Text>
        {snapshot.partnerState === 'reconnecting' && <Notice tone="warning" text="Your partner's connection is unstable…" />}
        {snapshot.secondsLeftWarning != null && <Notice tone="warning" text="This call ends in about a minute (plan limit)." />}
        <ErrorText error={snapshot.error} />
      </View>
      <Row style={{ justifyContent: 'center', gap: 28 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={snapshot.muted ? 'Unmute' : 'Mute'} accessibilityState={{ selected: snapshot.muted }} onPress={() => session.setMuted(!snapshot.muted)}
          style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: snapshot.muted ? t.dangerSoft : t.surface2, borderWidth: 1, borderColor: snapshot.muted ? t.danger : t.border }}>
          <Text style={{ fontSize: 28 }}>{snapshot.muted ? '🔇' : '🎙️'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="End call" onPress={() => session.hangUp()} style={{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: t.danger }}>
          <Text style={{ fontSize: 30 }}>📞</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Report or block" onPress={() => setReport(true)} style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface2, borderWidth: 1, borderColor: t.border }}>
          <Text style={{ fontSize: 26 }}>🚩</Text>
        </Pressable>
      </Row>
      <P small muted style={{ textAlign: 'center' }}>{snapshot.muted ? 'You are muted' : 'Microphone on'} · Use headphones for best audio</P>
      {report && <ReportPanel callId={info.id} onDone={() => setReport(false)} />}
      {info.mode === 'ielts_speaking' && info.ielts ? (
        <Card>
          <H2>🎯 IELTS partner script</H2>
          <P small muted>Part 1 · {info.ielts.part1.topic}</P>
          {info.ielts.part1.questions.map((q) => <P key={q}>• {q}</P>)}
          <P small muted>Part 2 cue card (1 min prep, 2 min talk)</P>
          <P style={{ fontWeight: '700' }}>{info.ielts.part2.cueCard}</P>
          {info.ielts.part2.bullets.map((b) => <P key={b} small>– {b}</P>)}
          <P small muted>Part 3</P>
          {info.ielts.part3.questions.map((q) => <P key={q}>• {q}</P>)}
        </Card>
      ) : info.prompts.length > 0 && (
        <Card>
          <H2>💡 Conversation prompt</H2>
          <P>{info.prompts[prompt % info.prompts.length]}</P>
          <Button small variant="secondary" title="Next prompt" onPress={() => setPrompt((p) => p + 1)} />
        </Card>
      )}
    </Screen>
  );
}
