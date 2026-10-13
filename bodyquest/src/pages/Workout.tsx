import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ExerciseDetail } from '../components/ExerciseDetail';
import { Icon } from '../components/Icon';
import { PageHead } from '../components/Layout';
import { Badge, Button, Card, EmptyState, Modal, Note, ProgressBar, Stepper } from '../components/ui';
import { ExerciseFrames } from '../components/visuals';
import { DIFFICULTY_LABEL, EXERCISE_MAP } from '../data/exercises';
import type { SetRating, SkipReason, Symptom, Workout, WorkoutExercise, WorkoutSession } from '../domain/types';
import { addDays, formatDate } from '../services/dates';
import { cautionsFor, SYMPTOM_LABEL, triageSymptoms } from '../services/safety';
import * as S from '../services/session';
import { getAlternatives } from '../services/substitution';
import { estimateSeconds, generateWorkout, COMEBACK_OPTIONS } from '../services/workoutGenerator';
import { XP } from '../services/xp';
import {
  canStartPlanned,
  finishWorkout,
  logSet,
  markDone,
  pauseWorkout,
  replace,
  resumeWorkout,
  skip,
  startComeback,
  startMobility,
  startPlanned,
  undoSet,
  unskip,
} from '../store/actions';
import { useApp } from '../store/AppStore';
import { useDerived } from '../store/hooks';
import { comebackSessionId, findSession, mobilitySessionId, plannedSessionId, plannedWorkoutFor } from '../store/selectors';

function useTick(ms: number, active = true) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => set((x) => x + 1), ms);
    return () => window.clearInterval(t);
  }, [ms, active]);
}

const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

const RATINGS: Array<{ v: SetRating; label: string; emoji: string }> = [
  { v: 1, label: 'Very easy', emoji: '😌' },
  { v: 2, label: 'Easy', emoji: '🙂' },
  { v: 3, label: 'Moderate', emoji: '😤' },
  { v: 4, label: 'Hard', emoji: '🥵' },
  { v: 5, label: 'Too hard', emoji: '🛑' },
];

const SKIP_REASONS: Array<{ v: SkipReason; label: string }> = [
  { v: 'pain', label: 'Pain or discomfort' },
  { v: 'too-difficult', label: 'Too difficult right now' },
  { v: 'no-space', label: 'Not enough space / equipment' },
  { v: 'no-time', label: 'Out of time' },
  { v: 'other', label: 'Other reason' },
];

const SYMPTOMS: Symptom[] = ['normal-soreness', 'excessive-soreness', 'fatigue', 'too-difficult', 'joint-pain', 'sharp-pain', 'chest-pain', 'faint-dizzy', 'breathless-severe', 'palpitations'];

