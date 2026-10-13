import { Link } from 'react-router';
import { Lock } from 'lucide-react';
import { QUESTION_TYPE_LABELS, WRITING_CRITERIA, type QuestionType } from '@fluentpath/shared';
import { AccuracyBars, BandTrend, DailyBars } from '../components/learning/DataCharts';
import { BandNote } from '../components/learning/Disclaimers';
import { Badge, ButtonLink, Card, CardHeader, EmptyState, ErrorState, PageHeader, PageLoader, Stat } from '../components/ui';
import { formatDateTime, timeAgo } from '../lib/format';
import { useApi } from '../lib/useApi';

interface ProgressData {
  plan: string;
  series: { day: string; minutes: number; xp: number }[];
  totals: { xp: number; minutes: number };
  activity: { id: number; title: string; xp: number; createdAt: string }[];
  attempts: { id: string; kind: string; title: string; score: number | null; maxScore: number | null; bandEstimate: number | null; completedAt: string }[];
  writing: { id: string; title: string; taskNumber: number; status: string; bandEstimate: number | null; submittedAt: string }[];
  assessments: { cefrResult: string; score: number; maxScore: number; completedAt: string }[];
  analytics: { accuracyByType: Record<string, { correct: number; total: number }>; bandTrend: { module: string; band: number; at: string }[]; writingCriteria: Record<string, number> } | null;
  analyticsLocked: boolean;
}
const KIND: Record<string, string> = { lesson: 'Grammar lesson', vocab_quiz: 'Vocabulary quiz', ielts_reading: 'IELTS reading', ielts_listening: 'IELTS listening' };

export default function Progress() {
  const { data, error, loading, reload } = useApi<ProgressData>('/api/progress');
  const ach = useApi<{ achievements: { code: string; title: string; description: string; earnedAt: string | null }[] }>('/api/achievements');
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const empty = data.activity.length === 0;
  return (
    <div>
      <PageHeader title="Your progress" description="Everything here is calculated from the activities you have completed." />
      {empty ? (
        <EmptyState title="No activity yet" description="Complete a lesson, quiz or practice test to start tracking your progress." action={<ButtonLink to="/dashboard">Go to dashboard</ButtonLink>} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Total XP" value={data.totals.xp} />
            <Stat label="Total study time" value={`${Math.floor(data.totals.minutes / 60)}h ${data.totals.minutes % 60}m`} />
            <Stat label="Practice items completed" value={data.attempts.length + data.writing.length} />
          </div>
          <Card><CardHeader title="Study minutes" subtitle="Last 30 days" /><div className="p-5"><DailyBars data={data.series} /></div></Card>

          <Card>
            <CardHeader title="Advanced analytics" subtitle="Accuracy by IELTS question type, band trends and writing criteria" action={data.analyticsLocked ? <Badge tone="violet">Premium</Badge> : undefined} />
            {data.analyticsLocked ? (
              <div className="flex flex-col items-center p-8 text-center"><Lock className="h-8 w-8 text-slate-400" /><p className="muted mt-2 max-w-md text-sm">See which question types you find hardest, how your band estimates change over time and your average score for each writing criterion.</p><ButtonLink to="/premium" className="mt-4">Upgrade to Premium</ButtonLink></div>
            ) : data.analytics && (
              <div className="grid gap-6 p-5 lg:grid-cols-2">
                <div>
                  <h3 className="mb-3 text-sm font-semibold">Accuracy by question type</h3>
                  {Object.keys(data.analytics.accuracyByType).length ? <AccuracyBars rows={Object.entries(data.analytics.accuracyByType).map(([k, v]) => ({ label: QUESTION_TYPE_LABELS[k as QuestionType] ?? k, ...v }))} /> : <p className="muted text-sm">Complete reading or listening practice to see this.</p>}
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-semibold">Band estimates over time</h3>
                  {data.analytics.bandTrend.length ? <BandTrend points={data.analytics.bandTrend} /> : <p className="muted text-sm">No band estimates yet.</p>}
                  {Object.keys(data.analytics.writingCriteria).length > 0 && (
                    <div className="mt-6">
                      <h3 className="mb-2 text-sm font-semibold">Average writing criteria (AI feedback)</h3>
                      <ul className="space-y-1 text-sm">{WRITING_CRITERIA.map((c) => data.analytics!.writingCriteria[c.id] != null && <li key={c.id} className="flex justify-between"><span>{c.label}</span><strong>≈ {data.analytics!.writingCriteria[c.id]}</strong></li>)}</ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Quiz and practice results" />
              <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                {data.attempts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <div className="min-w-0"><div className="truncate">{a.title}</div><div className="muted text-xs">{KIND[a.kind] ?? a.kind} · {formatDateTime(a.completedAt)}</div></div>
                    <div className="shrink-0 text-right"><div className="font-semibold">{a.score}/{a.maxScore}</div>{a.bandEstimate != null && <div className="muted text-xs">≈ {a.bandEstimate}</div>}</div>
                  </li>
                ))}
                {data.attempts.length === 0 && <li className="muted px-5 py-4 text-sm">No results yet.</li>}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Recent activity" />
              <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                {data.activity.map((a) => <li key={a.id} className="px-5 py-2.5 text-sm"><div>{a.title}</div><div className="muted text-xs">{timeAgo(a.createdAt)}{a.xp ? ` · +${a.xp} XP` : ''}</div></li>)}
              </ul>
            </Card>
          </div>

          <Card>
            <CardHeader title="Level assessments" />
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.assessments.map((a, i) => <li key={i} className="flex justify-between px-5 py-2.5 text-sm"><span>Estimated level <strong>{a.cefrResult}</strong> ({a.score}/{a.maxScore})</span><span className="muted">{formatDateTime(a.completedAt)}</span></li>)}
              {data.assessments.length === 0 && <li className="px-5 py-3 text-sm"><Link to="/assessment" className="text-brand-700 hover:underline dark:text-brand-300">Take the placement assessment</Link></li>}
            </ul>
          </Card>
          <BandNote />
        </div>
      )}
      <h2 id="achievements" className="mt-10 mb-3 text-lg font-semibold">Achievements</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ach.data?.achievements.map((a) => (
          <div key={a.code} className={`card p-4 ${a.earnedAt ? '' : 'opacity-50'}`}>
            <div className="flex items-center justify-between"><span className="font-semibold">{a.title}</span>{a.earnedAt ? <Badge tone="green">Earned</Badge> : <Badge>Locked</Badge>}</div>
            <p className="muted mt-1 text-sm">{a.description}</p>
            {a.earnedAt && <p className="muted mt-1 text-xs">{formatDateTime(a.earnedAt)}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
