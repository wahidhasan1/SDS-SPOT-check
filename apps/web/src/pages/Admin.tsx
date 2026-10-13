import { useState } from 'react';
import { CEFR_LEVELS } from '@app/shared';
import { api } from '../lib/api';
import { errorMessage, formatDate, useApi } from '../lib/hooks';
import { Empty, ErrorBox, Loading, PageHeader } from '../components/ui';

const TABS = ['Overview', 'Reports', 'Users', 'Plans', 'Vocabulary', 'IELTS content', 'Topics', 'Review queue', 'Media', 'Audit log'] as const;

export function AdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview');
  return (
    <div className="stack lg">
      <PageHeader title="Administration" subtitle="All actions are permission-checked on the server and recorded in the audit log." />
      <div className="tabs">{TABS.map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === 'Overview' && <Overview />}
      {tab === 'Reports' && <Reports />}
      {tab === 'Users' && <Users />}
      {tab === 'Plans' && <Plans />}
      {tab === 'Vocabulary' && <VocabAdmin />}
      {tab === 'IELTS content' && <ContentAdmin />}
      {tab === 'Topics' && <TopicsAdmin />}
      {tab === 'Review queue' && <ReviewQueue />}
      {tab === 'Media' && <Media />}
      {tab === 'Audit log' && <Audit />}
    </div>
  );
}

function Overview() {
  const { data, loading, error, reload } = useApi<any>('/admin/stats');
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const items: [string, any][] = [
    ['Users', data.users], ['New users (7d)', data.new_users_7d], ['Active learners (7d)', data.active_learners_7d], ['Premium subscribers', data.premium_subscribers],
    ['Calls (24h)', data.calls_24h], ['Connected calls (7d)', data.connected_calls_7d], ['Failed connections (7d)', data.failed_calls_7d], ['Avg call length (7d)', `${Math.round(data.avg_call_sec_7d / 60)} min`],
    ['Active calls now', data.active_calls], ['Users in queue', data.queued], ['Open reports', data.open_reports], ['Online (this server)', data.online_now_this_instance],
    ['Practice attempts (7d)', data.practice_attempts_7d], ['Writing submissions (7d)', data.writing_7d], ['Battles (7d)', data.battles_7d],
  ];
  return <div className="grid cols-4">{items.map(([l, v]) => <div key={l} className="card stat"><span className="v">{v}</span><span className="l">{l}</span></div>)}</div>;
}

