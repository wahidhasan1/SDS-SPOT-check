import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CEFR_LABELS, type CefrLevel } from '@app/shared';
import { api, mediaUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import { errorMessage } from '../lib/hooks';
import { ErrorBox, Loading, Progress } from '../components/ui';

interface Item {
  id: string;
  skill: string;
  prompt: string;
  passage: string | null;
  audioUrl: string | null;
  options: string[];
  index: number;
  total: number;
}
interface Result {
  level: CefrLevel;
  skills: Record<string, { correct: number; total: number; level: string }>;
  answered: number;
  correct: number;
}

const SKILL_LABEL: Record<string, string> = { vocabulary: 'Vocabulary', grammar: 'Grammar', reading: 'Reading', listening: 'Listening' };

export function AssessmentPage() {
  const { refreshUser } = useAuth();
  const nav = useNavigate();
  const [phase, setPhase] = useState<'intro' | 'loading' | 'test' | 'result'>('loading');
  const [assessmentId, setId] = useState<string | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ assessment: { assessmentId: string; item: Item } | null }>('/assessment/current')
      .then((r) => {
        if (r.assessment) {
          setId(r.assessment.assessmentId);
          setItem(r.assessment.item);
          setPhase('test');
        } else setPhase('intro');
      })
      .catch((e) => {
        setErr(errorMessage(e));
        setPhase('intro');
      });
  }, []);

  const start = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ assessmentId: string; item: Item }>('/assessment/start');
      setId(r.assessmentId);
      setItem(r.item);
      setChoice(null);
      setPhase('test');
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const answer = async () => {
    if (!item || !choice || !assessmentId) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ done: boolean; item?: Item; result?: Result }>(`/assessment/${assessmentId}/answer`, { itemId: item.id, answer: choice });
      if (r.done && r.result) {
        setResult(r.result);
        setPhase('result');
        await refreshUser();
      } else if (r.item) {
        setItem(r.item);
        setChoice(null);
      }
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'loading') return <Loading />;
  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }} className="stack lg">
      {phase === 'intro' && (
        <div className="card pad-lg stack">
          <h1>English placement test</h1>
          <p>About 20 questions covering vocabulary, grammar, reading and listening. Questions adapt to your answers, so the test gets harder or easier as you go. It takes around 10–15 minutes.</p>
          <ul className="muted small">
            <li>Answer honestly — your level is used to match practice and speaking partners.</li>
            <li>Listening questions play audio, so turn your sound on.</li>
            <li>You can retake the test later; your level history is kept.</li>
          </ul>
          <p className="disclaimer">This gives an application-level CEFR estimate (A1–C2). It is not an official certificate.</p>
          <ErrorBox error={err} />
          <div className="row">
            <button className="btn lg" onClick={start} disabled={busy} data-testid="start-assessment">Start the test</button>
            <Link to="/" className="btn ghost">Skip for now</Link>
          </div>
        </div>
      )}
      {phase === 'test' && item && (
        <div className="card pad-lg stack">
          <div className="row between">
            <span className="badge primary">{SKILL_LABEL[item.skill]}</span>
            <span className="small muted">Question {item.index + 1} of {item.total}</span>
          </div>
          <Progress value={item.index} max={item.total} />
          {item.passage && <div className="card flat reading-text" style={{ background: 'var(--surface-2)', fontSize: '1rem' }}>{item.passage}</div>}
          {item.audioUrl && (
            <div className="stack" style={{ gap: 4 }}>
              <audio controls src={mediaUrl(item.audioUrl)} preload="auto" style={{ width: '100%' }} />
              <span className="tiny muted">Listen, then answer. You can replay the clip.</span>
            </div>
          )}
          <h2 data-testid="assessment-prompt">{item.prompt}</h2>
          <div className="stack" role="radiogroup">
            {item.options.map((o) => (
              <button key={o} role="radio" aria-checked={choice === o} className={`option ${choice === o ? 'selected' : ''}`} onClick={() => setChoice(o)}>
                {o}
              </button>
            ))}
          </div>
          <ErrorBox error={err} />
          <div className="row between">
            <span className="tiny muted">Not sure? Choose your best guess — that is fine.</span>
            <button className="btn" disabled={!choice || busy} onClick={answer} data-testid="assessment-next">{busy ? 'Saving…' : 'Next'}</button>
          </div>
        </div>
      )}
      {phase === 'result' && result && (
        <div className="card pad-lg stack center">
          <div style={{ fontSize: 48 }}>🎉</div>
          <h1>Your estimated level: <span data-testid="assessment-level">{result.level}</span></h1>
          <p className="muted">{CEFR_LABELS[result.level]} · {result.correct} of {result.answered} correct</p>
          <div className="grid cols-4" style={{ textAlign: 'left' }}>
            {Object.entries(result.skills).map(([k, s]) => (
              <div key={k} className="card flat">
                <div className="small muted">{SKILL_LABEL[k]}</div>
                <div style={{ fontWeight: 800, fontSize: '1.3rem' }}>{s.level}</div>
                <div className="tiny muted">{s.correct}/{s.total} correct</div>
              </div>
            ))}
          </div>
          <p className="disclaimer" style={{ textAlign: 'left' }}>Application-level estimate. It improves as you complete more practice and can be retaken from your profile.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn lg" onClick={() => nav('/')}>Go to my dashboard</button>
          </div>
        </div>
      )}
    </div>
  );
}
