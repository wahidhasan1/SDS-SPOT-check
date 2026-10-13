import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Flag, Mic, Swords, Trophy } from 'lucide-react';
import type { BattleKind, BattleQuestionPublic, ServerMessage } from '@fluentpath/shared';
import { RecorderPanel } from '../../components/learning/Recorder';
import { Alert, Badge, Button, Card, CardHeader, ChoiceChip, EmptyState, PageHeader, ProgressBar, Spinner, Tabs, useToast } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useMe } from '../../lib/auth';
import { formatDateTime } from '../../lib/format';
import { useRecorder } from '../../lib/recorder';
import { realtime, useRealtimeStatus } from '../../lib/realtime';
import { uploadSpeaking } from '../../lib/speaking';
import { useApi } from '../../lib/useApi';
import { ReportDialog } from './ReportDialog';

export default function Battles() {
  const [tab, setTab] = useState<'live' | 'challenge' | 'history'>('live');
  return (
    <div>
      <PageHeader eyebrow="Speak & play" title="Battles and challenges" description="Compete with another learner in a live quiz, or beat your own score in a timed speaking challenge." />
      <Tabs tabs={[{ id: 'live', label: 'Live battle' }, { id: 'challenge', label: 'Speaking challenge' }, { id: 'history', label: 'History' }]} value={tab} onChange={setTab} />
      {tab === 'live' && <LiveBattle />}
      {tab === 'challenge' && <SpeakingChallenge />}
      {tab === 'history' && <History />}
    </div>
  );
}

type Phase = 'choose' | 'waiting' | 'countdown' | 'playing' | 'finished';
interface Start { battleId: string; kind: BattleKind; opponentAlias: string; questions: BattleQuestionPublic[]; secondsPerQuestion: number; startsAt: number }

