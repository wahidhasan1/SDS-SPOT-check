import { Link } from 'react-router';
import { ArrowRight, BookOpen, Flame, GraduationCap, Headphones, Library, Mic, PenLine, Phone, Swords, Target, Trophy } from 'lucide-react';
import { CEFR_INFO, type CefrLevel } from '@fluentpath/shared';
import { DailyBars } from '../components/learning/DataCharts';
import { LevelNote } from '../components/learning/Disclaimers';
import { Badge, ButtonLink, Card, CardHeader, EmptyState, ErrorState, PageHeader, PageLoader, ProgressBar, Stat } from '../components/ui';
import { useMe } from '../lib/auth';
import { timeAgo } from '../lib/format';
import { useApi } from '../lib/useApi';

interface DashboardData {
  profile: { displayName: string; cefrLevel: CefrLevel | null; cefrAssessedAt: string | null; ieltsModule: string | null; ieltsTargetBand: number | null; examInDays: number | null };
  streak: { current: number; longest: number };
  today: { minutes: number; xp: number; goalMinutes: number };
  series: { day: string; minutes: number; xp: number; activities: number }[];
  totals: {
    lessonsCompleted: number;
    lessonsTotal: number;
    quizzesTaken: number;
    quizAvgPercent: number | null;
    vocab: { learning: number; reviewing: number; mastered: number; total: number; due: number };
    reading: { count: number; bestBand: number | null; latestBand: number | null };
    listening: { count: number; bestBand: number | null; latestBand: number | null };
    writing: { count: number; latestBand: number | null };
    speaking: { count: number; minutes: number };
    mocksCompleted: number;
    calls: { count: number; minutes: number };
    battles: { played: number; won: number };
    achievements: number;
    totalXp: number;
  };
  recent: { id: number; type: string; title: string; xp: number; createdAt: string }[];
  recommendations: { id: string; title: string; description: string; link: string }[];
}

const ICONS: Record<string, typeof BookOpen> = { lesson: BookOpen, vocab_quiz: Library, vocab_review: Library, word_saved: Library, ielts_reading: GraduationCap, ielts_listening: Headphones, ielts_writing: PenLine, ielts_speaking: Mic, speaking_challenge: Mic, call: Phone, battle: Swords, assessment: Target, mock_test: GraduationCap, reader_scan: BookOpen };

