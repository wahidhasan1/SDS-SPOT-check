import { Link } from 'react-router';
import { Alert, ErrorState, PageLoader, Stat } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';

export default function Overview() {
  const { integrations } = useAuth();
  const { data, error, loading, reload } = useApi<{ users: number; newThisWeek: number; activeToday: number; premium: number; openReports: number; callsToday: number; content: { lessons: number; ieltsSets: number; words: number }; writingEvaluating: number }>('/api/admin/overview');
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const d = data!;
  const missing = integrations ? Object.entries({ 'AI feedback (ANTHROPIC_API_KEY)': integrations.ai, 'Email (SMTP_URL)': integrations.email, 'Payments (Stripe)': integrations.payments, 'Google sign-in': integrations.googleAuth, 'TURN relay for calls': integrations.turn }).filter(([, v]) => !v).map(([k]) => k) : [];
  return (
    <div className="space-y-6">
      {d.openReports > 0 && <Alert tone="warning" title={`${d.openReports} report${d.openReports === 1 ? '' : 's'} need review`} action={<Link to="/admin/reports" className="text-sm font-semibold underline">Review</Link>} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Users" value={d.users} hint={`${d.newThisWeek} new this week`} />
        <Stat label="Active in last 24 h" value={d.activeToday} />
        <Stat label="Premium subscribers" value={d.premium} />
        <Stat label="Calls in last 24 h" value={d.callsToday} />
        <Stat label="Lessons" value={d.content.lessons} />
        <Stat label="IELTS practice sets" value={d.content.ieltsSets} />
        <Stat label="Vocabulary words" value={d.content.words} />
        <Stat label="Writing evaluations running" value={d.writingEvaluating} />
      </div>
      {missing.length > 0 && <Alert tone="info" title="Integrations not configured">{missing.join(' · ')}. See docs/SETUP.md for how to enable them.</Alert>}
    </div>
  );
}
