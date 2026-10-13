import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import { Avatar, Badge, Button, Card, DemoBadge, EmptyState, Note, Segmented, Tabs } from '../components/ui';
import { DEMO_OPPONENTS, OPPONENT_MAP } from '../data/demoOpponents';
import { GOAL_NAME } from '../data/bodyGoals';
import type { Battle, BattleScoreBreakdown } from '../domain/types';
import { ageCompatible, battleWeeks, challengesForWeek, demoActivity, findMatches, scoreParticipant, SCORING } from '../services/battle';
import { addDays, diffDays, formatDate, startOfWeek } from '../services/dates';
import { acceptInvite, cancelBattle, createBattle, declineInvite } from '../store/actions';
import { useApp } from '../store/AppStore';
import { battleScores, myActivity } from '../store/selectors';
import { STATUS_INFO } from './Streaks';

function ScoringRules() {
  return (
    <Card title="How scoring works">
      <ul className="bullets small">
        <li>Planned sessions kept: up to {SCORING.session} pts per week, proportional to <em>your own</em> schedule (3 days or 5 — same maximum).</li>
        <li>Full warm-ups in those sessions: up to {SCORING.warmup} pts per week.</li>
        <li>Approved weekly challenges: {SCORING.challengeEach} pts each, {SCORING.challengesPerWeek} per week.</li>
        <li>Recovery / mobility sessions: {SCORING.mobilityEach} pts each, max {SCORING.mobilityMaxPerWeek} per week.</li>
        <li>Extra workouts beyond your plan earn nothing. Unwell days are excused for both players. Equal scores are a tie.</li>
      </ul>
      <p className="small muted mb-0">Production note: scores must be computed on a server from verified records — never trusted from the client.</p>
    </Card>
  );
}

function DemoNotice() {
  return (
    <Note tone="warning" title="Development mode — demo opponents">
      BODYQUEST doesn’t have a live multiplayer community yet (no backend is connected). Opponents are clearly-labelled fictional demo users whose activity is simulated on this device. Your own score comes from your real logs.
    </Note>
  );
}

