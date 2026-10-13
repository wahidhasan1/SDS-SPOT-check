import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { PartyPopper } from 'lucide-react';
import { AudioButton } from '../../components/learning/AudioButton';
import { Badge, Button, ButtonLink, Card, EmptyState, ErrorState, PageHeader, PageLoader, ProgressBar, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { VocabNav } from './VocabNav';

interface CardItem { id: string; word: string; definition: string; context: string | null; translation: string | null; status: string; phonetic: string | null; audioUrl: string | null; partOfSpeech: string | null }

const RATINGS = [
  { q: 1, label: 'Forgot', cls: 'bg-red-600 hover:bg-red-700', hint: 'See it again tomorrow' },
  { q: 3, label: 'Hard', cls: 'bg-amber-600 hover:bg-amber-700', hint: 'Recalled with effort' },
  { q: 4, label: 'Good', cls: 'bg-brand-600 hover:bg-brand-700', hint: 'Recalled correctly' },
  { q: 5, label: 'Easy', cls: 'bg-emerald-600 hover:bg-emerald-700', hint: 'Instant recall' },
];

export default function Review() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ cards: CardItem[]; totalDue: number; nextDueAt: string | null }>('/api/vocab/review?limit=20');
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ reviewed: 0, correct: 0 });
  const [busy, setBusy] = useState(false);
  const started = useRef(Date.now());
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    setI(0);
    setFlipped(false);
  }, [data]);

  const rate = async (q: number) => {
    const card = data!.cards[i];
    setBusy(true);
    try {
      const r = await api.post<{ promoted: string | null }>(`/api/vocab/review/${card.id}`, { quality: q });
      if (r.promoted) toast(`“${card.word}” is now ${r.promoted}`, 'info');
      const next = { reviewed: stats.reviewed + 1, correct: stats.correct + (q >= 3 ? 1 : 0) };
      setStats(next);
      if (i + 1 >= data!.cards.length) {
        setFinished(true);
        await api.post('/api/vocab/review-session', { ...next, durationSec: Math.round((Date.now() - started.current) / 1000) }).catch(() => {});
      } else {
        setI(i + 1);
        setFlipped(false);
      }
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Vocabulary" title="Flashcard review" description="Spaced repetition: words you know well come back less often; words you forget come back sooner." />
      <VocabNav due={data?.totalDue} />
      {loading && !data ? <PageLoader /> : error ? <ErrorState message={error} onRetry={reload} /> : finished ? (
        <Card className="mx-auto max-w-lg p-8 text-center">
          <PartyPopper className="mx-auto h-10 w-10 text-brand-600" />
          <h2 className="mt-3 text-xl font-bold">Session complete</h2>
          <p className="muted mt-1">You reviewed {stats.reviewed} card{stats.reviewed === 1 ? '' : 's'} and recalled {stats.correct}.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={() => { setFinished(false); setStats({ reviewed: 0, correct: 0 }); started.current = Date.now(); reload(); }}>Check for more cards</Button>
            <ButtonLink to="/vocabulary/quiz" variant="secondary">Take a quiz</ButtonLink>
          </div>
        </Card>
      ) : data!.cards.length === 0 ? (
        <EmptyState
          title="No cards due right now"
          description={data!.nextDueAt ? `Your next review is due ${formatDateTime(data!.nextDueAt)}.` : 'Save some words first — they become flashcards automatically.'}
          action={<Link to="/vocabulary" className="font-medium text-brand-700 hover:underline dark:text-brand-300">Find new words</Link>}
        />
      ) : (
        <div className="mx-auto max-w-xl">
          <div className="mb-2 flex justify-between text-sm"><span>Card {i + 1} of {data!.cards.length}</span><span className="muted">{data!.totalDue} due in total</span></div>
          <ProgressBar value={i} max={data!.cards.length} label="Review progress" />
          {(() => {
            const c = data!.cards[i];
            return (
              <Card className="mt-4 p-8 text-center">
                <Badge className="capitalize">{c.status}</Badge>
                <div className="mt-4 flex items-center justify-center gap-2"><h2 className="text-3xl font-bold">{c.word}</h2><AudioButton src={c.audioUrl} /></div>
                {c.phonetic && <div className="muted font-mono text-sm">{c.phonetic}</div>}
                {!flipped ? (
                  <>
                    <p className="muted mt-6 text-sm">Try to remember the meaning, then reveal it.</p>
                    <Button className="mt-4" onClick={() => setFlipped(true)}>Show meaning</Button>
                  </>
                ) : (
                  <div className="mt-6 text-left">
                    {c.partOfSpeech && <em className="muted text-sm">{c.partOfSpeech}</em>}
                    <p className="mt-1 text-lg">{c.definition}</p>
                    {c.translation && <p className="text-violet-700 dark:text-violet-300">{c.translation}</p>}
                    {c.context && <p className="muted mt-2 italic">“{c.context}”</p>}
                    <p className="mt-6 text-center text-sm font-medium">How well did you remember it?</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {RATINGS.map((r) => (
                        <button key={r.q} disabled={busy} onClick={() => rate(r.q)} className={`rounded-xl px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${r.cls}`} title={r.hint}>{r.label}</button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })()}
        </div>
      )}
    </div>
  );
}