export default function WorkoutPage() {
  const { data, today, now, run } = useApp();
  const d = useDerived();
  const [params] = useSearchParams();
  const mode = params.get('mode');

  // Resolve which session this page shows.
  const target = useMemo(() => {
    if (mode === 'mobility') {
      const id = mobilitySessionId(today);
      const w = findSession(data, id)?.workout ?? generateWorkout(d.profile, d.plan, today, 'mobility-b', { minutes: 15 });
      return { kind: 'mobility' as const, id, date: today, workout: w ? { ...w, title: 'Optional Mobility Session', xpAvailable: XP.mobility } : null };
    }
    if (mode === 'comeback') {
      const forDate = params.get('for') ?? addDays(today, -1);
      const tpl = (params.get('t') ?? 'comeback-mobility') as 'comeback-mobility' | 'comeback-technique';
      const id = comebackSessionId(forDate);
      const w = findSession(data, id)?.workout ?? generateWorkout(d.profile, d.plan, today, tpl, { progressions: data.progressions });
      return { kind: 'comeback' as const, id, date: forDate, tpl, workout: w };
    }
    const date = params.get('date') ?? (d.todayWorkout ? today : d.movedHere[0] ?? today);
    return { kind: 'planned' as const, id: plannedSessionId(date), date, workout: plannedWorkoutFor(data, date, today) };
  }, [mode, params, data, today, d]);

  const session = findSession(data, target.id);
  const running = session?.status === 'in-progress';
  useTick(1000, running);

  if (!target.workout) {
    return (
      <>
        <PageHead title="Today’s Workout" sub={formatDate(today, { weekday: 'long', month: 'long', day: 'numeric' })} />
        <Card>
          <EmptyState
            icon="moon"
            title="Rest day"
            action={
              <div className="row" style={{ justifyContent: 'center' }}>
                <Link to="/app/workout?mode=mobility" className="btn btn-primary">
                  Optional 15-min mobility
                </Link>
                <Link to="/app/schedule" className="btn btn-secondary">
                  View schedule
                </Link>
              </div>
            }
          >
            Rest days are planned on purpose — they never break your streak. {d.next ? `Next: ${d.next.workout.title} on ${formatDate(d.next.date)}.` : ''}
          </EmptyState>
        </Card>
        {d.overdue.length > 0 && (
          <div className="mt-3">
            <Note tone="warning">
              You have a missed session to resolve. <Link to="/app/streaks">See recovery options</Link>.
            </Note>
          </div>
        )}
      </>
    );
  }

  if (session && (session.status === 'completed' || (session.status === 'ended-early' && session.finishedAt))) {
    return <Summary session={session} onResume={session.status === 'ended-early' ? () => run(resumeWorkout, session.id) : undefined} />;
  }

  const startCheck = target.kind === 'planned' ? canStartPlanned(data, { nowIso: '', today, userId: '' }, target.date) : { ok: true };
  const start = () => {
    if (target.kind === 'mobility') run(startMobility);
    else if (target.kind === 'comeback') run(startComeback, target.date, target.tpl);
    else run(startPlanned, target.date);
  };

  return (
    <WorkoutView
      workout={session?.workout ?? target.workout}
      session={session}
      kind={target.kind}
      plannedDate={target.date}
      startDisabledReason={startCheck.ok ? undefined : startCheck.reason}
      onStart={start}
      nowMs={now()}
    />
  );
}

