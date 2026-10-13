import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { NOTICE_UNOFFICIAL } from '@app/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { errorMessage, formatDuration, useApi } from '../lib/hooks';
import { BandMeter } from '../components/Charts';
import { IeltsPlayer, type AttemptDto } from '../components/IeltsPlayer';
import { Empty, ErrorBox, Loading, PageHeader } from '../components/ui';

export function IeltsTabs() {
  const tabs = [
    ['/ielts', 'Overview'], ['/ielts/reading', 'Reading'], ['/ielts/listening', 'Listening'], ['/ielts/writing', 'Writing'],
    ['/ielts/speaking', 'Speaking'], ['/ielts/mock', 'Mock tests'],
  ];
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([to, l]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => ''} style={{ textDecoration: 'none' }}>
          {({ isActive }) => <button className={isActive ? 'on' : ''} role="tab" aria-selected={isActive}>{l}</button>}
        </NavLink>
      ))}
    </div>
  );
}

function TestTypeSwitch() {
  const { user, setUser } = useAuth();
  const set = async (testType: 'academic' | 'general') => setUser(await api.patch('/me', { testType }));
  return (
    <div className="row small">
      <span className="muted">Test type:</span>
      <button className={`chip ${user?.testType !== 'general' ? 'on' : ''}`} onClick={() => set('academic')}>Academic</button>
      <button className={`chip ${user?.testType === 'general' ? 'on' : ''}`} onClick={() => set('general')}>General Training</button>
    </div>
  );
}

export function IeltsHome() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi<any>('/me/dashboard');
  return (
    <div className="stack lg">
      <PageHeader title="IELTS preparation" subtitle={NOTICE_UNOFFICIAL} actions={<TestTypeSwitch />} />
      <IeltsTabs />
      <ErrorBox error={error} onRetry={reload} />
      {loading ? <Loading /> : data && (
        <div className="grid cols-3" style={{ alignItems: 'start' }}>
          <div className="card stack" style={{ gridColumn: 'span 2' }}>
            <div className="row between"><h3 style={{ margin: 0 }}>Your skills</h3><span className="small muted">Target: {user?.targetBand ?? 'not set'}</span></div>
            <div className="grid cols-2">
              {(['listening', 'reading', 'writing', 'speaking'] as const).map((k) => (
                <BandMeter key={k} label={k[0].toUpperCase() + k.slice(1)} band={data.ielts.skills[k].band} target={data.ielts.targetBand} sub={`${data.ielts.skills[k].practiceCount} practice session(s)`} />
              ))}
            </div>
            <div className="small">Estimated overall: <b>{data.ielts.estimatedOverall ?? 'needs a scored result in all four skills'}</b></div>
          </div>
          <div className="card">
            <h3>Areas to improve</h3>
            <div className="list">
              {data.recommendations.map((r: any) => (
                <Link key={r.id} to={r.href} className="list-item" style={{ color: 'var(--text)' }}><span>{r.icon}</span><span className="small" style={{ flex: 1 }}>{r.title}</span></Link>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="grid cols-3">
        <Link className="tile" to="/ielts/reading"><span className="ico">📖</span><span className="t">Reading</span><span className="small muted">Passages with all major question types</span></Link>
        <Link className="tile" to="/ielts/listening"><span className="ico">🎧</span><span className="t">Listening</span><span className="small muted">Four sections with real audio</span></Link>
        <Link className="tile" to="/ielts/writing"><span className="ico">✍️</span><span className="t">Writing</span><span className="small muted">Task 1 and Task 2 with feedback</span></Link>
        <Link className="tile" to="/ielts/speaking"><span className="ico">🗣️</span><span className="t">Speaking</span><span className="small muted">Parts 1–3 with timers and transcripts</span></Link>
        <Link className="tile" to="/ielts/mock"><span className="ico">📝</span><span className="t">Mock tests</span><span className="small muted">Full timed practice tests</span></Link>
        <Link className="tile" to="/speaking"><span className="ico">🤝</span><span className="t">Speaking partner</span><span className="small muted">Practise the test format with a real person</span></Link>
      </div>
    </div>
  );
}

export function SetList({ skill }: { skill: 'reading' | 'listening' }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const tt = user?.testType === 'general' ? 'general' : 'academic';
  const { data, error, loading, reload } = useApi<any[]>(`/ielts/sets?skill=${skill}${skill === 'reading' ? `&testType=${tt}` : ''}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const start = async (slug: string, mode: 'practice' | 'timed') => {
    setBusy(slug + mode);
    setErr(null);
    try {
      const r = await api.post<{ attempt: AttemptDto }>(`/ielts/sets/${slug}/attempts`, { mode });
      nav(`/ielts/practice/${r.attempt.id}`);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="stack lg">
      <PageHeader title={`IELTS ${skill === 'reading' ? 'Reading' : 'Listening'}`} subtitle={skill === 'reading' ? `${tt === 'general' ? 'General Training' : 'Academic'} passages` : 'Listening sections are the same for Academic and General Training.'} actions={skill === 'reading' ? <TestTypeSwitch /> : undefined} />
      <IeltsTabs />
      <ErrorBox error={error ?? err} onRetry={reload} />
      {loading ? <Loading /> : !data?.length ? <Empty title="No practice sets available yet" /> : (
        <div className="grid cols-2">
          {data.map((s) => (
            <div key={s.slug} className="card stack" data-testid={`set-${s.slug}`}>
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ marginBottom: 4 }}>{s.title}</h3>
                  <div className="small muted">{s.description}</div>
                </div>
                {s.isPremium && <span className="badge warning">Premium</span>}
              </div>
              <div className="row wrap small muted">
                <span>{s.questionCount} questions</span>·<span>{formatDuration(s.timeLimitSec)} suggested</span>·<span>{s.difficulty}</span>
              </div>
              {s.lastAttempt && (
                <div className="small">
                  Last: {s.lastAttempt.status === 'submitted' ? <>{s.lastAttempt.score}/{s.lastAttempt.total}{s.lastAttempt.band != null ? ` · band ${s.lastAttempt.band}` : ''} · <Link to={`/ielts/practice/${s.lastAttempt.id}`}>Review</Link></> : <>in progress · <Link to={`/ielts/practice/${s.lastAttempt.id}`}>Resume</Link></>}
                </div>
              )}
              <div className="row wrap">
                <button className="btn" disabled={!!busy} onClick={() => start(s.slug, 'practice')} data-testid={`practice-${s.slug}`}>Practice</button>
                <button className="btn secondary" disabled={!!busy} onClick={() => start(s.slug, 'timed')}>Timed test</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PracticePage() {
  const { id } = useParams();
  const [attempt, setAttempt] = useState<AttemptDto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.get<AttemptDto>(`/ielts/attempts/${id}`).then(setAttempt).catch((e) => setErr(errorMessage(e)));
  }, [id]);
  if (err) return <ErrorBox error={err} />;
  if (!attempt) return <Loading />;
  if (attempt.mockAttemptId && attempt.status !== 'submitted') return <div className="card">This set belongs to a mock test. <Link to={`/ielts/mock/${attempt.mockAttemptId}`}>Open the mock test</Link></div>;
  return (
    <div className="stack">
      <div className="row"><Link to={`/ielts/${attempt.set.skill}`} className="small">← Back to {attempt.set.skill}</Link></div>
      <IeltsPlayer key={attempt.id} attempt={attempt} />
    </div>
  );
}
