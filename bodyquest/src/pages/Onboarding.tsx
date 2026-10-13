import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BrandMark, Icon } from '../components/Icon';
import { Badge, Button, Card, Field, Note, Segmented } from '../components/ui';
import { BodyGoalFigure } from '../components/visuals';
import { BODY_GOALS, BODY_GOAL_MAP, GOAL_NAME, PRIMARY_GOALS, suggestedBodyGoal } from '../data/bodyGoals';
import { ALLERGEN_LABEL, DIET_LABEL } from '../data/foods';
import type { ActivityLevel, Allergen, DietPreference, Experience, Limitation, Region, TimelineMonths, TrainingPattern, UserProfile, Weekday } from '../domain/types';
import { WEEK_ORDER, WEEKDAY_LONG, WEEKDAY_SHORT } from '../services/dates';
import { buildMilestones, buildPhases, buildWeekTemplate, PATTERN_INFO, recommendPattern } from '../services/plan';
import { cmToFtIn, ftInToCm, hasErrors, kgToLb, lbToKg, validateBody, validateGoals, type ProfileErrors } from '../services/profileValidation';
import { ageGroup, LIMITATION_INFO, needsMedicalClearance, requiresLowIntensity } from '../services/safety';
import { completeOnboarding, saveDraft } from '../store/actions';
import { useApp } from '../store/AppStore';
import { TEMPLATES } from '../services/workoutGenerator';

const STEPS = [
  { path: 'profile', label: 'Body profile' },
  { path: 'goal', label: 'Fitness goal' },
  { path: 'body-goal', label: 'Body goal' },
  { path: 'pattern', label: 'Training pattern' },
  { path: 'timeline', label: 'Timeline' },
  { path: 'review', label: 'Review' },
] as const;

export const REGIONS: Array<{ id: Region; name: string }> = [
  { id: 'BD', name: 'Bangladesh' },
  { id: 'IN', name: 'India' },
  { id: 'PK', name: 'Pakistan' },
  { id: 'GB', name: 'United Kingdom / Europe' },
  { id: 'US', name: 'United States / Canada' },
  { id: 'MENA', name: 'Middle East & North Africa' },
  { id: 'EAST_ASIA', name: 'East & Southeast Asia' },
  { id: 'OTHER', name: 'Other / international' },
];

export const ACTIVITY: Array<{ id: ActivityLevel; name: string; desc: string }> = [
  { id: 'sedentary', name: 'Mostly sitting', desc: 'Desk work, little walking' },
  { id: 'light', name: 'Lightly active', desc: 'Some walking or standing daily' },
  { id: 'moderate', name: 'Moderately active', desc: 'On your feet a lot, or regular sport' },
  { id: 'very-active', name: 'Very active', desc: 'Physical job or daily hard exercise' },
];

export const EXPERIENCE: Array<{ id: Experience; name: string; desc: string }> = [
  { id: 'beginner', name: 'Beginner', desc: 'New to training, or returning after a long break.' },
  { id: 'intermediate', name: 'Intermediate', desc: 'Trained consistently for 6+ months; can do ~10 push-ups.' },
  { id: 'advanced', name: 'Advanced', desc: 'Years of consistent training; comfortable with harder variations.' },
];

