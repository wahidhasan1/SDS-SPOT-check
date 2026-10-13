import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Mic } from 'lucide-react';
import { Alert, Badge, Card, ErrorState, PageHeader, PageLoader, Tabs } from '../../components/ui';
import { formatDateTime, formatDuration } from '../../lib/format';
import { useApi } from '../../lib/useApi';

interface Prompt { id: string; part: number; topic: string; questions: string[]; cueCard: string | null; speakSeconds: number }
interface Attempt { id: string; title: string; question: string; durationSec: number; createdAt: string; mode: string; feedback: { aiStatus?: string; ai?: { overallBand: number } } | null }

export default function SpeakingHome() {
  const [part, setPart] = useState<'1' | '2' | '3'>('1');
  const { data, error, loading, reload } = useApi<{ prompts: Prompt[]; aiConfigured: boolean }>(`/api/speaking/prompts?part=${part}`, [part]);
  const hist = useApi<{ attempts: Attempt[] }>('/api/speaking/attempts?mode=ielts');
  return (
    <div>
      <Link to="/ielts" className="muted mb-4 inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft className="h-4 w-4" /> IELTS</Link>
      <PageHeader eyebrow="IELTS" title="Speaking practice" description="Record your answers to real-format questions. You get a transcript, fluency statistics and, when AI is configured, feedback on fluency, vocabulary and grammar." />
      <Alert tone="info" className="mb-5">Pronunciation is <strong>not</strong> scored: FluentPath only analyses the words in your transcript. Listen back to your recording to check your own pronunciation.{data && !data.aiConfigured && ' AI feedback is not configured on this server, so you will receive automatic statistics only.'}</Alert>
      <Tabs tabs={[{ id: '1', label: 'Part 1 · Interview' }, { id: '2', label: 'Part 2 · Long turn' }, { id: '3', label: 'Part 3 · Discussion' }]} value={part} onChange={setPart} />
      <p className="muted mb-4 text-sm">{part === '1' ? 'Short answers (2–3 sentences) about familiar topics. About 4–5 minutes in the exam.' : part === '2' ? 'You get 1 minute to prepare and then speak for up to 2 minutes about the cue card.' : 'Longer, more abstract answers linked to the Part 2 topic. Give reasons and examples.'}</p>
      {loading && !data ? <PageLoader /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {data!.prompts.map((p) => (
            <Link key={p.id} to={`/ielts/speaking/${p.id}`}>
              <Card className="h-full p-4 transition-shadow hover:shadow-md">
                <div className="flex items-center gap-2"><Mic className="h-4 w-4 text-brand-600" /><h2 className="font-semibold">{p.topic}</h2></div>
                <p className="muted mt-1 text-sm">{p.cueCard ?? `${p.questions.length} questions · e.g. “${p.questions[0]}”`}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <h2 className="mt-10 mb-3 text-lg font-semibold">Your recordings</h2>
      {hist.data?.attempts.length ? (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {hist.data.attempts.map((a) => (
            <Link key={a.id} to={`/ielts/speaking/attempts/${a.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <div className="min-w-0"><div className="truncate text-sm font-medium">{a.question}</div><div className="muted text-xs">{a.title} · {formatDuration(a.durationSec)} · {formatDateTime(a.createdAt)}</div></div>
              {a.feedback?.ai ? <Badge tone="brand">≈ {a.feedback.ai.overallBand}</Badge> : a.feedback?.aiStatus === 'evaluating' ? <Badge>Evaluating…</Badge> : null}
            </Link>
          ))}
        </div>
      ) : <p className="muted text-sm">No recordings yet.</p>}
    </div>
  );
}
