import { useRef, useState } from 'react';
import { Copy, Upload } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, ErrorState, PageLoader, Select, Textarea, useToast } from '../../components/ui';
import { api, ApiError, errorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { LEVEL_OPTIONS, ResourceManager, STATUS_FIELD, STATUS_FILTER, StatusBadge, type FieldDef } from './ResourceManager';

const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));
const SLUG: FieldDef = { name: 'slug', label: 'Slug', type: 'text', required: true, hint: 'Lowercase letters, numbers and hyphens, e.g. present-perfect' };

// ---------------------------------------------------------------- lessons + exercises

interface Ex { id: string; type: 'mcq' | 'fill'; prompt: string; options: string[]; answers: string[]; explanation: string; status: string; sortOrder: number }

function ExercisesEditor({ lessonId }: { lessonId: string }) {
  const toast = useToast();
  const list = useApi<{ items: Ex[] }>(`/api/admin/exercises?lessonId=${lessonId}`);
  const empty = { type: 'mcq' as const, prompt: '', options: '', answers: '', explanation: '', status: 'published' };
  const [draft, setDraft] = useState<{ id?: string; type: 'mcq' | 'fill'; prompt: string; options: string; answers: string; explanation: string; status: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!draft) return;
    setErr(null);
    const body = { lessonId, type: draft.type, prompt: draft.prompt, options: draft.type === 'mcq' ? draft.options.split('\n').map((s) => s.trim()).filter(Boolean) : [], answers: draft.answers.split('\n').map((s) => s.trim()).filter(Boolean), explanation: draft.explanation, status: draft.status, sortOrder: draft.id ? undefined : (list.data?.items.length ?? 0) };
    try {
      if (draft.id) await api.patch(`/api/admin/exercises/${draft.id}`, body);
      else await api.post('/api/admin/exercises', body);
      setDraft(null);
      list.reload();
      toast('Question saved');
    } catch (e) {
      setErr(e instanceof ApiError && Array.isArray(e.details) ? (e.details as { message: string }[]).map((d) => d.message).join(' ') : errorMessage(e));
    }
  };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Practice questions ({list.data?.items.length ?? 0})</h3><Button size="sm" variant="secondary" onClick={() => setDraft({ ...empty })}>Add question</Button></div>
      <p className="muted mb-2 text-xs">A lesson needs at least 3 published questions before it can be published.</p>
      <ol className="space-y-1.5 text-sm">
        {list.data?.items.map((e, i) => (
          <li key={e.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
            <span>{i + 1}. {e.prompt} <span className="muted">→ {e.answers.join(' / ')}</span> {e.status !== 'published' && <StatusBadge s={e.status} />}</span>
            <span className="flex shrink-0 gap-2">
              <button className="text-xs text-brand-700 hover:underline dark:text-brand-300" onClick={() => setDraft({ id: e.id, type: e.type, prompt: e.prompt, options: e.options.join('\n'), answers: e.answers.join('\n'), explanation: e.explanation, status: e.status })}>Edit</button>
              <button className="text-xs text-red-600 hover:underline" onClick={async () => { await api.del(`/api/admin/exercises/${e.id}`); list.reload(); }}>Delete</button>
            </span>
          </li>
        ))}
      </ol>
      {draft && (
        <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
          {err && <Alert tone="error">{err}</Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Type" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as 'mcq' | 'fill' })}><option value="mcq">Multiple choice</option><option value="fill">Fill in the blank</option></Select>
            <Select label="Status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}><option value="published">Published</option><option value="draft">Draft</option></Select>
          </div>
          <Textarea label="Question" rows={2} value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} />
          {draft.type === 'mcq' && <Textarea label="Options (one per line)" rows={4} value={draft.options} onChange={(e) => setDraft({ ...draft, options: e.target.value })} />}
          <Textarea label={draft.type === 'mcq' ? 'Correct option (must match an option exactly)' : 'Accepted answers (one per line)'} rows={2} value={draft.answers} onChange={(e) => setDraft({ ...draft, answers: e.target.value })} />
          <Textarea label="Explanation shown after answering" rows={2} value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} />
          <div className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setDraft(null)}>Cancel</Button><Button size="sm" onClick={save}>Save question</Button></div>
        </div>
      )}
    </div>
  );
}

