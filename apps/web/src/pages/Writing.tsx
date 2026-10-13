import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { errorMessage, formatDate, useApi } from '../lib/hooks';
import { PromptCard, WritingEditor, type PromptDto } from '../components/WritingEditor';
import { Empty, ErrorBox, Loading, Modal, PageHeader, Unofficial } from '../components/ui';
import { IeltsTabs } from './Ielts';

export function WritingList() {
  const { user } = useAuth();
  const tt = user?.testType === 'general' ? 'general' : 'academic';
  const { data, error, loading, reload } = useApi<any[]>(`/ielts/writing/prompts?testType=${tt}`);
  const subs = useApi<any[]>('/ielts/writing/submissions');
  const kindLabel: Record<string, string> = {
    bar_chart: 'Bar chart', line_graph: 'Line graph', table: 'Table', process: 'Process diagram', map: 'Maps', essay: 'Essay',
    letter_formal: 'Formal letter', letter_semi: 'Semi-formal letter', letter_informal: 'Informal letter',
  };
  return (
    <div className="stack lg">
      <PageHeader title="IELTS Writing" subtitle={`${tt === 'general' ? 'General Training' : 'Academic'} tasks. Change your test type on the IELTS overview.`} />
      <IeltsTabs />
      <ErrorBox error={error} onRetry={reload} />
      {loading ? <Loading /> : (
        [1, 2].map((task) => (
          <div key={task} className="stack">
            <h2>Task {task}</h2>
            <div className="grid cols-3">
              {data!.filter((p) => p.task === task).map((p) => (
                <Link key={p.slug} to={`/ielts/writing/${p.slug}`} className="tile" data-testid={`writing-${p.slug}`}>
                  <span className="badge">{kindLabel[p.kind] ?? p.kind}</span>
                  <span className="t">{p.title}</span>
                  <span className="small muted">{p.minWords}+ words · {Math.round(p.timeLimitSec / 60)} min {p.isPremium && '· ⭐ Premium'}</span>
                  {p.latest && <span className="small">{p.latest.status === 'draft' ? `Draft · ${p.latest.word_count} words` : `Submitted${p.latest.band_estimate ? ` · band ≈ ${p.latest.band_estimate}` : ''}`}</span>}
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
      <div className="card">
        <h3>Your writing history</h3>
        {subs.loading ? <Loading /> : !subs.data?.length ? <Empty icon="✍️" title="No writing yet" /> : (
          <table className="table"><thead><tr><th>Task</th><th>Status</th><th>Words</th><th>Band (unofficial)</th><th>Updated</th></tr></thead><tbody>
            {subs.data.map((s) => (
              <tr key={s.id}>
                <td>{s.status === 'draft' && !s.mock_attempt_id ? <Link to={`/ielts/writing/${s.slug}`}>{s.title}</Link> : <Link to={`/ielts/writing/result/${s.id}`}>{s.title}</Link>}<div className="tiny muted">Task {s.task}{s.mock_attempt_id ? ' · mock test' : ''}</div></td>
                <td>{s.status}</td><td>{s.word_count}</td><td>{s.band_estimate ?? '—'}</td><td>{formatDate(s.updated_at)}</td>
              </tr>
            ))}
          </tbody></table>
        )}
      </div>
    </div>
  );
}

export function WritingTaskPage() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState<{ prompt: PromptDto; draft: any } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get<{ prompt: PromptDto; draft: any }>(`/ielts/writing/prompts/${slug}`).then((d) => {
      setData(d);
      setSubId(d.draft?.id ?? null);
    }).catch((e) => setErr(errorMessage(e)));
  }, [slug]);
  const submit = async () => {
    if (!subId) return;
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/ielts/writing/submissions/${subId}/submit`);
      nav(`/ielts/writing/result/${subId}`);
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(false);
      setConfirm(false);
    }
  };
  if (err && !data) return <ErrorBox error={err} />;
  if (!data) return <Loading />;
  return (
    <div className="stack">
      <Link to="/ielts/writing" className="small">← All writing tasks</Link>
      <h1>{data.prompt.title}</h1>
      <div className="writing-layout">
        <div style={{ position: 'sticky', top: 76 }}><PromptCard prompt={data.prompt} /></div>
        <div className="card stack">
          <WritingEditor prompt={data.prompt} initialText={data.draft?.text ?? ''} submissionId={data.draft?.id} onSaved={setSubId} />
          <ErrorBox error={err} />
          <div className="row between">
            <span className="small muted">Your draft saves automatically, on any device.</span>
            <button className="btn" disabled={!subId || busy} onClick={() => setConfirm(true)} data-testid="submit-writing">Submit for feedback</button>
          </div>
        </div>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Submit your response?">
        <p>Your response will be checked and you'll receive feedback. You can't edit it afterwards, but you can start a new attempt.</p>
        <div className="row"><button className="btn" onClick={submit} disabled={busy} data-testid="confirm-writing">{busy ? 'Evaluating… (this can take a moment)' : 'Submit'}</button><button className="btn secondary" onClick={() => setConfirm(false)}>Cancel</button></div>
      </Modal>
    </div>
  );
}

const CRIT: [string, string][] = [
  ['taskAchievementOrResponse', 'Task achievement / response'],
  ['coherenceCohesion', 'Coherence & cohesion'],
  ['lexicalResource', 'Lexical resource'],
  ['grammaticalRangeAccuracy', 'Grammatical range & accuracy'],
];

export function FeedbackChecks({ checks }: { checks: { id: string; status: string; title: string; detail: string }[] }) {
  return (
    <div className="list">
      {checks.map((c) => (
        <div key={c.id} className="list-item" style={{ alignItems: 'flex-start' }}>
          <span>{c.status === 'good' ? '✅' : c.status === 'warn' ? '⚠️' : 'ℹ️'}</span>
          <div><b>{c.title}</b><div className="small muted">{c.detail}</div></div>
        </div>
      ))}
    </div>
  );
}

export function WritingResultPage() {
  const { id } = useParams();
  const { data, error, loading } = useApi<any>(`/ielts/writing/submissions/${id}`);
  const [draftView, setDraftView] = useState<any>(null);
  const [saved, setSaved] = useState<string[]>([]);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const fb = data.feedback;
  const m = data.metrics;
  const saveWord = async (w: string) => {
    await api.post('/vocabulary/saved', { word: w, source: 'writing_feedback' });
    setSaved((s) => [...s, w]);
  };
  return (
    <div className="stack lg">
      <Link to="/ielts/writing" className="small">← Writing</Link>
      <PageHeader title={data.prompt.title} subtitle={`Task ${data.prompt.task} · ${data.wordCount} words · submitted ${formatDate(data.submittedAt)}`} />
      <div className="writing-layout">
        <div className="stack">
          <div className="card">
            <h3>Your response</h3>
            <div className="reading-text" style={{ whiteSpace: 'pre-wrap', fontSize: '1rem' }}>{data.text}</div>
          </div>
          <details className="card">
            <summary><b>Task and draft history ({data.drafts.length})</b></summary>
            <div className="mt"><p className="small">{data.prompt.prompt}</p></div>
            <div className="list">
              {data.drafts.map((d: any) => (
                <button key={d.id} className="list-item btn ghost sm" style={{ justifyContent: 'space-between' }} onClick={async () => setDraftView(await api.get(`/ielts/writing/drafts/${d.id}`))}>
                  <span>{formatDate(d.saved_at)}</span><span>{d.word_count} words</span>
                </button>
              ))}
            </div>
          </details>
        </div>
        <div className="stack">
          {fb ? (
            <div className="card stack" data-testid="ai-feedback">
              <div className="row between"><h2 style={{ margin: 0 }}>Feedback</h2><span className="badge primary">Estimated band {data.bandEstimate}</span></div>
              <Unofficial />
              <p>{fb.summary}</p>
              <div className="grid cols-2">
                {CRIT.map(([k, l]) => (
                  <div key={k} className="card flat">
                    <div className="row between"><b className="small">{l}</b><span className="badge">{fb.bandEstimates[k]}</span></div>
                    <div className="small muted">{fb.criteria[k]}</div>
                  </div>
                ))}
              </div>
              <h3>Focus on next</h3>
              <ol>{fb.priorities.map((p: string) => <li key={p}>{p}</li>)}</ol>
              {fb.strengths.length > 0 && <><h3>Strengths</h3><ul>{fb.strengths.map((s: string) => <li key={s}>{s}</li>)}</ul></>}
              {fb.errors.length > 0 && (
                <>
                  <h3>Mistakes to learn from</h3>
                  {fb.errors.map((e: any, i: number) => (
                    <div key={i} className="card flat small">
                      <span className="badge">{e.category}</span> <s className="muted">{e.excerpt}</s> → <b>{e.correction}</b>
                      <div>{e.issue}</div><div className="muted">Rule: {e.explanation}</div>
                    </div>
                  ))}
                </>
              )}
              {fb.vocabularyUpgrades.length > 0 && (
                <>
                  <h3>Vocabulary upgrades</h3>
                  {fb.vocabularyUpgrades.map((v: any, i: number) => (
                    <div key={i} className="row small" style={{ justifyContent: 'space-between' }}>
                      <span>“{v.original}” → <b>{v.suggestion}</b> <span className="muted">— {v.why}</span></span>
                      <button className="btn ghost sm" disabled={saved.includes(v.suggestion)} onClick={() => saveWord(v.suggestion)}>{saved.includes(v.suggestion) ? 'Saved' : '+ Save'}</button>
                    </div>
                  ))}
                </>
              )}
              {fb.improvedSentenceExamples.length > 0 && (
                <>
                  <h3>Example improvements</h3>
                  {fb.improvedSentenceExamples.map((s: any, i: number) => (
                    <div key={i} className="card flat small"><div className="muted">{s.original}</div><div><b>{s.improved}</b></div><div className="tiny muted">{s.whatChanged}</div></div>
                  ))}
                </>
              )}
            </div>
          ) : (
            <div className="card stack">
              <h2 style={{ margin: 0 }}>Text checks</h2>
              <div className="alert info">{m?.aiError ?? 'AI feedback was not available for this response.'} No band score is estimated from these checks.</div>
            </div>
          )}
          {m && (
            <div className="card stack">
              <h3>Measurable checks</h3>
              <FeedbackChecks checks={m.checks} />
              {m.spelling?.length > 0 && (
                <div><b className="small">Possible spelling issues</b><div className="row wrap mt">{m.spelling.map((s: any) => <span key={s.word} className="badge warning">{s.word}{s.suggestions.length ? ` → ${s.suggestions.join(' / ')}` : ''}</span>)}</div></div>
              )}
              {m.advancedWords?.length > 0 && (
                <div><b className="small">Less common vocabulary you used</b><div className="row wrap mt">{m.advancedWords.map((w: any) => <span key={w.word} className="badge success">{w.word} · {w.level}</span>)}</div></div>
              )}
              <div className="grid cols-3 small">
                <div className="stat"><span className="v">{m.metrics.words}</span><span className="l">words</span></div>
                <div className="stat"><span className="v">{m.metrics.avgSentenceLength}</span><span className="l">avg sentence length</span></div>
                <div className="stat"><span className="v">{m.metrics.lexicalDiversity}</span><span className="l">lexical variety index</span></div>
              </div>
            </div>
          )}
          <Link to={`/ielts/writing/${data.prompt.slug}`} className="btn secondary">Write another attempt</Link>
        </div>
      </div>
      <Modal open={!!draftView} onClose={() => setDraftView(null)} title={`Draft from ${draftView ? formatDate(draftView.saved_at) : ''}`}>
        <div style={{ whiteSpace: 'pre-wrap' }} className="small">{draftView?.text}</div>
      </Modal>
    </div>
  );
}
