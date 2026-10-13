import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CEFR_LEVELS } from '@app/shared';
import { api } from '../lib/api';
import { errorMessage, formatDate, useApi, useDebouncedCallback } from '../lib/hooks';
import { Empty, ErrorBox, Loading, PageHeader, Progress } from '../components/ui';

function speak(word: string) {
  try {
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-GB';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* speech synthesis unavailable */
  }
}

export function WordCard({ w, onSaved }: { w: any; onSaved?: () => void }) {
  const [saved, setSaved] = useState<boolean>(w.saved);
  const [err, setErr] = useState<string | null>(null);
  const toggle = async () => {
    try {
      if (saved && w.savedId) await api.del(`/vocabulary/saved/${w.savedId}`);
      else await api.post('/vocabulary/saved', { word: w.word, vocabularyId: w.id, source: 'manual' });
      setSaved(!saved);
      onSaved?.();
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <div className="card stack" style={{ gap: 6 }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          <b style={{ fontSize: '1.1rem' }}>{w.word}</b> <button className="btn ghost sm" onClick={() => speak(w.word)} aria-label={`Pronounce ${w.word}`}>🔊</button>
          <div className="tiny muted">{w.ipa} · {w.partOfSpeech} · {w.cefr}{w.tags?.includes('ielts') ? ' · IELTS' : ''}</div>
        </div>
        <button className={`btn sm ${saved ? 'secondary' : ''}`} onClick={toggle} data-testid={`save-${w.word}`}>{saved ? '✓ Saved' : '+ Save'}</button>
      </div>
      <div>{w.meaning}</div>
      {w.examples?.map((e: string) => <div key={e} className="small muted">“{e}”</div>)}
      {(w.synonyms?.length > 0 || w.antonyms?.length > 0) && (
        <div className="small">{w.synonyms?.length > 0 && <>≈ {w.synonyms.join(', ')}</>} {w.antonyms?.length > 0 && <span className="muted"> ≠ {w.antonyms.join(', ')}</span>}</div>
      )}
      {w.usageNote && <div className="tiny" style={{ color: 'var(--warning)' }}>💡 {w.usageNote}</div>}
      {err && <div className="alert error small">{err}</div>}
    </div>
  );
}

export function VocabularyPage() {
  const [tab, setTab] = useState<'today' | 'browse' | 'saved' | 'quiz'>('today');
  const stats = useApi<any>('/vocabulary/stats');
  return (
    <div className="stack lg">
      <PageHeader
        title="Vocabulary"
        subtitle="Learn, save and review words with spaced repetition. Saved words sync across all your devices."
        actions={<Link to="/vocabulary/review" className="btn">🔁 Review{stats.data?.due ? ` (${stats.data.due} due)` : ''}</Link>}
      />
      {stats.data && (
        <div className="grid cols-4">
          <div className="card stat"><span className="v">{stats.data.saved}</span><span className="l">Saved words</span></div>
          <div className="card stat"><span className="v">{stats.data.due}</span><span className="l">Due for review</span></div>
          <div className="card stat"><span className="v">{stats.data.mastered}</span><span className="l">Mastered (21+ day interval)</span></div>
          <div className="card stat"><span className="v">{stats.data.reviewed_week}</span><span className="l">Reviews this week</span></div>
        </div>
      )}
      <div className="tabs">
        {([['today', 'Words of the day'], ['browse', 'Browse'], ['saved', 'My words'], ['quiz', 'Quiz']] as const).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'today' && <Daily onChange={stats.reload} />}
      {tab === 'browse' && <Browse onChange={stats.reload} />}
      {tab === 'saved' && <Saved onChange={stats.reload} />}
      {tab === 'quiz' && <Quiz />}
    </div>
  );
}

function Daily({ onChange }: { onChange: () => void }) {
  const { data, loading, error } = useApi<any>('/vocabulary/daily');
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  return (
    <div className="stack">
      <div className="small muted">Five words for level {data.level} today. Save the ones you want to remember.</div>
      <div className="grid cols-2">{data.words.map((w: any) => <WordCard key={w.id} w={w} onSaved={onChange} />)}</div>
    </div>
  );
}

function Browse({ onChange }: { onChange: () => void }) {
  const [level, setLevel] = useState('');
  const [tag, setTag] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const debounced = useDebouncedCallback((v: string) => setQuery(v), 350);
  const { data, loading, error } = useApi<any>(`/vocabulary?limit=40${level ? `&level=${level}` : ''}${tag ? `&tag=${tag}` : ''}${query ? `&q=${encodeURIComponent(query)}` : ''}`);
  return (
    <div className="stack">
      <div className="row wrap">
        <input className="input" style={{ maxWidth: 260 }} placeholder="Search words or meanings" value={q} onChange={(e) => { setQ(e.target.value); debounced(e.target.value); }} />
        <select className="input" style={{ maxWidth: 140 }} value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">All levels</option>{CEFR_LEVELS.map((l) => <option key={l}>{l}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 180 }} value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">All topics</option><option value="ielts">IELTS</option><option value="academic">Academic</option><option value="everyday">Everyday</option><option value="business">Business</option>
        </select>
      </div>
      <ErrorBox error={error} />
      {loading ? <Loading /> : !data.items.length ? <Empty title="No words match" /> : <div className="grid cols-3">{data.items.map((w: any) => <WordCard key={w.id} w={w} onSaved={onChange} />)}</div>}
    </div>
  );
}

function Saved({ onChange }: { onChange: () => void }) {
  const { data, loading, error, reload } = useApi<any[]>('/vocabulary/saved');
  const [word, setWord] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const add = async () => {
    if (!word.trim()) return;
    try {
      await api.post('/vocabulary/saved', { word: word.trim(), source: 'manual' });
      setWord('');
      reload();
      onChange();
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  const remove = async (id: string) => {
    await api.del(`/vocabulary/saved/${id}`);
    reload();
    onChange();
  };
  const sourceLabel: Record<string, string> = { ai_reading: '📷 AI reading', reading: '📖 Reading', call: '🎙️ Call', writing_feedback: '✍️ Writing', speaking: '🗣️ Speaking', quiz: '❓ Quiz', manual: '➕ Added', daily: '📅 Daily' };
  return (
    <div className="stack">
      <div className="row"><input className="input" style={{ maxWidth: 320 }} placeholder="Add any word…" value={word} onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} /><button className="btn" onClick={add}>Add</button></div>
      <ErrorBox error={error ?? err} />
      {loading ? <Loading /> : !data?.length ? <Empty icon="📚" title="No saved words yet">Save words from lessons, reading or feedback.</Empty> : (
        <div className="card">
          <table className="table">
            <thead><tr><th>Word</th><th>Meaning</th><th>From</th><th>Next review</th><th></th></tr></thead>
            <tbody>
              {data.map((w) => (
                <tr key={w.id}>
                  <td><b>{w.word}</b>{w.mastered && <span className="badge success" style={{ marginLeft: 6 }}>mastered</span>}<div className="tiny muted">{w.partOfSpeech}</div></td>
                  <td className="small">{w.meaning ?? <span className="muted">—</span>}{w.context && <div className="tiny muted">“{w.context.slice(0, 90)}”</div>}</td>
                  <td className="small">{sourceLabel[w.source] ?? w.source}</td>
                  <td className="small">{new Date(w.dueAt) <= new Date() ? <span className="badge warning">due now</span> : formatDate(w.dueAt)}</td>
                  <td><button className="btn ghost sm" onClick={() => remove(w.id)} aria-label={`Remove ${w.word}`}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Quiz() {
  const [quiz, setQuiz] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const start = async (kind: string) => {
    setErr(null);
    setResult(null);
    setAnswers({});
    try {
      setQuiz(await api.post('/vocabulary/quiz', { kind }));
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  const submit = async () => {
    try {
      setResult(await api.post(`/vocabulary/quiz/${quiz.id}/submit`, { answers }));
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  const saveWord = async (prompt: string) => {
    const m = prompt.match(/"([^"]+)"/);
    if (m) await api.post('/vocabulary/saved', { word: m[1], source: 'quiz' });
  };
  if (!quiz) {
    return (
      <div className="stack">
        <ErrorBox error={err} />
        <div className="grid cols-4">
          {[['vocabulary', 'Word meanings'], ['synonym', 'Synonyms'], ['ielts_vocabulary', 'IELTS vocabulary'], ['spelling', 'Spelling']].map(([k, l]) => (
            <button key={k} className="tile" onClick={() => start(k)}><span className="t">{l}</span><span className="small muted">10 questions</span></button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="stack">
      {result && <div className="alert success">You scored {result.score} / {result.total}.</div>}
      {quiz.questions.map((q: any) => {
        const r = result?.results[q.index];
        return (
          <div key={q.index} className="card stack">
            <b>{q.index + 1}. {q.prompt}</b>
            {q.hint && <div className="small muted">Hint: {q.hint}</div>}
            {q.kind === 'mcq' ? (
              <div className="grid cols-2">
                {q.options.map((o: string) => (
                  <button key={o} disabled={!!result} className={`option ${answers[q.index] === o ? 'selected' : ''} ${r && o === r.correctAnswer ? 'correct' : ''} ${r && answers[q.index] === o && !r.correct ? 'wrong' : ''}`} onClick={() => setAnswers((a) => ({ ...a, [q.index]: o }))}>{o}</button>
                ))}
              </div>
            ) : (
              <input className="input" disabled={!!result} value={answers[q.index] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.index]: e.target.value }))} />
            )}
            {r && <div className="small">{r.correct ? '✅ Correct' : `❌ Answer: ${r.correctAnswer}`} {r.explanation && <span className="muted">— {r.explanation}</span>} {!r.correct && <button className="btn ghost sm" onClick={() => saveWord(q.prompt)}>+ Save word</button>}</div>}
          </div>
        );
      })}
      <ErrorBox error={err} />
      <div className="row">{!result ? <button className="btn" onClick={submit}>Submit quiz</button> : <button className="btn" onClick={() => setQuiz(null)}>New quiz</button>}</div>
    </div>
  );
}

export function ReviewPage() {
  const { data, loading, error, reload } = useApi<any[]>('/vocabulary/review');
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const cards = data ?? [];
  const card = cards[idx];
  const rate = async (quality: number) => {
    await api.post(`/vocabulary/saved/${card.id}/review`, { quality });
    setDone((d) => d + 1);
    setFlipped(false);
    if (idx + 1 < cards.length) setIdx(idx + 1);
    else {
      setIdx(0);
      reload();
    }
  };
  return (
    <div className="stack lg" style={{ maxWidth: 640, margin: '0 auto' }}>
      <Link to="/vocabulary" className="small">← Vocabulary</Link>
      <h1>Review</h1>
      {!card ? (
        <div className="card"><Empty icon="🎉" title={done ? `Great work — ${done} word${done === 1 ? '' : 's'} reviewed!` : 'Nothing due right now'}>Come back later; words return just before you'd forget them.</Empty></div>
      ) : (
        <>
          <Progress value={idx} max={cards.length} />
          <div className="card pad-lg center stack" style={{ minHeight: 260, justifyContent: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{card.word} <button className="btn ghost sm" onClick={() => speak(card.word)}>🔊</button></div>
            <div className="small muted">{card.partOfSpeech} {card.ipa}</div>
            {flipped ? (
              <>
                <div style={{ fontSize: '1.1rem' }}>{card.meaning ?? 'No meaning saved.'}</div>
                {card.example && <div className="small muted">“{card.example}”</div>}
                {card.context && <div className="tiny muted">Context: “{card.context}”</div>}
              </>
            ) : (
              <button className="btn" onClick={() => setFlipped(true)}>Show meaning</button>
            )}
          </div>
          {flipped && (
            <div className="grid cols-4">
              <button className="btn danger" onClick={() => rate(1)}>Forgot</button>
              <button className="btn secondary" onClick={() => rate(3)}>Hard</button>
              <button className="btn" onClick={() => rate(4)}>Good</button>
              <button className="btn success" onClick={() => rate(5)}>Easy</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
