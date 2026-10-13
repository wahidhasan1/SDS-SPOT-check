import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { api, errorMessage } from '../lib/api';
import { fmtDuration, useInterval } from '../lib/hooks';
import { useTheme } from '../lib/theme';
import { Badge, Button, Card, ErrorText, H2, Notice, P, Row } from './ui';

/**
 * Speaking answer capture using the device's speech recognizer (iOS/Android native,
 * browser on web). Audio is not stored; only the transcript is sent for analysis.
 */
export function SpeakingRecorder({ part, question, promptId, prepSeconds = 0, speakSeconds, mockAttemptId, onResult }: { part: 1 | 2 | 3; question: string; promptId?: string; prepSeconds?: number; speakSeconds: number; mockAttemptId?: string; onResult?: (r: any) => void }) {
  const t = useTheme();
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'recording' | 'review' | 'analysing' | 'done'>('idle');
  const [consent, setConsent] = useState(false);
  const [startAt, setStartAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [finalText, setFinal] = useState('');
  const [interim, setInterim] = useState('');
  const [source, setSource] = useState<'native_speech' | 'typed'>('native_speech');
  const [duration, setDuration] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const acc = useRef('');
  useInterval(() => {
    setNow(Date.now());
    const el = (Date.now() - startAt) / 1000;
    if (phase === 'preparing' && el >= prepSeconds) void begin();
    if (phase === 'recording' && el >= speakSeconds) stop();
  }, phase === 'preparing' || phase === 'recording' ? 300 : null);

  useSpeechRecognitionEvent('result', (ev) => {
    const text = ev.results[0]?.transcript ?? '';
    if (ev.isFinal) {
      acc.current = (acc.current + ' ' + text).trim();
      setFinal(acc.current);
      setInterim('');
    } else setInterim(text);
  });
  useSpeechRecognitionEvent('error', (ev) => {
    if (ev.error !== 'no-speech' && ev.error !== 'aborted') setErr(`Speech recognition: ${ev.message || ev.error}. You can type or correct your answer.`);
  });

  async function begin() {
    setErr(null);
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) throw new Error('denied');
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) throw new Error('unavailable');
      acc.current = '';
      setFinal('');
      ExpoSpeechRecognitionModule.start({ lang: 'en-GB', interimResults: true, continuous: true });
      setSource('native_speech');
      setStartAt(Date.now());
      setPhase('recording');
    } catch (e) {
      setSource('typed');
      setErr((e as Error).message === 'denied' ? 'Microphone or speech permission was denied. You can type your answer instead.' : 'Speech recognition is not available on this device. You can type your answer instead.');
      setPhase('review');
    }
  }
  function stop() {
    setDuration(Math.max(1, Math.round((Date.now() - startAt) / 1000)));
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      setFinal((f) => (f + (interim ? ' ' + interim : '')).trim());
      setInterim('');
      setPhase('review');
    }, 600);
  }
  const analyse = async () => {
    const transcript = finalText.trim();
    if (!transcript) return setErr('There is no transcript to analyse.');
    setPhase('analysing');
    try {
      const r = await api.post<any>('/ielts/speaking/analyse', { promptId, part, question, transcript, durationSec: duration || Math.max(5, transcript.split(/\s+/).length / 2), transcriptSource: source, consent: true, mockAttemptId });
      setResult(r);
      setPhase('done');
      onResult?.(r);
    } catch (e) {
      setErr(errorMessage(e));
      setPhase('review');
    }
  };
  const el = Math.floor((now - startAt) / 1000);
  return (
    <View style={{ gap: 10 }}>
      {phase === 'idle' && (
        <>
          <Pressable onPress={() => setConsent(!consent)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }} style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ fontSize: 20, color: t.primary }}>{consent ? '☑' : '☐'}</Text>
            <Text style={{ color: t.text, flex: 1, fontSize: 13 }}>I agree to my answer being transcribed by my device's speech recognition service and the transcript analysed for feedback. Audio is not stored by the app.</Text>
          </Pressable>
          <Button title={prepSeconds ? `Start ${prepSeconds}s preparation` : '🎙️ Start speaking'} disabled={!consent} onPress={() => (prepSeconds ? (setStartAt(Date.now()), setPhase('preparing')) : void begin())} />
          <Button variant="ghost" title="Type my answer instead" disabled={!consent} onPress={() => { setSource('typed'); setPhase('review'); }} />
        </>
      )}
      {(phase === 'preparing' || phase === 'recording') && (
        <Card style={{ alignItems: 'center' }}>
          <Badge label={phase === 'preparing' ? 'Preparation' : '● Recording'} tone={phase === 'recording' ? 'danger' : 'primary'} />
          <Text style={{ fontSize: 36, fontWeight: '800', color: t.text }}>{fmtDuration((phase === 'preparing' ? prepSeconds : speakSeconds) - el)}</Text>
          {phase === 'recording' && <P small>{finalText} <P small muted>{interim}</P></P>}
          {phase === 'preparing' ? <Button title="Start speaking now" onPress={() => void begin()} /> : <Button variant="danger" title="■ Stop" onPress={stop} />}
        </Card>
      )}
      {phase === 'review' && (
        <>
          <P small muted>{source === 'typed' ? 'Type what you said:' : 'Transcript — correct any recognition mistakes:'}</P>
          <TextInput multiline value={finalText} onChangeText={setFinal} style={{ minHeight: 120, borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 10, color: t.text, textAlignVertical: 'top' }} />
          {source === 'typed' && <TextInput keyboardType="number-pad" placeholder="Seconds you spoke" placeholderTextColor={t.textMuted} value={duration ? String(duration) : ''} onChangeText={(v) => setDuration(Number(v.replace(/\D/g, '')))} style={{ borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 10, color: t.text }} />}
          <Row><Button title="Get feedback" onPress={analyse} /><Button variant="secondary" title="Try again" onPress={() => setPhase('idle')} /></Row>
        </>
      )}
      {phase === 'analysing' && <P>Analysing…</P>}
      <ErrorText error={err} />
      {phase === 'done' && result && (
        <Card>
          {result.feedback ? (
            <>
              <Row between><H2>Feedback</H2><Badge label={`≈ ${result.band_estimate}`} tone="primary" /></Row>
              <P small muted>Unofficial estimate from the transcript; pronunciation not assessed.</P>
              <P>{result.feedback.summary}</P>
              {result.feedback.priorities.map((p: string) => <P key={p} small>• {p}</P>)}
            </>
          ) : <Notice text={result.metrics?.aiError ?? 'AI feedback unavailable.'} />}
          {result.metrics?.checks.map((c: any) => <P key={c.id} small>{c.status === 'good' ? '✅' : c.status === 'warn' ? '⚠️' : 'ℹ️'} {c.title}</P>)}
          <Button small variant="secondary" title="Answer again" onPress={() => setPhase('idle')} />
        </Card>
      )}
    </View>
  );
}
