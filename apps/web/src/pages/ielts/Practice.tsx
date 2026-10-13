import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Check, Headphones } from 'lucide-react';
import type { ListeningContent, ReadingContent } from '@fluentpath/shared';
import { BandNote } from '../../components/learning/Disclaimers';
import { QuestionGroups, type PublicG, type QResult } from '../../components/learning/QuestionGroups';
import { SelectableText } from '../../components/learning/SelectableText';
import { TimerBadge, useCountdown } from '../../components/learning/Timer';
import { Alert, Badge, Button, Card, ConfirmDialog, ErrorState, PageLoader, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatDuration } from '../../lib/format';

interface AttemptResp {
  attempt: { id: string; status: string; answers: Record<string, string>; results: QResult[] | null; score: number | null; maxScore: number | null; bandEstimate: number | null; deadlineAt: string | null; durationSec: number | null };
  set: { id: string; title: string; module: 'reading' | 'listening'; variant: string; timeLimitSec: number; questionCount: number };
  content: (ReadingContent | ListeningContent) & { groups: PublicG[] };
  serverTime: number;
}

export default function Practice() {
  const { id } = useParams();
  const toast = useToast();
  const [data, setData] = useState<AttemptResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const load = useCallback(async () => {
    try {
      const r = await api.get<AttemptResp>(`/api/ielts/attempts/${id}`);
      setData(r);
      setAnswers(r.attempt.answers ?? {});
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const completed = data?.attempt.status === 'completed';
  const remaining = useCountdown(completed ? null : data?.attempt.deadlineAt, data?.serverTime);

  const submit = useCallback(async () => {
    setSubmitting(true);
    clearTimeout(saveTimer.current);
    try {
      const r = await api.post<{ late: boolean; newAchievements: { title: string }[] }>(`/api/ielts/attempts/${id}/submit`, { answers: answersRef.current });
      if (r.late) toast('Time was up — only answers saved before the deadline were scored.', 'info');
      r.newAchievements?.forEach((a) => toast(`Achievement unlocked: ${a.title}`, 'info'));
      await load();
      window.scrollTo(0, 0);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  }, [id, load, toast]);

  // Auto-submit when the timer reaches zero.
  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (remaining === 0 && !completed && data && !autoSubmitted.current) {
      autoSubmitted.current = true;
      toast('Time is up! Submitting your answers…', 'info');
      submit();
    }
  }, [remaining, completed, data, submit, toast]);

  const onChange = (n: number, v: string) => {
    const next = { ...answersRef.current, [String(n)]: v };
    setAnswers(next);
    setSaveState('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await api.put(`/api/ielts/attempts/${id}/answers`, { answers: next });
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, 1200);
  };

  const resultsMap = useMemo(() => (data?.attempt.results ? Object.fromEntries(data.attempt.results.map((r) => [r.n, r])) : null), [data]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <PageLoader />;
  const { set, content, attempt } = data;
  const answered = Object.values(answers).filter((v) => v?.trim()).length;
  const isReading = set.module === 'reading';
  const passages = isReading ? (content as ReadingContent).passages : [];
  const sections = !isReading ? (content as ListeningContent).sections : [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/ielts/${set.module}`} className="muted inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft className="h-4 w-4" /> {isReading ? 'Reading' : 'Listening'} practice</Link>
        {!completed && (
          <div className="flex items-center gap-3">
            <span className="muted text-xs" aria-live="polite">{saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'All answers saved' : saveState === 'error' ? 'Could not save — check your connection' : ''}</span>
            <TimerBadge seconds={remaining} />
          </div>
        )}
      </div>
      <h1 className="text-2xl font-bold">{set.title}</h1>

      {completed && (
        <Card className="mt-4 p-5">
          <div className="flex flex-wrap items-center gap-6">
            <div><div className="muted text-sm">Score</div><div className="text-3xl font-bold">{attempt.score}/{attempt.maxScore}</div></div>
            {attempt.bandEstimate != null && <div><div className="muted text-sm">Estimated band</div><div className="text-3xl font-bold text-brand-600">≈ {attempt.bandEstimate}</div></div>}
            {attempt.durationSec != null && <div><div className="muted text-sm">Time</div><div className="text-xl font-semibold">{formatDuration(attempt.durationSec)}</div></div>}
          </div>
          <div className="mt-3"><BandNote /></div>
          <p className="muted mt-2 text-xs">Practice sets are shorter than a real 40-question paper, so the score is scaled to estimate a band. Review each question below — explanations show where the answer is.</p>
        </Card>
      )}

      <div className={`mt-6 grid gap-6 ${isReading ? 'lg:grid-cols-2' : ''}`}>
        {isReading ? (
          <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            {passages.map((p) => (
              <Card key={p.id} className="p-5">
                <h2 className="text-lg font-semibold">{p.title}</h2>
                {completed && <p className="muted mt-1 text-xs">Tip: tap any word in the passage to see its meaning and save it.</p>}
                <div className="mt-3 space-y-3 text-[15px] leading-7">
                  {p.paragraphs.map((para, i) => (
                    <p key={i}>
                      {para.label && <strong className="mr-2 text-brand-700 dark:text-brand-300">{para.label}</strong>}
                      {completed ? <SelectableText text={para.text} source="reading" /> : para.text}
                    </p>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {sections.map((s) => (
              <Card key={s.id} className="p-5">
                <div className="flex items-center gap-2"><Headphones className="h-5 w-5 text-brand-600" /><h2 className="font-semibold">{s.title}</h2></div>
                {s.context && <p className="muted mt-1 text-sm">{s.context}</p>}
                <audio controls preload="metadata" src={s.audioUrl} className="mt-3 w-full">Your browser does not support audio playback.</audio>
                <p className="muted mt-1 text-xs">Synthesised audio generated from the script (text-to-speech).</p>
                {completed && 'transcript' in s && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-brand-700 dark:text-brand-300">Show transcript</summary>
                    <div className="mt-2 space-y-1.5 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                      {(s as { transcript: string }).transcript.split('\n').map((line, i) => {
                        const m = line.match(/^([^:]+):\s*(.*)$/);
                        return <p key={i}>{m ? <><strong>{m[1]}:</strong> <SelectableText text={m[2]} source="listening" /></> : line}</p>;
                      })}
                    </div>
                  </details>
                )}
              </Card>
            ))}
          </div>
        )}
        <Card className="p-5">
          <QuestionGroups groups={content.groups} answers={answers} onChange={completed ? undefined : onChange} results={resultsMap} />
        </Card>
      </div>

      {!completed && (
        <div className="sticky bottom-16 z-20 mt-6 lg:bottom-4">
          <div className="card flex items-center justify-between gap-3 p-3 shadow-lg">
            <span className="text-sm"><Badge tone={answered === set.questionCount ? 'green' : 'slate'}>{answered}/{set.questionCount} answered</Badge></span>
            <Button onClick={() => setConfirm(true)} loading={submitting} icon={<Check className="h-4 w-4" />}>Submit answers</Button>
          </div>
        </div>
      )}
      {completed && (
        <div className="mt-6 flex gap-2">
          <Link to={`/ielts/${set.module}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">Choose another practice set</Link>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={submit}
        title="Submit your answers?"
        message={answered < set.questionCount ? <Alert tone="warning">You have answered {answered} of {set.questionCount} questions. Unanswered questions will be marked wrong.</Alert> : 'You have answered every question. Submit to see your score and explanations.'}
        confirmLabel="Submit"
      />
    </div>
  );
}
