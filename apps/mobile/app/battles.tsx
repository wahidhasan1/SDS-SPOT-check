import { useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { BATTLE_TYPE_LABELS, type BattleType, type ServerMessage } from '@app/shared';
import { realtime } from '../src/lib/api';
import { useApi, useInterval } from '../src/lib/hooks';
import { Avatar, Badge, Button, Card, H1, H2, Input, Notice, Option, P, Row, Screen } from '../src/components/ui';

export default function Battles() {
  const [phase, setPhase] = useState<'lobby' | 'queued' | 'playing' | 'ended'>('lobby');
  const [info, setInfo] = useState<any>(null);
  const [q, setQ] = useState<any>(null);
  const [deadline, setDeadline] = useState(0);
  const [mine, setMine] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [reveal, setReveal] = useState<any>(null);
  const [end, setEnd] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const idRef = useRef<string | null>(null);
  const board = useApi<any>('/battles/leaderboard');
  useInterval(() => setNow(Date.now()), phase === 'playing' ? 250 : null);
  useEffect(() => {
    const off = realtime.on((m: ServerMessage) => {
      if (m.t === 'battle.status') m.status === 'queued' ? setPhase('queued') : (setPhase('lobby'), m.message && setMsg(m.message));
      if (m.t === 'battle.start') { idRef.current = m.battleId; setInfo(m); setPhase('playing'); setReveal(null); setQ(null); }
      if (m.t === 'battle.question') { setQ(m.question); setDeadline(Date.now() + (m.deadline - m.serverNow)); setMine(null); setText(''); setReveal(null); }
      if (m.t === 'battle.reveal') setReveal(m);
      if (m.t === 'battle.end') { setEnd(m); setPhase('ended'); idRef.current = null; board.reload(); }
    });
    return () => {
      off();
      if (idRef.current) realtime.send({ t: 'battle.leave', battleId: idRef.current });
      else realtime.send({ t: 'battle.cancel' });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const answer = (a: string) => {
    if (mine !== null || !q || !info) return;
    setMine(a);
    realtime.send({ t: 'battle.answer', battleId: info.battleId, index: q.index, answer: a });
  };
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Battles' }} />
      {phase === 'lobby' && (
        <>
          {msg && <Notice tone="warning" text={msg} />}
          <P muted>Battle rating is separate from your English level. Rating: {board.data?.me.rating ?? '…'}{board.data?.me.rank ? ` · #${board.data.me.rank}` : ''}</P>
          {(Object.keys(BATTLE_TYPE_LABELS) as BattleType[]).map((t) => (
            <Card key={t}>
              <H2>{BATTLE_TYPE_LABELS[t]}</H2>
              <Row><Button small title="⚔️ Ranked" onPress={() => { setMsg(null); setPhase('queued'); realtime.send({ t: 'battle.join', battleType: t, ranked: true }); }} /><Button small variant="secondary" title="Solo" onPress={() => realtime.send({ t: 'battle.join', battleType: t, ranked: false })} /></Row>
            </Card>
          ))}
          <H2>Leaderboard</H2>
          {board.data?.top.slice(0, 10).map((r: any) => <Row key={r.rank} between><Row><P>#{r.rank}</P><Avatar avatar={r.avatar} size={30} /><P>{r.anonName}</P></Row><P>{r.rating}</P></Row>)}
        </>
      )}
      {phase === 'queued' && (
        <Card style={{ alignItems: 'center' }}>
          <H1>⚔️</H1><H2>Finding an opponent…</H2>
          <Button variant="secondary" title="Cancel" onPress={() => { realtime.send({ t: 'battle.cancel' }); setPhase('lobby'); }} />
        </Card>
      )}
      {phase === 'playing' && info && (
        <>
          <Card>
            <Row between><P>{BATTLE_TYPE_LABELS[info.battleType as BattleType]}</P>{info.opponent ? <Row><Avatar avatar={info.opponent.avatar} size={28} /><P>{info.opponent.anonName}</P></Row> : <Badge label="Solo" />}</Row>
          </Card>
          {!q ? <P>Get ready…</P> : (
            <Card>
              <Row between><P small muted>Question {q.index + 1}/{info.questionCount}</P><Badge label={reveal ? '—' : `${Math.max(0, Math.ceil((deadline - now) / 1000))}s`} tone="danger" /></Row>
              <H2>{q.prompt}</H2>
              {q.hint && <P small muted>{q.hint}</P>}
              {q.kind === 'mcq' ? q.options.map((o: string) => (
                <Option key={o} label={o} selected={mine === o} disabled={mine !== null || !!reveal} state={reveal ? (o === reveal.correctAnswer ? 'correct' : mine === o ? 'wrong' : null) : null} onPress={() => answer(o)} />
              )) : <Row><Input style={{ flex: 1 }} value={text} onChangeText={setText} autoCapitalize="none" editable={mine === null} /><Button small title="Submit" onPress={() => answer(text)} /></Row>}
              {reveal && <Notice tone={reveal.you.correct ? 'success' : 'warning'} text={`${reveal.you.correct ? `Correct +${reveal.you.points}` : `Answer: ${reveal.correctAnswer}`} · You ${reveal.scores.me}${reveal.scores.opponent != null ? ` – ${reveal.scores.opponent}` : ''}`} />}
            </Card>
          )}
          <Button variant="ghost" title="Leave battle" onPress={() => idRef.current && realtime.send({ t: 'battle.leave', battleId: idRef.current })} />
        </>
      )}
      {phase === 'ended' && end && (
        <Card style={{ alignItems: 'center' }}>
          <H1>{end.result === 'win' ? '🏆 You won!' : end.result === 'loss' ? '💪 Good effort' : end.result === 'draw' ? '🤝 Draw' : '✅ Done'}</H1>
          <P>Score {end.scores.me}{end.scores.opponent != null ? ` – ${end.scores.opponent}` : ''}</P>
          {end.ratingAfter != null && <P>Rating {end.ratingBefore} → {end.ratingAfter}</P>}
          <Button title="Back" onPress={() => setPhase('lobby')} />
        </Card>
      )}
    </Screen>
  );
}
