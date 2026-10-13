import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Clock, Lock } from 'lucide-react';
import { BandNote } from '../../components/learning/Disclaimers';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, PageLoader, Tabs, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useMe } from '../../lib/auth';
import { formatDateTime } from '../../lib/format';
import { useApi } from '../../lib/useApi';

interface SetItem { id: string; title: string; description: string; difficulty: string; timeLimitSec: number; questionCount: number; isPremium: boolean; locked: boolean; attempts: number; bestScore: number | null; bestBand: number | null; inProgressId: string | null; variant: string }
interface Hist { id: string; title: string; score: number; maxScore: number; bandEstimate: number | null; completedAt: string }

export default function SetList({ module }: { module: 'reading' | 'listening' }) {
  const me = useMe();
  const nav = useNavigate();
  const toast = useToast();
  const [variant, setVariant] = useState<'academic' | 'general'>(me.profile.ieltsModule ?? 'academic');
  const { data, error, loading, reload } = useApi<{ sets: SetItem[] }>(`/api/ielts/sets?module=${module}${module === 'reading' ? `&variant=${variant}` : ''}`, [variant]);
  const hist = useApi<{ attempts: Hist[] }>(`/api/ielts/history?module=${module}`);
  const [starting, setStarting] = useState<string | null>(null);

  const start = async (s: SetItem) => {
    if (s.locked) return nav('/premium');
    setStarting(s.id);
    try {
      const r = await api.post<{ attemptId: string }>(`/api/ielts/sets/${s.id}/start`);
      nav(`/ielts/attempts/${r.attemptId}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
      setStarting(null);
    }
  };

  return (
    <div>
      <Link to="/ielts" className="muted mb-4 inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft className="h-4 w-4" /> IELTS</Link>
      <PageHeader eyebrow="IELTS" title={module === 'reading' ? 'Reading practice' : 'Listening practice'} description={module === 'reading' ? 'Each set is timed. Your answers are saved as you go and checked when you submit.' : 'Listen to the recording and answer the questions. In the real test you hear the recording once — try to do the same.'} />
      {module === 'reading' && <Tabs tabs={[{ id: 'academic', label: 'Academic' }, { id: 'general', label: 'General Training' }]} value={variant} onChange={setVariant} />}
      {loading && !data ? <PageLoader /> : error ? <ErrorState message={error} onRetry={reload} /> : data!.sets.length === 0 ? <EmptyState title="No practice sets yet" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {data!.sets.map((s) => (
            <Card key={s.id} className="flex flex-col p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="capitalize">{s.difficulty}</Badge>
                {s.isPremium && <Badge tone="violet">Premium</Badge>}
                {s.attempts > 0 && <Badge tone="green">Done {s.attempts}×</Badge>}
              </div>
              <h2 className="mt-2 font-semibold">{s.title}</h2>
              <p className="muted mt-1 text-sm">{s.description}</p>
              <div className="muted mt-3 flex flex-wrap gap-4 text-xs"><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{Math.round(s.timeLimitSec / 60)} min</span><span>{s.questionCount} questions</span>{s.bestScore != null && <span>Best: {s.bestScore}/{s.questionCount}{s.bestBand != null ? ` (≈ ${s.bestBand})` : ''}</span>}</div>
              <div className="mt-auto pt-4">
                {s.locked ? (
                  <Button variant="secondary" icon={<Lock className="h-4 w-4" />} onClick={() => nav('/premium')}>Unlock with Premium</Button>
                ) : s.inProgressId ? (
                  <Button onClick={() => nav(`/ielts/attempts/${s.inProgressId}`)}>Resume</Button>
                ) : (
                  <Button onClick={() => start(s)} loading={starting === s.id}>{s.attempts ? 'Try again' : 'Start'}</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <h2 className="mt-10 mb-3 text-lg font-semibold">Your history</h2>
      {hist.data?.attempts.length ? (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {hist.data.attempts.map((h) => (
            <Link key={h.id} to={`/ielts/attempts/${h.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <div><div className="text-sm font-medium">{h.title}</div><div className="muted text-xs">{formatDateTime(h.completedAt)}</div></div>
              <div className="text-right text-sm"><div className="font-semibold">{h.score}/{h.maxScore}</div>{h.bandEstimate != null && <div className="muted text-xs">≈ band {h.bandEstimate}</div>}</div>
            </Link>
          ))}
        </div>
      ) : <p className="muted text-sm">No completed attempts yet.</p>}
      <div className="mt-4"><BandNote /></div>
    </div>
  );
}
