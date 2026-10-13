import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Plus, Trash2 } from 'lucide-react';
import { AudioButton } from '../../components/learning/AudioButton';
import { Alert, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Input, Modal, PageHeader, PageLoader, Tabs, Textarea, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { VocabNav } from './VocabNav';

interface MyWord { id: string; word: string; definition: string; context: string | null; translation: string | null; source: string; status: 'learning' | 'reviewing' | 'mastered'; dueAt: string; repetitions: number; intervalDays: number; correctCount: number; wrongCount: number; createdAt: string; phonetic: string | null; audioUrl: string | null; partOfSpeech: string | null }
interface Resp { words: MyWord[]; stats: { learning: number; reviewing: number; mastered: number; total: number; due: number }; rules: string }

const TONE = { learning: 'amber', reviewing: 'brand', mastered: 'green' } as const;
const SOURCE: Record<string, string> = { daily: 'Daily words', lesson: 'Lesson', reading: 'Reading practice', reader: 'Book reader', listening: 'Listening', manual: 'Added by you', browse: 'Word lists' };

export default function MyWords() {
  const toast = useToast();
  const [status, setStatus] = useState<'all' | 'learning' | 'reviewing' | 'mastered'>('all');
  const { data, error, loading, reload, setData } = useApi<Resp>(`/api/vocab/my${status === 'all' ? '' : `?status=${status}`}`, [status]);
  const [del, setDel] = useState<MyWord | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ word: '', definition: '', context: '' });
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.word.trim() || !form.definition.trim()) return setFormErr('Please enter the word and its meaning.');
    setBusy(true);
    setFormErr(null);
    try {
      await api.post('/api/vocab/my', { word: form.word.trim(), definition: form.definition.trim(), context: form.context.trim() || undefined, source: 'manual' });
      toast(`“${form.word.trim()}” added`);
      setAdding(false);
      setForm({ word: '', definition: '', context: '' });
      reload();
    } catch (err) {
      setFormErr(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const s = data?.stats;
  return (
    <div>
      <PageHeader eyebrow="Vocabulary" title="My words" description="Every word you save from lessons, daily words, practice tests and the book reader." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add a word</Button>} />
      <VocabNav due={s?.due} />
      {data?.rules && <p className="muted mb-4 text-xs">{data.rules}</p>}
      <Tabs
        tabs={[
          { id: 'all', label: 'All', count: s?.total },
          { id: 'learning', label: 'Learning', count: s?.learning },
          { id: 'reviewing', label: 'Reviewing', count: s?.reviewing },
          { id: 'mastered', label: 'Mastered', count: s?.mastered },
        ]}
        value={status}
        onChange={setStatus}
      />
      {loading && !data ? <PageLoader /> : error ? <ErrorState message={error} onRetry={reload} /> : data!.words.length === 0 ? (
        <EmptyState title={status === 'all' ? 'Your list is empty' : `No ${status} words`} description="Save words from today’s words, word lists, lessons or the book reader." action={<Link to="/vocabulary" className="font-medium text-brand-700 hover:underline dark:text-brand-300">Find words to learn</Link>} />
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {data!.words.map((w) => (
            <div key={w.id} className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{w.word}</span>
                  <AudioButton src={w.audioUrl} />
                  {w.partOfSpeech && <em className="muted text-sm">{w.partOfSpeech}</em>}
                  <Badge tone={TONE[w.status]} className="capitalize">{w.status}</Badge>
                </div>
                <p className="mt-1 text-sm">{w.definition}</p>
                {w.translation && <p className="text-sm text-violet-700 dark:text-violet-300">{w.translation}</p>}
                {w.context && <p className="muted mt-1 text-sm italic">“{w.context}”</p>}
                <p className="muted mt-1.5 text-xs">From {SOURCE[w.source] ?? w.source} · added {formatDate(w.createdAt)} · next review {new Date(w.dueAt) <= new Date() ? 'now' : formatDate(w.dueAt)} · {w.correctCount} right / {w.wrongCount} wrong</p>
              </div>
              <button className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" onClick={() => setDel(w)} aria-label={`Remove ${w.word}`}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(del)}
        onClose={() => setDel(null)}
        title="Remove word?"
        message={<>Remove <strong>{del?.word}</strong> from your list? Its review history will be deleted.</>}
        confirmLabel="Remove"
        danger
        onConfirm={async () => {
          try {
            await api.del(`/api/vocab/my/${del!.id}`);
            setData((d) => (d ? { ...d, words: d.words.filter((x) => x.id !== del!.id) } : d));
            toast('Word removed');
            reload();
          } catch (err) {
            toast(errorMessage(err), 'error');
          }
        }}
      />
      <Modal open={adding} onClose={() => setAdding(false)} title="Add a word">
        <form onSubmit={add} className="space-y-3">
          {formErr && <Alert tone="error">{formErr}</Alert>}
          <Input label="Word or phrase" value={form.word} onChange={(e) => setForm({ ...form, word: e.target.value })} maxLength={60} autoFocus />
          <Textarea label="Meaning" rows={2} value={form.definition} onChange={(e) => setForm({ ...form, definition: e.target.value })} maxLength={500} />
          <Textarea label="Example or context (optional)" rows={2} value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} maxLength={500} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={() => setAdding(false)}>Cancel</Button><Button type="submit" loading={busy}>Save word</Button></div>
        </form>
      </Modal>
    </div>
  );
}
