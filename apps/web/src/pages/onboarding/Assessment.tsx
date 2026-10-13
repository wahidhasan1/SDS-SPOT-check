import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CheckCircle2, XCircle } from 'lucide-react';
import { CEFR_INFO, type CefrLevel } from '@fluentpath/shared';
import { Logo } from '../../components/layout/Logo';
import { LevelNote } from '../../components/learning/Disclaimers';
import { Alert, Badge, Button, ButtonLink, Card, PageLoader, ProgressBar } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface Q { id: string; skill: string; prompt: string; passage: string | null; options: string[] }
interface Result {
  level: CefrLevel;
  score: number;
  maxScore: number;
  bySkill: Record<string, { correct: number; total: number }>;
  byLevel: Record<string, { correct: number; total: number }>;
  review: { id: string; prompt: string; level: string; given: string | null; correctAnswer: string; correct: boolean; explanation: string }[];
}

export default function Assessment() {
  const { refresh } = useAuth();
  const nav = useNavigate();
  const [id, setId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    api
      .post<{ assessmentId: string; questions: Q[]; answers: Record<string, string> }>('/api/assessment/start')
      .then((r) => {
        setId(r.assessmentId);
        setQuestions(r.questions);
        setAnswers(r.answers ?? {});
        const firstUnanswered = r.questions.findIndex((q) => !r.answers?.[q.id]);
        setIndex(firstUnanswered === -1 ? r.questions.length - 1 : firstUnanswered);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const choose = (qid: string, opt: string) => {
    const next = { ...answers, [qid]: opt };
    setAnswers(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => id && api.put(`/api/assessment/${id}/answers`, { answers: next }).catch(() => {}), 600);
  };

  const submit = async () => {
    if (!id) return;
    clearTimeout(saveTimer.current);
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<Result>(`/api/assessment/${id}/submit`, { answers });
      setResult(r);
      await refresh();
      window.scrollTo(0, 0);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (error && !questions.length) return <div className="mx-auto max-w-xl p-6"><Alert tone="error">{error}</Alert></div>;
  if (!questions.length) return <PageLoader label="Preparing your assessment…" />;

  if (result) {
    const info = CEFR_INFO[result.level];
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6"><Logo to="/dashboard" /></div>
        <Card className="p-6 text-center sm:p-8">
          <p className="muted text-sm font-medium tracking-wide uppercase">Your estimated level</p>
          <div className="mt-2 text-6xl font-extrabold text-brand-600">{result.level}</div>
          <div className="mt-1 text-lg font-semibold">{info.name}</div>
          <p className="muted mx-auto mt-2 max-w-lg">{info.description}</p>
          <p className="mt-2 text-sm">Roughly comparable to IELTS {info.ieltsApprox}.</p>
          <div className="mt-4 flex justify-center"><Badge>{result.score} / {result.maxScore} correct</Badge></div>
          <div className="mx-auto mt-6 grid max-w-md gap-3 text-left">
            {Object.entries(result.bySkill).map(([skill, s]) => (
              <div key={skill}>
                <div className="mb-1 flex justify-between text-sm"><span className="capitalize">{skill}</span><span>{s.correct}/{s.total}</span></div>
                <ProgressBar value={s.correct} max={s.total} />
              </div>
            ))}
          </div>
          <div className="mx-auto mt-6 max-w-lg"><LevelNote /></div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={() => nav('/dashboard', { replace: true })}>Go to my dashboard</Button>
            <ButtonLink to="/grammar" variant="secondary">See grammar lessons</ButtonLink>
          </div>
        </Card>
        <h2 className="mt-10 mb-3 text-xl font-semibold">Review your answers</h2>
        <div className="space-y-3">
          {result.review.map((r, i) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start gap-3">
                {r.correct ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <XCircle className="h-5 w-5 shrink-0 text-red-600" />}
                <div className="text-sm">
                  <div className="font-medium">{i + 1}. {r.prompt} <Badge className="ml-1">{r.level}</Badge></div>
                  {!r.correct && <div className="mt-1">Your answer: <strong>{r.given ?? '(skipped)'}</strong> · Correct: <strong>{r.correctAnswer}</strong></div>}
                  <div className="muted mt-1">{r.explanation}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const q = questions[index];
  const answered = Object.keys(answers).filter((k) => questions.some((qq) => qq.id === k)).length;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Logo to="/dashboard" />
        <Link to="/dashboard" className="muted text-sm hover:underline">Finish later</Link>
      </div>
      <div className="mb-2 flex justify-between text-sm"><span>Question {index + 1} of {questions.length}</span><span className="muted">{answered} answered</span></div>
      <ProgressBar value={index + 1} max={questions.length} label="Assessment progress" />
      <Card className="mt-6 p-6">
        <Badge tone="violet" className="capitalize">{q.skill}</Badge>
        {q.passage && <blockquote className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-7 dark:bg-slate-800/60">{q.passage}</blockquote>}
        <h1 className="mt-4 text-lg font-semibold">{q.prompt}</h1>
        <div className="mt-4 grid gap-2" role="radiogroup">
          {q.options.map((o) => (
            <button
              key={o}
              role="radio"
              aria-checked={answers[q.id] === o}
              onClick={() => choose(q.id, o)}
              className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${answers[q.id] === o ? 'border-brand-600 bg-brand-50 font-medium dark:bg-brand-900/30' : 'border-slate-300 hover:border-slate-400 dark:border-slate-700'}`}
            >
              {o}
            </button>
          ))}
        </div>
        <p className="muted mt-3 text-xs">Not sure? It is better to skip than to guess — skipping gives a more accurate estimate.</p>
      </Card>
      {error && <Alert tone="error" className="mt-4">{error}</Alert>}
      <div className="mt-6 flex justify-between gap-2">
        <Button variant="secondary" onClick={() => setIndex((i) => i - 1)} disabled={index === 0}>Previous</Button>
        {index < questions.length - 1 ? (
          <div className="flex gap-2">
            {!answers[q.id] && <Button variant="ghost" onClick={() => setIndex((i) => i + 1)}>Skip</Button>}
            <Button onClick={() => setIndex((i) => i + 1)} disabled={!answers[q.id]}>Next</Button>
          </div>
        ) : (
          <Button onClick={submit} loading={busy}>Finish and see my level</Button>
        )}
      </div>
    </div>
  );
}
