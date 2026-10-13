import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Timer } from 'lucide-react';
import { RecorderPanel } from '../../components/learning/Recorder';
import { Alert, Badge, Button, Card, ErrorState, PageLoader, useToast } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useRecorder } from '../../lib/recorder';
import { uploadSpeaking } from '../../lib/speaking';
import { useApi } from '../../lib/useApi';

interface Prompt { id: string; part: number; topic: string; questions: string[]; cueCard: string | null; prepSeconds: number; speakSeconds: number }

export default function SpeakingPractice() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ prompt: Prompt; aiConfigured: boolean }>(`/api/speaking/prompts/${id}`);
  const rec = useRecorder();
  const [qi, setQi] = useState(0);
  const [prepLeft, setPrepLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string[]>([]);

  const p = data?.prompt;
  const isPart2 = p?.part === 2;
  const question = p ? (isPart2 ? p.cueCard! : p.questions[qi]) : '';

  // Part 2 preparation countdown, then automatic recording.
  useEffect(() => {
    if (prepLeft == null) return;
    if (prepLeft <= 0) {
      setPrepLeft(null);
      rec.start();
      return;
    }
    const t = setTimeout(() => setPrepLeft((s) => (s == null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [prepLeft, rec]);

  // Stop automatically at the time limit.
  useEffect(() => {
    if (p && rec.state === 'recording' && rec.seconds >= p.speakSeconds) {
      rec.stop();
      toast('Time is up — recording stopped.', 'info');
    }
  }, [rec, p, toast]);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!p) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const r = await uploadSpeaking(
        { mode: 'ielts', promptId: p.id, question, transcript: rec.transcript, transcriptSource: rec.recognitionSupported && rec.transcript ? 'browser' : rec.transcript ? 'manual' : 'none', durationSec: rec.seconds },
        rec.blob,
      );
      r.newAchievements?.forEach((a) => toast(`Achievement unlocked: ${a.title}`, 'info'));
      toast('Answer saved');
      if (isPart2 || qi >= p.questions.length - 1) {
        nav(`/ielts/speaking/attempts/${r.attempt.id}`);
      } else {
        setDone([...done, r.attempt.id]);
        setQi(qi + 1);
        rec.reset();
      }
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/ielts/speaking" className="muted mb-4 inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft className="h-4 w-4" /> Speaking practice</Link>
      <div className="flex flex-wrap items-center gap-2"><Badge tone="brand">Part {p.part}</Badge><Badge>{p.topic}</Badge>{!isPart2 && <Badge>Question {qi + 1} of {p.questions.length}</Badge>}</div>
      <Card className="mt-4 p-6">
        {isPart2 ? (
          <>
            <h1 className="text-xl font-semibold">{p.cueCard}</h1>
            <p className="muted mt-3 text-sm">You should say:</p>
            <ul className="mt-1 list-disc space-y-1 pl-6">{p.questions.map((q) => <li key={q}>{q}</li>)}</ul>
          </>
        ) : (
          <h1 className="text-xl font-semibold">{question}</h1>
        )}
        <p className="muted mt-4 text-sm">Aim for {isPart2 ? '1½–2 minutes' : p.part === 1 ? '20–40 seconds' : '45–75 seconds'}. Maximum {Math.round(p.speakSeconds / 60 * 10) / 10} min.</p>
      </Card>

      <Card className="mt-4 p-6">
        {isPart2 && rec.state === 'idle' && prepLeft == null && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Button variant="secondary" icon={<Timer className="h-4 w-4" />} onClick={() => setPrepLeft(p.prepSeconds)}>Start 1-minute preparation</Button>
            <span className="muted text-sm">Recording starts automatically when preparation ends. Make notes on paper.</span>
          </div>
        )}
        {prepLeft != null && (
          <Alert tone="info" title={`Preparation: ${prepLeft} s`} action={<Button size="sm" onClick={() => setPrepLeft(0)}>Start speaking now</Button>}>Think about what you will say for each point.</Alert>
        )}
        {prepLeft == null && <RecorderPanel rec={rec} maxSeconds={p.speakSeconds} />}
        {rec.state === 'stopped' && (
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={submit} loading={busy}>{isPart2 || qi >= p.questions.length - 1 ? 'Submit and see feedback' : 'Save and next question'}</Button>
          </div>
        )}
      </Card>
      {done.length > 0 && <p className="muted mt-3 text-sm">{done.length} answer{done.length > 1 ? 's' : ''} saved. You can review them later under “Your recordings”.</p>}
    </div>
  );
}
