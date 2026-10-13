import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import type { BattleKind, BattleQuestionPublic, ServerMessage } from '@fluentpath/shared';
import { Badge, Button, Card, Chip, H2, Notice, P, Progress, Row, Screen } from '../src/components/ui';
import { useAuth } from '../src/lib/auth';
import { realtime, useRealtimeStatus } from '../src/lib/realtime';
import { useTheme } from '../src/lib/theme';

type Start = Extract<ServerMessage, { type: 'battle.start' }>;
type End = Extract<ServerMessage, { type: 'battle.end' }>['results'];

export default function Battles() {
  const t = useTheme();
  const { refresh } = useAuth();
  const status = useRealtimeStatus();
  const [kind, setKind] = useState<BattleKind>('vocabulary');
  const [phase, setPhase] = useState<'setup' | 'queued' | 'playing' | 'done'>('setup');
  const [battle, setBattle] = useState<Start | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<Record<number, { choice: string; correct?: boolean; correctAnswer?: string; points?: number }>>({});
  const [score, setScore] = useState(0);
  const [opp, setOpp] = useState({ answered: 0, score: 0 });
  const [result, setResult] = useState<End | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const battleRef = useRef(battle);
  battleRef.current = battle;

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(i); }, []);
  useEffect(() => realtime.subscribe((m) => {
    switch (m.type) {
      case 'battle.queued': setPhase('queued'); break;
      case 'battle.queue.left': setPhase('setup'); break;
      case 'battle.start': setBattle(m); setIndex(0); setPicked({}); setScore(0); setOpp({ answered: 0, score: 0 }); setResult(null); setPhase('playing'); break;
      case 'battle.answer_result':
        setPicked((p) => ({ ...p, [m.index]: { ...p[m.index], correct: m.correct, correctAnswer: m.correctAnswer, points: m.points } }));
        setScore(m.score);
        setTimeout(() => setIndex((i) => Math.max(i, m.index + 1)), 900);
        break;
      case 'battle.opponent_progress': setOpp({ answered: m.answered, score: m.score }); break;
      case 'battle.end': setResult(m.results); setPhase('done'); refresh().catch(() => {}); break;
      case 'error': setError(m.message); if (phaseRef.current === 'queued') setPhase('setup'); break;
    }
  }), [refresh]);
  useFocusEffect(useCallback(() => () => {
    if (phaseRef.current === 'queued') realtime.send({ type: 'battle.queue.leave' });
    if (phaseRef.current === 'playing' && battleRef.current) realtime.send({ type: 'battle.forfeit', battleId: battleRef.current.battleId });
  }, []));

  const q: BattleQuestionPublic | undefined = battle?.questions[index];
  const qStart = battle ? battle.startsAt + index * battle.secondsPerQuestion * 1000 : 0;
  const left = battle ? Math.max(0, Math.ceil((qStart + battle.secondsPerQuestion * 1000 - now) / 1000)) : 0;
  const waiting = battle ? now < battle.startsAt : false;
  const answer = (choice: string) => {
    if (!battle || !q || picked[q.index]) return;
    setPicked((p) => ({ ...p, [q.index]: { choice } }));
    realtime.send({ type: 'battle.answer', battleId: battle.battleId, index: q.index, choice });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Battles' }} />
      {error && <Notice tone="error" text={error} />}
      {(phase === 'setup' || phase === 'done') && (
        <>
          {result && (
            <Card>
              <H2>{result.outcome === 'win' ? 'You won! 🎉' : result.outcome === 'draw' ? 'Draw' : 'You lost this one'}</H2>
              <P>You {result.you} · Opponent {result.opponent}</P>
              {result.reason !== 'completed' && <P muted>{result.reason === 'opponent_left' ? 'Your opponent left the battle.' : result.reason === 'you_left' ? 'You left the battle.' : ''}</P>}
            </Card>
          )}
          <P muted>Answer quickly: 100 points for a correct answer plus up to 50 for speed. Everyone gets the same questions at the same time.</P>
          <Row><Chip label="Vocabulary" selected={kind === 'vocabulary'} onPress={() => setKind('vocabulary')} /><Chip label="Grammar" selected={kind === 'grammar'} onPress={() => setKind('grammar')} /></Row>
          <Button title="Find an opponent" disabled={status !== 'open'} onPress={() => { setError(null); realtime.send({ type: 'battle.queue.join', kind }); }} />
        </>
      )}
      {phase === 'queued' && <Card><H2>Looking for an opponent…</H2><Button variant="secondary" title="Cancel" onPress={() => realtime.send({ type: 'battle.queue.leave' })} /></Card>}
      {phase === 'playing' && battle && (
        <>
          <Row><Badge text={`You ${score}`} tone="green" /><Badge text={`${battle.opponentAlias} ${opp.score}`} tone="slate" /><Badge text={`Q ${Math.min(index + 1, battle.questions.length)}/${battle.questions.length}`} /></Row>
          {waiting ? <Card><H2>Get ready… {Math.ceil((battle.startsAt - now) / 1000)}</H2></Card> : q ? (
            <Card>
              <Progress value={left} max={battle.secondsPerQuestion} />
              <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>{q.prompt}</Text>
              {q.options.map((o) => {
                const p = picked[q.index];
                const tone = p?.correctAnswer ? (o === p.correctAnswer ? 'success' : p.choice === o ? 'danger' : 'secondary') : p?.choice === o ? 'primary' : 'secondary';
                return <Button key={o} title={o} variant={tone as 'primary'} disabled={Boolean(p) && p.choice !== o && o !== p.correctAnswer} onPress={() => answer(o)} />;
              })}
              <P muted>{left}s left</P>
            </Card>
          ) : <Card><P>Waiting for the battle to finish…</P></Card>}
        </>
      )}
    </Screen>
  );
}
