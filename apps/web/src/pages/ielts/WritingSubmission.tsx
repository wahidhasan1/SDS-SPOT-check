import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, CheckCircle2, RefreshCw, Send, Trash2 } from 'lucide-react';
import { countWords, WRITING_CRITERIA, type ChartSpec } from '@fluentpath/shared';
import { Chart } from '../../components/learning/Chart';
import { BandNote } from '../../components/learning/Disclaimers';
import { Alert, Badge, Button, Card, CardHeader, ConfirmDialog, ErrorState, PageLoader, Spinner, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';

interface Task { id: string; title: string; taskNumber: number; taskType: string; variant: string; prompt: string; instructions: string; visual: ChartSpec | null; minWords: number; timeMinutes: number }
interface Stats { wordCount: number; minWords: number; underLength: boolean; paragraphs: number; sentences: number; avgSentenceLength: number; lexicalDiversity: number; linkersUsed: string[]; repeatedWords: { word: string; count: number }[]; contractions: number; academicWordsUsed: string[] }
interface AiFeedback { criteria: { id: string; band: number; comment: string; suggestions: string[] }[]; overallBand: number; summary: string; strengths: string[]; improvements: string[]; corrections: { original: string; corrected: string; explanation: string }[]; improvedVersion: string | null }
interface Submission { id: string; status: string; text: string; wordCount: number; timeSpentSec: number; bandEstimate: number | null; feedback: { stats?: Stats; ai?: AiFeedback; aiStatus?: string; detailed?: boolean } | null; feedbackError: string | null; submittedAt: string | null; updatedAt: string; mockAttemptId: string | null }

export default function WritingSubmission() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [sub, setSub] = useState<Submission | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [del, setDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const textRef = useRef(text);
  textRef.current = text;

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ submission: Submission; task: Task }>(`/api/writing/submissions/${id}`);
      setSub(r.submission);
      setTask(r.task);
      setText(r.submission.text);
      setElapsed(r.submission.timeSpentSec);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const draft = sub?.status === 'draft';
  useEffect(() => {
    if (!draft) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [draft]);

  // Poll while the AI evaluation is running.
  useEffect(() => {
    if (sub?.status !== 'evaluating') return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [sub?.status, load]);

  const persist = useCallback(async (value: string, secs: number) => {
    setSave('saving');
    try {
      await api.put(`/api/writing/submissions/${id}`, { text: value, timeSpentSec: secs });
      setSave('saved');
    } catch {
      setSave('error');
    }
  }, [id]);

  const onType = (v: string) => {
    setText(v);
    setSave('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(v, elapsed), 1500);
  };

  const submit = async () => {
    setBusy(true);
    clearTimeout(timer.current);
    try {
      const r = await api.post<{ status: string; newAchievements: { title: string }[] }>(`/api/writing/submissions/${id}/submit`, { text: textRef.current, timeSpentSec: elapsed });
      r.newAchievements?.forEach((a) => toast(`Achievement unlocked: ${a.title}`, 'info'));
      if (r.status === 'evaluating') toast('Submitted! Your feedback is being prepared.');
      await load();
      window.scrollTo(0, 0);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    try {
      await api.post(`/api/writing/submissions/${id}/evaluate`);
      await load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!sub || !task) return <PageLoader />;
  const words = countWords(text);
  const st = sub.feedback?.stats;
  const ai = sub.feedback?.ai;
  const limit = task.timeMinutes * 60;
  const over = elapsed > limit;

  return (
    <div>
      <Link to="/ielts/writing" className="muted mb-4 inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft className="h-4 w-4" /> Writing practice</Link>
      <div className="flex flex-wrap items-center gap-2"><Badge tone="brand">{task.variant === 'academic' ? 'Academic' : 'General Training'} · Task {task.taskNumber}</Badge>{sub.mockAttemptId && <Badge tone="violet">Mock test</Badge>}</div>
      <h1 className="mt-2 text-2xl font-bold">{task.title}</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="p-5">
            <p className="font-medium whitespace-pre-line">{task.prompt}</p>
            <p className="muted mt-3 text-sm">{task.instructions}</p>
          </Card>
          {task.visual && <Chart spec={task.visual} />}
        </div>

        <div>
          {draft ? (
            <Card className="flex h-full flex-col p-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className={`font-semibold ${words < task.minWords ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{words} / {task.minWords} words</span>
                <span className={`font-mono ${over ? 'text-red-600' : 'muted'}`} title="Time spent">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} / {task.timeMinutes}:00</span>
                <span className="muted text-xs" aria-live="polite">{save === 'saving' ? 'Saving…' : save === 'saved' ? 'Draft saved' : save === 'error' ? 'Not saved — check connection' : ''}</span>
              </div>
              <textarea
                className="input min-h-[420px] flex-1 font-serif text-[15px] leading-7"
                value={text}
                onChange={(e) => onType(e.target.value)}
                placeholder={task.taskType === 'letter' ? 'Dear …,' : 'Start writing your answer here…'}
                aria-label="Your answer"
                spellCheck={false}
              />
              <p className="muted mt-2 text-xs">Spell-check is turned off, as in the computer-delivered IELTS test.</p>
              <div className="mt-3 flex flex-wrap justify-between gap-2">
                <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDel(true)}>Discard draft</Button>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => persist(text, elapsed)}>Save draft</Button>
                  <Button icon={<Send className="h-4 w-4" />} onClick={() => setConfirm(true)} disabled={words < 20} loading={busy}>Submit</Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-5">
              <div className="muted mb-2 text-xs">Submitted {formatDateTime(sub.submittedAt)} · {sub.wordCount} words</div>
              <div className="font-serif text-[15px] leading-7 whitespace-pre-wrap">{sub.text}</div>
            </Card>
          )}
        </div>
      </div>

      {!draft && (
        <div className="mt-6 space-y-6">
          {sub.status === 'evaluating' && <Alert tone="info" title="Evaluating your writing…"><span className="inline-flex items-center gap-2"><Spinner className="h-4 w-4" /> This usually takes under a minute. You can leave this page — we will notify you when it is ready.</span></Alert>}
          {sub.feedback?.aiStatus === 'not_configured' && <Alert tone="info" title="AI feedback is not configured">This server has no AI service configured, so no band estimate or examiner-style comments are available. The automatic statistics below are calculated directly from your text.</Alert>}
          {sub.feedback?.aiStatus === 'limit_reached' && <Alert tone="warning" title="Daily AI feedback limit reached" action={<Link to="/premium" className="text-sm font-semibold underline">Upgrade</Link>}>{sub.feedbackError}</Alert>}
          {sub.status === 'evaluation_failed' && <Alert tone="error" title="Evaluation failed" action={<Button size="sm" variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={retry}>Try again</Button>}>{sub.feedbackError}</Alert>}
          {(sub.status === 'submitted' && sub.feedback?.aiStatus === 'limit_reached') && <Button variant="secondary" onClick={retry}>Request feedback again</Button>}

          {ai && (
            <Card>
              <CardHeader title="AI feedback" subtitle={sub.feedback?.detailed ? 'Detailed Premium feedback' : 'Standard feedback'} action={<div className="text-right"><div className="muted text-xs">Estimated band</div><div className="text-2xl font-bold text-brand-600">≈ {sub.bandEstimate}</div></div>} />
              <div className="space-y-5 p-5">
                <p>{ai.summary}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {WRITING_CRITERIA.map((c) => {
                    const f = ai.criteria.find((x) => x.id === c.id);
                    if (!f) return null;
                    return (
                      <div key={c.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{c.label}</h3><Badge tone="brand">≈ {f.band}</Badge></div>
                        <p className="mt-2 text-sm">{f.comment}</p>
                        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">{f.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                      </div>
                    );
                  })}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div><h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Strengths</h3><ul className="mt-1 list-disc pl-5 text-sm">{ai.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                  <div><h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400">To improve</h3><ul className="mt-1 list-disc pl-5 text-sm">{ai.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                </div>
                {ai.corrections.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold">Corrections</h3>
                    <ul className="mt-2 space-y-2 text-sm">
                      {ai.corrections.map((c, i) => (
                        <li key={i} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60"><span className="text-red-600 line-through">{c.original}</span> → <span className="font-medium text-emerald-700 dark:text-emerald-400">{c.corrected}</span><div className="muted mt-1">{c.explanation}</div></li>
                      ))}
                    </ul>
                  </div>
                )}
                {ai.improvedVersion && (
                  <details><summary className="cursor-pointer text-sm font-semibold text-brand-700 dark:text-brand-300">Show an improved version of your answer</summary><div className="mt-2 rounded-lg bg-slate-50 p-4 font-serif text-[15px] leading-7 whitespace-pre-wrap dark:bg-slate-800/60">{ai.improvedVersion}</div></details>
                )}
                <BandNote />
              </div>
            </Card>
          )}

          {st && (
            <Card>
              <CardHeader title="Automatic text statistics" subtitle="Calculated directly from your text — not AI feedback" />
              <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
                <div><div className="muted text-xs">Words</div><div className={`text-xl font-semibold ${st.underLength ? 'text-amber-700 dark:text-amber-400' : ''}`}>{st.wordCount}</div>{st.underLength && <div className="text-xs text-amber-700 dark:text-amber-400">Below the {st.minWords}-word minimum</div>}</div>
                <div><div className="muted text-xs">Paragraphs</div><div className="text-xl font-semibold">{st.paragraphs}</div></div>
                <div><div className="muted text-xs">Average sentence length</div><div className="text-xl font-semibold">{st.avgSentenceLength} words</div></div>
                <div><div className="muted text-xs">Vocabulary variety</div><div className="text-xl font-semibold">{Math.round(st.lexicalDiversity * 100)}%</div><div className="muted text-xs">unique words ÷ total</div></div>
              </div>
              <div className="space-y-2 border-t border-slate-100 p-5 text-sm dark:border-slate-800">
                <div><strong>Linking words used:</strong> {st.linkersUsed.length ? st.linkersUsed.join(', ') : 'none found — linking words help coherence'}</div>
                {st.repeatedWords.length > 0 && <div><strong>Frequently repeated:</strong> {st.repeatedWords.map((r) => `${r.word} (${r.count})`).join(', ')} — consider synonyms</div>}
                {st.academicWordsUsed.length > 0 && <div><strong>Upper-level vocabulary:</strong> {st.academicWordsUsed.join(', ')}</div>}
                {st.contractions > 0 && <div><strong>Contractions:</strong> {st.contractions} (e.g. “don’t”) — avoid these in formal writing</div>}
              </div>
            </Card>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={async () => { const r = await api.post<{ submission: { id: string } }>('/api/writing/submissions', { taskId: task.id }).catch((e) => { toast(errorMessage(e), 'error'); return null; }); if (r) nav(`/ielts/writing/submissions/${r.submission.id}`); }} icon={<CheckCircle2 className="h-4 w-4" />} disabled={Boolean(sub.mockAttemptId)}>Write this task again</Button>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={submit} title="Submit your answer?" message={words < task.minWords ? <Alert tone="warning">Your answer has {words} words, below the {task.minWords}-word minimum. In the exam this would lower your Task Achievement score.</Alert> : 'You will not be able to edit it after submitting.'} confirmLabel="Submit" />
      <ConfirmDialog open={del} onClose={() => setDel(false)} danger title="Discard this draft?" message="Your text will be deleted permanently." confirmLabel="Discard" onConfirm={async () => { await api.del(`/api/writing/submissions/${id}`); nav('/ielts/writing'); }} />
    </div>
  );
}