function LiveBattle() {
  const me = useMe();
  const status = useRealtimeStatus();
  const [kind, setKind] = useState<BattleKind>('vocabulary');
  const [phase, setPhase] = useState<Phase>('choose');
  const [battle, setBattle] = useState<Start | null>(null);
  const [index, setIndex] = useState(0);
  const [qStart, setQStart] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; correctAnswer: string; points: number } | null>(null);
  const [score, setScore] = useState(0);
  const [opp, setOpp] = useState({ answered: 0, score: 0 });
  const [result, setResult] = useState<{ you: number; opponent: number; outcome: string; reason: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [report, setReport] = useState<{ callId: string; alias: string } | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const battleRef = useRef<Start | null>(null);
  battleRef.current = battle;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const onMessage = useCallback((m: ServerMessage) => {
    switch (m.type) {
      case 'battle.queued':
        setPhase('waiting');
        break;
      case 'battle.queue.left':
        setPhase('choose');
        break;
      case 'battle.start':
        setBattle(m);
        setIndex(0);
        setScore(0);
        setOpp({ answered: 0, score: 0 });
        setResult(null);
        setFeedback(null);
        setPicked(null);
        setQStart(m.startsAt);
        setPhase('countdown');
        break;
      case 'battle.answer_result':
        setFeedback({ correct: m.correct, correctAnswer: m.correctAnswer, points: m.points });
        setScore(m.score);
        setTimeout(() => {
          setFeedback(null);
          setPicked(null);
          setIndex(m.index + 1);
          setQStart(Date.now() + 0);
        }, 800);
        break;
      case 'battle.opponent_progress':
        setOpp({ answered: m.answered, score: m.score });
        break;
      case 'battle.end':
        setResult(m.results);
        setPhase('finished');
        break;
      case 'error':
        if (m.code.startsWith('already') || m.code === 'limit_reached') {
          setError(m.message);
          setPhase('choose');
        }
        break;
    }
  }, []);
  useEffect(() => realtime.subscribe(onMessage), [onMessage]);

  useEffect(() => {
    if (phase === 'countdown' && battle && now >= battle.startsAt) {
      setPhase('playing');
      setQStart(battle.startsAt);
    }
  }, [phase, battle, now]);

  useEffect(
    () => () => {
      if (phaseRef.current === 'waiting') realtime.send({ type: 'battle.queue.leave' });
      if ((phaseRef.current === 'playing' || phaseRef.current === 'countdown') && battleRef.current) realtime.send({ type: 'battle.forfeit', battleId: battleRef.current.battleId });
    },
    [],
  );

  const join = () => {
    setError(null);
    if (!realtime.send({ type: 'battle.queue.join', kind })) setError('Not connected to the server yet. Please try again in a moment.');
  };
  const answer = (choice: string) => {
    if (!battle || picked || feedback) return;
    setPicked(choice);
    realtime.send({ type: 'battle.answer', battleId: battle.battleId, index, choice });
  };

  const left = battle ? Math.max(0, battle.secondsPerQuestion - Math.floor((now - qStart) / 1000)) : 0;
  const q = battle?.questions[index];
  const battlesLeft = me.limits.battle == null ? null : Math.max(0, me.limits.battle - (me.usage.battle ?? 0));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {error && <Alert tone="error" className="mb-4" action={error.includes('Premium') ? <Link to="/premium" className="text-sm font-semibold underline">Upgrade</Link> : undefined}>{error}</Alert>}
        {phase === 'choose' && (
          <Card className="p-6">
            <h2 className="font-semibold">Choose a battle</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <ChoiceChip selected={kind === 'vocabulary'} onClick={() => setKind('vocabulary')}><strong className="block">Vocabulary battle</strong><span className="muted text-xs">Match words to their meanings</span></ChoiceChip>
              <ChoiceChip selected={kind === 'grammar'} onClick={() => setKind('grammar')}><strong className="block">Grammar battle</strong><span className="muted text-xs">Choose the correct grammar</span></ChoiceChip>
            </div>
            <Button className="mt-5" size="lg" icon={<Swords className="h-5 w-5" />} onClick={join} disabled={status !== 'open'}>Find an opponent</Button>
            {battlesLeft != null && <p className="muted mt-2 text-xs">{battlesLeft} free battles left today.</p>}
          </Card>
        )}
        {phase === 'waiting' && (
          <Card className="flex flex-col items-center p-10 text-center">
            <Spinner className="h-10 w-10 text-brand-600" />
            <h2 className="mt-4 text-lg font-semibold">Waiting for an opponent…</h2>
            <p className="muted mt-1 text-sm">The battle starts as soon as another learner joins a {kind} battle.</p>
            <Button variant="secondary" className="mt-6" onClick={() => realtime.send({ type: 'battle.queue.leave' })}>Cancel</Button>
          </Card>
        )}
        {phase === 'countdown' && battle && (
          <Card className="p-10 text-center">
            <p className="muted">Your opponent: <strong>{battle.opponentAlias}</strong></p>
            <div className="mt-4 text-6xl font-extrabold text-brand-600">{Math.max(1, Math.ceil((battle.startsAt - now) / 1000))}</div>
            <p className="muted mt-2">Get ready!</p>
          </Card>
        )}
        {phase === 'playing' && battle && q && (
          <Card className="p-6">
            <div className="mb-3 flex items-center justify-between text-sm"><span>Question {index + 1} of {battle.questions.length}</span><span className={`font-mono font-semibold ${left <= 5 ? 'text-red-600' : ''}`}>{left}s</span></div>
            <ProgressBar value={left} max={battle.secondsPerQuestion} tone={left <= 5 ? 'amber' : 'brand'} label="Time left" />
            <h2 className="mt-5 text-lg font-semibold">{q.prompt}</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {q.options.map((o) => {
                const isCorrect = feedback && o === feedback.correctAnswer;
                const isWrong = feedback && picked === o && !feedback.correct;
                return (
                  <button key={o} disabled={Boolean(picked || feedback)} onClick={() => answer(o)} className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${isCorrect ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : isWrong ? 'border-red-500 bg-red-50 dark:bg-red-950/40' : picked === o ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30' : 'border-slate-300 hover:border-brand-400 dark:border-slate-700'}`}>{o}</button>
                );
              })}
            </div>
            {feedback && <p className={`mt-3 text-sm font-semibold ${feedback.correct ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}`}>{feedback.correct ? `Correct! +${feedback.points} points` : 'Not this time.'}</p>}
            {index >= battle.questions.length && <p className="muted mt-3">Waiting for your opponent to finish…</p>}
          </Card>
        )}
        {phase === 'playing' && battle && !q && (
          <Card className="flex flex-col items-center p-10 text-center"><Spinner className="h-8 w-8 text-brand-600" /><p className="mt-3">You have finished! Waiting for {battle.opponentAlias}…</p></Card>
        )}
        {phase === 'finished' && result && battle && (
          <Card className="p-8 text-center">
            <Trophy className={`mx-auto h-12 w-12 ${result.outcome === 'win' ? 'text-amber-500' : 'text-slate-300'}`} />
            <h2 className="mt-2 text-2xl font-bold">{result.outcome === 'win' ? 'You won!' : result.outcome === 'draw' ? 'It’s a draw!' : 'You lost this time'}</h2>
            {result.reason === 'opponent_left' && <p className="muted mt-1 text-sm">Your opponent left the battle.</p>}
            <div className="mt-4 flex justify-center gap-8"><div><div className="muted text-sm">You</div><div className="text-3xl font-bold">{result.you}</div></div><div><div className="muted text-sm">{battle.opponentAlias}</div><div className="text-3xl font-bold">{result.opponent}</div></div></div>
            <div className="mt-6 flex justify-center gap-2"><Button onClick={() => { setPhase('choose'); }}>Play again</Button></div>
            <button className="muted mt-4 inline-flex items-center gap-1 text-sm hover:text-red-600" onClick={() => setReport({ callId: battle.battleId, alias: battle.opponentAlias })}><Flag className="h-4 w-4" /> Report opponent</button>
          </Card>
        )}
      </div>
      <div className="space-y-4">
        {(phase === 'playing' || phase === 'countdown') && battle && (
          <Card>
            <CardHeader title="Scoreboard" />
            <div className="space-y-3 p-5 text-sm">
              <div><div className="flex justify-between"><span>You</span><strong>{score}</strong></div><ProgressBar value={Math.min(index, battle.questions.length)} max={battle.questions.length} /></div>
              <div><div className="flex justify-between"><span>{battle.opponentAlias}</span><strong>{opp.score}</strong></div><ProgressBar value={opp.answered} max={battle.questions.length} tone="amber" /></div>
            </div>
          </Card>
        )}
        <Card>
          <CardHeader title="How scoring works" />
          <ul className="list-disc space-y-1 p-5 pl-9 text-sm">
            <li>Both players get the same 10 questions.</li>
            <li>Correct answer: 100 points + up to 50 speed points (50 × time left ÷ 15 s).</li>
            <li>Wrong or no answer within 15 seconds: 0 points.</li>
            <li>Time is measured on the server, so connection speed does not give anyone an advantage beyond a 1.5-second grace period.</li>
            <li>Leaving a battle early counts as a loss.</li>
          </ul>
        </Card>
      </div>
      <ReportDialog target={report} onClose={() => setReport(null)} kind="battle" />
    </div>
  );
}