function Reports() {
  const [status, setStatus] = useState('open');
  const { data, loading, error, reload } = useApi<any[]>(`/admin/reports?status=${status}`);
  const [err, setErr] = useState<string | null>(null);
  const resolve = async (id: string, st: string, action: string) => {
    const note = window.prompt('Resolution note (optional)') ?? '';
    try {
      await api.post(`/admin/reports/${id}/resolve`, { status: st, action, note });
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <div className="stack">
      <div className="row">{['open', 'actioned', 'dismissed'].map((s) => <button key={s} className={`chip ${status === s ? 'on' : ''}`} onClick={() => setStatus(s)}>{s}</button>)}</div>
      <ErrorBox error={error ?? err} />
      {loading ? <Loading /> : !data?.length ? <Empty icon="✅" title="No reports" /> : (
        <div className="card"><table className="table"><thead><tr><th>When</th><th>Reported user</th><th>Reason</th><th>Details</th><th>Actions</th></tr></thead><tbody>
          {data.map((r) => (
            <tr key={r.id}>
              <td className="small">{formatDate(r.created_at)}<div className="tiny muted">{r.call_id ? 'call' : 'battle'}</div></td>
              <td className="small">{r.reported_anon}<div className="tiny muted">{r.reported_email}</div><div className="tiny">{r.reports_against_total} report(s) total{r.suspended_until && new Date(r.suspended_until) > new Date() ? ' · suspended' : ''}</div></td>
              <td><span className="badge warning">{r.reason}</span></td>
              <td className="small">{r.details ?? '—'}<div className="tiny muted">by {r.reporter_email ?? 'deleted user'}</div>{r.resolution_note && <div className="tiny">Note: {r.resolution_note}</div>}</td>
              <td>{status === 'open' && (
                <div className="row wrap">
                  <button className="btn sm secondary" onClick={() => resolve(r.id, 'dismissed', 'none')}>Dismiss</button>
                  <button className="btn sm secondary" onClick={() => resolve(r.id, 'actioned', 'warn')}>Warn</button>
                  <button className="btn sm" onClick={() => resolve(r.id, 'actioned', 'suspend_24h')}>Suspend 24h</button>
                  <button className="btn sm" onClick={() => resolve(r.id, 'actioned', 'suspend_7d')}>7 days</button>
                  <button className="btn sm danger" onClick={() => resolve(r.id, 'actioned', 'ban')}>Ban</button>
                </div>
              )}</td>
            </tr>
          ))}
        </tbody></table></div>
      )}
    </div>
  );
}

function Users() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const { data, loading, error, reload } = useApi<any[]>(`/admin/users?q=${encodeURIComponent(search)}`);
  const [err, setErr] = useState<string | null>(null);
  const act = async (id: string, action: string, extra: object = {}) => {
    try {
      await api.post(`/admin/users/${id}/action`, { action, ...extra });
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <div className="stack">
      <form className="row" onSubmit={(e) => { e.preventDefault(); setSearch(q); }}><input className="input" style={{ maxWidth: 320 }} placeholder="Email, anonymous name or id" value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn">Search</button></form>
      <ErrorBox error={error ?? err} />
      {loading ? <Loading /> : (
        <div className="card" style={{ overflowX: 'auto' }}><table className="table"><thead><tr><th>User</th><th>Level</th><th>Plan</th><th>Reports</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {data!.map((u) => {
            const suspended = u.suspended_until && new Date(u.suspended_until) > new Date();
            return (
              <tr key={u.id}>
                <td className="small"><b>{u.email}</b><div className="tiny muted">{u.anon_name} · {u.role} · joined {formatDate(u.created_at)}</div></td>
                <td>{u.cefr_level ?? '—'}</td><td>{u.plan ?? 'free'}</td><td>{u.reports_against}</td>
                <td>{suspended ? <span className="badge danger">suspended until {formatDate(u.suspended_until)}</span> : <span className="badge success">active</span>}</td>
                <td><div className="row wrap">
                  {suspended ? <button className="btn sm secondary" onClick={() => act(u.id, 'unsuspend')}>Unsuspend</button> : <button className="btn sm secondary" onClick={() => act(u.id, 'suspend_24h', { reason: 'Admin action' })}>Suspend 24h</button>}
                  {u.plan === 'premium' ? <button className="btn sm secondary" onClick={() => act(u.id, 'revoke_premium')}>Revoke grant</button> : <button className="btn sm secondary" onClick={() => act(u.id, 'grant_premium', { days: 30 })}>Grant 30d Premium</button>}
                  {u.role === 'admin' ? <button className="btn sm ghost" onClick={() => act(u.id, 'remove_admin')}>Remove admin</button> : <button className="btn sm ghost" onClick={() => act(u.id, 'make_admin')}>Make admin</button>}
                </div></td>
              </tr>
            );
          })}
        </tbody></table></div>
      )}
    </div>
  );
}

function Plans() {
  const { data, loading, error, reload } = useApi<any[]>('/admin/plans');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (loading) return <Loading />;
  const save = async (id: string, fallback: any) => {
    setErr(null);
    try {
      const limits = JSON.parse(edits[id] ?? JSON.stringify(fallback));
      await api.put(`/admin/plans/${id}`, { limits });
      setMsg(`Saved ${id} plan.`);
      reload();
    } catch (e) {
      setErr(e instanceof SyntaxError ? 'Invalid JSON.' : errorMessage(e));
    }
  };
  return (
    <div className="stack">
      {msg && <div className="alert success">{msg}</div>}
      <ErrorBox error={error ?? err} />
      <div className="small muted">Limits are enforced by the server for every client. Use null for unlimited.</div>
      <div className="grid cols-2">
        {data!.map((p) => (
          <div key={p.id} className="card stack">
            <h3>{p.name} ({p.id})</h3>
            <textarea className="input" rows={18} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }} value={edits[p.id] ?? JSON.stringify(p.limits, null, 2)} onChange={(e) => setEdits({ ...edits, [p.id]: e.target.value })} />
            <div className="row"><button className="btn" onClick={() => save(p.id, p.limits)}>Save limits</button><button className="btn ghost" onClick={async () => { await api.post(`/admin/plans/${p.id}/reset`); reload(); setEdits({}); }}>Reset to defaults</button></div>
          </div>
        ))}
      </div>
    </div>
  );
}

