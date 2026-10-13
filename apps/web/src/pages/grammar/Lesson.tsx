import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { Markdown } from '../../components/learning/Markdown';
import { useElapsed } from '../../components/learning/Timer';
import { Alert, Badge, Button, ButtonLink, Card, CardHeader, ErrorState, PageLoader, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useApi } from '../../lib/useApi';

interface LessonData {
  lesson: { id: string; slug: string; title: string; cefrLevel: string; pathLevel: string; summary: string; body: string; examples: { text: string; note?: string; correct?: boolean }[] };
  exercises: { id: string; type: 'mcq' | 'fill'; prompt: string; options: string[] }[];
  progress: { status: string; bestScore: number; maxScore: number; attemptsCount: number };
  next: { slug: string; title: string } | null;
  prev: { slug: string; title: string } | null;
}
interface SubmitResult { score: number; maxScore: number; passed: boolean; results: { id: string; given: string | null; correct: boolean; correctAnswer: string; explanation: string }[]; newAchievements: { title: string }[] }

export default function Lesson() {
  const { slug } = useParams();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<LessonData>(`/api/lessons/${slug}`, [slug]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const elapsed = useElapsed();

  useEffect(() => {
    setAnswers({});
    setResult(null);
    window.scrollTo(0, 0);
  }, [slug]);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const { lesson, exercises } = data;
  const byId = new Map(result?.results.map((r) => [r.id, r]));
  const unanswered = exercises.filter((e) => !answers[e.id]?.trim()).length;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<SubmitResult>(`/api/lessons/${lesson.slug}/submit`, { answers, durationSec: elapsed });
      setResult(r);
      r.newAchievements?.forEach((a) => toast(`Achievement unlocked: ${a.title}`, 'info'));
      document.getElementById('practice')?.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/grammar" className="muted mb-4 inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft className="h-4 w-4" /> All lessons</Link>
      <div className="flex flex-wrap items-center gap-2"><Badge tone="brand">{lesson.cefrLevel}</Badge><Badge className="capitalize">{lesson.pathLevel}</Badge>{data.progress.status === 'completed' && <Badge tone="green">Completed</Badge>}</div>
      <h1 className="mt-2 text-3xl font-bold">{lesson.title}</h1>
      <p className="muted mt-2">{lesson.summary}</p>

      <Card className="mt-6 p-6"><Markdown text={lesson.body} /></Card>

      {lesson.examples.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Examples" />
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {lesson.examples.map((ex, i) => (
              <li key={i} className="flex gap-3 px-5 py-3">
                {ex.correct === false ? <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-label="Incorrect example" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-label="Correct example" />}
                <div>
                  <div className={ex.correct === false ? 'text-red-700 line-through decoration-red-300 dark:text-red-400' : 'font-medium'}>{ex.text}</div>
                  {ex.note && <div className="muted text-sm">{ex.note}</div>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-6" id="practice">
        <CardHeader title="Practice" subtitle={`${exercises.length} questions · score 70% or more to complete the lesson`} />
        {result && (
          <div className="px-5 pt-5">
            <Alert tone={result.passed ? 'success' : 'warning'} title={result.passed ? `Great job! ${result.score}/${result.maxScore} correct` : `${result.score}/${result.maxScore} correct — review the explanations and try again`}>
              {result.passed ? 'This lesson is marked as completed.' : 'You need 70% to complete this lesson.'}
            </Alert>
          </div>
        )}
        <ol className="space-y-5 p-5">
          {exercises.map((e, i) => {
            const r = byId.get(e.id);
            return (
              <li key={e.id}>
                <div className="flex items-start gap-2">
                  <span className="muted w-6 shrink-0 text-sm font-semibold">{i + 1}.</span>
                  <div className="flex-1">
                    <p className="font-medium">{e.prompt}</p>
                    {e.type === 'mcq' ? (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={`Question ${i + 1}`}>
                        {e.options.map((o) => {
                          const sel = answers[e.id] === o;
                          const isCorrect = r && o === r.correctAnswer;
                          return (
                            <button
                              key={o}
                              role="radio"
                              aria-checked={sel}
                              disabled={Boolean(result)}
                              onClick={() => setAnswers({ ...answers, [e.id]: o })}
                              className={`rounded-xl border px-3 py-2 text-left text-sm ${
                                r ? (isCorrect ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : sel ? 'border-red-500 bg-red-50 dark:bg-red-950/40' : 'border-slate-200 opacity-70 dark:border-slate-700') : sel ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30' : 'border-slate-300 hover:border-slate-400 dark:border-slate-700'
                              }`}
                            >
                              {o}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <input
                        className={`input mt-2 max-w-sm ${r ? (r.correct ? 'border-emerald-500' : 'border-red-500') : ''}`}
                        aria-label={`Answer for question ${i + 1}`}
                        value={answers[e.id] ?? ''}
                        disabled={Boolean(result)}
                        onChange={(ev) => setAnswers({ ...answers, [e.id]: ev.target.value })}
                        autoComplete="off"
                      />
                    )}
                    {r && (
                      <div className={`mt-2 rounded-lg px-3 py-2 text-sm ${r.correct ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200'}`}>
                        {!r.correct && <div>Correct answer: <strong>{r.correctAnswer}</strong></div>}
                        <div>{r.explanation}</div>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          {err && <Alert tone="error" className="w-full">{err}</Alert>}
          {!result ? (
            <>
              <span className="muted text-sm">{unanswered > 0 ? `${unanswered} unanswered` : 'All questions answered'}</span>
              <Button onClick={submit} loading={busy}>Check my answers</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => { setResult(null); setAnswers({}); }}>Try again</Button>
              {data.next && <ButtonLink to={`/grammar/${data.next.slug}`}>Next: {data.next.title} <ArrowRight className="h-4 w-4" /></ButtonLink>}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
