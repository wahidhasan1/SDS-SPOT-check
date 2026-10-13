import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { SPEAKING_CRITERIA } from '@fluentpath/shared';
import { BandNote } from '../../components/learning/Disclaimers';
import { Alert, Badge, Button, Card, CardHeader, ErrorState, PageLoader, Spinner, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatDateTime, formatDuration } from '../../lib/format';
import { useApi } from '../../lib/useApi';

interface Metrics { wordCount: number; wordsPerMinute: number; uniqueWords: number; lexicalDiversity: number; fillerCount: number; advancedWordsUsed: string[]; linkersUsed: string[] }
interface Ai { fluency: { band: number; comment: string }; lexical: { band: number; comment: string }; grammar: { band: number; comment: string }; overallBand: number; summary: string; tips: string[]; betterPhrases: { original: string; better: string }[] }
interface Attempt { id: string; title: string; question: string; audioFileId: string | null; durationSec: number; transcript: string; transcriptSource: string; metrics: Metrics; feedback: { aiStatus?: string; ai?: Ai } | null; feedbackError: string | null; createdAt: string }

export default function SpeakingAttempt() {
  const { id } = useParams();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ attempt: Attempt }>(`/api/speaking/attempts/${id}`);
  const a = data?.attempt;
  useEffect(() => {
    if (a?.feedback?.aiStatus !== 'evaluating') return;
    const t = setInterval(reload, 4000);
    return () => clearInterval(t);
  }, [a?.feedback?.aiStatus, reload]);
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!a) return null;
  const m = a.metrics;
  const ai = a.feedback?.ai;
  const status = a.feedback?.aiStatus;
  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/ielts/speaking" className="muted mb-4 inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft className="h-4 w-4" /> Speaking practice</Link>
      <Badge>{a.title}</Badge>
      <h1 className="mt-2 text-xl font-semibold">{a.question}</h1>
      <p className="muted text-sm">{formatDateTime(a.createdAt)} · {formatDuration(a.durationSec)}</p>
      <Card className="mt-4 p-5">
        {a.audioFileId ? <audio controls src={`/api/media/${a.audioFileId}`} className="w-full" /> : <p className="muted text-sm">No audio saved.</p>}
        <h2 className="mt-4 text-sm font-semibold">Transcript <span className="muted font-normal">({a.transcriptSource === 'browser' ? 'automatic speech recognition' : a.transcriptSource === 'device' ? 'device speech recognition' : a.transcriptSource === 'manual' ? 'typed by you' : 'none'})</span></h2>
        <p className="mt-1 text-sm whitespace-pre-wrap">{a.transcript || <span className="muted">No transcript was produced.</span>}</p>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Speaking statistics" subtitle="Calculated from your transcript and recording length — not AI" />
        <div className="grid gap-4 p-5 sm:grid-cols-4">
          <div><div className="muted text-xs">Words</div><div className="text-xl font-semibold">{m.wordCount}</div></div>
          <div><div className="muted text-xs">Speaking rate</div><div className="text-xl font-semibold">{m.wordsPerMinute} wpm</div><div className="muted text-xs">Natural speech ≈ 110–160</div></div>
          <div><div className="muted text-xs">Filler words</div><div className="text-xl font-semibold">{m.fillerCount}</div><div className="muted text-xs">um, uh, like, you know…</div></div>
          <div><div className="muted text-xs">Vocabulary variety</div><div className="text-xl font-semibold">{Math.round(m.lexicalDiversity * 100)}%</div></div>
        </div>
        {(m.advancedWordsUsed.length > 0 || m.linkersUsed.length > 0) && (
          <div className="space-y-1 border-t border-slate-100 p-5 text-sm dark:border-slate-800">
            {m.advancedWordsUsed.length > 0 && <div><strong>Upper-level words:</strong> {m.advancedWordsUsed.join(', ')}</div>}
            {m.linkersUsed.length > 0 && <div><strong>Linking words:</strong> {m.linkersUsed.join(', ')}</div>}
          </div>
        )}
      </Card>

      <div className="mt-4">
        {status === 'evaluating' && <Alert tone="info" title="AI feedback in progress"><span className="inline-flex items-center gap-2"><Spinner className="h-4 w-4" /> This usually takes under a minute.</span></Alert>}
        {status === 'not_configured' && <Alert tone="info" title="AI feedback is not configured">This server has no AI service configured, so only the automatic statistics above are available.</Alert>}
        {status === 'too_short' && <Alert tone="warning">The transcript is too short for AI feedback (at least 15 words are needed).</Alert>}
        {status === 'limit_reached' && <Alert tone="warning" action={<Link className="text-sm font-semibold underline" to="/premium">Upgrade</Link>}>You have used today’s AI speaking evaluations.</Alert>}
        {status === 'failed' && <Alert tone="error">{a.feedbackError ?? 'AI evaluation failed.'}</Alert>}
        {ai && (
          <Card>
            <CardHeader title="AI feedback" subtitle="Based on the transcript only — pronunciation is not assessed" action={<div className="text-right"><div className="muted text-xs">Estimated band</div><div className="text-2xl font-bold text-brand-600">≈ {ai.overallBand}</div></div>} />
            <div className="space-y-4 p-5">
              <p>{ai.summary}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {SPEAKING_CRITERIA.map((c) => {
                  const f = ai[c.id as 'fluency' | 'lexical' | 'grammar'];
                  return <div key={c.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div className="flex justify-between text-sm font-semibold">{c.label}<Badge tone="brand">≈ {f.band}</Badge></div><p className="mt-1 text-sm">{f.comment}</p></div>;
                })}
              </div>
              <div><h3 className="text-sm font-semibold">Tips</h3><ul className="mt-1 list-disc pl-5 text-sm">{ai.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
              {ai.betterPhrases.length > 0 && <div><h3 className="text-sm font-semibold">Try saying it this way</h3><ul className="mt-1 space-y-1 text-sm">{ai.betterPhrases.map((b, i) => <li key={i}><span className="muted">“{b.original}”</span> → <strong>“{b.better}”</strong></li>)}</ul></div>}
              <BandNote />
            </div>
          </Card>
        )}
      </div>
      <div className="mt-6">
        <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={async () => { try { await api.del(`/api/speaking/attempts/${a.id}`); toast('Recording deleted'); history.back(); } catch (e) { toast(errorMessage(e), 'error'); } }}>Delete recording</Button>
      </div>
    </div>
  );
}
