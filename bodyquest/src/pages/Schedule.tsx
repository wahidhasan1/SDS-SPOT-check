import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHead } from '../components/Layout';
import { Badge, Button, Card, Modal, Note } from '../components/ui';
import { EXERCISE_MAP } from '../data/exercises';
import type { Weekday, Workout } from '../domain/types';
import { addDays, formatDate, WEEK_ORDER, WEEKDAY_LONG, WEEKDAY_SHORT } from '../services/dates';
import { buildWeekTemplate, PATTERN_INFO, phaseFor, weekNumber } from '../services/plan';
import { TEMPLATES } from '../services/workoutGenerator';
import { changeTrainingDays } from '../store/actions';
import { useApp } from '../store/AppStore';
import { useDerived } from '../store/hooks';
import { plannedWorkoutFor } from '../store/selectors';

export default function SchedulePage() {
  const { data, today, run } = useApp();
  const d = useDerived();
  const [days, setDays] = useState<Weekday[]>(d.profile.trainingDays);
  const [preview, setPreview] = useState<Workout | null>(null);
  const week = Math.max(1, weekNumber(d.plan, today));
  const phase = phaseFor(d.plan, week);
  const totalWeeks = d.plan.phases[d.plan.phases.length - 1].endWeek;
  const proposed = buildWeekTemplate(d.plan.pattern, days, d.profile);
  const changed = JSON.stringify([...days].sort()) !== JSON.stringify([...d.profile.trainingDays].sort());
  const upcoming = Array.from({ length: 14 }, (_, i) => addDays(today, i)).map((date) => ({ date, w: plannedWorkoutFor(data, date, today) }));

  return (
    <>
      <PageHead title="Workout Schedule" sub={`${PATTERN_INFO[d.plan.pattern].name} · week ${week} of ${totalWeeks}`} actions={<Link to="/onboarding/review" className="btn btn-secondary">Edit plan inputs</Link>} />
      {d.plan.lowIntensityOnly && (
        <div className="mb-3">
          <Note tone="warning" title="Low-intensity mode">
            Your plan uses gentle sessions only. Once a health professional clears you, update your readiness answers in <Link to="/app/settings">Settings</Link>.
          </Note>
        </div>
      )}
      <div className="grid-2">
        <Card title="Weekly training days">
          <p className="small muted">Choose a sustainable schedule. Changes apply from today — past history is kept.</p>
          <div className="chips" role="group" aria-label="Training days">
            {WEEK_ORDER.map((w) => (
              <button key={w} type="button" className="chip" aria-pressed={days.includes(w)} aria-label={WEEKDAY_LONG[w]} onClick={() => setDays(days.includes(w) ? days.filter((x) => x !== w) : [...days, w])}>
                {WEEKDAY_SHORT[w]}
              </button>
            ))}
          </div>
          <div className="grid-4 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
            {WEEK_ORDER.map((w) => (
              <div key={w} className="card flat" style={{ padding: 8 }}>
                <div className="small muted" style={{ fontWeight: 700 }}>
                  {WEEKDAY_SHORT[w]}
                </div>
                <div className="small" style={{ fontWeight: 700 }}>
                  {proposed[w] ? TEMPLATES[proposed[w]!].title : 'Rest'}
                </div>
              </div>
            ))}
          </div>
          {days.length < 2 && <p className="small mt-2" style={{ color: 'var(--danger)' }}>Choose at least 2 days.</p>}
          {days.length > 6 && <p className="small mt-2" style={{ color: 'var(--danger)' }}>Keep at least one full rest day.</p>}
          <div className="row mt-3">
            <Button disabled={!changed || days.length < 2 || days.length > 6} onClick={() => run(changeTrainingDays, [...days].sort() as Weekday[])}>
              Save schedule
            </Button>
            {changed && (
              <Button variant="ghost" onClick={() => setDays(d.profile.trainingDays)}>
                Reset
              </Button>
            )}
          </div>
        </Card>
        <Card title="Why your plan looks like this">
          <ul className="bullets small">
            {d.plan.rationale.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Next 14 days" className="mt-3">
        <ul className="list">
          {upcoming.map(({ date, w }) => (
            <li key={date} className="list-row">
              <span style={{ width: 110 }} className="small" aria-hidden="false">
                <strong>{date === today ? 'Today' : formatDate(date, { weekday: 'short' })}</strong> <span className="muted">{formatDate(date, { month: 'short', day: 'numeric' })}</span>
              </span>
              <span className="grow">{w ? w.title : <span className="muted">Rest day</span>}</span>
              {w && (
                <>
                  <Badge>~{w.estimatedMinutes} min</Badge>
                  <Button size="sm" variant="ghost" onClick={() => setPreview(w)}>
                    Preview
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid-2 mt-3">
        <Card title="Training phases">
          <ol className="list">
            {d.plan.phases.map((p) => (
              <li key={p.index}>
                <div className="row-between">
                  <strong>
                    {p.name} {p.index === phase.index && <Badge tone="accent">Current</Badge>}
                  </strong>
                  <span className="small muted">
                    Weeks {p.startWeek}–{p.endWeek}
                  </span>
                </div>
                <div className="small muted">{p.focus}</div>
                {p.deloadEvery > 0 && <div className="small muted">Lighter deload week every {p.deloadEvery} weeks.</div>}
              </li>
            ))}
          </ol>
          <p className="small muted mb-0">Extra volume in later phases is only applied when your recent consistency and recovery support it. Harder variations are always opt-in.</p>
        </Card>
        <Card title="Milestones">
          <ol className="list" style={{ maxHeight: 460, overflow: 'auto' }}>
            {d.plan.milestones.map((m) => {
              const startMonth = Math.floor((week - 1) / 4.345) + 1;
              return (
                <li key={m.month}>
                  <strong>Month {m.month}:</strong> {m.title} {m.month === startMonth && <Badge tone="accent">Now</Badge>}
                  <div className="small muted">{m.description}</div>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>

      {preview && (
        <Modal title={`${preview.title} · ${formatDate(preview.date)}`} onClose={() => setPreview(null)}>
          <p className="small">{preview.objective}</p>
          {(['warmup', 'main', 'cooldown'] as const).map((b) => (
            <div key={b} className="mt-2">
              <div className="card-title">{b === 'warmup' ? 'Warm-up' : b === 'main' ? 'Main' : 'Cooldown'}</div>
              <ul className="list">
                {preview.exercises
                  .filter((e) => e.block === b)
                  .map((e) => (
                    <li key={e.id} className="list-row">
                      <Link to={`/app/exercises/${e.exerciseId}`} className="grow">
                        {EXERCISE_MAP[e.exerciseId].name}
                      </Link>
                      <span className="small muted mono">{e.sets} × {e.reps ? `${e.reps[0]}–${e.reps[1]}` : `${e.seconds}s`}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </Modal>
      )}
    </>
  );
}
