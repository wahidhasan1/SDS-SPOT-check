import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Clock, Lock } from 'lucide-react';
import { BandNote } from '../../components/learning/Disclaimers';
import { Alert, Badge, Button, Card, ErrorState, PageHeader, PageLoader, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { useApi } from '../../lib/useApi';

interface Test { id: string; title: string; variant: string; description: string; isPremium: boolean; locked: boolean; sections: { module: string; timeLimitSec: number }[]; totalMinutes: number; inProgressId: string | null; completedCount: number }

export default function MockList() {
  const nav = useNavigate();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ tests: Test[]; history: { id: string; mockTestId: string; completedAt: string }[] }>('/api/mock-tests');
  const [busy, setBusy] = useState<string | null>(null);
  const start = async (t: Test) => {
    if (t.locked) return nav('/premium');
    setBusy(t.id);
    try {
      const r = await api.post<{ attemptId: string }>(`/api/mock-tests/${t.id}/start`);
      nav(`/ielts/mock/${r.attemptId}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
      setBusy(null);
    }
  };
  return (
    <div>
      <Link to="/ielts" className="muted mb-4 inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft className="h-4 w-4" /> IELTS</Link>
      <PageHeader eyebrow="IELTS" title="Mock tests" description="Practice tests in exam order: Listening, Reading, Writing and Speaking, each with its own timer. Your answers are saved as you go." />
      <Alert tone="info" className="mb-6">These are <strong>shortened practice tests</strong>, not complete official-format IELTS exams. Band estimates are scaled from fewer questions and are approximate. Writing and Speaking bands need AI feedback to be configured.</Alert>
      {loading && !data ? <PageLoader /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {data!.tests.map((t) => (
            <Card key={t.id} className="flex flex-col p-5">
              <div className="flex flex-wrap gap-2"><Badge tone="brand">{t.variant === 'academic' ? 'Academic' : 'General Training'}</Badge>{t.isPremium && <Badge tone="violet">Premium</Badge>}{t.completedCount > 0 && <Badge tone="green">Completed {t.completedCount}×</Badge>}</div>
              <h2 className="mt-2 font-semibold">{t.title}</h2>
              <p className="muted mt-1 text-sm">{t.description}</p>
              <div className="muted mt-3 flex flex-wrap gap-3 text-xs"><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> about {t.totalMinutes} min</span>{t.sections.map((s) => <span key={s.module} className="capitalize">{s.module} {Math.round(s.timeLimitSec / 60)}m</span>)}</div>
              <div className="mt-auto pt-4">
                {t.locked ? <Button variant="secondary" icon={<Lock className="h-4 w-4" />} onClick={() => nav('/premium')}>Unlock with Premium</Button> : t.inProgressId ? <Button onClick={() => nav(`/ielts/mock/${t.inProgressId}`)}>Resume test</Button> : <Button onClick={() => start(t)} loading={busy === t.id}>Start test</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
      <h2 className="mt-10 mb-3 text-lg font-semibold">Completed tests</h2>
      {data?.history.length ? (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {data.history.map((h) => <Link key={h.id} to={`/ielts/mock/${h.id}`} className="flex justify-between px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50"><span>{data.tests.find((t) => t.id === h.mockTestId)?.title}</span><span className="muted">{formatDateTime(h.completedAt)}</span></Link>)}
        </div>
      ) : <p className="muted text-sm">No completed mock tests yet.</p>}
      <div className="mt-4"><BandNote /></div>
    </div>
  );
}
