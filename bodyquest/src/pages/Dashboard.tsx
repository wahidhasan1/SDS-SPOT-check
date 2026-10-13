import { Link, useNavigate } from 'react-router-dom';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import { Avatar, Badge, Button, Card, Note, ProgressBar, Ring } from '../components/ui';
import { ACHIEVEMENT_MAP } from '../data/achievements';
import { OPPONENT_MAP } from '../data/demoOpponents';
import { EXERCISE_MAP } from '../data/exercises';
import { addDays, formatDate, startOfWeek, WEEKDAY_SHORT, weekdayOf } from '../services/dates';
import { fmtApprox } from '../services/nutrition';
import { dayStatus, templateForDate } from '../services/schedule';
import { TEMPLATES } from '../services/workoutGenerator';
import { acceptProgression, dismissProgression, startPlanned } from '../store/actions';
import { useApp } from '../store/AppStore';
import { useDerived } from '../store/hooks';
import { sessionsCompleted } from '../services/analytics';
import { MissionList } from './Checklist';

function greeting(hour: number) {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { data, today, now, run } = useApp();
  const d = useDerived();
  const navigate = useNavigate();
  const completedCount = sessionsCompleted(data.sessions, 'planned');
  const doneToday = d.todayStatus === 'completed';
  const inProgress = d.todaySession && (d.todaySession.status === 'in-progress' || d.todaySession.status === 'paused');

  let message: string;
  if (d.overdue.length) message = 'Life happens. Choose a comeback option below and keep moving — you never need to double up workouts.';
  else if (doneToday) message = 'Today’s work is done. Refuel, hydrate and sleep well — that’s where progress happens.';
  else if (completedCount === 0) message = 'Day one of your quest. Every journey starts with a single session — let’s make it a good one.';
  else if (!d.todayWorkout) message = 'Rest day. Recovery is part of the plan — your streak is safe.';
  else if (d.streak.current >= 3) message = `${d.streak.current} planned sessions in a row. That’s real consistency — keep the chain going.`;
  else message = 'Show up, warm up, and do today’s session at a quality you’re proud of.';

  const weekStart = startOfWeek(today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const suggestions = Object.values(data.progressions).filter((p) => p.suggestion);
  const recent = [...data.achievements].sort((a, b) => (a.unlockedAt < b.unlockedAt ? 1 : -1)).slice(0, 3);
  const hydPct = d.hydration.target ? d.hydration.total / d.hydration.target.ml : 0;
  const checklistDone = d.missions.daily.filter((m) => m.complete).length;

  const startToday = () => {
    if (inProgress || run(startPlanned, today)) navigate('/app/workout');
  };

  return (
    <>
      <PageHead title="Dashboard" />
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <section className="card hero" aria-labelledby="greet">
          <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
            <Avatar emoji={d.profile.avatar.emoji} color={d.profile.avatar.color} size="lg" />
            <div style={{ flex: 1, minWidth: 200 }}>
              <h2 id="greet" style={{ fontSize: '1.5rem', marginBottom: 4 }}>
                {greeting(new Date(now()).getHours())}, {d.profile.displayName.split(' ')[0]}
              </h2>
              <p className="muted" style={{ marginBottom: 12 }}>{message}</p>
              <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                <span className="badge badge-xp">
                  Level {d.level.level} · {d.level.title}
                </span>
                <span className="small muted">
                  {d.xp - d.level.current} / {d.level.next - d.level.current} XP to level {d.level.level + 1}
                </span>
              </div>
              <div style={{ maxWidth: 420 }}>
                <ProgressBar value={d.level.progress} label="XP progress to next level" variant="xp" />
              </div>
            </div>
            <div className="stack" style={{ minWidth: 220 }}>
              {d.todayWorkout && !doneToday ? (
                <Button size="lg" icon="play" onClick={startToday}>
                  {inProgress ? 'Resume Today’s Workout' : 'Start Today’s Workout'}
                </Button>
              ) : doneToday ? (
                <Link to="/app/workout" className="btn btn-primary btn-lg">
                  <Icon name="check" /> Workout complete
                </Link>
              ) : (
                <Link to="/app/workout?mode=mobility" className="btn btn-primary btn-lg">
                  <Icon name="heart" /> Optional mobility session
                </Link>
              )}
              <Link to="/app/coach" className="btn btn-secondary">
                <Icon name="chat" size={18} /> Ask the coach
              </Link>
            </div>
          </div>
        </section>

        {d.overdue.length > 0 && (
          <Note tone="warning" title={`${d.overdue.length} session${d.overdue.length > 1 ? 's' : ''} need${d.overdue.length > 1 ? '' : 's'} a decision`}>
            {d.overdue.map((x) => formatDate(x)).join(', ')} wasn’t completed. <Link to="/app/streaks">Choose a recovery option</Link> — reschedule, a light comeback session, a recovery token, or mark it as an unwell day.
          </Note>
        )}
        {d.movedHere.length > 0 && <Note tone="accent">You moved a session to today. Open Today’s Workout to complete it.</Note>}

        <div className="grid-4">
          <Card>
            <div className="stat-card">
              <span className="stat-icon" style={{ background: 'var(--streak-soft)', color: 'var(--streak)' }}>
                <Icon name="flame" />
              </span>
              <div className="stat">
                <span className="value">{d.streak.current}</span>
                <span className="label">Session streak · best {d.streak.longest}</span>
              </div>
            </div>
          </Card>
          <Card>
            <div className="stat-card">
              <span className="stat-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
                <Icon name="calendar" />
              </span>
              <div className="stat">
                <span className="value">
                  {d.streak.weekKept}/{d.ctx ? week.filter((x) => templateForDate(d.plan, x)).length : 0}
                </span>
                <span className="label">Sessions kept this week</span>
              </div>
            </div>
          </Card>
          <Card>
            <div className="stat-card">
              <span className="stat-icon" style={{ background: 'var(--xp-soft)', color: 'var(--xp)' }}>
                <Icon name="zap" />
              </span>
              <div className="stat">
                <span className="value">{d.xp}</span>
                <span className="label">Total XP</span>
              </div>
            </div>
          </Card>
          <Card>
            <div className="stat-card">
              <span className="stat-icon" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}>
                <Icon name="moon" />
              </span>
              <div className="stat">
                <span className="value" style={{ fontSize: '1.15rem' }}>{d.nextRest ? (d.nextRest === today ? 'Today' : formatDate(d.nextRest, { weekday: 'long' })) : '—'}</span>
                <span className="label">Next rest day</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid-3">
          <Card title="Today’s workout" action={<Link to="/app/workout" className="btn btn-ghost btn-sm">Open <Icon name="chevronRight" size={16} /></Link>} className="span-2">
            {d.todayWorkout ? (
              <div className="stack">
                <div className="row-between">
                  <div>
                    <h3 className="mb-0" style={{ fontSize: '1.3rem' }}>{d.todayWorkout.title}</h3>
                    <p className="muted small mb-0">{d.todayWorkout.objective}</p>
                  </div>
                  {doneToday ? <Badge tone="success">Completed</Badge> : inProgress ? <Badge tone="warning">In progress</Badge> : <Badge tone="xp">Up to {d.todayWorkout.xpAvailable} XP</Badge>}
                </div>
                <div className="row">
                  <Badge>
                    <Icon name="clock" size={13} /> ~{d.todayWorkout.estimatedMinutes} min
                  </Badge>
                  <Badge>{d.todayWorkout.phaseName} phase</Badge>
                  {d.todayWorkout.isDeloadWeek && <Badge tone="info">Deload week</Badge>}
                  <Badge tone={d.todayWorkout.intensity === 'hard' ? 'streak' : 'success'}>{d.todayWorkout.intensity}</Badge>
                </div>
                <ul className="list">
                  {d.todayWorkout.exercises
                    .filter((e) => e.block === 'main')
                    .map((e) => (
                      <li key={e.id} className="list-row">
                        <span className="grow">{EXERCISE_MAP[e.exerciseId].name}</span>
                        <span className="small muted mono">
                          {e.sets} × {e.reps ? `${e.reps[0]}–${e.reps[1]}` : `${e.seconds}s`}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : (
              <div className="stack">
                <h3 className="mb-0">Rest day</h3>
                <p className="muted mb-0">
                  Scheduled rest never breaks your streak. Next session: {d.next ? `${d.next.workout.title} on ${formatDate(d.next.date)}` : '—'}.
                </p>
                <Link to="/app/workout?mode=mobility" className="btn btn-secondary">
                  Optional 15-min mobility
                </Link>
              </div>
            )}
          </Card>
          <Card title="Daily checklist" action={<Link to="/app/checklist" className="btn btn-ghost btn-sm">View</Link>}>
            <div className="row" style={{ gap: 16 }}>
              <Ring value={d.missions.daily.length ? checklistDone / d.missions.daily.length : 0} size={84} label={`${checklistDone} of ${d.missions.daily.length} daily missions done`}>
                <span className="ring-value">
                  {checklistDone}/{d.missions.daily.length}
                </span>
              </Ring>
              <div className="stack" style={{ flex: 1, gap: 4 }}>
                {d.missions.daily.map((m) => (
                  <span key={m.mission.id} className="small row" style={{ gap: 6 }}>
                    <Icon name={m.complete ? 'check' : 'target'} size={15} style={{ color: m.complete ? 'var(--success)' : 'var(--muted)' }} />
                    {m.mission.title}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="grid-3">
          <Card title="Hydration" action={<Link to="/app/hydration" className="btn btn-ghost btn-sm">Log</Link>}>
            <div className="row" style={{ gap: 16 }}>
              <Ring value={hydPct} size={84} color="var(--water)" label={`Hydration ${Math.round(hydPct * 100)} percent of target`}>
                <span className="ring-value" style={{ fontSize: '1rem' }}>{Math.round(hydPct * 100)}%</span>
              </Ring>
              <div>
                <div className="stat">
                  <span className="value" style={{ fontSize: '1.3rem' }}>
                    {(d.hydration.total / 1000).toFixed(2)} L
                  </span>
                  <span className="label">
                    of {d.hydration.target ? (d.hydration.target.ml / 1000).toFixed(1) : '—'} L {d.hydration.target?.isLimit ? 'limit' : 'starting target'}
                  </span>
                </div>
              </div>
            </div>
          </Card>
          <Card title="Food today" action={<Link to="/app/food" className="btn btn-ghost btn-sm">Plan</Link>}>
            <div className="stat">
              <span className="value" style={{ fontSize: '1.3rem' }}>{d.food.totals.knownItems ? fmtApprox(d.food.totals.kcal, ' kcal') : 'Nothing logged'}</span>
              <span className="label">
                {d.food.guidance.mode === 'targets' && d.food.guidance.kcalRange ? `Guide: ${d.food.guidance.kcalRange[0]}–${d.food.guidance.kcalRange[1]} kcal · protein ${d.food.guidance.proteinRange![0]}–${d.food.guidance.proteinRange![1]} g` : 'Balanced-eating guidance'}
              </span>
            </div>
            <div className="small mt-2">
              {d.food.totals.knownItems > 0 && <>Protein {fmtApprox(d.food.totals.protein, ' g')} · </>}
              Next: {d.food.meals.lunch?.name ?? '—'}
            </div>
          </Card>
          <Card title="Active battle" action={<Link to="/app/battles" className="btn btn-ghost btn-sm">Battles</Link>}>
            {d.battle && d.battleScore ? (
              <Link to={`/app/battles/${d.battle.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                <div className="versus">
                  <div>
                    <div className="score">{d.battleScore.me.total}</div>
                    <div className="small muted">You</div>
                  </div>
                  <div className="vs">VS</div>
                  <div>
                    <div className="score">{d.battleScore.opp.total}</div>
                    <div className="small muted">{OPPONENT_MAP[d.battle.opponentId].username}</div>
                  </div>
                </div>
                <p className="small muted text-center mt-2 mb-0">Ends {formatDate(d.battle.endDate!)} · demo opponent</p>
              </Link>
            ) : (
              <div className="stack">
                <p className="muted mb-0">No active battle. Challenge someone with a similar goal — scoring rewards consistency, not overtraining.</p>
                <Link to="/app/battles/find" className="btn btn-secondary btn-sm">
                  Find an opponent
                </Link>
              </div>
            )}
          </Card>
        </div>

        <Card title="This week">
          <div className="cal" style={{ gap: 8 }}>
            {week.map((day) => {
              const st = dayStatus(d.ctx, day);
              const tpl = templateForDate(d.plan, day);
              return (
                <div key={day} className={`cal-day ${st} ${day === today ? 'today' : ''}`} style={{ aspectRatio: 'auto', padding: '10px 4px' }} title={`${formatDate(day)}: ${tpl ? TEMPLATES[tpl].title : 'Rest'} (${st})`}>
                  <span className="small">{WEEKDAY_SHORT[weekdayOf(day)]}</span>
                  <span className="icon" aria-hidden="true">
                    {st === 'completed' ? '✓' : st === 'rest' ? '·' : st === 'missed' ? '✕' : st === 'excused' ? '☾' : st === 'protected' ? '🛡' : st === 'comeback' ? '↺' : '●'}
                  </span>
                  <span style={{ fontSize: '0.66rem', fontWeight: 600, textAlign: 'center', lineHeight: 1.1 }} className="desktop-only">
                    {tpl ? TEMPLATES[tpl].title.replace('Full Body', 'Full') : 'Rest'}
                  </span>
                  <span className="sr-only">{st}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {suggestions.length > 0 && (
          <Card title="Progression suggestions">
            <p className="small muted">Based on your logged performance. Nothing changes until you accept.</p>
            <ul className="list">
              {suggestions.map((p) => (
                <li key={p.exerciseId} className="list-row" style={{ flexWrap: 'wrap' }}>
                  <div className="grow">
                    <strong>{EXERCISE_MAP[p.variationId]?.name}</strong>
                    <div className="small muted">{p.suggestion!.reason}</div>
                  </div>
                  <div className="row">
                    <Button size="sm" onClick={() => run(acceptProgression, p.exerciseId)}>
                      Accept
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => run(dismissProgression, p.exerciseId)}>
                      Not now
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="grid-2">
          <Card title="Missions" action={<Link to="/app/checklist" className="btn btn-ghost btn-sm">All</Link>}>
            <MissionList items={[...d.missions.daily, ...d.missions.weekly]} />
          </Card>
          <div className="stack">
            <Card title="Recent achievements" action={<Link to="/app/achievements" className="btn btn-ghost btn-sm">All</Link>}>
              {recent.length ? (
                <div className="stack">
                  {recent.map((a) => {
                    const info = ACHIEVEMENT_MAP[a.achievementId];
                    return (
                      <div key={a.achievementId} className="ach">
                        <span className="ach-icon">{info.icon}</span>
                        <div>
                          <div className="ach-name">{info.name}</div>
                          <div className="small muted">{info.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="muted mb-0">Complete your first workout to unlock “First Workout”.</p>
              )}
            </Card>
            <Card title="Progress overview" action={<Link to="/app/progress" className="btn btn-ghost btn-sm">Details</Link>}>
              <div className="grid-2" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
                <div className="stat">
                  <span className="value">{completedCount}</span>
                  <span className="label">Workouts completed</span>
                </div>
                <div className="stat">
                  <span className="value">{d.tokens.length}</span>
                  <span className="label">Recovery tokens</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
