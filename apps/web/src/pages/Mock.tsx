import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { errorMessage, formatDate, formatDuration, useApi, useInterval } from '../lib/hooks';
import { IeltsPlayer } from '../components/IeltsPlayer';
import { SpeakingRecorder } from '../components/SpeakingRecorder';
import { PromptCard, WritingEditor } from '../components/WritingEditor';
import { Empty, ErrorBox, Loading, Modal, PageHeader, Unofficial } from '../components/ui';
import { IeltsTabs } from './Ielts';

const SKILL_ICON: Record<string, string> = { listening: '🎧', reading: '📖', writing: '✍️', speaking: '🗣️' };

export function MockListPage() {
  const nav = useNavigate();
  const { data, error, loading, reload } = useApi<any>('/ielts/mocks');
  const [chosen, setChosen] = useState<any>(null);
  const [strict, setStrict] = useState(true);
  const [skills, setSkills] = useState<string[]>(['listening', 'reading', 'writing', 'speaking']);
  const [err, setErr] = useState<string | null>(null);
  const start = async () => {
    setErr(null);
    try {
      const r = await api.post<{ id: string }>(`/ielts/mocks/${chosen.slug}/start`, { strict, skills });
      nav(`/ielts/mock/${r.id}`);
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <div className="stack lg">
      <PageHeader title="Mock tests" subtitle="Complete or partial practice tests under timed conditions." />
      <IeltsTabs />
      <ErrorBox error={error} onRetry={reload} />
      {loading ? <Loading /> : (
        <>
          <div className="small muted">{data.quota.limit == null ? 'Unlimited mock tests on your plan.' : `${data.quota.usedLast30Days} of ${data.quota.limit} mock test(s) used in the last 30 days.`}</div>
          {!data.aiFeedback && <div className="alert info small">Listening and Reading are scored automatically. Writing and Speaking need AI feedback, which is not configured on this server, so those sections will be recorded but not given a band.</div>}
          <div className="grid cols-2">
            {data.tests.map((t: any) => (
              <div key={t.slug} className="card stack">
                <h3>{t.title}</h3>
                <p className="small muted">{t.description}</p>
                <div className="row wrap small">{t.sections.map((s: any) => <span key={s.skill} className="badge">{SKILL_ICON[s.skill]} {s.skill} · {Math.round(s.timeLimitSec / 60)} min</span>)}</div>
                <button className="btn" onClick={() => { setChosen(t); setErr(null); }} data-testid={`mock-${t.slug}`}>Start</button>
              </div>
            ))}
          </div>
          <div className="card">
            <h3>Mock test history</h3>
            {!data.attempts.length ? <Empty icon="📝" title="No mock tests yet" /> : (
              <table className="table"><thead><tr><th>Test</th><th>Started</th><th>Sections</th><th>Status</th><th>Overall</th></tr></thead><tbody>
                {data.attempts.map((a: any) => (
                  <tr key={a.id}>
                    <td><Link to={`/ielts/mock/${a.id}`}>{a.title}</Link>{a.strict ? '' : <div className="tiny muted">relaxed timing</div>}</td>
                    <td>{formatDate(a.started_at)}</td>
                    <td className="small">{a.sections.map((s: any) => `${s.skill} ${s.result?.band ?? (s.status === 'submitted' ? '—' : '…')}`).join(' · ')}</td>
                    <td>{a.status}</td>
                    <td><b>{a.overall_band ?? '—'}</b></td>
                  </tr>
                ))}
              </tbody></table>
            )}
          </div>
        </>
      )}
      <Modal open={!!chosen} onClose={() => setChosen(null)} title={chosen?.title ?? ''}>
        <div className="stack">
          <div className="small">Choose sections:</div>
          <div className="row wrap">
            {['listening', 'reading', 'writing', 'speaking'].map((s) => (
              <button key={s} className={`chip ${skills.includes(s) ? 'on' : ''}`} onClick={() => setSkills((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]))}>{SKILL_ICON[s]} {s}</button>
            ))}
          </div>
          <label className="row small"><input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} /> Strict test conditions (timers enforced, audio plays once, no going back)</label>
          <div className="small muted">Sections run in order. Once you submit a section you cannot return to it.</div>
          <ErrorBox error={err} />
          <button className="btn" disabled={!skills.length} onClick={start} data-testid="mock-begin">Begin test</button>
        </div>
      </Modal>
    </div>
  );
}

