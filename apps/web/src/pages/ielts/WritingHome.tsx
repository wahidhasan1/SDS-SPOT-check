import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Lock } from 'lucide-react';
import { BandNote } from '../../components/learning/Disclaimers';
import { Alert, Badge, Button, Card, ErrorState, PageHeader, PageLoader, Tabs, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useMe } from '../../lib/auth';
import { formatDateTime } from '../../lib/format';
import { useApi } from '../../lib/useApi';

interface Task { id: string; title: string; taskNumber: number; taskType: string; variant: string; isPremium: boolean; locked: boolean; minWords: number; timeMinutes: number; submissions: number; bestBand: number | null; draftId: string | null }
interface Sub { id: string; taskTitle: string; taskNumber: number; status: string; wordCount: number; bandEstimate: number | null; updatedAt: string; submittedAt: string | null }

const TYPE_LABEL: Record<string, string> = { bar: 'Bar chart', line: 'Line graph', pie: 'Pie charts', table: 'Table', process: 'Process diagram', map: 'Maps', letter: 'Letter', essay: 'Essay' };
const STATUS: Record<string, { label: string; tone: 'slate' | 'amber' | 'green' | 'red' | 'brand' }> = {
  draft: { label: 'Draft', tone: 'amber' },
  submitted: { label: 'Submitted', tone: 'slate' },
  evaluating: { label: 'Evaluating…', tone: 'brand' },
  evaluated: { label: 'Feedback ready', tone: 'green' },
  evaluation_failed: { label: 'Evaluation failed', tone: 'red' },
};

export default function WritingHome() {
  const me = useMe();
  const nav = useNavigate();
  const toast = useToast();
  const [variant, setVariant] = useState<'academic' | 'general'>(me.profile.ieltsModule ?? 'academic');
  const { data, error, loading, reload } = useApi<{ tasks: Task[]; aiConfigured: boolean }>(`/api/writing/tasks?variant=${variant}`, [variant]);
  const subs = useApi<{ submissions: Sub[] }>('/api/writing/submissions');
  const [busy, setBusy] = useState<string | null>(null);

  const open = async (t: Task) => {
    if (t.locked) return nav('/premium');
    setBusy(t.id);
    try {
      const r = await api.post<{ submission: { id: string } }>('/api/writing/submissions', { taskId: t.id });
      nav(`/ielts/writing/submissions/${r.submission.id}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
      setBusy(null);
    }
  };

  return (
    <div>
      <Link to="/ielts" className="muted mb-4 inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft className="h-4 w-4" /> IELTS</Link>
      <PageHeader eyebrow="IELTS" title="Writing practice" description="Write with a timer and live word count. Drafts are saved automatically. Submit to get statistics and, when AI is configured, criteria-based feedback." />
      {data && !data.aiConfigured && <Alert tone="info" className="mb-4" title="AI feedback is not configured on this server">You can still write, save drafts, submit and get automatic text statistics (word count, paragraphs, linking words, repetition). Band estimates need AI feedback, which an administrator can enable by setting ANTHROPIC_API_KEY.</Alert>}
      <Tabs tabs={[{ id: 'academic', label: 'Academic' }, { id: 'general', label: 'General Training' }]} value={variant} onChange={setVariant} />
      {loading && !data ? <PageLoader /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="space-y-8">
          {[1, 2].map((n) => (
            <section key={n}>
              <h2 className="mb-1 text-lg font-semibold">Task {n}</h2>
              <p className="muted mb-3 text-sm">{n === 1 ? (variant === 'academic' ? 'Describe a chart, table, map or process in at least 150 words (20 minutes).' : 'Write a letter in at least 150 words (20 minutes).') : 'Write an essay of at least 250 words (40 minutes). Task 2 counts twice as much as Task 1.'}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {data!.tasks.filter((t) => t.taskNumber === n).map((t) => (
                  <Card key={t.id} className="flex flex-col p-4">
                    <div className="flex flex-wrap gap-2"><Badge>{TYPE_LABEL[t.taskType] ?? t.taskType}</Badge>{t.isPremium && <Badge tone="violet">Premium</Badge>}{t.draftId && <Badge tone="amber">Draft saved</Badge>}{t.submissions > 0 && <Badge tone="green">Submitted {t.submissions}×</Badge>}</div>
                    <h3 className="mt-2 font-semibold">{t.title}</h3>
                    <p className="muted mt-1 text-xs">{t.minWords}+ words · {t.timeMinutes} minutes{t.bestBand != null ? ` · best ≈ ${t.bestBand}` : ''}</p>
                    <div className="mt-auto pt-3">
                      <Button size="sm" variant={t.locked ? 'secondary' : 'primary'} icon={t.locked ? <Lock className="h-4 w-4" /> : undefined} loading={busy === t.id} onClick={() => open(t)}>{t.locked ? 'Unlock with Premium' : t.draftId ? 'Continue draft' : 'Start writing'}</Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <h2 className="mt-10 mb-3 text-lg font-semibold">Your submissions</h2>
      {subs.data?.submissions.length ? (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {subs.data.submissions.map((s) => (
            <Link key={s.id} to={`/ielts/writing/submissions/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <div className="min-w-0"><div className="truncate text-sm font-medium">Task {s.taskNumber}: {s.taskTitle}</div><div className="muted text-xs">{s.wordCount} words · {formatDateTime(s.submittedAt ?? s.updatedAt)}</div></div>
              <div className="flex shrink-0 items-center gap-2">{s.bandEstimate != null && <span className="text-sm font-semibold">≈ {s.bandEstimate}</span>}<Badge tone={STATUS[s.status]?.tone ?? 'slate'}>{STATUS[s.status]?.label ?? s.status}</Badge></div>
            </Link>
          ))}
        </div>
      ) : <p className="muted text-sm">No submissions yet.</p>}
      <div className="mt-4"><BandNote /></div>
    </div>
  );
}