const AVATARS = ['💪', '🦁', '🐯', '🦊', '🐺', '🦅', '🐼', '🌟', '⚡', '🔥'];
const COLORS = ['#c8f031', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#10b981', '#ec4899', '#64748b'];

export function defaultDraft(name: string): Partial<UserProfile> {
  return {
    displayName: name === 'Guest' ? '' : name,
    unitSystem: 'metric',
    sex: 'unspecified',
    region: 'BD',
    activityLevel: 'light',
    sleepHours: 7,
    dailyMinutes: 30,
    trainingDays: [1, 3, 5] as Weekday[],
    limitations: [],
    limitationNotes: '',
    readiness: { heartConditionOrSupervised: false, chestPainOnActivity: false, dizzinessOrFainting: false, otherMedicalReason: false },
    diet: 'omnivore',
    allergies: [],
    secondaryGoal: null,
    timelineMonths: 6,
    avatar: { emoji: '💪', color: '#c8f031' },
  };
}

export default function Onboarding() {
  const { data, user, run } = useApp();
  const navigate = useNavigate();
  const loc = useLocation();
  const editing = Boolean(data.profile);
  const draft = useMemo<Partial<UserProfile>>(() => ({ ...defaultDraft(user?.displayName ?? ''), ...(data.profile ?? {}), ...(data.draft ?? {}) }), [data.draft, data.profile, user]);
  const update = (patch: Partial<UserProfile>) => run(saveDraft, patch);
  const stepIndex = Math.max(0, STEPS.findIndex((s) => loc.pathname.endsWith(`/${s.path}`)));
  const go = (i: number) => navigate(`/onboarding/${STEPS[i].path}`);

  useEffect(() => {
    document.title = `${STEPS[stepIndex].label} · Set up · BODYQUEST`;
    window.scrollTo({ top: 0 });
  }, [stepIndex]);

  const finish = () => {
    if (run(completeOnboarding, draft)) navigate('/app');
  };

  return (
    <div className="wizard">
      <div className="wizard-top">
        <Link to={editing ? '/app' : '/'} className="brand" style={{ padding: 0, color: 'inherit' }}>
          <BrandMark />
          <span className="brand-name">BODYQUEST</span>
        </Link>
        {editing ? (
          <Link to="/app" className="btn btn-ghost btn-sm">
            Cancel editing
          </Link>
        ) : (
          <span className="small muted">Step {stepIndex + 1} of {STEPS.length}</span>
        )}
      </div>
      <nav aria-label="Setup progress">
        <ol className="wizard-steps" style={{ listStyle: 'none', padding: 0 }}>
          {STEPS.map((s, i) => (
            <li key={s.path} className={`ws ${i < stepIndex ? 'done' : i === stepIndex ? 'current' : ''}`} aria-current={i === stepIndex ? 'step' : undefined}>
              <span className="sr-only">
                {s.label} {i < stepIndex ? '(done)' : ''}
              </span>
            </li>
          ))}
        </ol>
      </nav>
      <Routes>
        <Route index element={<Navigate to="profile" replace />} />
        <Route path="profile" element={<ProfileStep draft={draft} update={update} onNext={() => go(1)} />} />
        <Route path="goal" element={<GoalStep draft={draft} update={update} onBack={() => go(0)} onNext={() => go(2)} />} />
        <Route path="body-goal" element={<BodyGoalStep draft={draft} update={update} onBack={() => go(1)} onNext={() => go(3)} />} />
        <Route path="pattern" element={<PatternStep draft={draft} update={update} onBack={() => go(2)} onNext={() => go(4)} />} />
        <Route path="timeline" element={<TimelineStep draft={draft} update={update} onBack={() => go(3)} onNext={() => go(5)} />} />
        <Route path="review" element={<ReviewStep draft={draft} onBack={() => go(4)} onEdit={go} onFinish={finish} editing={editing} />} />
        <Route path="*" element={<Navigate to="profile" replace />} />
      </Routes>
    </div>
  );
}

interface StepProps {
  draft: Partial<UserProfile>;
  update: (p: Partial<UserProfile>) => void;
  onBack?: () => void;
  onNext: () => void;
}

function WizardFoot({ onBack, onNext, nextLabel = 'Continue' }: { onBack?: () => void; onNext: () => void; nextLabel?: string }) {
  return (
    <div className="wizard-foot">
      {onBack ? (
        <Button variant="secondary" icon="chevronLeft" onClick={onBack}>
          Back
        </Button>
      ) : (
        <span />
      )}
      <Button size="lg" onClick={onNext}>
        {nextLabel} <Icon name="chevronRight" />
      </Button>
    </div>
  );
}

function toggle<T>(arr: T[] | undefined, v: T): T[] {
  const a = arr ?? [];
  return a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
}

// ---------------------------------------------------------------- Step 1
function ProfileStep({ draft, update, onNext }: StepProps) {
  const [errors, setErrors] = useState<ProfileErrors>({});
  const imperial = draft.unitSystem === 'imperial';
  const ftIn = draft.heightCm ? cmToFtIn(draft.heightCm) : { ft: NaN, inch: NaN };
  const [ftStr, setFtStr] = useState(Number.isFinite(ftIn.ft) ? String(ftIn.ft) : '');
  const [inStr, setInStr] = useState(Number.isFinite(ftIn.inch) ? String(ftIn.inch) : '');
  const [lbStr, setLbStr] = useState(draft.weightKg ? String(kgToLb(draft.weightKg)) : '');
  const formRef = useRef<HTMLDivElement>(null);
  const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
  const group = draft.age ? ageGroup(draft.age) : null;
  const clearance = draft.readiness ? needsMedicalClearance(draft.readiness) : false;

  const switchUnits = (u: 'metric' | 'imperial') => {
    if (u === 'imperial') {
      const fi = draft.heightCm ? cmToFtIn(draft.heightCm) : null;
      setFtStr(fi ? String(fi.ft) : '');
      setInStr(fi ? String(fi.inch) : '');
      setLbStr(draft.weightKg ? String(kgToLb(draft.weightKg)) : '');
    }
    update({ unitSystem: u });
  };

  const next = () => {
    const e = validateBody(draft);
    setErrors(e);
    if (hasErrors(e)) {
      window.setTimeout(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
      return;
    }
    onNext();
  };

  return (
    <div ref={formRef}>
      <h1>Your body profile</h1>
      <p className="muted">We use this to build a safe, realistic plan. Only what’s needed is collected, and it stays on this device.</p>

      <Card title="About you" className="mt-3">
        <div className="form-grid">
          <Field label="Display name" error={errors.displayName}>
            {(p) => <input {...p} className="input" value={draft.displayName ?? ''} onChange={(e) => update({ displayName: e.target.value })} maxLength={40} />}
          </Field>
          <div className="field">
            <span className="label">Avatar</span>
            <div className="row">
              <div className="chips" role="radiogroup" aria-label="Avatar symbol">
                {AVATARS.map((a) => (
                  <button key={a} type="button" role="radio" className="chip" aria-checked={draft.avatar?.emoji === a} onClick={() => update({ avatar: { color: draft.avatar?.color ?? COLORS[0], emoji: a } })} aria-label={`Avatar ${a}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="chips" role="radiogroup" aria-label="Avatar colour">
              {COLORS.map((c) => (
                <button key={c} type="button" role="radio" className="chip" aria-checked={draft.avatar?.color === c} onClick={() => update({ avatar: { emoji: draft.avatar?.emoji ?? '💪', color: c } })} aria-label={`Colour ${c}`} style={{ width: 36, height: 36, padding: 0, background: c }} />
              ))}
            </div>
          </div>
          <Field label="Age" error={errors.age} hint="13 or older.">
            {(p) => <input {...p} className="input" type="number" inputMode="numeric" min={13} max={100} value={draft.age ?? ''} onChange={(e) => update({ age: num(e.target.value) })} />}
          </Field>
          <div className="field">
            <span className="label">Units</span>
            <Segmented
              label="Measurement units"
              value={draft.unitSystem ?? 'metric'}
              onChange={switchUnits}
              options={[
                { value: 'metric', label: 'Metric (cm, kg)' },
                { value: 'imperial', label: 'Imperial (ft, lb)' },
              ]}
            />
          </div>
          {imperial ? (
            <Field label="Height" error={errors.heightCm}>
              {(p) => (
                <div className="input-group">
                  <input
                    {...p}
                    aria-label="Height feet"
                    className="input"
                    type="number"
                    inputMode="numeric"
                    min={3}
                    max={8}
                    value={ftStr}
                    onChange={(e) => {
                      setFtStr(e.target.value);
                      const f = num(e.target.value);
                      const i = num(inStr) ?? 0;
                      update({ heightCm: f === undefined ? undefined : ftInToCm(f, i) });
                    }}
                  />
                  <span className="input-suffix">ft</span>
                  <input
                    aria-label="Height inches"
                    className="input"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={11}
                    value={inStr}
                    onChange={(e) => {
                      setInStr(e.target.value);
                      const f = num(ftStr);
                      const i = Math.min(11, Math.max(0, num(e.target.value) ?? 0));
                      update({ heightCm: f === undefined ? undefined : ftInToCm(f, i) });
                    }}
                  />
                  <span className="input-suffix">in</span>
                </div>
              )}
            </Field>
          ) : (
            <Field label="Height" error={errors.heightCm}>
              {(p) => (
                <div className="input-group">
                  <input {...p} className="input" type="number" inputMode="decimal" min={120} max={230} value={draft.heightCm ?? ''} onChange={(e) => update({ heightCm: num(e.target.value) })} />
                  <span className="input-suffix">cm</span>
                </div>
              )}
            </Field>
          )}
          {imperial ? (
            <Field label="Current weight" error={errors.weightKg}>
              {(p) => (
                <div className="input-group">
                  <input
                    {...p}
                    className="input"
                    type="number"
                    inputMode="decimal"
                    value={lbStr}
                    onChange={(e) => {
                      setLbStr(e.target.value);
                      const lb = num(e.target.value);
                      update({ weightKg: lb === undefined ? undefined : lbToKg(lb) });
                    }}
                  />
                  <span className="input-suffix">lb</span>
                </div>
              )}
            </Field>
          ) : (
            <Field label="Current weight" error={errors.weightKg}>
              {(p) => (
                <div className="input-group">
                  <input {...p} className="input" type="number" inputMode="decimal" min={30} max={300} step="0.1" value={draft.weightKg ?? ''} onChange={(e) => update({ weightKg: num(e.target.value) })} />
                  <span className="input-suffix">kg</span>
                </div>
              )}
            </Field>
          )}
          <Field label="Sex (optional)" hint="Only used to estimate energy needs. Choose “Prefer not to say” to see a range instead.">
            {(p) => (
              <select {...p} className="select" value={draft.sex} onChange={(e) => update({ sex: e.target.value as UserProfile['sex'] })}>
                <option value="unspecified">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            )}
          </Field>
          <Field label="Country or region" error={errors.region} hint="Used for local food suggestions.">
            {(p) => (
              <select {...p} className="select" value={draft.region} onChange={(e) => update({ region: e.target.value as Region })}>
                {REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        {group === 'teen' && (
          <div className="mt-2">
            <Note tone="info" title="Under 18">
              Your plan will use conservative volumes, no explosive jumping for beginners, no calorie targets, and battles only with other under-18 users. Please let a parent or guardian know you’re using BODYQUEST.
            </Note>
          </div>
        )}
      </Card>

      <Card title="Experience & lifestyle" className="mt-3">
        <div className="field">
          <span className="label">Fitness experience</span>
          <div className="grid-3" role="radiogroup" aria-label="Fitness experience">
            {EXPERIENCE.map((x) => (
              <button key={x.id} type="button" role="radio" aria-checked={draft.experience === x.id} className="option-card" onClick={() => update({ experience: x.id })}>
                <span className="title">{x.name}</span>
                <span className="desc">{x.desc}</span>
              </button>
            ))}
          </div>
          {errors.experience && <span className="error" role="alert">{errors.experience}</span>}
        </div>
        <div className="form-grid mt-3">
          <Field label="Current activity level" error={errors.activityLevel}>
            {(p) => (
              <select {...p} className="select" value={draft.activityLevel} onChange={(e) => update({ activityLevel: e.target.value as ActivityLevel })}>
                {ACTIVITY.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.desc}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Typical sleep per night" error={errors.sleepHours}>
            {(p) => (
              <div className="input-group">
                <input {...p} className="input" type="number" inputMode="decimal" step="0.5" min={3} max={14} value={draft.sleepHours ?? ''} onChange={(e) => update({ sleepHours: num(e.target.value) })} />
                <span className="input-suffix">hours</span>
              </div>
            )}
          </Field>
        </div>
      </Card>

      <Card title="Your schedule" className="mt-3">
        <div className="field">
          <span className="label">Time available per workout</span>
          <Segmented label="Daily workout time" value={draft.dailyMinutes ?? 30} onChange={(v) => update({ dailyMinutes: v })} options={[15, 20, 30, 45, 60].map((m) => ({ value: m as 15, label: `${m} min` }))} />
        </div>
        <div className="field mt-3">
          <span className="label" id="days-label">
            Preferred workout days
          </span>
          <div className="chips" role="group" aria-labelledby="days-label">
            {WEEK_ORDER.map((d) => (
              <button key={d} type="button" className="chip" aria-pressed={draft.trainingDays?.includes(d) ?? false} onClick={() => update({ trainingDays: toggle(draft.trainingDays, d).sort() as Weekday[] })} aria-label={WEEKDAY_LONG[d]}>
                {WEEKDAY_SHORT[d]}
              </button>
            ))}
          </div>
          <span className="hint">Pick days you can realistically keep. 2–4 days is plenty for most people. Weekend days are fine too.</span>
          {errors.trainingDays && <span className="error" role="alert">{errors.trainingDays}</span>}
        </div>
      </Card>

      <Card title="Health & safety" className="mt-3">
        <p className="small muted">Answer honestly — this keeps your plan safe. Nothing here is shared.</p>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ fontWeight: 700 }}>
            Readiness check
          </legend>
          {(
            [
              ['heartConditionOrSupervised', 'Has a doctor said you have a heart condition, or that you should only exercise with medical supervision?'],
              ['chestPainOnActivity', 'Do you feel chest pain or pressure during physical activity, or at rest?'],
              ['dizzinessOrFainting', 'Do you lose balance because of dizziness, or have you lost consciousness recently?'],
              ['otherMedicalReason', 'Is there any other medical reason (e.g. a condition, medication, recent illness) you should check before exercising?'],
            ] as const
          ).map(([k, q]) => (
            <label key={k} className="check-row">
              <input type="checkbox" checked={draft.readiness?.[k] ?? false} onChange={(e) => update({ readiness: { ...draft.readiness!, [k]: e.target.checked } })} />
              <span>{q}</span>
            </label>
          ))}
        </fieldset>
        {clearance && (
          <Note tone="warning" title="Please check with a health professional">
            Based on your answers, talk to a doctor before starting a new exercise programme. Until you confirm clearance in Settings, BODYQUEST will only give you gentle, low-intensity mobility sessions.
          </Note>
        )}
        <div className="field mt-3">
          <span className="label" id="lim-label">
            Exercise limitations or injuries
          </span>
          <div className="chips" role="group" aria-labelledby="lim-label">
            {(Object.keys(LIMITATION_INFO) as Limitation[]).map((l) => (
              <button key={l} type="button" className="chip" aria-pressed={draft.limitations?.includes(l) ?? false} onClick={() => update({ limitations: toggle(draft.limitations, l) })}>
                {LIMITATION_INFO[l].label}
              </button>
            ))}
          </div>
          <span className="hint">Selected limitations remove unsuitable exercises from your plan. This app does not diagnose injuries.</span>
        </div>
        <Field label="Anything else we should know? (optional)" error={errors.limitationNotes} className="mt-2">
          {(p) => <textarea {...p} className="textarea" maxLength={300} value={draft.limitationNotes ?? ''} onChange={(e) => update({ limitationNotes: e.target.value })} placeholder="e.g. old ankle sprain, prefer quiet exercises (no jumping, upstairs neighbours)" />}
        </Field>
      </Card>

      <Card title="Food preferences" className="mt-3">
        <div className="form-grid">
          <Field label="Dietary preference" error={errors.diet}>
            {(p) => (
              <select {...p} className="select" value={draft.diet} onChange={(e) => update({ diet: e.target.value as DietPreference })}>
                {(Object.keys(DIET_LABEL) as DietPreference[]).map((d) => (
                  <option key={d} value={d}>
                    {DIET_LABEL[d]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <div className="field full">
            <span className="label" id="allergy-label">
              Food allergies or intolerances
            </span>
            <div className="chips" role="group" aria-labelledby="allergy-label">
              {(Object.keys(ALLERGEN_LABEL) as Allergen[]).map((a) => (
                <button key={a} type="button" className="chip" aria-pressed={draft.allergies?.includes(a) ?? false} onClick={() => update({ allergies: toggle(draft.allergies, a) })}>
                  {ALLERGEN_LABEL[a]}
                </button>
              ))}
            </div>
            <span className="hint">Meals containing these are never suggested. Always check labels yourself — cross-contamination is possible (*oats may contain gluten).</span>
          </div>
        </div>
      </Card>
      {hasErrors(errors) && (
        <div className="mt-3">
          <Note tone="danger">Please fix the highlighted fields ({Object.keys(errors).length}).</Note>
        </div>
      )}
      <WizardFoot onNext={next} />
    </div>
  );
}

// ---------------------------------------------------------------- Step 2
function GoalStep({ draft, update, onBack, onNext }: StepProps) {
  const [errors, setErrors] = useState<ProfileErrors>({});
  const next = () => {
    const e = validateGoals(draft);
    setErrors(e);
    if (hasErrors(e)) return;
    if (!draft.bodyGoal) update({ bodyGoal: suggestedBodyGoal(draft.primaryGoal!, draft.experience ?? 'beginner') });
    onNext();
  };
  return (
    <div>
      <h1>What’s your main goal?</h1>
      <p className="muted">Pick one primary goal. You can add a secondary goal if it fits.</p>
      <div className="grid-2 mt-3" role="radiogroup" aria-label="Primary goal">
        {PRIMARY_GOALS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={draft.primaryGoal === g.id}
            className="option-card"
            onClick={() => update({ primaryGoal: g.id, secondaryGoal: draft.secondaryGoal === g.id ? null : draft.secondaryGoal, bodyGoal: suggestedBodyGoal(g.id, draft.experience ?? 'beginner') })}
          >
            <span className="title">{g.name}</span>
            <span className="desc">{g.description}</span>
          </button>
        ))}
      </div>
      {errors.primaryGoal && (
        <p className="error mt-2" role="alert" style={{ color: 'var(--danger)' }}>
          {errors.primaryGoal}
        </p>
      )}
      <h2 className="mt-4">Secondary goal (optional)</h2>
      <div className="chips" role="radiogroup" aria-label="Secondary goal">
        <button type="button" role="radio" className="chip" aria-checked={!draft.secondaryGoal} onClick={() => update({ secondaryGoal: null })}>
          None
        </button>
        {PRIMARY_GOALS.filter((g) => g.id !== draft.primaryGoal).map((g) => (
          <button key={g.id} type="button" role="radio" className="chip" aria-checked={draft.secondaryGoal === g.id} onClick={() => update({ secondaryGoal: g.id })}>
            {g.name}
          </button>
        ))}
      </div>
      {draft.primaryGoal === 'recomp' && (
        <div className="mt-3">
          <Note tone="info">Fat loss is optional, gradual and never extreme in BODYQUEST. You don’t need to lose weight to get fitter — performance and consistency matter just as much.</Note>
        </div>
      )}
      <WizardFoot onBack={onBack} onNext={next} />
    </div>
  );
}

// ---------------------------------------------------------------- Step 3
function BodyGoalStep({ draft, update, onBack, onNext }: StepProps) {
  const [error, setError] = useState('');
  return (
    <div>
      <h1>Choose your body goal</h1>
      <p className="muted">This sets your training emphasis. The highlighted areas show where your plan focuses more work.</p>
      <Note tone="info">
        These are generic illustrations of training styles — not predictions or guarantees of how anyone’s body will look. Results depend on genetics, consistency, nutrition, sleep and time. Nothing about your health is inferred from your choice.
      </Note>
      <div className="grid-auto mt-3">
        {BODY_GOALS.map((g) => {
          const selected = draft.bodyGoal === g.id;
          return (
            <div key={g.id} className={`card goal-card ${selected ? 'selected' : ''}`}>
              <div className="goal-figure">
                <BodyGoalFigure goal={g} title={`Illustration: ${g.name}`} />
              </div>
              <h3 className="mb-0">{g.name}</h3>
              <p className="small muted mb-0">{g.description}</p>
              <p className="small mb-0">
                <strong>Plan emphasis:</strong> {g.emphasis}
              </p>
              <Button
                variant={selected ? 'dark' : 'primary'}
                icon={selected ? 'check' : undefined}
                aria-pressed={selected}
                onClick={() => {
                  update({ bodyGoal: g.id });
                  setError('');
                }}
              >
                {selected ? 'Selected' : 'Choose This Goal'}
              </Button>
            </div>
          );
        })}
      </div>
      {error && (
        <p className="mt-2" role="alert" style={{ color: 'var(--danger)', fontWeight: 600 }}>
          {error}
        </p>
      )}
      <WizardFoot onBack={onBack} onNext={() => (draft.bodyGoal ? onNext() : setError('Choose a body goal to continue.'))} />
    </div>
  );
}

// ---------------------------------------------------------------- Step 4
function PatternStep({ draft, update, onBack, onNext }: StepProps) {
  const rec = recommendPattern(draft as UserProfile);
  const low = requiresLowIntensity(draft as UserProfile);
  useEffect(() => {
    if (!draft.trainingPattern || (low && draft.trainingPattern !== 'mobility-general')) update({ trainingPattern: rec.pattern });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const chosen = draft.trainingPattern ?? rec.pattern;
  const week = buildWeekTemplate(chosen, draft.trainingDays ?? [], { experience: draft.experience ?? 'beginner', age: draft.age ?? 30 });
  return (
    <div>
      <h1>Training pattern</h1>
      <p className="muted">How your sessions are organised across the week.</p>
      <Note tone="accent" icon="star" title={`Recommended for you: ${PATTERN_INFO[rec.pattern].name}`}>
        <ul className="bullets">
          {rec.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Note>
      <div className="grid-2 mt-3" role="radiogroup" aria-label="Training pattern">
        {(Object.keys(PATTERN_INFO) as TrainingPattern[]).map((p) => {
          const info = PATTERN_INFO[p];
          const disabled = low && p !== 'mobility-general';
          return (
            <button key={p} type="button" role="radio" aria-checked={chosen === p} disabled={disabled} className="option-card" onClick={() => update({ trainingPattern: p })} style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
              {p === rec.pattern && <span className="tagline">Recommended</span>}
              <span className="title">{info.name}</span>
              <span className="desc">{info.summary}</span>
              <span className="desc">
                <strong>Best for:</strong> {info.bestFor}
              </span>
            </button>
          );
        })}
      </div>
      {chosen === 'push-pull-legs' && draft.experience === 'beginner' && (
        <div className="mt-3">
          <Note tone="warning">Push/pull/legs is usually more than beginners need. Full-body sessions build technique faster. You can still choose it — recovery rules will apply.</Note>
        </div>
      )}
      <Card title="Your week with this pattern" className="mt-3">
        <div className="grid-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
          {WEEK_ORDER.map((d) => (
            <div key={d} className="card flat" style={{ padding: 10 }}>
              <div className="small muted" style={{ fontWeight: 700 }}>
                {WEEKDAY_SHORT[d]}
              </div>
              <div style={{ fontWeight: 750, fontSize: '0.88rem' }}>{week[d] ? TEMPLATES[week[d]!].title : 'Rest'}</div>
            </div>
          ))}
        </div>
        <p className="small muted mt-2 mb-0">Days training the same muscles back-to-back are automatically turned into lighter technique or mobility sessions.</p>
      </Card>
      <WizardFoot onBack={onBack} onNext={onNext} />
    </div>
  );
}

// ---------------------------------------------------------------- Step 5
function TimelineStep({ draft, update, onBack, onNext }: StepProps) {
  const months = draft.timelineMonths ?? 6;
  const phases = buildPhases(months);
  const milestones = buildMilestones(months, phases);
  return (
    <div>
      <h1>Transformation timeline</h1>
      <p className="muted">Choose your training horizon. This is how long your plan runs with progressive phases — not a guarantee of reaching a specific physique.</p>
      <div className="grid-4 mt-3" role="radiogroup" aria-label="Timeline">
        {([3, 6, 12, 24] as TimelineMonths[]).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={months === m} className="option-card" onClick={() => update({ timelineMonths: m })}>
            <span className="title" style={{ fontSize: '1.4rem' }}>
              {m} months
            </span>
            <span className="desc">{buildPhases(m).length} training phases</span>
          </button>
        ))}
      </div>
      <div className="grid-2 mt-3">
        <Card title="Phases">
          <ol className="list">
            {phases.map((p) => (
              <li key={p.index}>
                <div className="row-between">
                  <strong>{p.name}</strong>
                  <span className="badge">
                    Weeks {p.startWeek}–{p.endWeek}
                  </span>
                </div>
                <div className="small muted">{p.focus}</div>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="Milestones">
          <ol className="list" style={{ maxHeight: 420, overflow: 'auto' }}>
            {milestones.map((m) => (
              <li key={m.month}>
                <strong>Month {m.month}:</strong> {m.title}
                <div className="small muted">{m.description}</div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
      <WizardFoot onBack={onBack} onNext={onNext} />
    </div>
  );
}

// ---------------------------------------------------------------- Step 6
function ReviewStep({ draft, onBack, onEdit, onFinish, editing }: { draft: Partial<UserProfile>; onBack: () => void; onEdit: (i: number) => void; onFinish: () => void; editing: boolean }) {
  const [busy, setBusy] = useState(false);
  const imperial = draft.unitSystem === 'imperial';
  const h = draft.heightCm ? (imperial ? `${cmToFtIn(draft.heightCm).ft}′${cmToFtIn(draft.heightCm).inch}″` : `${draft.heightCm} cm`) : '—';
  const w = draft.weightKg ? (imperial ? `${kgToLb(draft.weightKg)} lb` : `${draft.weightKg} kg`) : '—';
  const low = requiresLowIntensity(draft as UserProfile);
  const rows: Array<[string, React.ReactNode, number]> = [
    ['Starting profile', `${draft.displayName || '—'} · ${draft.age ?? '—'} yrs · ${h} · ${w} · ${REGIONS.find((r) => r.id === draft.region)?.name ?? ''}`, 0],
    ['Experience', <span style={{ textTransform: 'capitalize' }}>{draft.experience}</span>, 0],
    ['Primary goal', `${draft.primaryGoal ? GOAL_NAME[draft.primaryGoal] : '—'}${draft.secondaryGoal ? ` + ${GOAL_NAME[draft.secondaryGoal]}` : ''}`, 1],
    ['Physique goal', draft.bodyGoal ? BODY_GOAL_MAP[draft.bodyGoal].name : '—', 2],
    ['Training pattern', draft.trainingPattern ? PATTERN_INFO[low ? 'mobility-general' : draft.trainingPattern].name : '—', 3],
    ['Weekly availability', (draft.trainingDays ?? []).map((d) => WEEKDAY_SHORT[d]).join(', ') || '—', 0],
    ['Time per session', `${draft.dailyMinutes} minutes`, 0],
    ['Timeline', `${draft.timelineMonths} months`, 4],
    ['Diet', `${draft.diet ? DIET_LABEL[draft.diet] : '—'}${draft.allergies?.length ? ` · avoids ${draft.allergies.map((a) => ALLERGEN_LABEL[a]).join(', ')}` : ''}`, 0],
    ['Exercise limitations', draft.limitations?.length ? draft.limitations.map((l) => LIMITATION_INFO[l].label).join(', ') : 'None reported', 0],
  ];
  return (
    <div>
      <h1>Review your plan inputs</h1>
      <p className="muted">Check everything looks right. You can edit any section.</p>
      <Card className="mt-3">
        {rows.map(([k, v, step]) => (
          <div className="review-row" key={k}>
            <span className="k">{k}</span>
            <span className="wrap-anywhere">{v}</span>
            <Button variant="ghost" size="sm" icon="edit" onClick={() => onEdit(step)} aria-label={`Edit ${k}`}>
              Edit
            </Button>
          </div>
        ))}
      </Card>
      {low && (
        <div className="mt-3">
          <Note tone="warning" title="Low-intensity mode">
            Because of your readiness answers or recent surgery, your plan starts with gentle mobility sessions. Please check with a health professional; you can update this later in Settings.
          </Note>
        </div>
      )}
      <div className="mt-3">
        <Note tone="info">
          BODYQUEST provides general fitness guidance and is not a substitute for a qualified healthcare professional. Stop exercising and seek help if you experience chest pain, faintness or sharp pain. See <Link to="/safety">Privacy & Safety</Link>.
        </Note>
      </div>
      <div className="wizard-foot">
        <Button variant="secondary" icon="chevronLeft" onClick={onBack}>
          Back
        </Button>
        <Button
          size="lg"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            onFinish();
            setBusy(false);
          }}
        >
          {busy ? 'Generating…' : editing ? 'Update my plan' : 'Generate my plan'} <Icon name="zap" />
        </Button>
      </div>
      <p className="small muted text-center">
        <Badge tone="accent">Rules-based engine</Badge> Plans are generated from a validated exercise library and safety rules — not a free-form AI.
      </p>
    </div>
  );
}
