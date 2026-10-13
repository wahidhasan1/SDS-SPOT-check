import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHead } from '../components/Layout';
import { Avatar, Badge, Button, Card, Field } from '../components/ui';
import { BODY_GOAL_MAP, GOAL_NAME } from '../data/bodyGoals';
import { ALLERGEN_LABEL, DIET_LABEL } from '../data/foods';
import { WEEKDAY_SHORT } from '../services/dates';
import { PATTERN_INFO } from '../services/plan';
import { cmToFtIn, kgToLb } from '../services/profileValidation';
import { LIMITATION_INFO } from '../services/safety';
import { updateProfile } from '../store/actions';
import { useApp } from '../store/AppStore';
import { useDerived } from '../store/hooks';
import { REGIONS } from './Onboarding';

export default function ProfilePage() {
  const { user, run, auth } = useApp();
  const d = useDerived();
  const p = d.profile;
  const [name, setName] = useState(p.displayName);
  const imperial = p.unitSystem === 'imperial';
  const fi = cmToFtIn(p.heightCm);
  const rows: Array<[string, string]> = [
    ['Age', `${p.age}`],
    ['Height', imperial ? `${fi.ft}′${fi.inch}″` : `${p.heightCm} cm`],
    ['Weight at setup', imperial ? `${kgToLb(p.weightKg)} lb` : `${p.weightKg} kg`],
    ['Region', REGIONS.find((r) => r.id === p.region)?.name ?? p.region],
    ['Experience', p.experience],
    ['Primary goal', GOAL_NAME[p.primaryGoal] + (p.secondaryGoal ? ` + ${GOAL_NAME[p.secondaryGoal]}` : '')],
    ['Body goal', BODY_GOAL_MAP[p.bodyGoal].name],
    ['Training pattern', PATTERN_INFO[d.plan.pattern].name],
    ['Training days', p.trainingDays.map((x) => WEEKDAY_SHORT[x]).join(', ')],
    ['Session length', `${p.dailyMinutes} min`],
    ['Timeline', `${p.timelineMonths} months (started ${d.plan.startDate})`],
    ['Diet', DIET_LABEL[p.diet] + (p.allergies.length ? ` · avoids ${p.allergies.map((a) => ALLERGEN_LABEL[a]).join(', ')}` : '')],
    ['Limitations', p.limitations.length ? p.limitations.map((l) => LIMITATION_INFO[l].label).join(', ') : 'None'],
  ];
  return (
    <>
      <PageHead title="Profile" actions={<Link to="/onboarding/profile" className="btn btn-secondary">Edit body profile & plan</Link>} />
      <div className="grid-3">
        <Card className="stack">
          <div className="row">
            <Avatar emoji={p.avatar.emoji} color={p.avatar.color} size="lg" />
            <div>
              <h2 className="mb-0">{p.displayName}</h2>
              <div className="small muted">{user?.isGuest ? 'Guest (this device only)' : user?.email}</div>
              <Badge tone="xp">
                Level {d.level.level} · {d.level.title}
              </Badge>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (run(updateProfile, { displayName: name.trim() })) {
                try {
                  if (!user?.isGuest) auth.rename(name);
                } catch {
                  /* account name optional */
                }
              }
            }}
            className="stack"
          >
            <Field label="Display name">{(f) => <input {...f} className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />}</Field>
            <Button type="submit" variant="secondary" disabled={name.trim() === p.displayName}>
              Save name
            </Button>
          </form>
        </Card>
        <Card title="Your plan inputs" className="span-2">
          {rows.map(([k, v]) => (
            <div className="review-row" key={k} style={{ gridTemplateColumns: '180px minmax(0,1fr)' }}>
              <span className="k">{k}</span>
              <span style={{ textTransform: k === 'Experience' ? 'capitalize' : undefined }}>{v}</span>
            </div>
          ))}
          <p className="small muted mt-2 mb-0">Changing these regenerates your plan from today. Completed workouts, streaks and XP are preserved.</p>
        </Card>
      </div>
    </>
  );
}