export function Lessons() {
  return (
    <ResourceManager
      endpoint="lessons"
      title="Lessons"
      description="Grammar and everyday-English lessons. Body supports ## headings, - bullets, **bold** and *italic*."
      filters={[STATUS_FILTER, { name: 'track', label: 'Track', options: opts(['grammar', 'general']) }, { name: 'pathLevel', label: 'Path', options: opts(['beginner', 'intermediate', 'advanced']) }]}
      columns={[{ key: 'title', label: 'Title' }, { key: 'track', label: 'Track' }, { key: 'pathLevel', label: 'Path' }, { key: 'cefrLevel', label: 'Level' }, { key: 'status', label: 'Status' }]}
      fields={[
        { name: 'title', label: 'Title', type: 'text', required: true },
        SLUG,
        { name: 'track', label: 'Track', type: 'select', required: true, defaultValue: 'grammar', options: opts(['grammar', 'general']) },
        { name: 'pathLevel', label: 'Learning path', type: 'select', required: true, defaultValue: 'beginner', options: opts(['beginner', 'intermediate', 'advanced']) },
        { name: 'cefrLevel', label: 'CEFR level', type: 'select', required: true, defaultValue: 'A2', options: LEVEL_OPTIONS },
        { name: 'categorySlug', label: 'Category slug', type: 'text' },
        { name: 'sortOrder', label: 'Sort order', type: 'number', defaultValue: 100 },
        STATUS_FIELD,
        { name: 'summary', label: 'Summary', type: 'textarea', rows: 2, required: true },
        { name: 'body', label: 'Explanation (body)', type: 'textarea', rows: 12, required: true },
        { name: 'examples', label: 'Examples (JSON array of {text, note?, correct?})', type: 'json', rows: 6, defaultValue: [] },
      ]}
      extraEditor={(row) => row && <ExercisesEditor lessonId={row.id} />}
    />
  );
}

export function Placement() {
  return (
    <ResourceManager
      endpoint="exercises"
      title="Placement questions"
      description="Questions for the level assessment. The result is the highest CEFR level passed consecutively with at least 60% correct."
      newDefaults={{ purpose: 'placement', type: 'mcq', status: 'published' }}
      filters={[{ name: 'purpose', label: 'Purpose', options: [{ value: 'placement', label: 'Placement' }, { value: 'lesson', label: 'Lesson' }] }]}
      columns={[{ key: 'prompt', label: 'Question' }, { key: 'cefrLevel', label: 'Level' }, { key: 'skill', label: 'Skill' }, { key: 'purpose', label: 'Used in' }, { key: 'status', label: 'Status' }]}
      fields={[
        { name: 'purpose', label: 'Used in', type: 'select', required: true, defaultValue: 'placement', options: [{ value: 'placement', label: 'Placement test' }, { value: 'lesson', label: 'Lesson' }] },
        { name: 'type', label: 'Type', type: 'select', required: true, defaultValue: 'mcq', options: [{ value: 'mcq', label: 'Multiple choice' }, { value: 'fill', label: 'Fill in' }] },
        { name: 'cefrLevel', label: 'Level', type: 'select', options: LEVEL_OPTIONS },
        { name: 'skill', label: 'Skill', type: 'select', options: opts(['grammar', 'vocabulary', 'reading']) },
        { name: 'prompt', label: 'Question', type: 'textarea', rows: 2, required: true },
        { name: 'passage', label: 'Reading passage (optional)', type: 'textarea', rows: 4 },
        { name: 'options', label: 'Options (one per line)', type: 'lines', rows: 4 },
        { name: 'answers', label: 'Correct answer(s) (one per line)', type: 'lines', rows: 2 },
        { name: 'explanation', label: 'Explanation', type: 'textarea', rows: 2, required: true },
        { name: 'sortOrder', label: 'Sort order', type: 'number', defaultValue: 100 },
        { ...STATUS_FIELD, defaultValue: 'published' },
      ]}
    />
  );
}