export function MockRunnerPage() {
  const { id } = useParams();
  const [m, setM] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [part, setPart] = useState(0);
  const [now, setNow] = useState(Date.now());
  useInterval(() => setNow(Date.now()), 1000);
  const load = useCallback(async () => {
    try {
      setM(await api.get(`/ielts/mock-attempts/${id}`));
      setPart(0);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  const cur = m?.current;
  const remaining = cur?.deadline ? Math.floor((Date.parse(cur.deadline) - now) / 1000) : null;
  useEffect(() => {
    // Time is up: the server auto-submits on the next fetch.
    if (remaining !== null && remaining < -2) void load();
  }, [remaining, load]);

  const submitSection = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/ielts/mock-attempts/${id}/sections/${cur.index}/submit`);
      setConfirm(false);
      await load();
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (err && !m) return <ErrorBox error={err} />;
  if (!m) return <Loading />;
  return (
    <div className="stack">
      <div className="row between wrap">
        <div>
          <Link to="/ielts/mock" className="small">← Mock tests</Link>
          <h1 style={{ margin: 0 }}>{m.title}</h1>
        </div>
        <div className="row wrap">
          {m.sections.map((s: any, i: number) => (
            <span key={i} className={`badge ${s.status === 'active' ? 'primary' : s.status === 'submitted' ? 'success' : ''}`}>
              {SKILL_ICON[s.skill]} {s.skill}{s.status === 'submitted' ? ` ✓${s.result?.band != null ? ` ${s.result.band}` : ''}` : ''}
            </span>
          ))}
        </div>
      </div>
      <ErrorBox error={err} />
      {m.status !== 'in_progress' ? (
        <div className="card pad-lg stack" data-testid="mock-results">
          <h2>{m.status === 'completed' ? 'Results' : 'Test abandoned'}</h2>
          <div className="grid cols-4">
            {m.sections.map((s: any) => (
              <div key={s.skill} className="card flat">
                <div className="small muted">{SKILL_ICON[s.skill]} {s.skill}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{s.result?.band ?? '—'}</div>
                {s.result?.raw != null && <div className="small">{s.result.raw}/{s.result.total} correct</div>}
                {s.result?.note && <div className="tiny muted">{s.result.note}</div>}
                {s.attemptIds.map((a: string, i: number) => <Link key={a} className="tiny" to={`/ielts/practice/${a}`}>Review part {i + 1} </Link>)}
                {s.submissionIds.map((w: string, i: number) => <Link key={w} className="tiny" to={`/ielts/writing/result/${w}`}>Task {i + 1} feedback </Link>)}
              </div>
            ))}
          </div>
          <div className="row"><b>Overall band:</b> <span style={{ fontSize: '1.4rem', fontWeight: 800 }} data-testid="mock-overall">{m.overallBand ?? 'Not available'}</span></div>
          {m.overallBand == null && <div className="small muted">An overall band needs a score in all four sections.</div>}
          <Unofficial />
        </div>
      ) : cur && (
        <div className="stack">
          <div className="card row between wrap">
            <div><b>{SKILL_ICON[cur.skill]} {cur.skill[0].toUpperCase() + cur.skill.slice(1)} section</b> <span className="small muted">({formatDuration(cur.timeLimitSec)})</span></div>
            <div className="row">
              {remaining !== null && <span className={`timer ${remaining < 120 ? 'low' : ''}`} data-testid="mock-timer">⏱ {formatDuration(Math.max(0, remaining))}</span>}
              <button className="btn" onClick={() => setConfirm(true)} data-testid="mock-submit-section">Submit section</button>
            </div>
          </div>
          {(cur.skill === 'listening' || cur.skill === 'reading') && (
            <>
              <div className="tabs">
                {cur.attempts.map((a: any, i: number) => (
                  <button key={a.id} className={part === i ? 'on' : ''} onClick={() => setPart(i)}>{cur.skill === 'listening' ? `Part ${i + 1}` : `Passage ${i + 1}`}</button>
                ))}
              </div>
              {cur.attempts.map((a: any, i: number) => (
                <div key={a.id} style={{ display: part === i ? 'block' : 'none' }}>
                  <IeltsPlayer attempt={a} embedded strictAudio={m.strict} />
                </div>
              ))}
            </>
          )}
          {cur.skill === 'writing' && (
            <>
              <div className="tabs">{cur.submissions.map((s: any, i: number) => <button key={s.id} className={part === i ? 'on' : ''} onClick={() => setPart(i)}>Task {s.prompt.task}</button>)}</div>
              {cur.submissions.map((s: any, i: number) => (
                <div key={s.id} className="writing-layout" style={{ display: part === i ? 'grid' : 'none' }}>
                  <PromptCard prompt={s.prompt} />
                  <div className="card"><WritingEditor prompt={s.prompt} initialText={s.text} submissionId={s.id} mockAttemptId={m.id} deadline={cur.deadline} /></div>
                </div>
              ))}
              <div className="small muted">Task 2 is worth twice as much as Task 1. Spend about 20 minutes on Task 1 and 40 on Task 2.</div>
            </>
          )}
          {cur.skill === 'speaking' && (
            <div className="stack">
              <div className="alert info small">Answer each part aloud. In the real test an examiner asks the questions; here you answer one representative question per part.</div>
              {cur.prompts.map((p: any) => {
                const done = cur.answered.filter((a: any) => a.part === p.part);
                const q = p.part === 2 ? p.text : p.questions[0];
                return (
                  <div key={p.id} className="card stack">
                    <div className="row between"><b>Part {p.part} · {p.topic}</b>{done.length > 0 && <span className="badge success">Answered</span>}</div>
                    <h3>{q}</h3>
                    {p.part === 2 && <ul className="small">{p.bullets.map((b: string) => <li key={b}>{b}</li>)}</ul>}
                    <SpeakingRecorder part={p.part} question={q} promptId={p.id} prepSeconds={p.part === 2 ? 60 : 0} speakSeconds={p.part === 2 ? 120 : 90} serverStt={false} mockAttemptId={m.id} onResult={() => void load()} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Submit this section?">
        <p>Your saved answers will be submitted and you'll move to the next section. You can't come back to this section.</p>
        <div className="row"><button className="btn" disabled={busy} onClick={submitSection} data-testid="mock-confirm-submit">{busy ? 'Submitting…' : 'Submit section'}</button><button className="btn secondary" onClick={() => setConfirm(false)}>Keep working</button></div>
      </Modal>
    </div>
  );
}
