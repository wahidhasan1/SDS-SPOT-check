import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { CEFR_LEVELS } from '@fluentpath/shared';
import { Alert, Button, Card, PageHeader, ProgressBar, Select, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { VocabNav } from './VocabNav';

interface Q { index: number; prompt: string; options: string[] }
interface Result { score: number; maxScore: number; results: { index: number; prompt: string; word: string; given: string | null; correctAnswer: string; correct: boolean }[] }

export default function Quiz() {
  const toast = useToast();
  const cats = useApi<{ categories: { slug: string; name: string }[] }>('/api/vocab/categories');
  const [source, setSource] = useState<'my' | 'category' | 'level'>('my');
  const [category, setCategory] = useState('education');
  const [level, setLevel] = useState('B1');
  const [quiz, setQuiz] = useState<{ attemptId: string; questions: Q[]; started: number } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [i, setI] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ attemptId: string; questions: Q[] }>('/api/vocab/quiz/start', { source, category: source === 'category' ? category : undefined, level: source === 'level' ? level : undefined, size: 10 });
      setQuiz({ ...r, started: Date.now() });
      setAnswers({});
      setI(0);
      setResult(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.post<Result & { newAchievements: { title: string }[] }>(`/api/vocab/quiz/${quiz!.attemptId}/submit`, { answers, durationSec: Math.round((Date.now() - quiz!.started) / 1000) });
      setResult(r);
      r.newAchievements?.forEach((a) => toast(`Achievement unlocked: ${a.title}`, 'info'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Vocabulary" title="Vocabulary quiz" description="Ten multiple-choice questions. Your score and results are saved to your progress." />
      <VocabNav />
      {error && <Alert tone="error" className="mb-4">{error}</Alert>}
      {!quiz ? (
        <Card className="max-w-xl p-6">
          <h2 className="font-semibold">Choose your words</h2>
          <div className="mt-4 space-y-3">
            {([
              ['my', 'My saved words'],
              ['category', 'An IELTS topic list'],
              ['level', 'Words at a level'],
            ] as const).map(([id, label]) => (
              <label key={id} className="flex items-center gap-2"><input type="radio" name="src" checked={source === id} onChange={() => setSource(id)} /> {label}</label>
            ))}
            {source === 'category' && (
              <Select label="Topic" value={category} onChange={(e) => setCategory(e.target.value)}>
                {cats.data?.categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </Select>
            )}
            {source === 'level' && (
              <Select label="Level" value={level} onChange={(e) => setLevel(e.target.value)}>
                {CEFR_LEVELS.map((l) => <option key={l}>{l}</option>)}
              </Select>
            )}
          </div>
          <Button className="mt-6" onClick={start} loading={busy}>Start quiz</Button>
        </Card>
      ) : result ? (
        <div className="max-w-2xl">
          <Card className="p-6 text-center">
            <div className="text-5xl font-extrabold text-brand-600">{result.score}/{result.maxScore}</div>
            <p className="muted mt-1">{Math.round((result.score / result.maxScore) * 100)}% correct</p>
            <div className="mt-4 flex justify-center gap-2"><Button onClick={start} loading={busy}>New quiz</Button><Button variant="secondary" onClick={() => setQuiz(null)}>Change words</Button></div>
          </Card>
          <div className="mt-4 space-y-2">
            {result.results.map((r) => (
              <Card key={r.index} className="flex gap-3 p-4 text-sm">
                {r.correct ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <XCircle className="h-5 w-5 shrink-0 text-red-600" />}
                <div>
                  <div className="font-medium">{r.prompt}</div>
                  {!r.correct && <div className="mt-1">Your answer: {r.given ?? '(none)'}<br />Correct: <strong>{r.correctAnswer}</strong></div>}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-2xl">
          <div className="mb-2 flex justify-between text-sm"><span>Question {i + 1} of {quiz.questions.length}</span></div>
          <ProgressBar value={i + 1} max={quiz.questions.length} />
          <Card className="mt-4 p-6">
            <h2 className="font-semibold">{quiz.questions[i].prompt}</h2>
            <div className="mt-4 grid gap-2" role="radiogroup">
              {quiz.questions[i].options.map((o) => (
                <button key={o} role="radio" aria-checked={answers[i] === o} onClick={() => setAnswers({ ...answers, [i]: o })} className={`rounded-xl border px-4 py-3 text-left text-sm ${answers[i] === o ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30' : 'border-slate-300 hover:border-slate-400 dark:border-slate-700'}`}>{o}</button>
              ))}
            </div>
          </Card>
          <div className="mt-4 flex justify-between">
            <Button variant="secondary" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</Button>
            {i < quiz.questions.length - 1 ? <Button disabled={!answers[i]} onClick={() => setI(i + 1)}>Next</Button> : <Button onClick={submit} loading={busy} disabled={!answers[i]}>Submit quiz</Button>}
          </div>
        </div>
      )}
    </div>
  );
}