const EMPTY_WORD = { word: '', ipa: '', partOfSpeech: 'noun', meaning: '', examples: [''], synonyms: [], antonyms: [], cefr: 'B1', tags: ['everyday'], usageNote: '', status: 'published' };

function VocabAdmin() {
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useApi<any[]>(`/admin/vocabulary?q=${encodeURIComponent(q)}`);
  const [edit, setEdit] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setErr(null);
    const body = {
      word: edit.word, ipa: edit.ipa || null, partOfSpeech: edit.partOfSpeech, meaning: edit.meaning, cefr: edit.cefr, status: edit.status,
      examples: String(edit.examplesText ?? edit.examples.join('\n')).split('\n').map((s: string) => s.trim()).filter(Boolean),
      synonyms: String(edit.synText ?? edit.synonyms.join(', ')).split(',').map((s: string) => s.trim()).filter(Boolean),
      antonyms: String(edit.antText ?? edit.antonyms.join(', ')).split(',').map((s: string) => s.trim()).filter(Boolean),
      tags: String(edit.tagText ?? edit.tags.join(', ')).split(',').map((s: string) => s.trim()).filter(Boolean),
      usageNote: edit.usageNote || null,
    };
    try {
      if (edit.id) await api.put(`/admin/vocabulary/${edit.id}`, body);
      else await api.post('/admin/vocabulary', body);
      setEdit(null);
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <div className="grid cols-2" style={{ alignItems: 'start' }}>
      <div className="card stack">
        <div className="row"><input className="input" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn" onClick={() => setEdit({ ...EMPTY_WORD })}>+ New word</button></div>
        <ErrorBox error={error} />
        {loading ? <Loading /> : <div className="list">{data!.map((w) => <button key={w.id} className="list-item btn ghost" style={{ justifyContent: 'space-between' }} onClick={() => setEdit({ ...w, partOfSpeech: w.part_of_speech, usageNote: w.usage_note })}><span>{w.word}</span><span className="tiny muted">{w.part_of_speech} · {w.cefr} · {w.status}</span></button>)}</div>}
      </div>
      {edit && (
        <div className="card stack">
          <h3>{edit.id ? `Edit “${edit.word}”` : 'New word'}</h3>
          <div className="grid cols-2">
            <label className="field">Word<input className="input" value={edit.word} onChange={(e) => setEdit({ ...edit, word: e.target.value })} /></label>
            <label className="field">IPA<input className="input" value={edit.ipa ?? ''} onChange={(e) => setEdit({ ...edit, ipa: e.target.value })} /></label>
            <label className="field">Part of speech<input className="input" value={edit.partOfSpeech} onChange={(e) => setEdit({ ...edit, partOfSpeech: e.target.value })} /></label>
            <label className="field">CEFR<select className="input" value={edit.cefr} onChange={(e) => setEdit({ ...edit, cefr: e.target.value })}>{CEFR_LEVELS.map((l) => <option key={l}>{l}</option>)}</select></label>
          </div>
          <label className="field">Meaning<textarea className="input" rows={2} value={edit.meaning} onChange={(e) => setEdit({ ...edit, meaning: e.target.value })} /></label>
          <label className="field">Examples (one per line)<textarea className="input" rows={3} value={edit.examplesText ?? edit.examples.join('\n')} onChange={(e) => setEdit({ ...edit, examplesText: e.target.value })} /></label>
          <div className="grid cols-2">
            <label className="field">Synonyms (comma separated)<input className="input" value={edit.synText ?? edit.synonyms.join(', ')} onChange={(e) => setEdit({ ...edit, synText: e.target.value })} /></label>
            <label className="field">Antonyms<input className="input" value={edit.antText ?? edit.antonyms.join(', ')} onChange={(e) => setEdit({ ...edit, antText: e.target.value })} /></label>
            <label className="field">Tags<input className="input" value={edit.tagText ?? edit.tags.join(', ')} onChange={(e) => setEdit({ ...edit, tagText: e.target.value })} /></label>
            <label className="field">Status<select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option>published</option><option>draft</option></select></label>
          </div>
          <label className="field">Usage note<input className="input" value={edit.usageNote ?? ''} onChange={(e) => setEdit({ ...edit, usageNote: e.target.value })} /></label>
          <ErrorBox error={err} />
          <div className="row">
            <button className="btn" onClick={save}>Save</button>
            <button className="btn secondary" onClick={() => setEdit(null)}>Cancel</button>
            {edit.id && <button className="btn danger" onClick={async () => { if (confirm('Delete this word?')) { await api.del(`/admin/vocabulary/${edit.id}`); setEdit(null); reload(); } }}>Delete</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function JsonEditor({ title, value, onSave }: { title: string; value: any; onSave: (v: any) => Promise<void> }) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="card stack">
      <h3>{title}</h3>
      <textarea className="input" rows={22} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }} value={text} onChange={(e) => setText(e.target.value)} />
      {msg && <div className="alert success">{msg}</div>}
      <ErrorBox error={err} />
      <button className="btn" onClick={async () => {
        setErr(null);
        setMsg(null);
        try {
          await onSave(JSON.parse(text));
          setMsg('Saved and validated.');
        } catch (e) {
          setErr(e instanceof SyntaxError ? 'Invalid JSON: ' + e.message : errorMessage(e));
        }
      }}>Validate & save</button>
    </div>
  );
}

function ContentAdmin() {
  const sets = useApi<any[]>('/admin/ielts/sets');
  const writing = useApi<any[]>('/admin/writing-prompts');
  const speaking = useApi<any[]>('/admin/speaking-prompts');
  const grammar = useApi<any[]>('/admin/grammar');
  const [sel, setSel] = useState<{ kind: string; key: string; value: any } | null>(null);
  const openSet = async (slug: string) => {
    const s = await api.get<any>(`/admin/ielts/sets/${slug}`);
    setSel({ kind: 'set', key: slug, value: { skill: s.skill, testType: s.test_type, title: s.title, description: s.description, difficulty: s.difficulty, timeLimitSec: s.time_limit_sec, isPremium: s.is_premium, status: s.status, content: s.content, answerKey: s.answer_key } });
  };
  const newSet = () => setSel({ kind: 'set', key: `new-set-${Date.now()}`, value: { skill: 'reading', testType: 'academic', title: 'New reading set', description: '', difficulty: 'Band 6', timeLimitSec: 1200, isPremium: false, status: 'draft', content: { passages: [{ id: 'p1', title: 'Title', paragraphs: [{ label: 'A', text: 'Passage text…' }] }], groups: [{ id: 'g1', passageId: 'p1', type: 'tfng', title: 'Questions 1–1', instructions: 'Choose TRUE, FALSE or NOT GIVEN.', options: ['TRUE', 'FALSE', 'NOT GIVEN'], questions: [{ id: 'q1', number: 1, text: 'Statement' }] }] }, answerKey: { q1: { accepted: ['TRUE'], explanation: 'Why.' } } } });
  return (
    <div className="grid cols-3" style={{ alignItems: 'start' }}>
      <div className="stack">
        <div className="card"><div className="row between"><h3 style={{ margin: 0 }}>Reading & listening sets</h3><button className="btn sm" onClick={newSet}>+ New</button></div>
          {sets.loading ? <Loading /> : <div className="list">{sets.data!.map((s) => <button key={s.slug} className="list-item btn ghost" style={{ justifyContent: 'space-between' }} onClick={() => openSet(s.slug)}><span className="small">{s.title}</span><span className="tiny muted">{s.skill} · {s.question_count}q · {s.status}</span></button>)}</div>}
        </div>
        <div className="card"><h3>Writing prompts</h3>
          {writing.loading ? <Loading /> : <div className="list">{writing.data!.map((p) => <button key={p.slug} className="list-item btn ghost" onClick={() => setSel({ kind: 'writing', key: p.slug, value: { testType: p.test_type, task: p.task, kind: p.kind, title: p.title, prompt: p.prompt, instructions: p.instructions, visual: p.visual, minWords: p.min_words, timeLimitSec: p.time_limit_sec, isPremium: p.is_premium, status: p.status } })}><span className="small">T{p.task} · {p.title}</span></button>)}</div>}
        </div>
        <div className="card"><h3>Speaking prompts</h3>
          {speaking.loading ? <Loading /> : <div className="list">{speaking.data!.map((p) => <button key={p.slug} className="list-item btn ghost" onClick={() => setSel({ kind: 'speaking', key: p.slug, value: { part: p.part, topic: p.topic, text: p.text, bullets: p.bullets, questions: p.questions, groupKey: p.group_key, status: p.status } })}><span className="small">P{p.part} · {p.text}</span></button>)}</div>}
        </div>
        <div className="card"><h3>Grammar lessons</h3>
          {grammar.loading ? <Loading /> : <div className="list">{grammar.data!.map((l) => <button key={l.slug} className="list-item btn ghost" onClick={() => setSel({ kind: 'grammar', key: l.slug, value: { title: l.title, cefr: l.cefr, topic: l.topic, summary: l.summary, body: l.body, status: l.status, exercises: (l.exercises ?? []).map((e: any) => ({ kind: e.kind, prompt: e.prompt, options: e.options, answers: e.answers, explanation: e.explanation })) } })}><span className="small">{l.cefr} · {l.title}</span></button>)}</div>}
        </div>
      </div>
      <div style={{ gridColumn: 'span 2' }}>
        {!sel ? <div className="card"><Empty icon="🛠️" title="Select content to edit">Changes are validated by the server (e.g. every question needs an answer key) and take effect immediately.</Empty></div> : (
          <JsonEditor
            key={sel.kind + sel.key}
            title={`${sel.kind}: ${sel.key}`}
            value={sel.value}
            onSave={async (v) => {
              const path = sel.kind === 'set' ? `/admin/ielts/sets/${sel.key}` : sel.kind === 'writing' ? `/admin/writing-prompts/${sel.key}` : sel.kind === 'speaking' ? `/admin/speaking-prompts/${sel.key}` : `/admin/grammar/${sel.key}`;
              await api.put(path, v);
              sets.reload();
            }}
          />
        )}
      </div>
    </div>
  );
}

function TopicsAdmin() {
  const { data, loading, error, reload } = useApi<any[]>('/admin/topics');
  const [edits, setEdits] = useState<Record<string, string>>({});
  if (loading) return <Loading />;
  return (
    <div className="stack">
      <ErrorBox error={error} />
      <div className="grid cols-2">
        {data!.map((t) => (
          <div key={t.id} className="card stack">
            <b>{t.label} {t.overridden && <span className="badge">customised</span>}</b>
            <textarea className="input" rows={6} value={edits[t.id] ?? t.prompts.join('\n')} onChange={(e) => setEdits({ ...edits, [t.id]: e.target.value })} />
            <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={async () => { await api.put(`/admin/topics/${t.id}`, { prompts: (edits[t.id] ?? t.prompts.join('\n')).split('\n').map((s) => s.trim()).filter(Boolean) }); reload(); }}>Save prompts</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewQueue() {
  const { data, loading, error, reload } = useApi<any[]>('/admin/review-queue');
  const [form, setForm] = useState({ topic: 'environment', level: 'B2', count: 6 });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const generate = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.post('/admin/review-queue/generate', form);
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack">
      <div className="card row wrap">
        <b>Generate vocabulary with AI</b>
        <input className="input" style={{ maxWidth: 200 }} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
        <select className="input" style={{ maxWidth: 90 }} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>{CEFR_LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
        <input className="input" type="number" style={{ maxWidth: 80 }} value={form.count} min={1} max={15} onChange={(e) => setForm({ ...form, count: Number(e.target.value) })} />
        <button className="btn" disabled={busy} onClick={generate}>{busy ? 'Generating…' : 'Generate for review'}</button>
      </div>
      <ErrorBox error={error ?? err} />
      <div className="small muted">AI-generated items are never published until an administrator approves them.</div>
      {loading ? <Loading /> : !data?.length ? <Empty icon="📥" title="Nothing awaiting review" /> : (
        <div className="grid cols-2">
          {data.map((i) => (
            <div key={i.id} className="card stack" style={{ gap: 6 }}>
              <b>{i.payload.word}</b> <span className="tiny muted">{i.payload.partOfSpeech} · {i.payload.cefr} · {i.source}</span>
              <div className="small">{i.payload.meaning}</div>
              {i.payload.examples?.map((e: string) => <div key={e} className="tiny muted">“{e}”</div>)}
              <div className="row"><button className="btn sm success" onClick={async () => { await api.post(`/admin/review-queue/${i.id}/approve`); reload(); }}>Approve</button><button className="btn sm danger" onClick={async () => { await api.post(`/admin/review-queue/${i.id}/reject`); reload(); }}>Reject</button></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Media() {
  const { data, loading, reload } = useApi<any[]>('/admin/media');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const upload = async (f: File) => {
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await api.upload<{ path: string }>('/admin/media', fd);
      setMsg(`Uploaded. Use "${r.path}" as content.audio in a listening set.`);
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <div className="stack">
      <div className="card row"><b>Upload audio</b><input type="file" accept="audio/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></div>
      {msg && <div className="alert success">{msg}</div>}
      <ErrorBox error={err} />
      {loading ? <Loading /> : (
        <div className="card"><table className="table"><tbody>{data!.map((m) => <tr key={m.path}><td className="small">{m.path}</td><td className="small">{Math.round(m.size / 1024)} KB</td><td><audio controls preload="none" src={m.path.startsWith('/media') ? (import.meta.env.VITE_API_URL ?? `${location.protocol}//${location.hostname}:4000`) + m.path : m.path} style={{ height: 32 }} /></td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}

function Audit() {
  const { data, loading } = useApi<any[]>('/admin/audit');
  if (loading) return <Loading />;
  return (
    <div className="card"><table className="table"><thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>
      {data!.map((a) => <tr key={a.id}><td className="small">{formatDate(a.created_at)}</td><td className="small">{a.admin_email ?? 'system'}</td><td><span className="badge">{a.action}</span></td><td className="small">{a.target_type} {a.target_id}</td><td className="tiny muted">{JSON.stringify(a.details).slice(0, 120)}</td></tr>)}
    </tbody></table></div>
  );
}
