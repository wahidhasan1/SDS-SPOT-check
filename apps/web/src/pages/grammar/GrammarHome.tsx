import { useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, Circle, CircleDot } from 'lucide-react';
import { cefrToPath, type PathLevel } from '@fluentpath/shared';
import { Badge, Card, ErrorState, PageHeader, PageLoader, ProgressBar, Tabs } from '../../components/ui';
import { useMe } from '../../lib/auth';
import { useApi } from '../../lib/useApi';

interface LessonItem { id: string; slug: string; title: string; track: string; pathLevel: PathLevel; cefrLevel: string; summary: string; exerciseCount: number; status: string | null; bestScore: number | null; maxScore: number | null }

const PATHS: { id: PathLevel; label: string; text: string }[] = [
  { id: 'beginner', label: 'Beginner', text: 'A1–A2: the building blocks of English sentences.' },
  { id: 'intermediate', label: 'Intermediate', text: 'B1–B2: tenses, conditionals, passive and reported speech.' },
  { id: 'advanced', label: 'Advanced', text: 'B2–C1: accuracy, cohesion and academic style for IELTS.' },
];

export default function GrammarHome() {
  const me = useMe();
  const [track, setTrack] = useState<'grammar' | 'general'>('grammar');
  const { data, error, loading, reload } = useApi<{ lessons: LessonItem[] }>(`/api/lessons?track=${track}`, [track]);
  const recommended = cefrToPath(me.profile.cefrLevel);
  return (
    <div>
      <PageHeader eyebrow="Learn" title="Grammar and general English" description="Clear explanations, examples and practice questions that are checked instantly. Score 70% or more to complete a lesson." />
      <Tabs tabs={[{ id: 'grammar', label: 'Grammar paths' }, { id: 'general', label: 'Everyday English' }]} value={track} onChange={setTrack} />
      {loading && !data ? <PageLoader /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="space-y-8">
          {(track === 'grammar' ? PATHS : [{ id: 'all' as PathLevel, label: 'Everyday English', text: 'Practical language for conversations, requests, opinions, emails and phone calls.' }]).map((p) => {
            const lessons = (data?.lessons ?? []).filter((l) => track === 'general' || l.pathLevel === p.id);
            if (!lessons.length) return null;
            const done = lessons.filter((l) => l.status === 'completed').length;
            return (
              <section key={p.id}>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold">{p.label} {track === 'grammar' && p.id === recommended && <Badge tone="green">Recommended for you</Badge>}</h2>
                    <p className="muted text-sm">{p.text}</p>
                  </div>
                  <div className="w-48 text-right text-sm"><span className="muted">{done} of {lessons.length} completed</span><ProgressBar value={done} max={lessons.length} tone="green" /></div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {lessons.map((l) => {
                    const Icon = l.status === 'completed' ? CheckCircle2 : l.status === 'started' ? CircleDot : Circle;
                    return (
                      <Link key={l.id} to={`/grammar/${l.slug}`}>
                        <Card className="h-full p-4 transition-shadow hover:shadow-md">
                          <div className="flex items-start gap-3">
                            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${l.status === 'completed' ? 'text-emerald-600' : l.status === 'started' ? 'text-amber-500' : 'text-slate-300'}`} />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{l.title}</h3><Badge>{l.cefrLevel}</Badge></div>
                              <p className="muted mt-1 text-sm">{l.summary}</p>
                              <p className="muted mt-2 text-xs">{l.exerciseCount} practice questions{l.maxScore ? ` · best score ${l.bestScore}/${l.maxScore}` : ''}</p>
                            </div>
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
