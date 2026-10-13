import { Link } from 'react-router-dom';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import { Badge, Card, ProgressBar } from '../components/ui';
import type { MissionProgress } from '../domain/types';
import { formatDate } from '../services/dates';
import { dayTotal } from '../services/hydration';
import { toggleChecklist } from '../store/actions';
import { useApp } from '../store/AppStore';
import { useDerived } from '../store/hooks';
import { foodLoggedSlots, sleepLogged } from '../store/selectors';

export function MissionList({ items }: { items: MissionProgress[] }) {
  return (
    <ul className="list">
      {items.map((m) => (
        <li key={m.mission.id} className="list-row">
          <Icon name={m.complete ? 'check' : 'target'} size={20} style={{ color: m.complete ? 'var(--success)' : 'var(--muted)', flex: 'none' }} />
          <div className="grow">
            <div style={{ fontWeight: 700 }}>
              {m.mission.title} <Badge>{m.mission.scope}</Badge>
            </div>
            <div className="small muted">{m.mission.description}</div>
            {m.mission.target > 1 && (
              <div className="mt-1" style={{ maxWidth: 240 }}>
                <ProgressBar value={m.progress} max={m.mission.target} label={`${m.mission.title} progress`} thin />
              </div>
            )}
          </div>
          <Badge tone={m.claimed ? 'success' : 'xp'}>{m.claimed ? `+${m.mission.xp} XP ✓` : `+${m.mission.xp} XP`}</Badge>
        </li>
      ))}
    </ul>
  );
}

const HABITS = [
  { id: 'protein', label: 'Included a protein food in most meals' },
  { id: 'veg', label: 'Ate vegetables or fruit' },
  { id: 'steps', label: 'Moved during the day (walk, stairs, chores)' },
  { id: 'wind-down', label: 'Screens off 30 minutes before bed' },
];

export default function ChecklistPage() {
  const { data, today, run } = useApp();
  const d = useDerived();
  const ticks = data.checklist[today] ?? [];
  const workoutDone = d.todayStatus === 'completed';
  const auto = [
    { label: d.todayWorkout ? `Complete today’s ${d.todayWorkout.title}` : 'Rest day — recover (nothing to do!)', done: d.todayWorkout ? workoutDone : true, to: '/app/workout' },
    { label: `Drink to your target (${((d.hydration.target?.ml ?? 0) / 1000).toFixed(1)} L)`, done: d.hydration.target ? dayTotal(data.hydration, today) >= d.hydration.target.ml : false, to: '/app/hydration' },
    { label: 'Log at least 2 meals', done: foodLoggedSlots(data, today) >= 2, to: '/app/food' },
    { label: 'Log last night’s sleep', done: sleepLogged(data, today), to: '/app/progress' },
  ];
  const total = auto.length + HABITS.length;
  const done = auto.filter((a) => a.done).length + HABITS.filter((h) => ticks.includes(h.id)).length;
  return (
    <>
      <PageHead title="Daily Checklist" sub={formatDate(today, { weekday: 'long', month: 'long', day: 'numeric' })} />
      <Card className="mb-3">
        <div className="row-between">
          <strong>
            {done} of {total} done
          </strong>
          <span className="small muted">No pressure — aim for “most days”, not perfection.</span>
        </div>
        <div className="mt-2">
          <ProgressBar value={done} max={total} label="Checklist progress" />
        </div>
      </Card>
      <div className="grid-2">
        <Card title="Tracked automatically">
          <ul className="list">
            {auto.map((a) => (
              <li key={a.label} className="list-row">
                <Icon name={a.done ? 'check' : 'target'} size={20} style={{ color: a.done ? 'var(--success)' : 'var(--muted)' }} />
                <span className="grow">{a.label}</span>
                {!a.done && (
                  <Link to={a.to} className="btn btn-ghost btn-sm">
                    Go
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Healthy habits (tick yourself)">
          {HABITS.map((h) => (
            <label key={h.id} className="check-row">
              <input type="checkbox" checked={ticks.includes(h.id)} onChange={() => run(toggleChecklist, h.id)} />
              <span>{h.label}</span>
            </label>
          ))}
          <p className="small muted mb-0">Habit ticks are for your own reflection and don’t earn XP — so there’s no reason to tick things you didn’t do.</p>
        </Card>
      </div>
      <Card title="Missions" className="mt-3">
        <p className="small muted">Missions award XP automatically once, when completed. They never reward extra training, less sleep or eating less.</p>
        <MissionList items={[...d.missions.daily, ...d.missions.weekly]} />
      </Card>
    </>
  );
}