export function BattlesPage() {
  const { data, today, run } = useApp();
  const [tab, setTab] = useState<'dashboard' | 'leaderboard' | 'history'>('dashboard');
  const invites = data.battles.filter((b) => b.status === 'invited');
  const pending = data.battles.filter((b) => b.status === 'pending-acceptance');
  const active = data.battles.filter((b) => b.status === 'active');
  const past = data.battles.filter((b) => ['completed', 'declined', 'cancelled'].includes(b.status));
  return (
    <>
      <PageHead title="Fitness Battles" sub="Compete on consistency with people pursuing similar goals." actions={<Link to="/app/battles/find" className="btn btn-primary"><Icon name="swords" size={18} /> Find an opponent</Link>} />
      <DemoNotice />
      <div className="mt-3">
        <Tabs
          label="Battle sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'dashboard', label: 'Battle dashboard' },
            { value: 'leaderboard', label: 'Leaderboard' },
            { value: 'history', label: `History (${past.length})` },
          ]}
        />
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'dashboard' && (
          <div className="stack-lg">
            {invites.map((b) => {
              const o = OPPONENT_MAP[b.opponentId];
              return (
                <Card key={b.id} title={<h2 style={{ margin: 0 }}>Battle invitation</h2>}>
                  <div className="row">
                    <Avatar emoji={o.avatar.emoji} color={o.avatar.color} />
                    <div className="grow" style={{ flex: 1 }}>
                      <strong>{o.username}</strong> <DemoBadge /> challenged you to a {b.durationDays}-day consistency battle.
                      <div className="small muted">
                        {GOAL_NAME[o.goal]} · {o.experience} · {o.trainingDaysPerWeek} days/week
                      </div>
                    </div>
                    <Button onClick={() => run(acceptInvite, b.id)}>Accept</Button>
                    <Button variant="secondary" onClick={() => run(declineInvite, b.id)}>
                      Decline
                    </Button>
                  </div>
                </Card>
              );
            })}
            {pending.map((b) => {
              const o = OPPONENT_MAP[b.opponentId];
              return (
                <Card key={b.id}>
                  <div className="row">
                    <span className="spinner" aria-hidden="true" />
                    <span style={{ flex: 1 }}>
                      Challenge sent to <strong>{o.username}</strong> <DemoBadge /> — waiting for acceptance (demo users respond within a few seconds).
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => run(cancelBattle, b.id)}>
                      Cancel
                    </Button>
                  </div>
                </Card>
              );
            })}
            {active.length === 0 && invites.length === 0 && pending.length === 0 ? (
              <Card>
                <EmptyState icon="swords" title="No active battles" action={<Link to="/app/battles/find" className="btn btn-primary">Find an opponent</Link>}>
                  Start a 7- or 14-day battle. You’ll score by keeping your own planned sessions.
                </EmptyState>
              </Card>
            ) : (
              <div className="grid-2">
                {active.map((b) => (
                  <BattleSummaryCard key={b.id} battle={b} today={today} />
                ))}
              </div>
            )}
            <ScoringRules />
          </div>
        )}
        {tab === 'leaderboard' && <Leaderboard />}
        {tab === 'history' && (
          <Card title="Battle history">
            {past.length === 0 ? (
              <p className="muted mb-0">No finished battles yet.</p>
            ) : (
              <ul className="list">
                {past.map((b) => {
                  const o = OPPONENT_MAP[b.opponentId];
                  const me = b.result?.scores.find((s) => s.participantId === 'me');
                  const op = b.result?.scores.find((s) => s.participantId !== 'me');
                  return (
                    <li key={b.id} className="list-row">
                      <Avatar emoji={o.avatar.emoji} color={o.avatar.color} size="sm" />
                      <span className="grow">
                        vs <strong>{o.username}</strong> <span className="small muted">· {b.durationDays} days{b.startDate ? ` · from ${formatDate(b.startDate)}` : ''}</span>
                      </span>
                      {b.status === 'completed' && b.result ? (
                        <>
                          <span className="mono small">
                            {me?.total} – {op?.total}
                          </span>
                          <Badge tone={b.result.outcome === 'win' ? 'success' : b.result.outcome === 'tie' ? 'info' : 'battle'}>{b.result.outcome === 'win' ? 'Won' : b.result.outcome === 'tie' ? 'Tie' : 'Lost'}</Badge>
                          <Link to={`/app/battles/${b.id}`} className="btn btn-ghost btn-sm">
                            Results
                          </Link>
                        </>
                      ) : (
                        <Badge>{b.status}</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}

function BattleSummaryCard({ battle, today }: { battle: Battle; today: string }) {
  const { data } = useApp();
  const o = OPPONENT_MAP[battle.opponentId];
  const sc = battleScores(data, battle, today);
  if (!sc) return null;
  const daysLeft = diffDays(battle.endDate!, today) + 1;
  const total = Math.max(1, sc.me.total + sc.opp.total);
  return (
    <Link to={`/app/battles/${battle.id}`} className="card clickable">
      <div className="row-between mb-2">
        <strong>
          vs {o.username} <DemoBadge />
        </strong>
        <Badge>{daysLeft} day{daysLeft === 1 ? '' : 's'} left</Badge>
      </div>
      <div className="versus">
        <div>
          <div className="score">{sc.me.total}</div>
          <div className="small muted">You · {sc.me.consistencyPct}% kept</div>
        </div>
        <div className="vs">VS</div>
        <div>
          <div className="score">{sc.opp.total}</div>
          <div className="small muted">
            {o.username} · {sc.opp.consistencyPct}% kept
          </div>
        </div>
      </div>
      <div className="score-bar mt-2" aria-hidden="true">
        <span className="me" style={{ width: `${(sc.me.total / total) * 100}%` }} />
        <span className="opp" style={{ width: `${(sc.opp.total / total) * 100}%` }} />
      </div>
      <p className="small muted mt-2 mb-0">
        Shared goal: {GOAL_NAME[battle.sharedGoal]} · {sc.me.total > sc.opp.total ? 'You’re leading' : sc.me.total === sc.opp.total ? 'All square' : 'You’re behind — keep your plan!'}
      </p>
    </Link>
  );
}

function Leaderboard() {
  const { data, today } = useApp();
  const ws = startOfWeek(today);
  const league: Battle = { id: `league-${ws}`, status: 'active', createdAt: '', initiatedBy: 'me', opponentId: '', sharedGoal: data.profile!.primaryGoal, durationDays: 7, startDate: ws, endDate: addDays(ws, 6), participants: [] };
  const pool = DEMO_OPPONENTS.filter((o) => ageCompatible(data.profile!.age, o.ageBand));
  const rows = useMemo(() => {
    const r = pool.map((o) => ({ id: o.id, name: o.username, avatar: o.avatar, demo: true, score: scoreParticipant(o.id, league, demoActivity(o, league.id), today) }));
    if (data.settings.showOnLeaderboard) r.push({ id: 'me', name: `${data.profile!.displayName} (you)`, avatar: data.profile!.avatar, demo: false, score: scoreParticipant('me', league, myActivity(data, today), today) });
    return r.sort((a, b) => b.score.total - a.score.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, today]);
  return (
    <div className="stack-lg">
      <Card title={`Weekly consistency league · week of ${formatDate(ws)}`}>
        {!data.settings.showOnLeaderboard && <Note>You’ve hidden yourself from leaderboards in Settings.</Note>}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Player</th>
                <th scope="col">Kept</th>
                <th scope="col">Points</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={r.id === 'me' ? 'me' : ''}>
                  <td>{i + 1}</td>
                  <td>
                    <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                      <Avatar emoji={r.avatar.emoji} color={r.avatar.color} size="sm" />
                      {r.name} {r.demo && <DemoBadge />}
                    </span>
                  </td>
                  <td className="mono">
                    {r.score.keptSessions}/{r.score.scheduledSessions}
                  </td>
                  <td className="mono">
                    <strong>{r.score.total}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted mt-2 mb-0">Ranked by the same capped consistency scoring as battles. Body weight, measurements and photos are never shown on leaderboards.</p>
      </Card>
    </div>
  );
}

export function FindOpponent() {
  const { data, run } = useApp();
  const navigate = useNavigate();
  const [duration, setDuration] = useState<7 | 14>(7);
  const matches = findMatches(data.profile!);
  const open = new Set(data.battles.filter((b) => ['active', 'pending-acceptance', 'invited'].includes(b.status)).map((b) => b.opponentId));
  return (
    <>
      <PageHead title="Find an Opponent" sub="Matched by goal, experience, schedule, session length and recent activity — never by height, weight or appearance." />
      <DemoNotice />
      <Card className="mt-3">
        <div className="row-between">
          <span style={{ fontWeight: 700 }}>Battle length</span>
          <Segmented
            label="Battle duration"
            value={duration}
            onChange={setDuration}
            options={[
              { value: 7, label: '7 days' },
              { value: 14, label: '14 days' },
            ]}
          />
        </div>
        {data.profile!.age < 18 && <p className="small muted mt-2 mb-0">For safety, under-18s are only matched with other under-18 users.</p>}
      </Card>
      <div className="grid-auto mt-3">
        {matches.map((m) => (
          <Card key={m.opponent.id} as="article">
            <div className="row">
              <Avatar emoji={m.opponent.avatar.emoji} color={m.opponent.avatar.color} size="lg" />
              <div style={{ flex: 1 }}>
                <strong>{m.opponent.username}</strong> <DemoBadge />
                <div className="small muted">{m.opponent.bio}</div>
              </div>
            </div>
            <div className="row mt-2" style={{ gap: 6 }}>
              <Badge tone="accent">{GOAL_NAME[m.opponent.goal]}</Badge>
              <Badge>{m.opponent.experience}</Badge>
              <Badge>{m.opponent.trainingDaysPerWeek} days/wk</Badge>
              <Badge>{m.opponent.dailyMinutes} min</Badge>
            </div>
            <div className="mt-2">
              <div className="small" style={{ fontWeight: 700 }}>
                Match {m.score}%
              </div>
              <div className="small muted">{m.reasons.join(' · ') || 'Different goals — still a fair consistency match'}</div>
            </div>
            <Button
              className="mt-2"
              block
              disabled={open.has(m.opponent.id)}
              onClick={() => {
                if (run(createBattle, m.opponent.id, duration)) navigate('/app/battles');
              }}
            >
              {open.has(m.opponent.id) ? 'Battle already open' : `Challenge (${duration} days)`}
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}

function BreakdownTable({ me, opp, oppName }: { me: BattleScoreBreakdown; opp: BattleScoreBreakdown; oppName: string }) {
  const rows: Array<[string, (s: BattleScoreBreakdown) => string]> = [
    ['Planned sessions kept', (s) => `${s.keptSessions}/${s.scheduledSessions} → ${s.sessionPoints} pts`],
    ['Full warm-ups', (s) => `${s.warmups} → ${s.warmupPoints} pts`],
    ['Weekly challenges', (s) => `${s.challenges} → ${s.challengePoints} pts`],
    ['Recovery / mobility', (s) => `${s.mobility} → ${s.mobilityPoints} pts`],
    ['Weekly consistency', (s) => `${s.consistencyPct}%`],
    ['Total', (s) => `${s.total} pts`],
  ];
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">You</th>
            <th scope="col">{oppName}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, f]) => (
            <tr key={k}>
              <td>{k}</td>
              <td className="mono">{f(me)}</td>
              <td className="mono">{f(opp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BattleDetail() {
  const { id } = useParams();
  const { data, today, run } = useApp();
  const b = data.battles.find((x) => x.id === id);
  if (!b) {
    return (
      <EmptyState icon="swords" title="Battle not found" action={<Link className="btn btn-primary" to="/app/battles">All battles</Link>}>
        It may have been cancelled.
      </EmptyState>
    );
  }
  const o = OPPONENT_MAP[b.opponentId];
  const evalDay = b.status === 'completed' ? b.endDate! : today;
  const sc = b.startDate ? (b.result ? { me: b.result.scores.find((s) => s.participantId === 'me')!, opp: b.result.scores.find((s) => s.participantId !== 'me')! } : battleScores(data, b, evalDay)) : null;
  const mine = myActivity(data, today);
  const theirs = demoActivity(o, b.id);
  return (
    <>
      <nav className="small mb-2" aria-label="Breadcrumb">
        <Link to="/app/battles">Fitness Battles</Link> / <span className="muted">vs {o.username}</span>
      </nav>
      <PageHead title={`Battle vs ${o.username}`} sub={`${b.durationDays}-day battle · shared goal: ${GOAL_NAME[b.sharedGoal]}${b.startDate ? ` · ${formatDate(b.startDate)} – ${formatDate(b.endDate!)}` : ''}`} />
      {b.status === 'invited' && (
        <Card className="mb-3">
          <div className="row-between">
            <span>
              {o.username} <DemoBadge /> invited you to this battle.
            </span>
            <div className="row">
              <Button onClick={() => run(acceptInvite, b.id)}>Accept</Button>
              <Button variant="secondary" onClick={() => run(declineInvite, b.id)}>
                Decline
              </Button>
            </div>
          </div>
        </Card>
      )}
      {b.status === 'pending-acceptance' && <Note>Waiting for {o.username} (demo) to accept…</Note>}
      {b.status === 'completed' && b.result && (
        <section className={`card hero mb-3 celebrate`}>
          <h2 style={{ fontSize: '1.6rem' }}>{b.result.outcome === 'win' ? '🏆 You won!' : b.result.outcome === 'tie' ? '🤝 It’s a tie' : `${o.username} won this one`}</h2>
          <p className="muted mb-0">
            {b.result.outcome === 'loss'
              ? 'Every session you kept still built your fitness. Ready for a rematch?'
              : 'Consistency pays off. Great work keeping your plan.'}
          </p>
        </section>
      )}
      {sc && (
        <div className="grid-2">
          <Card title="Battle progress">
            <div className="versus">
              <div>
                <Avatar emoji={data.profile!.avatar.emoji} color={data.profile!.avatar.color} size="lg" />
                <div className="score mt-1">{sc.me.total}</div>
                <div className="small muted">You</div>
              </div>
              <div className="vs">VS</div>
              <div>
                <Avatar emoji={o.avatar.emoji} color={o.avatar.color} size="lg" />
                <div className="score mt-1">{sc.opp.total}</div>
                <div className="small muted">
                  {o.username} <DemoBadge />
                </div>
              </div>
            </div>
            <p className="text-center mt-2 mb-0" style={{ fontWeight: 700 }}>
              Current ranking: {sc.me.total > sc.opp.total ? '1st — you’re ahead' : sc.me.total === sc.opp.total ? 'Tied' : '2nd — within reach'}
            </p>
          </Card>
          <Card title="Score breakdown">
            <BreakdownTable me={sc.me} opp={sc.opp} oppName={o.username} />
          </Card>
        </div>
      )}
      {b.startDate && (
        <div className="grid-2 mt-3">
          <Card title="Weekly challenges">
            {battleWeeks(b).map((w) => (
              <div key={w.index} className="mb-2">
                <div className="small muted" style={{ fontWeight: 700 }}>
                  Week {w.index + 1} ({formatDate(w.days[0])} – {formatDate(w.days[6])})
                </div>
                <ul className="bullets small">
                  {challengesForWeek(b.id, w.index).map((c) => (
                    <li key={c.id}>
                      <strong>{c.title}:</strong> {c.description}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="small muted mb-0">Challenges are verified automatically from your logs — no self-reported scores.</p>
          </Card>
          <Card title="Day by day">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col">You</th>
                    <th scope="col">{o.username}</th>
                  </tr>
                </thead>
                <tbody>
                  {battleWeeks(b)
                    .flatMap((w) => w.days)
                    .map((d) => {
                      const future = diffDays(d, today) > 0;
                      const ms = mine.status(d);
                      const ts = theirs.status(d);
                      return (
                        <tr key={d}>
                          <td className="small">{formatDate(d)}</td>
                          <td className="small">{future ? '—' : STATUS_INFO[ms].label}</td>
                          <td className="small">{future ? '—' : d === today && ts !== 'rest' ? 'Planned' : STATUS_INFO[ts].label}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
      <div className="mt-3">
        <ScoringRules />
      </div>
    </>
  );
}