// ---------------------------------------------------------------- vocabulary

export function Words() {
  return (
    <ResourceManager
      endpoint="words"
      title="Vocabulary words"
      filters={[STATUS_FILTER, { name: 'cefrLevel', label: 'Level', options: LEVEL_OPTIONS }]}
      columns={[{ key: 'word', label: 'Word' }, { key: 'partOfSpeech', label: 'Part of speech' }, { key: 'cefrLevel', label: 'Level' }, { key: 'categorySlug', label: 'Category' }, { key: 'status', label: 'Status' }]}
      fields={[
        { name: 'word', label: 'Word', type: 'text', required: true },
        { name: 'partOfSpeech', label: 'Part of speech', type: 'text', required: true, defaultValue: 'noun' },
        { name: 'phonetic', label: 'Phonetic (IPA)', type: 'text' },
        { name: 'cefrLevel', label: 'Level', type: 'select', required: true, defaultValue: 'B1', options: LEVEL_OPTIONS },
        { name: 'categorySlug', label: 'Category slug', type: 'text', hint: 'e.g. education, environment, academic' },
        { name: 'audioUrl', label: 'Pronunciation audio URL', type: 'text' },
        { name: 'definition', label: 'Definition', type: 'textarea', rows: 2, required: true },
        { name: 'example', label: 'Example sentence (must contain the word)', type: 'textarea', rows: 2, required: true },
        { name: 'synonyms', label: 'Synonyms (one per line)', type: 'lines', rows: 3 },
        { name: 'antonyms', label: 'Antonyms (one per line)', type: 'lines', rows: 3 },
        { ...STATUS_FIELD, defaultValue: 'published' },
      ]}
    />
  );
}

// ---------------------------------------------------------------- IELTS sets

const READING_TEMPLATE = {
  passages: [{ id: 'p1', title: 'Passage title', paragraphs: [{ label: 'A', text: 'Paragraph text…' }] }],
  groups: [{ id: 'g1', type: 'tfng', instructions: 'Do the following statements agree with the information given in the passage?', passageId: 'p1', options: [{ key: 'TRUE', text: 'TRUE' }, { key: 'FALSE', text: 'FALSE' }, { key: 'NOT GIVEN', text: 'NOT GIVEN' }], questions: [{ n: 1, prompt: 'Statement…', answer: ['TRUE'], explanation: 'Where the answer is found…' }] }],
};

export function IeltsSets() {
  return (
    <ResourceManager
      endpoint="ielts-sets"
      title="IELTS reading and listening sets"
      description="Content is a JSON document validated against the question schema when publishing. Listening sections need an audioUrl (upload files on the Audio tab) and a transcript."
      newDefaults={{ content: READING_TEMPLATE, timeLimitSec: 1200, module: 'reading', variant: 'academic', difficulty: 'medium' }}
      filters={[STATUS_FILTER, { name: 'module', label: 'Module', options: opts(['reading', 'listening']) }, { name: 'variant', label: 'Variant', options: opts(['academic', 'general', 'both']) }]}
      columns={[
        { key: 'title', label: 'Title' },
        { key: 'module', label: 'Module' },
        { key: 'variant', label: 'Variant' },
        { key: 'questionCount', label: 'Questions' },
        { key: 'flags', label: 'Flags', render: (r) => <span className="flex gap-1">{Boolean(r.isPremium) && <Badge tone="violet">Premium</Badge>}{Boolean(r.mockOnly) && <Badge>Mock only</Badge>}</span> },
        { key: 'status', label: 'Status' },
      ]}
      fields={[
        { name: 'title', label: 'Title', type: 'text', required: true },
        SLUG,
        { name: 'module', label: 'Module', type: 'select', required: true, options: opts(['reading', 'listening']) },
        { name: 'variant', label: 'Variant', type: 'select', required: true, options: opts(['academic', 'general', 'both']), hint: 'Listening is the same for both modules.' },
        { name: 'difficulty', label: 'Difficulty', type: 'select', required: true, options: opts(['easy', 'medium', 'hard']) },
        { name: 'timeLimitSec', label: 'Time limit (seconds)', type: 'number', required: true },
        { name: 'isPremium', label: 'Premium only', type: 'checkbox' },
        { name: 'mockOnly', label: 'Use only inside mock tests', type: 'checkbox' },
        STATUS_FIELD,
        { name: 'description', label: 'Description', type: 'textarea', rows: 2 },
        { name: 'content', label: 'Content (JSON)', type: 'json', rows: 18 },
      ]}
    />
  );
}