function WorkoutView({
  workout,
  session,
  kind,
  plannedDate,
  startDisabledReason,
  onStart,
  nowMs,
}: {
  workout: Workout;
  session?: WorkoutSession;
  kind: 'planned' | 'comeback' | 'mobility';
  plannedDate: string;
  startDisabledReason?: string;
  onStart: () => void;
  nowMs: number;
}) {
  const { run, today } = useApp();
  const d = useDerived();
  const [restEnds, setRestEnds] = useState<number | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const started = Boolean(session && session.status !== 'not-started');
  const running = session?.status === 'in-progress';
  const paused = session?.status === 'paused';
  const ended = session?.status === 'ended-early';
  useTick(500, restEnds !== null);

  const active = session ? S.activeMsAt(session, nowMs) / 1000 : 0;
  const progress = session ? S.overallProgress(session) : 0;
  const remaining = session ? S.remainingSeconds(session, estimateSeconds) : workout.exercises.reduce((s, w) => s + estimateSeconds(w), 0);
  const restLeft = restEnds ? Math.max(0, (restEnds - Date.now()) / 1000) : 0;
  useEffect(() => {
    if (restEnds && restLeft <= 0) setRestEnds(null);
  }, [restEnds, restLeft]);

  const blocks: Array<{ key: 'warmup' | 'main' | 'cooldown'; title: string; sub: string }> = [
    { key: 'warmup', title: 'Warm-up', sub: 'Gradually raise your temperature and rehearse today’s movements (~5–8 min).' },
    { key: 'main', title: 'Main workout', sub: 'Quality reps. Leave 1–3 reps in reserve on most sets.' },
    { key: 'cooldown', title: 'Cooldown', sub: 'Easy movement and comfortable stretching — never force a stretch.' },
  ];
  const challenge = d.missions.daily.find((m) => !m.complete)?.mission;
  const check = session ? S.finishCheck(session, nowMs) : null;

  return (
    <>
      <PageHead
        title={workout.title}
        sub={kind === 'planned' ? `${formatDate(plannedDate, { weekday: 'long', month: 'long', day: 'numeric' })}${plannedDate !== today ? ' (completing late — within the allowed window)' : ''}` : kind === 'comeback' ? `Comeback for your ${formatDate(plannedDate)} session` : 'Optional — rest is fine too'}
      />
      <div className="grid-4">
        <Card>
          <div className="stat">
            <span className="value">{Math.round(progress * 100)}%</span>
            <span className="label">Workout complete</span>
          </div>
          <div className="mt-1">
            <ProgressBar value={progress} label="Workout completion" />
          </div>
        </Card>
        <Card>
          <div className="stat">
            <span className="value">{fmtClock(remaining)}</span>
            <span className="label">Est. time remaining</span>
          </div>
        </Card>
        <Card>
          <div className="stat">
            <span className="value">
              <Icon name="flame" size={20} style={{ color: 'var(--streak)', verticalAlign: '-2px' }} /> {d.streak.current}
            </span>
            <span className="label">Current streak</span>
          </div>
        </Card>
        <Card>
          <div className="stat">
            <span className="value">{workout.xpAvailable}</span>
            <span className="label">XP available{kind === 'planned' ? ' (incl. warm-up & cooldown)' : ''}</span>
          </div>
        </Card>
      </div>

      <div className="grid-2 mt-3">
        <Card title="Session">
          <p className="mb-2">{workout.objective}</p>
          <div className="row">
            <Badge>
              <Icon name="clock" size={13} /> ~{workout.estimatedMinutes} min
            </Badge>
            <Badge>{workout.phaseName} phase</Badge>
            {workout.isDeloadWeek && <Badge tone="info">Deload week</Badge>}
            <Badge tone={workout.intensity === 'hard' ? 'streak' : 'success'}>{workout.intensity} intensity</Badge>
          </div>
          <div className="small muted mt-2">
            {challenge && (
              <>
                <strong>Today’s challenge:</strong> {challenge.title} — {challenge.description}{' '}
              </>
            )}
            <br />
            <strong>Next rest day:</strong> {d.nextRest ? (d.nextRest === today ? 'today' : formatDate(d.nextRest)) : '—'}
          </div>
        </Card>
        <Card title="Completion rules">
          <ul className="bullets small">
            <li>Log at least {Math.round(S.COMPLETION_THRESHOLD * 100)}% of the main sets (skipping for pain is excused).</li>
            <li>At least {S.MIN_ACTIVE_MINUTES[workout.intensity]} minutes of active (unpaused) time.</li>
            <li>One full workout per day. Opening this page never counts as a workout.</li>
          </ul>
          <button className="btn btn-danger-outline btn-sm mt-2" onClick={() => setReportOpen(true)}>
            <Icon name="heart" size={16} /> Report pain or a problem
          </button>
        </Card>
      </div>

      {/* Sticky control bar */}
      <div className="timer-bar mt-3">
        <div className="card" style={{ padding: 12, boxShadow: 'var(--shadow)' }}>
          <div className="row-between">
            <div className="row" style={{ gap: 14 }}>
              <div>
                <div className="small muted" style={{ fontWeight: 700 }}>
                  {restEnds ? 'REST' : running ? 'ACTIVE' : paused ? 'PAUSED' : ended ? 'SAVED' : 'READY'}
                </div>
                <div className="timer-big" aria-live="off" style={{ fontSize: '1.9rem', color: restEnds ? 'var(--water)' : undefined }}>
                  {restEnds ? fmtClock(restLeft) : fmtClock(active)}
                </div>
              </div>
              {restEnds && (
                <Button size="sm" variant="secondary" onClick={() => setRestEnds(null)}>
                  Skip rest
                </Button>
              )}
            </div>
            <div className="row">
              {!started && (
                <Button size="lg" icon="play" onClick={onStart} disabled={Boolean(startDisabledReason)}>
                  Start Workout
                </Button>
              )}
              {running && (
                <Button variant="secondary" icon="pause" onClick={() => run(pauseWorkout, session!.id)}>
                  Pause Workout
                </Button>
              )}
              {(paused || ended) && (
                <Button icon="play" onClick={() => run(resumeWorkout, session!.id)}>
                  Resume
                </Button>
              )}
              {started && (
                <Button variant="dark" icon="check" onClick={() => setFinishOpen(true)}>
                  Finish Workout
                </Button>
              )}
            </div>
          </div>
          {startDisabledReason && !started && (
            <p className="small mt-2 mb-0" role="status" style={{ color: 'var(--warning)' }}>
              {startDisabledReason}
            </p>
          )}
          {paused && <p className="small muted mt-2 mb-0">Paused — your progress is saved, even if you close or refresh this page.</p>}
        </div>
      </div>

      {blocks.map((b) => {
        const items = workout.exercises.filter((w) => w.block === b.key);
        if (!items.length) return null;
        const done = session ? items.filter((w) => session.progress[w.id].completed).length : 0;
        return (
          <section key={b.key} aria-labelledby={`blk-${b.key}`}>
            <div className="block-head">
              <h2 id={`blk-${b.key}`}>{b.title}</h2>
              <Badge tone={done === items.length ? 'success' : undefined}>
                {done}/{items.length}
              </Badge>
              <span className="line" />
            </div>
            <p className="small muted" style={{ marginTop: -6 }}>
              {b.sub}
            </p>
            <div className="stack">
              {items.map((we) =>
                b.key === 'main' ? (
                  <MainExerciseCard key={we.id} we={we} session={session} running={running} onRest={(sec) => setRestEnds(Date.now() + sec * 1000)} />
                ) : (
                  <SimpleItemCard key={we.id} we={we} session={session} running={running} />
                ),
              )}
            </div>
          </section>
        );
      })}

      <Card title="Recovery advice" className="mt-4">
        <ul className="bullets">
          {workout.recoveryAdvice.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </Card>

      {finishOpen && session && <FinishModal session={session} check={check!} onClose={() => setFinishOpen(false)} />}
      {reportOpen && <ReportModal session={session} onClose={() => setReportOpen(false)} />}
    </>
  );
}

// ---------------------------------------------------------------- cards

function SimpleItemCard({ we, session, running }: { we: WorkoutExercise; session?: WorkoutSession; running: boolean }) {
  const { run } = useApp();
  const ex = EXERCISE_MAP[we.exerciseId];
  const p = session?.progress[we.id];
  const [open, setOpen] = useState(false);
  return (
    <article className={`card ex-card ${p?.completed ? 'done' : ''}`} aria-labelledby={`ex-${we.id}`}>
      <div className="ex-visual">
        <ExerciseFrames exercise={ex} compact max={2} />
      </div>
      <div>
        <div className="row-between">
          <h3 id={`ex-${we.id}`} className="mb-0">
            {ex.name}
          </h3>
          {p?.completed ? <Badge tone="success">Done</Badge> : <Badge>{we.seconds ? `${we.seconds}s` : `${we.reps?.[0]}–${we.reps?.[1]} reps`}{ex.unilateral ? ' each side' : ''}</Badge>}
        </div>
        {we.note && <p className="small muted mb-1">{we.note}</p>}
        <p className="small mb-1">{ex.instructions.steps[0]}</p>
        <p className="small muted mb-2">Breathing: {ex.instructions.breathing}</p>
        <div className="row">
          <Button size="sm" icon="check" disabled={!running || p?.completed} onClick={() => run(markDone, session!.id, we.id)}>
            {p?.completed ? 'Completed' : 'Mark Complete'}
          </Button>
          <Button size="sm" variant="ghost" icon="book" onClick={() => setOpen(true)}>
            How to
          </Button>
        </div>
      </div>
      {open && (
        <Modal title={ex.name} onClose={() => setOpen(false)} wide>
          <ExerciseDetail exercise={ex} headingLevel={2} />
        </Modal>
      )}
    </article>
  );
}

function MainExerciseCard({ we, session, running, onRest }: { we: WorkoutExercise; session?: WorkoutSession; running: boolean; onRest: (sec: number) => void }) {
  const { run, data } = useApp();
  const ex = EXERCISE_MAP[we.exerciseId];
  const p = session?.progress[we.id];
  const isTime = ex.measure === 'time';
  const target = isTime ? we.seconds ?? 30 : we.targetReps ?? we.reps?.[0] ?? 10;
  const [value, setValue] = useState(target);
  const [rating, setRating] = useState<SetRating | undefined>(undefined);
  const [modal, setModal] = useState<'skip' | 'replace' | 'guide' | null>(null);
  const [holdEnds, setHoldEnds] = useState<number | null>(null);
  useTick(250, holdEnds !== null);
  const holdLeft = holdEnds ? Math.max(0, (holdEnds - Date.now()) / 1000) : 0;
  useEffect(() => {
    if (holdEnds && holdLeft <= 0) {
      setHoldEnds(null);
      setValue(we.seconds ?? 30);
    }
  }, [holdEnds, holdLeft, we.seconds]);
  useEffect(() => setValue(target), [target, we.exerciseId]);

  const setsDone = p?.sets.length ?? 0;
  const done = Boolean(p?.completed);
  const skipped = p?.skipped;
  const cautions = data.profile ? cautionsFor(ex, data.profile) : [];
  const easier = ex.easier.map((id) => EXERCISE_MAP[id]).filter(Boolean)[0];
  const harder = ex.harder.map((id) => EXERCISE_MAP[id]).filter(Boolean)[0];

  const log = () => {
    const ok = run(logSet, session!.id, we.id, isTime ? { secondsDone: value, rating } : { repsDone: value, rating });
    if (ok && setsDone + 1 < we.sets && we.restSec > 0) onRest(we.restSec);
    if (ok) setRating(undefined);
  };
  const completeAll = () => {
    for (let i = setsDone; i < we.sets; i++) {
      if (!run(logSet, session!.id, we.id, isTime ? { secondsDone: value, rating } : { repsDone: value, rating })) break;
    }
  };

  return (
    <article className={`card ex-card ${done ? 'done' : ''} ${skipped ? 'skipped' : ''}`} aria-labelledby={`ex-${we.id}`}>
      <div className="ex-visual">
        <ExerciseFrames exercise={ex} compact max={3} />
        <button className="btn btn-ghost btn-sm btn-block mt-1" onClick={() => setModal('guide')}>
          <Icon name="book" size={16} /> Full visual guide
        </button>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="row-between">
          <h3 id={`ex-${we.id}`} className="mb-0" style={{ fontSize: '1.15rem' }}>
            {ex.name}
          </h3>
          {done ? <Badge tone="success">Complete</Badge> : skipped ? <Badge tone="warning">Skipped · {SKIP_REASONS.find((r) => r.v === skipped.reason)?.label}</Badge> : null}
        </div>
        {p?.replacedFrom && <p className="small muted mb-1">Replaced {EXERCISE_MAP[p.replacedFrom]?.name} with an approved alternative.</p>}
        <div className="row mt-1" style={{ gap: 6 }}>
          {ex.muscles.slice(0, 4).map((m) => (
            <span key={m} className="badge">
              {m.replace('-', ' ')}
            </span>
          ))}
          <span className="badge badge-accent">
            Difficulty {ex.difficulty} · {DIFFICULTY_LABEL[ex.difficulty]}
          </span>
        </div>
        <div className="ex-meta">
          <div>
            <div className="k">Sets</div>
            <div className="v">{we.sets}</div>
          </div>
          <div>
            <div className="k">{isTime ? 'Duration' : 'Reps'}</div>
            <div className="v">{isTime ? `${we.seconds}s` : `${we.reps?.[0]}–${we.reps?.[1]}`}{ex.unilateral ? '/side' : ''}</div>
          </div>
          <div>
            <div className="k">Rest</div>
            <div className="v">{we.restSec}s</div>
          </div>
          <div>
            <div className="k">{isTime ? 'Target' : 'Your target'}</div>
            <div className="v">{isTime ? `${we.seconds}s` : we.targetReps ?? we.reps?.[0]}</div>
          </div>
        </div>
        <p className="small mb-1">
          <strong>Technique:</strong> {ex.instructions.steps.slice(0, 2).join(' ')}
        </p>
        <p className="small mb-1">
          <strong>Common mistakes:</strong> {ex.instructions.commonMistakes.slice(0, 2).join(' · ')}
        </p>
        <p className="small mb-1">
          <strong>Breathing:</strong> {ex.instructions.breathing}
        </p>
        <p className="small mb-2">
          <strong>Easier:</strong> {easier ? easier.name : ex.instructions.beginnerModification} · <strong>Harder:</strong> {harder ? harder.name : ex.instructions.progressionOption}
        </p>
        {cautions.map((c) => (
          <p key={c} className="small mb-1" style={{ color: 'var(--info)' }}>
            <Icon name="info" size={14} style={{ verticalAlign: '-2px' }} /> {c}
          </p>
        ))}

        <div className="set-pills mb-2" aria-label="Logged sets">
          {Array.from({ length: we.sets }, (_, i) => {
            const s = p?.sets[i];
            return (
              <span key={i} className={`set-pill ${s ? 'done' : ''}`}>
                Set {i + 1}: {s ? `${isTime ? `${s.secondsDone}s` : `${s.repsDone} reps`}${s.rating ? ` ${RATINGS[s.rating - 1].emoji}` : ''}` : '—'}
              </span>
            );
          })}
        </div>

        {!done && !skipped && (
          <div className="card flat" style={{ padding: 12 }}>
            <div className="row" style={{ alignItems: 'flex-end', gap: 14 }}>
              <div className="field">
                <span className="label">{isTime ? 'Seconds held' : 'Reps completed'} · set {setsDone + 1}</span>
                <Stepper value={value} onChange={setValue} min={0} max={isTime ? 600 : 100} step={isTime ? 5 : 1} label={isTime ? 'Seconds held' : 'Reps completed'} />
              </div>
              {isTime && (
                <Button variant="secondary" size="sm" icon="clock" disabled={!running} onClick={() => setHoldEnds(holdEnds ? null : Date.now() + (we.seconds ?? 30) * 1000)}>
                  {holdEnds ? `Holding… ${Math.ceil(holdLeft)}s` : 'Start hold timer'}
                </Button>
              )}
            </div>
            <div className="field mt-2">
              <span className="label" id={`rate-${we.id}`}>
                How did that set feel?
              </span>
              <div className="rating" role="group" aria-labelledby={`rate-${we.id}`}>
                {RATINGS.map((r) => (
                  <button key={r.v} type="button" aria-pressed={rating === r.v} onClick={() => setRating(r.v)}>
                    <span className="emoji" aria-hidden="true">
                      {r.emoji}
                    </span>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="row mt-2">
              <Button icon="check" disabled={!running} onClick={log}>
                Log set {setsDone + 1}
              </Button>
              <Button variant="secondary" disabled={!running} onClick={completeAll}>
                Mark Complete
              </Button>
              {setsDone > 0 && (
                <Button variant="ghost" size="sm" onClick={() => run(undoSet, session!.id, we.id)}>
                  Undo last set
                </Button>
              )}
            </div>
            {!running && <p className="small muted mt-2 mb-0">{session ? 'Resume the workout to log sets.' : 'Start the workout to log sets.'}</p>}
          </div>
        )}
        <div className="row mt-2">
          {!done && !skipped && setsDone === 0 && (
            <Button variant="ghost" size="sm" icon="swap" disabled={!session} onClick={() => setModal('replace')}>
              Replace
            </Button>
          )}
          {!done && !skipped && (
            <Button variant="ghost" size="sm" icon="skip" disabled={!session} onClick={() => setModal('skip')}>
              Skip
            </Button>
          )}
          {skipped && (
            <Button variant="ghost" size="sm" onClick={() => run(unskip, session!.id, we.id)}>
              Undo skip
            </Button>
          )}
        </div>
      </div>

      {modal === 'guide' && (
        <Modal title={ex.name} onClose={() => setModal(null)} wide>
          <ExerciseDetail exercise={ex} profile={data.profile} headingLevel={2} />
        </Modal>
      )}
      {modal === 'skip' && session && <SkipModal sessionId={session.id} weId={we.id} name={ex.name} onClose={() => setModal(null)} />}
      {modal === 'replace' && session && <ReplaceModal sessionId={session.id} we={we} originalId={p?.replacedFrom ?? we.exerciseId} onClose={() => setModal(null)} />}
    </article>
  );
}

function SkipModal({ sessionId, weId, name, onClose }: { sessionId: string; weId: string; name: string; onClose: () => void }) {
  const { run } = useApp();
  const [reason, setReason] = useState<SkipReason | null>(null);
  const [note, setNote] = useState('');
  return (
    <Modal
      title={`Skip ${name}?`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!reason}
            onClick={() => {
              if (run(skip, sessionId, weId, reason!, note.trim() || undefined)) onClose();
            }}
          >
            Skip exercise
          </Button>
        </>
      }
    >
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="mb-2" style={{ fontWeight: 700 }}>
          Why are you skipping it?
        </legend>
        {SKIP_REASONS.map((r) => (
          <label key={r.v} className="check-row">
            <input type="radio" name="skip" checked={reason === r.v} onChange={() => setReason(r.v)} />
            <span>{r.label}</span>
          </label>
        ))}
      </fieldset>
      {reason === 'pain' && (
        <Note tone="warning">
          Stop any movement that causes pain — never push through it. Skipping for pain doesn’t count against your completion. If the pain is sharp, severe or persists, see a health professional.
        </Note>
      )}
      <div className="field mt-2">
        <label htmlFor="skip-note">Note (optional)</label>
        <input id="skip-note" className="input" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

function ReplaceModal({ sessionId, we, originalId, onClose }: { sessionId: string; we: WorkoutExercise; originalId: string; onClose: () => void }) {
  const { run, data } = useApp();
  const alts = getAlternatives(originalId, data.profile!).filter((a) => a.exercise.id !== we.exerciseId);
  return (
    <Modal title="Replace with an approved alternative" onClose={onClose} wide>
      <p className="small muted">Only alternatives that fit your plan and safety settings are shown.</p>
      {alts.length === 0 ? (
        <EmptyState icon="swap" title="No alternatives available">
          You can skip this exercise with a reason instead.
        </EmptyState>
      ) : (
        <div className="grid-auto">
          {alts.map((a) => (
            <div key={a.exercise.id} className="card flat stack">
              <ExerciseFrames exercise={a.exercise} compact max={2} />
              <div className="row-between">
                <strong>{a.exercise.name}</strong>
                <Badge tone={a.relation === 'easier' ? 'success' : a.relation === 'harder' ? 'streak' : undefined}>{a.relation}</Badge>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (run(replace, sessionId, we.id, a.exercise.id)) onClose();
                }}
              >
                Use this
              </Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function SymptomPicker({ value, onChange }: { value: Symptom[]; onChange: (s: Symptom[]) => void }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="mb-2" style={{ fontWeight: 700 }}>
        How do you feel? (select any)
      </legend>
      <div className="grid-2" style={{ gap: 0 }}>
        {SYMPTOMS.map((s) => (
          <label key={s} className="check-row">
            <input type="checkbox" checked={value.includes(s)} onChange={(e) => onChange(e.target.checked ? [...value, s] : value.filter((x) => x !== s))} />
            <span>{SYMPTOM_LABEL[s]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TriageNote({ symptoms }: { symptoms: Symptom[] }) {
  if (!symptoms.length) return null;
  const t = triageSymptoms(symptoms);
  const tone = t.level === 'emergency' ? 'danger' : t.level === 'stop' ? 'warning' : t.level === 'modify' ? 'info' : 'success';
  return (
    <div className="mt-2">
      <Note tone={tone} title={t.title}>
        <p>{t.message}</p>
        <ul className="bullets">
          {t.actions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </Note>
    </div>
  );
}

function ReportModal({ session, onClose }: { session?: WorkoutSession; onClose: () => void }) {
  const { run, now } = useApp();
  const [sym, setSym] = useState<Symptom[]>([]);
  const [note, setNote] = useState('');
  const level = sym.length ? triageSymptoms(sym).level : 'ok';
  return (
    <Modal
      title="Report pain or a problem"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {session && session.status !== 'not-started' && (level === 'emergency' || level === 'stop') && (
            <Button
              variant="danger"
              onClick={() => {
                if (run(finishWorkout, session.id, { symptoms: sym, note, reportedAt: new Date(now()).toISOString() })) onClose();
              }}
            >
              End workout now
            </Button>
          )}
        </>
      }
    >
      <SymptomPicker value={sym} onChange={setSym} />
      <TriageNote symptoms={sym} />
      <div className="field mt-2">
        <label htmlFor="rep-note">Details (optional)</label>
        <textarea id="rep-note" className="textarea" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

function FinishModal({ session, check, onClose }: { session: WorkoutSession; check: S.FinishCheck; onClose: () => void }) {
  const { run, now } = useApp();
  const [sym, setSym] = useState<Symptom[]>([]);
  const [note, setNote] = useState('');
  return (
    <Modal
      title="Finish workout"
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep going
          </Button>
          <Button
            variant={check.ok ? 'primary' : 'dark'}
            onClick={() => {
              if (run(finishWorkout, session.id, sym.length || note ? { symptoms: sym, note, reportedAt: new Date(now()).toISOString() } : undefined)) onClose();
            }}
          >
            {check.ok ? 'Finish & claim XP' : 'Save & end session'}
          </Button>
        </>
      }
    >
      {check.ok ? (
        <Note tone="success" title="Ready to complete">
          You logged {Math.round(check.ratio * 100)}% of the main sets in {check.activeMinutes.toFixed(0)} active minutes.
        </Note>
      ) : (
        <Note tone="warning" title="This won’t count as a completed workout yet">
          <ul className="bullets">
            {check.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mb-0">You can keep going, or save and end — your logged sets are kept and you can resume later today. Ending early for pain or illness is always the right call.</p>
        </Note>
      )}
      <div className="mt-3">
        <SymptomPicker value={sym} onChange={setSym} />
        <TriageNote symptoms={sym} />
        <div className="field mt-2">
          <label htmlFor="fin-note">Notes (optional)</label>
          <textarea id="fin-note" className="textarea" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- summary

function Summary({ session, onResume }: { session: WorkoutSession; onResume?: () => void }) {
  const { data, today } = useApp();
  const ok = session.status === 'completed';
  const mains = session.workout.exercises.filter((w) => w.block === 'main');
  const mins = Math.round(session.activeMs / 60000);
  const triage = session.symptomReport?.symptoms.length ? triageSymptoms(session.symptomReport.symptoms) : null;
  const suggestions = Object.values(data.progressions).filter((p) => p.suggestion);
  const sameDay = session.performedDate === today;
  const msg = ok
    ? session.kind === 'comeback'
      ? 'Comeback complete. That’s how consistent people train — they come back.'
      : session.kind === 'mobility'
        ? 'Mobility done. Your joints and your recovery thank you.'
        : 'Session complete! Every quality rep is a step toward your goal.'
    : 'Session saved. Stopping when something isn’t right is a smart decision — it never counts against you.';
  return (
    <>
      <PageHead title="Workout summary" sub={session.workout.title} />
      {triage && (triage.level === 'emergency' || triage.level === 'stop') && (
        <div className="mb-3">
          <Note tone="danger" title={triage.title}>
            {triage.message}
          </Note>
        </div>
      )}
      <section className={`card hero ${ok ? 'celebrate' : ''}`}>
        <div className="row" style={{ gap: 24 }}>
          <div style={{ fontSize: '3rem' }} aria-hidden="true">
            {ok ? '🏆' : '💾'}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h2 style={{ fontSize: '1.6rem' }}>{ok ? 'Workout complete' : 'Session saved (not counted as complete)'}</h2>
            <p className="muted mb-0">{msg}</p>
          </div>
          <div className="row" style={{ gap: 28 }}>
            <div className="stat">
              <span className="value">{mins}</span>
              <span className="label muted">active minutes</span>
            </div>
            <div className="stat">
              <span className="value">{Math.round(session.completionRatio * 100)}%</span>
              <span className="label muted">main sets</span>
            </div>
            <div className="stat">
              <span className="value" style={{ color: 'var(--accent)' }}>+{session.xpAwarded}</span>
              <span className="label muted">XP earned</span>
            </div>
          </div>
        </div>
      </section>
      <div className="grid-2 mt-3">
        <Card title="Exercises">
          <ul className="list">
            {mains.map((w) => {
              const p = session.progress[w.id];
              const ex = EXERCISE_MAP[p.performedExerciseId];
              return (
                <li key={w.id} className="list-row">
                  <Icon name={p.completed ? 'check' : p.skipped ? 'skip' : 'minus'} size={18} style={{ color: p.completed ? 'var(--success)' : 'var(--muted)' }} />
                  <span className="grow">{ex.name}</span>
                  <span className="small muted mono">{p.skipped ? `skipped (${p.skipped.reason})` : p.sets.map((s) => (s.repsDone ?? `${s.secondsDone}s`)).join(' · ') || '—'}</span>
                </li>
              );
            })}
          </ul>
        </Card>
        <div className="stack">
          {suggestions.length > 0 && (
            <Card title="Progression suggestions">
              <p className="small">You have {suggestions.length} new suggestion(s) based on this session.</p>
              <Link to="/app" className="btn btn-secondary btn-sm">
                Review on dashboard
              </Link>
            </Card>
          )}
          <Card title="Recovery">
            <ul className="bullets">
              {session.workout.recoveryAdvice.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <div className="row mt-3">
        <Link to="/app" className="btn btn-primary">
          Back to dashboard
        </Link>
        <Link to="/app/food" className="btn btn-secondary">
          Plan a recovery meal
        </Link>
        {onResume && sameDay && (
          <Button variant="secondary" icon="play" onClick={onResume}>
            Resume this session
          </Button>
        )}
      </div>
    </>
  );
}

export { COMEBACK_OPTIONS };