export default function Dashboard() {
  const me = useMe();
  const { data, error, loading, reload } = useApi<DashboardData>('/api/dashboard');
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const t = data.totals;
  const isNew = data.recent.length === 0;
  const level = data.profile.cefrLevel;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      <PageHeader title={`${greeting}, ${me.profile.displayName}`} description={isNew ? 'Welcome to FluentPath! Here are some good first steps.' : 'Here is your progress, based on everything you have done so far.'} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="muted text-sm">Estimated level</div>
          {level ? (
            <>
              <div className="mt-1 flex items-baseline gap-2"><span className="text-3xl font-bold text-brand-600">{level}</span><span className="text-sm">{CEFR_INFO[level].name}</span></div>
              <Link to="/assessment" className="mt-1 inline-block text-xs text-brand-700 hover:underline dark:text-brand-300">Retake assessment</Link>
            </>
          ) : (
            <>
              <div className="mt-1 text-lg font-semibold">Not assessed yet</div>
              <Link to="/assessment" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">Take the assessment →</Link>
            </>
          )}
        </Card>
        <Stat label="Study streak" value={<span className="flex items-center gap-1.5"><Flame className="h-6 w-6 text-orange-500" />{data.streak.current} day{data.streak.current === 1 ? '' : 's'}</span>} hint={`Longest: ${data.streak.longest} day${data.streak.longest === 1 ? '' : 's'}`} />
        <Card className="p-4">
          <div className="muted text-sm">Today</div>
          <div className="mt-1 text-2xl font-bold">{Math.round(data.today.minutes)} <span className="text-base font-normal">/ {data.today.goalMinutes} min</span></div>
          <div className="mt-2"><ProgressBar value={data.today.minutes} max={data.today.goalMinutes} tone={data.today.minutes >= data.today.goalMinutes ? 'green' : 'brand'} label="Daily goal" /></div>
          <div className="muted mt-1 text-xs">{data.today.xp} XP earned today</div>
        </Card>
        <Card className="p-4">
          <div className="muted text-sm">{data.profile.ieltsModule ? `IELTS ${data.profile.ieltsModule === 'academic' ? 'Academic' : 'General Training'}` : 'IELTS'}</div>
          {data.profile.ieltsTargetBand ? <div className="mt-1 text-2xl font-bold">Target {data.profile.ieltsTargetBand}</div> : <div className="mt-1 text-lg font-semibold">No target set</div>}
          <div className="muted mt-1 text-xs">{data.profile.examInDays != null ? `Exam in ${data.profile.examInDays} day${data.profile.examInDays === 1 ? '' : 's'}` : <Link className="text-brand-700 hover:underline dark:text-brand-300" to="/profile">Set your exam date</Link>}</div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Recommended next" subtitle="Suggestions based on your goals and recent activity" />
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recommendations.map((r) => (
                <Link key={r.id} to={r.link} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div>
                    <div className="font-medium">{r.title}</div>
                    <div className="muted text-sm">{r.description}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                </Link>
              ))}
              {data.recommendations.length === 0 && <p className="muted px-5 py-4 text-sm">You are all caught up. Great work!</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Study minutes" subtitle="Last 14 days" />
            <div className="p-5">
              {data.series.some((d) => d.minutes > 0) ? <DailyBars data={data.series} goal={data.today.goalMinutes} /> : <EmptyState title="No study time recorded yet" description="Complete a lesson, quiz or practice test and your daily minutes will appear here." />}
            </div>
          </Card>

          <Card>
            <CardHeader title="IELTS practice" action={<Link to="/ielts" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">Open IELTS</Link>} />
            <div className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-4 dark:bg-slate-800">
              {[
                { label: 'Reading', icon: BookOpen, n: t.reading.count, band: t.reading.latestBand, link: '/ielts/reading' },
                { label: 'Listening', icon: Headphones, n: t.listening.count, band: t.listening.latestBand, link: '/ielts/listening' },
                { label: 'Writing', icon: PenLine, n: t.writing.count, band: t.writing.latestBand, link: '/ielts/writing' },
                { label: 'Speaking', icon: Mic, n: t.speaking.count, band: null, link: '/ielts/speaking' },
              ].map((m) => (
                <Link key={m.label} to={m.link} className="bg-white p-4 hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800">
                  <m.icon className="h-5 w-5 text-brand-600" />
                  <div className="mt-2 font-medium">{m.label}</div>
                  <div className="muted text-sm">{m.n} completed</div>
                  {m.band != null && <div className="mt-1 text-sm">Latest ≈ band <strong>{m.band}</strong></div>}
                </Link>
              ))}
            </div>
            <div className="px-5 py-3"><p className="muted text-xs">Band estimates are unofficial and approximate. Mock tests completed: {t.mocksCompleted}.</p></div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Vocabulary" action={<Link to="/vocabulary/my" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">My words</Link>} />
            <div className="p-5">
              {t.vocab.total === 0 ? (
                <EmptyState title="No saved words yet" description="Save words from daily vocabulary, lessons or the book reader." action={<ButtonLink to="/vocabulary" size="sm">Today’s words</ButtonLink>} />
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {(['learning', 'reviewing', 'mastered'] as const).map((s) => (
                      <div key={s} className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60"><div className="text-xl font-bold">{t.vocab[s]}</div><div className="muted text-xs capitalize">{s}</div></div>
                    ))}
                  </div>
                  {t.vocab.due > 0 && <ButtonLink to="/vocabulary/review" className="mt-4 w-full" size="sm">Review {t.vocab.due} due card{t.vocab.due === 1 ? '' : 's'}</ButtonLink>}
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Your numbers" />
            <dl className="grid grid-cols-2 gap-4 p-5 text-sm">
              <div><dt className="muted">Lessons completed</dt><dd className="text-lg font-semibold">{t.lessonsCompleted} / {t.lessonsTotal}</dd></div>
              <div><dt className="muted">Quiz average</dt><dd className="text-lg font-semibold">{t.quizAvgPercent != null ? `${t.quizAvgPercent}%` : '—'}</dd><dd className="muted text-xs">{t.quizzesTaken} taken</dd></div>
              <div><dt className="muted">Voice calls</dt><dd className="text-lg font-semibold">{t.calls.count}</dd><dd className="muted text-xs">{t.calls.minutes} min total</dd></div>
              <div><dt className="muted">Battles</dt><dd className="text-lg font-semibold">{t.battles.won} won</dd><dd className="muted text-xs">{t.battles.played} played</dd></div>
              <div><dt className="muted">Speaking recorded</dt><dd className="text-lg font-semibold">{t.speaking.minutes} min</dd></div>
              <div><dt className="muted">Achievements</dt><dd className="flex items-center gap-1 text-lg font-semibold"><Trophy className="h-4 w-4 text-amber-500" />{t.achievements}</dd></div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Recent activity" action={<Link to="/progress" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">All</Link>} />
            {data.recent.length === 0 ? (
              <p className="muted px-5 py-4 text-sm">Nothing yet — your completed activities will appear here.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.recent.map((a) => {
                  const Icon = ICONS[a.type] ?? BookOpen;
                  return (
                    <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{a.title}</div>
                        <div className="muted text-xs">{timeAgo(a.createdAt)}{a.xp ? ` · +${a.xp} XP` : ''}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          {level && <LevelNote />}
          {isNew && <Badge tone="amber">New account — statistics start from your first activity</Badge>}
        </div>
      </div>
    </div>
  );
}
