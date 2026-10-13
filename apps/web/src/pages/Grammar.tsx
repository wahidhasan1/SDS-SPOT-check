import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { errorMessage, useApi } from '../lib/hooks';
import { ErrorBox, Loading, PageHeader } from '../components/ui';

/** Minimal, safe markdown: paragraphs, "- " bullets and **bold** (no HTML injection). */
export function SimpleMarkdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : p));
  const flush = () => {
    if (bullets.length) blocks.push(<ul key={blocks.length}>{bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}</ul>);
    bullets = [];
  };
  for (const line of text.split('\n')) {
    if (line.startsWith('- ')) bullets.push(line.slice(2));
    else {
      flush();
      if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>);
    }
  }
  flush();
  return <div>{blocks}</div>;
}

export function GrammarListPage() {
  const { data, loading, error, reload } = useApi<any[]>('/grammar/lessons');
  return (
    <div className="stack lg">
      <PageHeader title="Grammar" subtitle="Short lessons with practice. Recommendations adapt to your level and results." />
      <ErrorBox error={error} onRetry={reload} />
      {loading ? <Loading /> : (
        <div className="grid cols-3">
          {data!.map((l) => (
            <Link key={l.slug} to={`/grammar/${l.slug}`} className="tile" data-testid={`lesson-${l.slug}`}>
              <div className="row between"><span className="badge">{l.cefr} · {l.topic}</span>{l.recommended && <span className="badge primary">Recommended</span>}</div>
              <span className="t">{l.title}</span>
              <span className="small muted">{l.summary}</span>
              <span className="small">{l.best == null ? `${l.exercises} exercises` : `Best score ${l.best}% · ${l.attempts} attempt${l.attempts === 1 ? '' : 's'}`}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function GrammarLessonPage() {
  const { slug } = useParams();
  const { data, loading, error } = useApi<any>(`/grammar/lessons/${slug}`);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const submit = async () => {
    setErr(null);
    try {
      setResult(await api.post(`/grammar/lessons/${slug}/submit`, { answers }));
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  const res = (id: string) => result?.results.find((r: any) => r.id === id);
  return (
    <div className="stack lg" style={{ maxWidth: 860 }}>
      <Link to="/grammar" className="small">← Grammar</Link>
      <PageHeader title={data.title} subtitle={`${data.cefr} · ${data.topic}`} />
      <div className="card"><SimpleMarkdown text={data.body} /></div>
      {data.examples.length > 0 && (
        <div className="card">
          <h3>Examples</h3>
          {data.examples.map((e: any) => <div key={e.sentence} className="list-item"><span style={{ flex: 1 }}>{e.sentence}</span><span className="small muted">{e.note}</span></div>)}
        </div>
      )}
      <div className="card stack">
        <h2>Practice</h2>
        {data.exercises.map((e: any, i: number) => {
          const r = res(e.id);
          return (
            <div key={e.id} className="stack" style={{ gap: 6, paddingBottom: 12, borderBottom: '1px dashed var(--border)' }}>
              <b>{i + 1}. {e.prompt}</b>
              {e.kind === 'mcq' ? (
                <div className="grid cols-2">
                  {e.options.map((o: string) => (
                    <button key={o} disabled={!!result} className={`option ${answers[e.id] === o ? 'selected' : ''} ${r && o === r.correctAnswer ? 'correct' : ''} ${r && answers[e.id] === o && !r.correct ? 'wrong' : ''}`} onClick={() => setAnswers((a) => ({ ...a, [e.id]: o }))}>{o}</button>
                  ))}
                </div>
              ) : (
                <input className="input" style={{ maxWidth: 320 }} disabled={!!result} value={answers[e.id] ?? ''} onChange={(ev) => setAnswers((a) => ({ ...a, [e.id]: ev.target.value }))} aria-label={`Answer ${i + 1}`} />
              )}
              {r && <div className="small">{r.correct ? '✅ Correct.' : `❌ Correct answer: ${r.correctAnswer}.`} <span className="muted">{r.explanation}</span></div>}
            </div>
          );
        })}
        <ErrorBox error={err} />
        {result ? (
          <div className="row between">
            <b>Score: {result.score}/{result.total} ({Math.round((result.score / result.total) * 100)}%)</b>
            <div className="row"><button className="btn secondary" onClick={() => { setResult(null); setAnswers({}); }}>Try again</button><Link to="/grammar" className="btn">More lessons</Link></div>
          </div>
        ) : (
          <button className="btn" onClick={submit} disabled={Object.keys(answers).length === 0}>Check answers</button>
        )}
      </div>
    </div>
  );
}
