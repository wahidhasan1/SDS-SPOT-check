import { Link } from 'react-router-dom';
import { CEFR_LABELS, NOTICE_UNOFFICIAL } from '@app/shared';
import { useAuth } from '../lib/auth';
import { formatDate, formatDuration, useApi } from '../lib/hooks';
import { ActivityBars, BandMeter } from '../components/Charts';
import { Empty, ErrorBox, LevelBadge, Loading } from '../components/ui';

const ACTIVITY_LABEL: Record<string, string> = {
  call: '🎙️ Speaking call', ielts_reading: '📖 IELTS Reading', ielts_listening: '🎧 IELTS Listening', ielts_writing: '✍️ IELTS Writing',
  ielts_speaking: '🗣️ Speaking practice', vocab_review: '🔁 Vocabulary review', quiz: '❓ Vocabulary quiz', grammar: '✍️ Grammar lesson',
  battle: '⚔️ Battle', assessment: '🧭 Placement test', mock_test: '📝 Mock test',
};

export function HomePage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<any>('/me/dashboard');
  const daily = useApi<any>('/vocabulary/daily');
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const d = data;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <div className="stack lg">
      <div className="row between wrap">
        <div>
          <h1 style={{ marginBottom: 2 }}>{greet}, {user?.displayName}</h1>
          <div className="row wrap small muted">
            <LevelBadge level={user?.cefrLevel} />
            {user?.cefrLevel && <span>{CEFR_LABELS[user.cefrLevel]}</span>}
            <span>· 🔥 {d.profile.streakDays}-day streak</span>
            {user?.testType !== 'none' && user?.targetBand && <span>· 🎯 Target band {user.targetBand}</span>}
          </div>
        </div>
        {!user?.cefrLevel && <Link to="/assessment" className="btn">🧭 Take placement test</Link>}
      </div>

      <div className="hero" data-testid="home-hero">
        <div>
          <h2>🎧 Find a Speaking Partner</h2>
          <p>Practise with a real learner right now — anonymous, safe, and matched to your level.</p>
        </div>
        <Link to="/speaking" className="btn lg" data-testid="find-partner">Find a partner</Link>
      </div>

      <div className="grid cols-4">
        <Link className="tile" to="/ielts"><span className="ico">🎯</span><span className="t">Start IELTS practice</span><span className="small muted">Reading, listening, writing, speaking</span></Link>
        <Link className="tile" to="/ielts/speaking"><span className="ico">🤖</span><span className="t">Practise with AI</span><span className="small muted">Solo speaking with feedback</span></Link>
        <Link className="tile" to="/battles"><span className="ico">⚔️</span><span className="t">Vocabulary battle</span><span className="small muted">Real-time quiz duels</span></Link>
        <Link className="tile" to="/read"><span className="ico">📷</span><span className="t">Read with AI</span><span className="small muted">Photograph a page, tap a word</span></Link>
      </div>

      <div className="grid cols-3" style={{ alignItems: 'start' }}>
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3>Continue learning</h3>
          {d.recommendations.length === 0 ? <Empty title="You're all caught up!" /> : (
            <div className="list">
              {d.recommendations.map((r: any) => (
                <Link key={r.id} to={r.href} className="list-item" style={{ color: 'var(--text)', textDecoration: 'none' }}>
                  <span style={{ fontSize: 24 }}>{r.icon}</span>
                  <div style={{ flex: 1 }}><b>{r.title}</b><div className="small muted">{r.reason}</div></div>
                  <span className="muted">→</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3>Words of the day</h3>
          {daily.loading ? <Loading /> : (
            <div className="list">
              {(daily.data?.words ?? []).map((w: any) => (
                <div key={w.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <b>{w.word}</b> <span className="tiny muted">{w.partOfSpeech} · {w.cefr}</span>
                    <div className="small muted">{w.meaning}</div>
                  </div>
                </div>
              ))}
              <Link to="/vocabulary" className="small mt">Open vocabulary →</Link>
            </div>
          )}
        </div>
      </div>

      <div className="grid cols-3" style={{ alignItems: 'start' }}>
        <div className="card stack">
          <div className="row between"><h3 style={{ margin: 0 }}>IELTS skills</h3><Link to="/progress" className="small">Details</Link></div>
          {(['listening', 'reading', 'writing', 'speaking'] as const).map((k) => (
            <BandMeter key={k} label={k[0].toUpperCase() + k.slice(1)} band={d.ielts.skills[k].band} target={d.ielts.targetBand}
              sub={d.ielts.skills[k].practiceCount ? `${d.ielts.skills[k].practiceCount} practice${d.ielts.skills[k].practiceCount === 1 ? '' : 's'}` : 'No practice yet'} />
          ))}
          <p className="disclaimer">{NOTICE_UNOFFICIAL}</p>
        </div>
        <div className="card">
          <h3>This week</h3>
          <ActivityBars data={d.weeklyActivity} />
          <div className="grid cols-2 mt">
            <div className="stat"><span className="v">{d.calls.completed}</span><span className="l">Calls · {formatDuration(d.calls.seconds)} total</span></div>
            <div className="stat"><span className="v">{d.vocabulary.saved}</span><span className="l">Saved words ({d.vocabulary.mastered} mastered)</span></div>
            <div className="stat"><span className="v">{d.grammar.mastered}/{d.grammar.total}</span><span className="l">Grammar lessons mastered</span></div>
            <div className="stat"><span className="v">{d.battles.rating}</span><span className="l">Battle rating · {d.battles.played} played</span></div>
          </div>
        </div>
        <div className="card">
          <h3>Recent activity</h3>
          {d.recentActivity.length === 0 ? <Empty icon="🌱" title="Nothing yet">Your completed practice will appear here.</Empty> : (
            <div className="list">
              {d.recentActivity.map((a: any, i: number) => (
                <div key={i} className="list-item small">
                  <span style={{ flex: 1 }}>{ACTIVITY_LABEL[a.kind] ?? a.kind}{a.meta?.band != null ? ` · band ${a.meta.band}` : a.meta?.score != null && a.meta?.total ? ` · ${a.meta.score}/${a.meta.total}` : ''}</span>
                  <span className="tiny muted">{formatDate(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProgressPage() {
  const { data, error, loading, reload } = useApi<any>('/me/dashboard');
  const plan = useApi<any>('/me/study-plan');
  const hist = useApi<any[]>('/ielts/history');
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const d = data;
  return (
    <div className="stack lg">
      <h1>Your progress</h1>
      <p className="muted">Four separate measures are tracked on purpose: your English level (placement), IELTS practice estimates, vocabulary & grammar performance, and battle rating.</p>
      <div className="grid cols-4">
        <div className="card stat"><span className="l">English level (placement)</span><span className="v">{d.profile.cefrLevel ?? '—'}</span><span className="tiny muted">{d.levelHistory.length} assessment{d.levelHistory.length === 1 ? '' : 's'}</span></div>
        <div className="card stat"><span className="l">IELTS estimate (all 4 skills)</span><span className="v">{d.ielts.estimatedOverall ?? '—'}</span><span className="tiny muted">{d.ielts.estimatedOverall ? 'Unofficial' : 'Needs scored practice in every skill'}</span></div>
        <div className="card stat"><span className="l">Vocabulary</span><span className="v">{d.vocabulary.mastered}/{d.vocabulary.saved}</span><span className="tiny muted">mastered / saved · {d.grammar.avgScore ?? '—'}% grammar avg</span></div>
        <div className="card stat"><span className="l">Battle rating</span><span className="v">{d.battles.rating}</span><span className="tiny muted">{d.battles.wins} wins / {d.battles.played} played</span></div>
      </div>
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="card stack">
          <h3>IELTS skills</h3>
          {(['listening', 'reading', 'writing', 'speaking'] as const).map((k) => (
            <BandMeter key={k} label={k[0].toUpperCase() + k.slice(1)} band={d.ielts.skills[k].band} target={d.ielts.targetBand}
              sub={`${d.ielts.skills[k].scoredSamples} scored of ${d.ielts.skills[k].practiceCount} practice${d.ielts.skills[k].practiceCount === 1 ? '' : 's'}${k === 'writing' || k === 'speaking' ? ' (scores need AI feedback)' : ''}`} />
          ))}
          <p className="disclaimer">{d.ielts.notice}</p>
        </div>
        <div className="card">
          <h3>Weekly study plan</h3>
          {plan.loading ? <Loading /> : plan.data && (
            <div className="list">
              {plan.data.week.map((w: any) => (
                <div key={w.day} className="list-item small"><b style={{ width: 100 }}>{w.day}</b><span style={{ flex: 1 }}>{w.focus.replace('_', ' ')}</span><span className="muted">{w.minutes} min</span></div>
              ))}
              <div className="tiny muted mt">{plan.data.note}</div>
            </div>
          )}
        </div>
      </div>
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h3>Level history</h3>
          {d.levelHistory.length === 0 ? <Empty icon="🧭" title="No placement test yet"><Link to="/assessment">Take the test</Link></Empty> : (
            <table className="table"><tbody>{[...d.levelHistory].reverse().map((l: any, i: number) => <tr key={i}><td>{formatDate(l.created_at)}</td><td><b>{l.level}</b></td></tr>)}</tbody></table>
          )}
          <Link to="/assessment" className="btn secondary sm mt">Retake placement test</Link>
        </div>
        <div className="card">
          <h3>Mock tests</h3>
          {d.mockTests.length === 0 ? <Empty icon="📝" title="No mock tests yet"><Link to="/ielts/mock">Try one</Link></Empty> : (
            <table className="table"><thead><tr><th>Test</th><th>Status</th><th>Overall</th></tr></thead><tbody>
              {d.mockTests.map((m: any) => <tr key={m.id}><td><Link to={`/ielts/mock/${m.id}`}>{m.title}</Link></td><td>{m.status}</td><td>{m.overall_band ?? '—'}</td></tr>)}
            </tbody></table>
          )}
        </div>
      </div>
      <div className="card">
        <h3>IELTS practice history</h3>
        {hist.loading ? <Loading /> : !hist.data?.length ? <Empty title="No practice yet" /> : (
          <table className="table"><thead><tr><th>Date</th><th>Set</th><th>Mode</th><th>Score</th><th>Band</th><th>Time</th></tr></thead><tbody>
            {hist.data.map((h: any) => (
              <tr key={h.id}>
                <td>{formatDate(h.started_at)}</td>
                <td><Link to={`/ielts/practice/${h.id}`}>{h.title}</Link><div className="tiny muted">{h.skill}</div></td>
                <td>{h.mode}</td>
                <td>{h.status === 'submitted' ? `${h.score}/${h.total}` : 'In progress'}</td>
                <td>{h.band ?? '—'}</td>
                <td>{formatDuration(h.elapsed_sec)}</td>
              </tr>
            ))}
          </tbody></table>
        )}
      </div>
    </div>
  );
}
