import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { CheckCircle2, Headphones, XCircle } from 'lucide-react';
import { countWords, type ChartSpec, type ListeningContent, type ReadingContent } from '@fluentpath/shared';
import { Chart } from '../../components/learning/Chart';
import { BandNote } from '../../components/learning/Disclaimers';
import { QuestionGroups, type PublicG } from '../../components/learning/QuestionGroups';
import { RecorderPanel } from '../../components/learning/Recorder';
import { TimerBadge, useCountdown } from '../../components/learning/Timer';
import { Alert, Badge, Button, Card, CardHeader, ConfirmDialog, ErrorState, PageLoader, Tabs, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useRecorder } from '../../lib/recorder';
import { uploadSpeaking } from '../../lib/speaking';

type Module = 'listening' | 'reading' | 'writing' | 'speaking';
interface WTask { id: string; slug: string; title: string; taskNumber: number; prompt: string; instructions: string; visual: ChartSpec | null; minWords: number }
interface SPrompt { id: string; part: number; topic: string; questions: string[]; cueCard: string | null; speakSeconds: number }
interface Section {
  index: number;
  module: Module;
  deadlineAt: string;
  answers: Record<string, string>;
  set?: { id: string; title: string; questionCount: number };
  content?: (ReadingContent | ListeningContent) & { groups: PublicG[] };
  tasks?: WTask[];
  prompts?: SPrompt[];
  recordings?: { id: string; promptId: string | null; question: string; durationSec: number }[];
}
interface Results {
  sections: ({ module: 'listening' | 'reading'; score: number; maxScore: number; band: number | null; results: { n: number; correct: boolean; given: string | null; correctAnswer: string; explanation: string }[] } | { module: 'writing'; band: number | null; items: { taskNumber: number; title: string; submissionId: string | null; wordCount: number; status: string; band: number | null }[] } | { module: 'speaking'; band: number | null; recordings: { id: string; question: string; durationSec: number; aiStatus: string | null }[] })[];
  bands: Record<string, number | null>;
  overall: number | null;
}
interface Resp { attempt: { id: string; status: string; currentSection: number }; test: { title: string; variant: string; sections: { module: Module; timeLimitSec: number }[] }; section?: Section; results?: Results; serverTime: number }