function SpeakingChallenge() {
  const toast = useToast();
  const { data, reload } = useApi<{ index: number; prompt: string; targetWords: string[]; seconds: number; minWords: number; rules: string }>('/api/speaking/challenge');
  const rec = useRecorder();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ score: number; breakdown: { goal: number; targets: number; variety: number }; targetWordsUsed: string[]; words: number } | null>(null);

  useEffect(() => {
    if (data && rec.state === 'recording' && rec.seconds >= data.seconds) rec.stop();
  }, [rec, data]);

  const submit = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const r = await uploadSpeaking({ mode: 'challenge', challengeIndex: data.index, question: data.prompt, transcript: rec.transcript, transcriptSource: rec.recognitionSupported ? 'browser' : 'manual', durationSec: rec.seconds }, rec.blob);
      const m = r.attempt.metrics as { wordCount: number; challenge: { score: number; breakdown: { goal: number; targets: number; variety: number }; targetWordsUsed: string[] } };
      setResult({ ...m.challenge, words: m.wordCount });
      r.newAchievements?.forEach((a) => toast(`Achievement unlocked: ${a.title}`, 'info'));
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  if (!data) return <div className="flex justify-center p-8"><Spinner className="h-6 w-6 text-brand-600" /></div>;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="p-6 lg:col-span-2">
        <Badge tone="violet">{data.seconds}-second challenge</Badge>
        <h2 className="mt-3 text-xl font-semibold">{data.prompt}</h2>
        <p className="mt-3 text-sm">Try to use these words: {data.targetWords.map((w) => <Badge key={w} tone="brand" className="mr-1">{w}</Badge>)}</p>
        <p className="muted mt-1 text-sm">Word goal: {data.minWords} words.</p>
        {result ? (
          <div className="mt-6 rounded-xl bg-slate-50 p-5 dark:bg-slate-800/60">
            <div className="text-4xl font-extrabold text-brand-600">{result.score}/100</div>
            <ul className="mt-3 space-y-1 text-sm">
              <li>Word goal: {result.breakdown.goal}/50 ({result.words} of {data.minWords} words)</li>
              <li>Target words: {result.breakdown.targets}/30 ({result.targetWordsUsed.length ? result.targetWordsUsed.join(', ') : 'none used'})</li>
              <li>Vocabulary variety: {result.breakdown.variety}/20</li>
            </ul>
            <Button className="mt-4" onClick={() => { setResult(null); rec.reset(); reload(); }}>Next challenge</Button>
          </div>
        ) : (
          <div className="mt-6">
            <RecorderPanel rec={rec} maxSeconds={data.seconds} />
            {rec.state === 'stopped' && <Button className="mt-4" icon={<Mic className="h-4 w-4" />} onClick={submit} loading={busy} disabled={!rec.transcript.trim()}>Score my answer</Button>}
            {rec.state === 'stopped' && !rec.transcript.trim() && <p className="muted mt-2 text-xs">A transcript is needed to score the challenge. Type what you said if speech recognition is not available.</p>}
          </div>
        )}
      </Card>
      <Card><CardHeader title="Scoring rules" /><p className="p-5 text-sm">{data.rules}</p></Card>
    </div>
  );
}

