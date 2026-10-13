import { PageHead } from '../components/Layout';
import { Badge, Card, ProgressBar } from '../components/ui';
import { ACHIEVEMENTS } from '../data/achievements';
import { formatDate, toDateKey } from '../services/dates';
import { XP } from '../services/xp';
import { useApp } from '../store/AppStore';
import { useDerived } from '../store/hooks';

const CATS = { consistency: 'Consistency', training: 'Training', habits: 'Habits', battles: 'Battles', recovery: 'Recovery' } as const;

export default function AchievementsPage() {
  const { data } = useApp();
  const d = useDerived();
  const unlocked = new Map(data.achievements.map((a) => [a.achievementId, a.unlockedAt]));
  const recentXp = [...data.xp].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 12);
  return (
    <>
      <PageHead title="Achievements" sub={`${unlocked.size} of ${ACHIEVEMENTS.length} unlocked`} />
      <section className="card hero mb-3">
        <div className="row-between">
          <div>
            <div className="small muted">Level {d.level.level}</div>
            <h2 style={{ fontSize: '1.8rem', margin: 0 }}>{d.level.title}</h2>
          </div>
          <div className="text-center">
            <div className="timer-big" style={{ color: 'var(--accent)' }}>{d.xp}</div>
            <div className="small muted">total XP</div>
          </div>
        </div>
        <div className="mt-2">
          <ProgressBar value={d.level.progress} variant="xp" label="Progress to next level" />
          <div className="small muted mt-1">
            {d.level.next - d.xp} XP to level {d.level.level + 1}
          </div>
        </div>
      </section>
      {(Object.keys(CATS) as Array<keyof typeof CATS>).map((c) => (
        <Card key={c} title={CATS[c]} className="mb-3">
          <div className="grid-2">
            {ACHIEVEMENTS.filter((a) => a.category === c).map((a) => {
              const at = unlocked.get(a.id);
              return (
                <div key={a.id} className={`ach ${at ? '' : 'locked'}`} aria-label={`${a.name}: ${at ? 'unlocked' : 'locked'}`}>
                  <span className="ach-icon" aria-hidden="true">
                    {a.icon}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div className="ach-name">
                      {a.name} <Badge tone={at ? 'success' : undefined}>{at ? `Unlocked ${formatDate(toDateKey(new Date(at)))}` : `+${a.xp} XP`}</Badge>
                    </div>
                    <div className="small muted">{a.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
      <div className="grid-2">
        <Card title="How XP works">
          <ul className="bullets small">
            <li>Completed planned workout: {XP.workoutBase}–{XP.workoutBase + XP.workoutCompletionBonus} XP (scaled by sets completed)</li>
            <li>Full warm-up: {XP.warmup} XP · cooldown: {XP.cooldown} XP</li>
            <li>Comeback session: {XP.comeback} XP · optional mobility (once a day): {XP.mobility} XP</li>
            <li>Hydration target reached: {XP.hydration} XP · meals logged: {XP.food} XP · sleep logged: {XP.sleep} XP</li>
            <li>Every reward can only be earned once per activity — re-marking things never adds XP.</li>
            <li>No XP for extra workouts, training through pain, less sleep, eating less or drinking past your target.</li>
          </ul>
        </Card>
        <Card title="Recent XP">
          {recentXp.length === 0 ? (
            <p className="muted mb-0">No XP yet — your first workout is worth up to 125 XP.</p>
          ) : (
            <ul className="list">
              {recentXp.map((x) => (
                <li key={x.key} className="list-row">
                  <span className="grow small">{x.reason}</span>
                  <Badge tone="xp">+{x.amount}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