export default function MockRunner() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const load = useCallback(async () => {
    try {
      const r = await api.get<Resp>(`/api/mock-attempts/${id}`);
      setData(r);
      setAnswers(r.section?.answers ?? {});
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const section = data?.section;
  const remaining = useCountdown(section?.deadlineAt, data?.serverTime);

  const save = (next: Record<string, string>) => {
    setAnswers(next);
    setSaveState('Saving…');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await api.put(`/api/mock-attempts/${id}/answers`, { section: section!.index, answers: next });
        setSaveState('Saved');
      } catch (err) {
        setSaveState(errorMessage(err));
      }
    }, 1200);
  };

  const submitSection = useCallback(async () => {
    if (!section) return;
    setBusy(true);
    clearTimeout(saveTimer.current);
    try {
      await api.post(`/api/mock-attempts/${id}/submit-section`, { section: section.index, answers: answersRef.current });
      await load();
      window.scrollTo(0, 0);
    } catch (err) {
      toast(errorMessage(err), 'error');
      await load();
    } finally {
      setBusy(false);
    }
  }, [id, load, section, toast]);

  const autoDone = useRef<number | null>(null);
  useEffect(() => {
    if (remaining === 0 && section && autoDone.current !== section.index) {
      autoDone.current = section.index;
      toast('Time is up for this section — moving on.', 'info');
      submitSection();
    }
  }, [remaining, section, submitSection, toast]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <PageLoader />;

  if (data.attempt.status !== 'in_progress') {
    const r = data.results;
    return (
      <div>
        <Link to="/ielts/mock" className="muted mb-4 inline-block text-sm hover:underline">← Mock tests</Link>
        <h1 className="text-2xl font-bold">{data.test.title}: results</h1>
        {data.attempt.status === 'abandoned' ? <Alert tone="warning" className="mt-4">This test was abandoned.</Alert> : r && (
          <>
            <Card className="mt-4 p-5">
              <div className="grid gap-4 sm:grid-cols-5">
                {(['listening', 'reading', 'writing', 'speaking'] as const).map((m) => (
                  <div key={m}><div className="muted text-xs capitalize">{m}</div><div className="text-2xl font-bold">{r.bands[m] != null ? `≈ ${r.bands[m]}` : '—'}</div></div>
                ))}
                <div><div className="muted text-xs">Overall</div><div className="text-2xl font-bold text-brand-600">{r.overall != null ? `≈ ${r.overall}` : '—'}</div></div>
              </div>
              {r.overall == null && <p className="muted mt-3 text-sm">An overall band needs all four modules. Writing and Speaking bands appear when AI feedback is configured and has finished; refresh this page later if feedback is still in progress.</p>}
              <div className="mt-3"><BandNote /></div>
            </Card>
            <div className="mt-6 space-y-4">
              {r.sections.map((s, i) => (
                <Card key={i}>
                  <CardHeader title={<span className="capitalize">{s.module}</span>} subtitle={'score' in s ? `${s.score}/${s.maxScore} correct` : undefined} />
                  <div className="p-5 text-sm">
                    {'results' in s && (
                      <ul className="space-y-2">{s.results.map((q) => (
                        <li key={q.n} className="flex gap-2">{q.correct ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="h-4 w-4 shrink-0 text-red-600" />}<div><strong>Q{q.n}</strong> {!q.correct && <>— your answer: {q.given ?? '(blank)'}; correct: <strong>{q.correctAnswer}</strong></>}<div className="muted">{q.explanation}</div></div></li>
                      ))}</ul>
                    )}
                    {'items' in s && s.items.map((it) => (
                      <div key={it.taskNumber} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0 dark:border-slate-800">
                        <span>Task {it.taskNumber}: {it.title} · {it.wordCount} words</span>
                        {it.submissionId ? <Link className="text-brand-700 hover:underline dark:text-brand-300" to={`/ielts/writing/submissions/${it.submissionId}`}>{it.band != null ? `≈ ${it.band}` : it.status === 'evaluating' ? 'Evaluating…' : 'View'}</Link> : <span className="muted">Not answered</span>}
                      </div>
                    ))}
                    {'recordings' in s && (s.recordings.length ? s.recordings.map((rc) => (
                      <div key={rc.id} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0 dark:border-slate-800"><span className="truncate pr-3">{rc.question}</span><Link className="shrink-0 text-brand-700 hover:underline dark:text-brand-300" to={`/ielts/speaking/attempts/${rc.id}`}>View</Link></div>
                    )) : <p className="muted">No answers were recorded.</p>)}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  const s = section!;
  const total = data.test.sections.length;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {data.test.sections.map((x, i) => <Badge key={i} tone={i === s.index ? 'brand' : i < s.index ? 'green' : 'slate'} className="capitalize">{i + 1}. {x.module}</Badge>)}
        </div>
        <div className="flex items-center gap-3"><span className="muted text-xs">{saveState}</span><TimerBadge seconds={remaining} /></div>
      </div>
      <h1 className="text-2xl font-bold capitalize">{data.test.title} — {s.module}</h1>
      <p className="muted mt-1 text-sm">Section {s.index + 1} of {total}. When you submit a section you cannot return to it. When time runs out, the section is submitted automatically.</p>

      <div className="mt-6">
        {(s.module === 'listening' || s.module === 'reading') && s.content && (
          <div className={`grid gap-6 ${s.module === 'reading' ? 'lg:grid-cols-2' : ''}`}>
            {s.module === 'reading' ? (
              <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
                {(s.content as ReadingContent).passages.map((p) => (
                  <Card key={p.id} className="p-5"><h2 className="text-lg font-semibold">{p.title}</h2><div className="mt-3 space-y-3 text-[15px] leading-7">{p.paragraphs.map((para, i) => <p key={i}>{para.label && <strong className="mr-2">{para.label}</strong>}{para.text}</p>)}</div></Card>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {(s.content as ListeningContent).sections.map((ls) => (
                  <Card key={ls.id} className="p-5"><div className="flex items-center gap-2"><Headphones className="h-5 w-5 text-brand-600" /><h2 className="font-semibold">{ls.title}</h2></div>{ls.context && <p className="muted mt-1 text-sm">{ls.context}</p>}<audio controls preload="metadata" src={ls.audioUrl} className="mt-3 w-full" /></Card>
                ))}
              </div>
            )}
            <Card className="p-5"><QuestionGroups idPrefix={`s${s.index}-`} groups={s.content.groups} answers={answers} onChange={(n, v) => save({ ...answersRef.current, [String(n)]: v })} /></Card>
          </div>
        )}
        {s.module === 'writing' && s.tasks && <WritingSection tasks={s.tasks} answers={answers} onChange={(slug, v) => save({ ...answersRef.current, [slug]: v })} />}
        {s.module === 'speaking' && s.prompts && <SpeakingSection attemptId={data.attempt.id} prompts={s.prompts} recordings={s.recordings ?? []} onRecorded={load} />}
      </div>

      <div className="sticky bottom-16 z-20 mt-6 lg:bottom-4">
        <div className="card flex items-center justify-between gap-3 p-3 shadow-lg">
          <Button variant="ghost" onClick={async () => { if (confirm) return; if (window.confirm('Abandon this mock test? Your progress will not be scored.')) { await api.post(`/api/mock-attempts/${id}/abandon`).catch(() => {}); nav('/ielts/mock'); } }}>Abandon</Button>
          <Button onClick={() => setConfirm(true)} loading={busy}>{s.index === total - 1 ? 'Finish test' : 'Submit section'}</Button>
        </div>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={submitSection} title={s.index === total - 1 ? 'Finish the test?' : 'Submit this section?'} message="You will not be able to change your answers for this section afterwards." confirmLabel="Submit" />
    </div>
  );
}

function WritingSection({ tasks, answers, onChange }: { tasks: WTask[]; answers: Record<string, string>; onChange: (slug: string, v: string) => void }) {
  const [tab, setTab] = useState(tasks[0]?.slug ?? '');
  const t = tasks.find((x) => x.slug === tab) ?? tasks[0];
  const words = countWords(answers[t.slug] ?? '');
  return (
    <div>
      <Tabs tabs={tasks.map((x) => ({ id: x.slug, label: `Task ${x.taskNumber} (${countWords(answers[x.slug] ?? '')} words)` }))} value={tab} onChange={setTab} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4"><Card className="p-5"><p className="font-medium whitespace-pre-line">{t.prompt}</p><p className="muted mt-3 text-sm">{t.instructions}</p></Card>{t.visual && <Chart spec={t.visual} />}</div>
        <Card className="flex flex-col p-5">
          <div className={`mb-2 text-sm font-semibold ${words < t.minWords ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{words} / {t.minWords} words</div>
          <textarea className="input min-h-[420px] flex-1 font-serif text-[15px] leading-7" value={answers[t.slug] ?? ''} onChange={(e) => onChange(t.slug, e.target.value)} spellCheck={false} aria-label={`Task ${t.taskNumber} answer`} />
          <p className="muted mt-2 text-xs">Tip: spend about 20 minutes on Task 1 and 40 minutes on Task 2.</p>
        </Card>
      </div>
    </div>
  );
}

function SpeakingSection({ attemptId, prompts, recordings, onRecorded }: { attemptId: string; prompts: SPrompt[]; recordings: { promptId: string | null; question: string }[]; onRecorded: () => void }) {
  const toast = useToast();
  const items = prompts.flatMap((p) => (p.part === 2 ? [{ p, q: p.cueCard! }] : p.questions.map((q) => ({ p, q }))));
  const doneSet = new Set(recordings.map((r) => r.question));
  const next = items.findIndex((it) => !doneSet.has(it.q));
  const [busy, setBusy] = useState(false);
  const rec = useRecorder();
  const current = next >= 0 ? items[next] : null;
  useEffect(() => {
    if (current && rec.state === 'recording' && rec.seconds >= current.p.speakSeconds) rec.stop();
  }, [rec, current]);
  const submit = async () => {
    if (!current) return;
    setBusy(true);
    try {
      await uploadSpeaking({ mode: 'mock', mockAttemptId: attemptId, promptId: current.p.id, question: current.q, transcript: rec.transcript, transcriptSource: rec.transcript ? (rec.recognitionSupported ? 'browser' : 'manual') : 'none', durationSec: rec.seconds }, rec.blob);
      rec.reset();
      onRecorded();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm">{recordings.length} of {items.length} answers recorded.</p>
      {current ? (
        <Card className="p-6">
          <Badge tone="brand">Part {current.p.part} · {current.p.topic}</Badge>
          <h2 className="mt-3 text-lg font-semibold">{current.q}</h2>
          {current.p.part === 2 && <ul className="mt-2 list-disc pl-6 text-sm">{current.p.questions.map((x) => <li key={x}>{x}</li>)}</ul>}
          <div className="mt-4"><RecorderPanel rec={rec} maxSeconds={current.p.speakSeconds} /></div>
          {rec.state === 'stopped' && <div className="mt-4 flex justify-end"><Button onClick={submit} loading={busy}>Save answer</Button></div>}
        </Card>
      ) : <Alert tone="success">All speaking answers are recorded. Submit the section to finish the test.</Alert>}
    </div>
  );
}