function History() {
  const { data } = useApi<{ battles: { id: string; kind: string; opponentAlias: string; myScore: number; opponentScore: number; outcome: string; endReason: string | null; createdAt: string }[] }>('/api/battles/history');
  const ch = useApi<{ attempts: { id: string; title: string; score: number | null; createdAt: string }[] }>('/api/speaking/attempts?mode=challenge');
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Battles" />
        {data?.battles.length ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.battles.map((b) => (
              <li key={b.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div><div className="font-medium capitalize">{b.kind} vs {b.opponentAlias}</div><div className="muted text-xs">{formatDateTime(b.createdAt)}{b.endReason === 'opponent_left' || b.endReason === 'forfeit' ? ' · ended early' : ''}</div></div>
                <div className="text-right"><Badge tone={b.outcome === 'win' ? 'green' : b.outcome === 'draw' ? 'slate' : 'red'} className="capitalize">{b.outcome}</Badge><div className="muted text-xs">{b.myScore}–{b.opponentScore}</div></div>
              </li>
            ))}
          </ul>
        ) : <div className="p-5"><EmptyState title="No battles yet" /></div>}
      </Card>
      <Card>
        <CardHeader title="Speaking challenges" />
        {ch.data?.attempts.length ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {ch.data.attempts.map((a) => <li key={a.id} className="flex justify-between px-5 py-3 text-sm"><span className="truncate pr-3">{a.title.replace('Speaking challenge: ', '')}</span><strong>{a.score}/100</strong></li>)}
          </ul>
        ) : <div className="p-5"><EmptyState title="No challenges yet" /></div>}
      </Card>
    </div>
  );
}
