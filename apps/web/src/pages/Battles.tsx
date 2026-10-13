import { useEffect, useRef, useState } from 'react';
import { BATTLE_TYPE_LABELS, type BattleQuestionPublic, type BattleType, type ServerMessage } from '@app/shared';
import { api, realtime } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDate, useApi, useInterval } from '../lib/hooks';
import { Avatar, Empty, ErrorBox, Loading, PageHeader } from '../components/ui';

type Phase = 'lobby' | 'queued' | 'starting' | 'question' | 'reveal' | 'ended';

const DESCRIPTIONS: Record<BattleType, string> = {
  vocabulary: 'Pick the right meaning, fast.',
  grammar: 'Choose the grammatically correct option.',
  word_meaning: 'Match words to their meanings.',
  synonym: 'Find the closest synonym.',
  spelling: 'Type the word from its definition.',
  sentence_formation: 'Pick the correctly ordered sentence.',
  quick_quiz: 'A mix of everything.',
  ielts_vocabulary: 'Academic and IELTS topic words.',
};

export function BattlesPage() {
  const { refreshUser } = useAuth();
  const [phase, setPhase] = useState<Phase>('lobby');
  const [info, setInfo] = useState<any>(null);
  const [q, setQ] = useState<BattleQuestionPublic | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [skew, setSkew] = useState(0);
  const [myAnswer, setMyAnswer] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [oppAnswered, setOppAnswered] = useState(false);
  const [reveal, setReveal] = useState<any>(null);
  const [end, setEnd] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [reported, setReported] = useState(false);
  const battleRef = useRef<string | null>(null);
  const board = useApi<any>('/battles/leaderboard');
  const history = useApi<any[]>('/battles/history');
  useInterval(() => setNow(Date.now()), phase === 'question' ? 200 : null);

  useEffect(() => {
    const off = realtime.on((m: ServerMessage) => {
      switch (m.t) {
        case 'battle.status':
          if (m.status === 'queued') setPhase('queued');
          else {
            setPhase('lobby');
            if (m.message) setMsg(m.message);
          }
          break;
        case 'battle.start':
          battleRef.current = m.battleId;
          setInfo(m);
          setReveal(null);
          setEnd(null);
          setReported(false);
          setPhase('starting');
          break;
        case 'battle.question':
          setQ(m.question);
          setDeadline(m.deadline);
          setSkew(Date.now() - m.serverNow);
          setMyAnswer(null);
          setText('');
          setOppAnswered(false);
          setReveal(null);
          setPhase('question');
          break;
        case 'battle.opponent_answered':
          setOppAnswered(true);
          break;
        case 'battle.reveal':
          setReveal(m);
          setPhase('reveal');
          break;
        case 'battle.end':
          setEnd(m);
          setPhase('ended');
          battleRef.current = null;
          board.reload();
          history.reload();
          void refreshUser();
          break;
        case 'error':
          if (phase === 'queued' || phase === 'lobby') setMsg(m.message);
          break;
      }
    });
    return () => void off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (battleRef.current) realtime.send({ t: 'battle.leave', battleId: battleRef.current });
    else realtime.send({ t: 'battle.cancel' });
  }, []);

  const join = (battleType: BattleType, ranked: boolean) => {
    setMsg(null);
    setPhase(ranked ? 'queued' : 'starting');
    realtime.send({ t: 'battle.join', battleType, ranked });
  };
  const answer = (a: string) => {
    if (!info || !q || myAnswer !== null) return;
    setMyAnswer(a);
    realtime.send({ t: 'battle.answer', battleId: info.battleId, index: q.index, answer: a });
  };
  const leave = () => {
    if (info) realtime.send({ t: 'battle.leave', battleId: info.battleId });
  };
  const report = async (block: boolean) => {
    if (!end) return;
    await api.post('/safety/report', { battleId: end.battleId, reason: 'inappropriate_language', alsoBlock: block }).catch(() => undefined);
    setReported(true);
  };

  const left = Math.max(0, Math.ceil((deadline - (now - skew)) / 1000));
  const scores = reveal?.scores;

  if (phase === 'lobby') {
    return (
      <div className="stack lg">
        <PageHeader title="Battles" subtitle="Compete in real-time quiz duels. Your battle rating is separate from your English level." />
        {msg && <div className="alert warning">{msg}</div>}
        <div className="grid cols-4">
          {(Object.keys(BATTLE_TYPE_LABELS) as BattleType[]).map((t) => (
            <div key={t} className="card stack" style={{ gap: 8 }}>
              <b>{BATTLE_TYPE_LABELS[t]}</b>
              <span className="small muted">{DESCRIPTIONS[t]}</span>
              <div className="row wrap">
                <button className="btn sm" onClick={() => join(t, true)} data-testid={`ranked-${t}`}>⚔️ Ranked</button>
                <button className="btn secondary sm" onClick={() => join(t, false)} data-testid={`solo-${t}`}>Solo practice</button>
              </div>
            </div>
          ))}
        </div>
        <div className="grid cols-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <h3>Leaderboard</h3>
            {board.loading ? <Loading /> : (
              <>
                <div className="small muted mb">Your rating: <b>{board.data.me.rating}</b>{board.data.me.rank ? ` · rank #${board.data.me.rank}` : ''}{!board.data.me.visible && ' (hidden — change in profile privacy)'}</div>
                {!board.data.top.length ? <Empty icon="🏆" title="No ranked battles yet" /> : (
                  <div className="list">
                    {board.data.top.slice(0, 15).map((r: any) => (
                      <div key={r.rank} className="list-item" style={r.isMe ? { background: 'var(--primary-soft)' } : undefined}>
                        <b style={{ width: 28 }}>#{r.rank}</b><Avatar avatar={r.avatar} /><span style={{ flex: 1 }}>{r.anonName}</span><b>{r.rating}</b>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="card">
            <h3>Recent battles</h3>
            {history.loading ? <Loading /> : !history.data?.length ? <Empty icon="⚔️" title="No battles yet" /> : (
              <table className="table small"><tbody>
                {history.data.slice(0, 12).map((h: any) => (
                  <tr key={h.id}>
                    <td>{BATTLE_TYPE_LABELS[h.battle_type as BattleType]}<div className="tiny muted">{formatDate(h.created_at)}</div></td>
                    <td>{h.ranked ? `vs ${h.opponent_name ?? '—'}` : 'Solo'}</td>
                    <td>{h.score}{h.opponent_score != null ? ` – ${h.opponent_score}` : ''}</td>
                    <td><span className={`badge ${h.result === 'win' ? 'success' : h.result === 'loss' ? 'danger' : ''}`}>{h.result ?? h.status}</span></td>
                    <td>{h.rating_after != null ? `${h.rating_after - h.rating_before >= 0 ? '+' : ''}${h.rating_after - h.rating_before}` : ''}</td>
                  </tr>
                ))}
              </tbody></table>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack lg" style={{ maxWidth: 820, margin: '0 auto' }}>
      {phase === 'queued' && (
        <div className="card match-stage">
          <div className="pulse" aria-hidden><span className="ring" /><span className="ring" /><span className="ring" /><div className="core">⚔️</div></div>
          <h2 data-testid="battle-status">Finding an opponent…</h2>
          <p className="muted small">Matching you with a player of similar battle rating.</p>
          <button className="btn secondary" onClick={() => { realtime.send({ t: 'battle.cancel' }); setPhase('lobby'); }}>Cancel</button>
        </div>
      )}
      {info && phase !== 'queued' && (
        <div className="card row between">
          <div className="row"><b>{BATTLE_TYPE_LABELS[info.battleType as BattleType]}</b><span className="badge">{info.ranked ? 'Ranked' : 'Solo practice'}</span></div>
          {info.opponent ? (
            <div className="row"><span className="small muted">vs</span><Avatar avatar={info.opponent.avatar} /><b data-testid="opponent-name">{info.opponent.anonName}</b><span className="tiny muted">{info.opponent.rating}</span></div>
          ) : <span className="small muted">Just you</span>}
        </div>
      )}
      {phase === 'starting' && <div className="card center"><h2>Get ready…</h2><p className="muted">{info ? `${info.questionCount} questions · ${info.secondsPerQuestion}s each` : 'Preparing questions…'}</p></div>}
      {(phase === 'question' || phase === 'reveal') && q && (
        <div className="card stack">
          <div className="row between">
            <span className="small muted">Question {q.index + 1} of {info.questionCount}</span>
            <span className={`timer ${left <= 5 ? 'low' : ''}`} data-testid="battle-timer">{phase === 'question' ? `${left}s` : '—'}</span>
          </div>
          <h2 data-testid="battle-question">{q.prompt}</h2>
          {q.hint && <div className="small muted">Hint: {q.hint}</div>}
          {q.kind === 'mcq' ? (
            <div className="grid cols-2">
              {q.options!.map((o) => {
                const isCorrect = reveal && o === reveal.correctAnswer;
                const isMineWrong = reveal && myAnswer === o && !reveal.you.correct;
                return (
                  <button key={o} disabled={phase !== 'question' || myAnswer !== null} className={`option ${myAnswer === o ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isMineWrong ? 'wrong' : ''}`} onClick={() => answer(o)}>
                    {o}
                  </button>
                );
              })}
            </div>
          ) : (
            <form className="row" onSubmit={(e) => { e.preventDefault(); answer(text); }}>
              <input className="input" value={text} disabled={myAnswer !== null || phase !== 'question'} onChange={(e) => setText(e.target.value)} autoFocus aria-label="Your answer" />
              <button className="btn" disabled={!text.trim() || myAnswer !== null}>Submit</button>
            </form>
          )}
          <div className="small muted">
            {phase === 'question' && (myAnswer !== null ? 'Answer locked in. Waiting…' : 'Choose quickly — faster correct answers earn more points.')}
            {phase === 'question' && info?.opponent && oppAnswered && ' · Your opponent has answered.'}
          </div>
          {reveal && (
            <div className={`alert ${reveal.you.correct ? 'success' : 'warning'}`}>
              {reveal.you.correct ? `Correct! +${reveal.you.points}` : `Correct answer: ${reveal.correctAnswer}`}
              {reveal.explanation && <div className="small">{reveal.explanation}</div>}
              {reveal.opponent && <div className="small">Opponent: {reveal.opponent.answered ? (reveal.opponent.correct ? `correct (+${reveal.opponent.points})` : 'wrong') : 'no answer'}</div>}
            </div>
          )}
          {scores && <div className="row"><b>You: {scores.me}</b>{scores.opponent != null && <span>· Opponent: {scores.opponent}</span>}</div>}
          <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={leave}>Leave battle</button>
        </div>
      )}
      {phase === 'ended' && end && (
        <div className="card pad-lg center stack" data-testid="battle-end">
          <div style={{ fontSize: 48 }}>{end.result === 'win' ? '🏆' : end.result === 'loss' ? '💪' : end.result === 'draw' ? '🤝' : '✅'}</div>
          <h1>{end.result === 'win' ? 'You won!' : end.result === 'loss' ? 'Good effort!' : end.result === 'draw' ? "It's a draw" : 'Practice complete'}</h1>
          {end.reason === 'opponent_left' && <p className="muted">Your opponent left the battle.</p>}
          {end.reason === 'you_left' && <p className="muted">You left the battle.</p>}
          <p>Score: <b>{end.scores.me}</b>{end.scores.opponent != null ? ` – ${end.scores.opponent}` : ''}</p>
          {end.ratingAfter != null && <p>Battle rating: {end.ratingBefore} → <b>{end.ratingAfter}</b> ({end.ratingAfter - end.ratingBefore >= 0 ? '+' : ''}{end.ratingAfter - end.ratingBefore})</p>}
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={() => setPhase('lobby')}>Back to battles</button>
            {info?.opponent && !reported && <button className="btn ghost" onClick={() => report(true)}>🚩 Report & block opponent</button>}
            {reported && <span className="small muted">Reported. You won't be matched again.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export { ErrorBox };