export function Audio() {
  const toast = useToast();
  const list = useApi<{ uploaded: { url: string; name: string | null; sizeBytes: number; createdAt: string }[]; generated: { url: string; name: string }[] }>('/api/admin/audio');
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('audio', f, f.name);
      const r = await api.post<{ url: string }>('/api/admin/audio', fd);
      toast(`Uploaded: ${r.url}`);
      list.reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const copy = (url: string) => navigator.clipboard?.writeText(url).then(() => toast('URL copied'));
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Upload listening audio" subtitle="MP3, M4A, OGG, WAV or WebM up to 25 MB. Use only audio you own or are licensed to use." action={<><input ref={ref} type="file" accept="audio/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} /><Button icon={<Upload className="h-4 w-4" />} loading={busy} onClick={() => ref.current?.click()}>Upload</Button></>} />
        {list.loading && !list.data ? <PageLoader /> : list.error ? <ErrorState message={list.error} /> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.data!.uploaded.map((a) => (
              <li key={a.url} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"><span>{a.name} <span className="muted text-xs">· {Math.round(a.sizeBytes / 1024)} KB · {formatDateTime(a.createdAt)}</span></span><span className="flex items-center gap-2"><audio controls src={a.url} className="h-8" /><Button size="sm" variant="ghost" icon={<Copy className="h-4 w-4" />} onClick={() => copy(a.url)}>Copy URL</Button></span></li>
            ))}
            {list.data!.uploaded.length === 0 && <li className="muted px-5 py-3 text-sm">No uploaded audio yet.</li>}
          </ul>
        )}
      </Card>
      <Card>
        <CardHeader title="Generated audio (from seed transcripts)" subtitle="Created with text-to-speech by npm run audio:generate -w apps/api" />
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {list.data?.generated.map((a) => <li key={a.url} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"><code className="text-xs">{a.url}</code><span className="flex items-center gap-2"><audio controls src={a.url} className="h-8" /><Button size="sm" variant="ghost" icon={<Copy className="h-4 w-4" />} onClick={() => copy(a.url)}>Copy</Button></span></li>)}
        </ul>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- writing, speaking, mocks, categories

export function WritingTasks() {
  return (
    <ResourceManager
      endpoint="writing-tasks"
      title="Writing tasks"
      description='Academic Task 1 charts need visual data, e.g. {"kind":"bar","title":"…","categories":["2000","2010"],"series":[{"name":"A","values":[1,2]}]}.'
      newDefaults={{ taskNumber: 2, taskType: 'essay', variant: 'academic', minWords: 250, timeMinutes: 40 }}
      filters={[STATUS_FILTER, { name: 'variant', label: 'Variant', options: opts(['academic', 'general']) }]}
      columns={[{ key: 'title', label: 'Title' }, { key: 'variant', label: 'Variant' }, { key: 'taskNumber', label: 'Task' }, { key: 'taskType', label: 'Type' }, { key: 'status', label: 'Status' }]}
      fields={[
        { name: 'title', label: 'Title', type: 'text', required: true },
        SLUG,
        { name: 'variant', label: 'Variant', type: 'select', required: true, options: opts(['academic', 'general']) },
        { name: 'taskNumber', label: 'Task number', type: 'select', required: true, numeric: true, options: [{ value: '1', label: 'Task 1' }, { value: '2', label: 'Task 2' }] },
        { name: 'taskType', label: 'Task type', type: 'select', required: true, options: opts(['bar', 'line', 'pie', 'table', 'process', 'map', 'letter', 'essay']) },
        { name: 'minWords', label: 'Minimum words', type: 'number', required: true },
        { name: 'timeMinutes', label: 'Suggested minutes', type: 'number', required: true },
        { name: 'isPremium', label: 'Premium only', type: 'checkbox' },
        { name: 'mockOnly', label: 'Use only inside mock tests', type: 'checkbox' },
        STATUS_FIELD,
        { name: 'prompt', label: 'Task prompt', type: 'textarea', rows: 4, required: true },
        { name: 'instructions', label: 'Instructions', type: 'textarea', rows: 2, required: true },
        { name: 'visual', label: 'Visual data (JSON, Task 1 charts)', type: 'json', rows: 8 },
        { name: 'modelOutline', label: 'Model outline (teacher notes)', type: 'textarea', rows: 3 },
      ]}
    />
  );
}

export function SpeakingPrompts() {
  return (
    <ResourceManager
      endpoint="speaking-prompts"
      title="Speaking prompts"
      newDefaults={{ part: 1, speakSeconds: 45, prepSeconds: 0 }}
      filters={[STATUS_FILTER, { name: 'part', label: 'Part', options: [{ value: '1', label: 'Part 1' }, { value: '2', label: 'Part 2' }, { value: '3', label: 'Part 3' }] }]}
      columns={[{ key: 'topic', label: 'Topic' }, { key: 'part', label: 'Part' }, { key: 'speakSeconds', label: 'Seconds' }, { key: 'status', label: 'Status' }]}
      fields={[
        { name: 'topic', label: 'Topic', type: 'text', required: true },
        SLUG,
        { name: 'part', label: 'Part', type: 'select', required: true, numeric: true, options: [{ value: '1', label: 'Part 1' }, { value: '2', label: 'Part 2' }, { value: '3', label: 'Part 3' }] },
        { name: 'speakSeconds', label: 'Speaking time (seconds)', type: 'number', required: true },
        { name: 'prepSeconds', label: 'Preparation time (seconds)', type: 'number' },
        STATUS_FIELD,
        { name: 'cueCard', label: 'Cue card (Part 2)', type: 'textarea', rows: 2 },
        { name: 'questions', label: 'Questions or cue-card points (one per line)', type: 'lines', rows: 6 },
      ]}
    />
  );
}

export function MockTests() {
  return (
    <ResourceManager
      endpoint="mock-tests"
      title="Mock tests"
      description='Sections reference content by slug, e.g. [{"module":"listening","refs":["mock-listening-apartment-heat"],"timeLimitSec":1200}]. All referenced items must be published.'
      newDefaults={{ variant: 'academic', sections: [] }}
      filters={[STATUS_FILTER]}
      columns={[{ key: 'title', label: 'Title' }, { key: 'variant', label: 'Variant' }, { key: 'flags', label: 'Premium', render: (r) => (r.isPremium ? <Badge tone="violet">Premium</Badge> : '—') }, { key: 'status', label: 'Status' }]}
      fields={[
        { name: 'title', label: 'Title', type: 'text', required: true },
        SLUG,
        { name: 'variant', label: 'Variant', type: 'select', required: true, options: opts(['academic', 'general']) },
        { name: 'isPremium', label: 'Premium only', type: 'checkbox' },
        STATUS_FIELD,
        { name: 'description', label: 'Description', type: 'textarea', rows: 3, required: true },
        { name: 'sections', label: 'Sections (JSON)', type: 'json', rows: 12 },
      ]}
    />
  );
}

export function Categories() {
  return (
    <ResourceManager
      endpoint="categories"
      title="Categories"
      filters={[{ name: 'kind', label: 'Kind', options: opts(['vocabulary', 'grammar', 'speaking']) }]}
      columns={[{ key: 'name', label: 'Name' }, { key: 'kind', label: 'Kind' }, { key: 'slug', label: 'Slug' }, { key: 'sortOrder', label: 'Order' }]}
      fields={[
        { name: 'name', label: 'Name', type: 'text', required: true },
        SLUG,
        { name: 'kind', label: 'Kind', type: 'select', required: true, defaultValue: 'vocabulary', options: opts(['vocabulary', 'grammar', 'speaking']) },
        { name: 'sortOrder', label: 'Sort order', type: 'number', defaultValue: 0 },
        { name: 'description', label: 'Description', type: 'textarea', rows: 2 },
      ]}
    />
  );
}

// ---------------------------------------------------------------- read-only lists

export function Subscriptions() {
  const { data, error, loading } = useApi<{ items: { userId: string; email: string; plan: string; status: string; provider: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; updatedAt: string }[] }>('/api/admin/subscriptions');
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} />;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 text-left dark:border-slate-700"><tr><th className="px-4 py-2.5">User</th><th>Plan</th><th>Status</th><th>Provider</th><th>Period end</th><th>Updated</th></tr></thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {data!.items.map((s) => <tr key={s.userId}><td className="px-4 py-2.5">{s.email}</td><td className="capitalize">{s.plan}</td><td>{s.status}{s.cancelAtPeriodEnd ? ' (cancels)' : ''}</td><td><Badge tone={s.provider === 'stripe' ? 'green' : s.provider === 'development' ? 'amber' : 'violet'}>{s.provider}</Badge></td><td>{formatDateTime(s.currentPeriodEnd)}</td><td>{formatDateTime(s.updatedAt)}</td></tr>)}
          {data!.items.length === 0 && <tr><td colSpan={6} className="muted px-4 py-4">No paid or granted subscriptions.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function Outbox() {
  const { data, error, loading } = useApi<{ items: { id: string; to: string; subject: string; body: string; status: string; error: string | null; createdAt: string }[] }>('/api/admin/email-outbox');
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} />;
  return (
    <div className="space-y-3">
      <Alert tone="info">Emails are listed here whether or not they were delivered. “logged” means SMTP is not configured and the email was not sent.</Alert>
      {data!.items.map((m) => (
        <details key={m.id} className="card p-4">
          <summary className="cursor-pointer text-sm"><Badge tone={m.status === 'sent' ? 'green' : m.status === 'failed' ? 'red' : 'amber'}>{m.status}</Badge> <strong className="ml-1">{m.subject}</strong> <span className="muted">→ {m.to} · {formatDateTime(m.createdAt)}</span></summary>
          <pre className="mt-3 text-xs whitespace-pre-wrap">{m.body}</pre>
          {m.error && <p className="mt-2 text-xs text-red-600">{m.error}</p>}
        </details>
      ))}
      {data!.items.length === 0 && <p className="muted text-sm">No emails yet.</p>}
    </div>
  );
}

export function AuditLog() {
  const { data, error, loading } = useApi<{ items: { id: number; action: string; target: string | null; details: unknown; createdAt: string; actor: string | null }[] }>('/api/admin/audit-log');
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} />;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 text-left dark:border-slate-700"><tr><th className="px-4 py-2.5">When</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {data!.items.map((a) => <tr key={a.id}><td className="px-4 py-2 whitespace-nowrap">{formatDateTime(a.createdAt)}</td><td>{a.actor ?? 'system'}</td><td><code className="text-xs">{a.action}</code></td><td className="max-w-40 truncate text-xs">{a.target}</td><td className="max-w-72 truncate text-xs">{a.details ? JSON.stringify(a.details) : ''}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

