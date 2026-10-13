import { useMemo, useState, type FormEvent } from 'react';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import { Badge, Button, Card, EmptyState, Field, Modal, Note, ProgressBar, Segmented } from '../components/ui';
import { ALLERGEN_LABEL, FOODS, FOOD_DATA_SOURCE, FOOD_MAP } from '../data/foods';
import { SLOTS, SLOT_LABEL } from '../data/meals';
import type { Meal, MealSlot, NutritionPerServing } from '../domain/types';
import { addDays, diffDays, formatDate } from '../services/dates';
import { eligibleMeals, energyGuidance, fmtApprox, logTotals, mealAllergens, mealTotals, resolveMeal, SUPPLEMENT_NOTE } from '../services/nutrition';
import { addFood, removeFood, selectMeal, setMealStatus } from '../store/actions';
import { useApp } from '../store/AppStore';

type Status = 'as-planned' | 'partly' | 'different' | 'skipped';

function Macros({ n, unknown }: { n: NutritionPerServing; unknown: number }) {
  return (
    <div className="small">
      <span className="mono">
        {fmtApprox(n.kcal, ' kcal')} · P {fmtApprox(n.protein, 'g')} · C {fmtApprox(n.carbs, 'g')} · F {fmtApprox(n.fat, 'g')}
      </span>
      {unknown > 0 && <span className="muted"> · {unknown} item{unknown > 1 ? 's' : ''} not estimated</span>}
    </div>
  );
}

export default function FoodPlanner() {
  const { data, today, run } = useApp();
  const profile = data.profile!;
  const [date, setDate] = useState(today);
  const [replaceSlot, setReplaceSlot] = useState<MealSlot | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const day = data.mealDays[date];
  const guidance = energyGuidance(profile);
  const entries = data.foodLog.filter((e) => e.date === date);
  const totals = logTotals(entries);
  const canLog = diffDays(date, today) <= 0 && diffDays(today, date) <= 7;
  const dates = useMemo(() => Array.from({ length: 10 }, (_, i) => addDays(today, i - 3)), [today]);

  return (
    <>
      <PageHead title="Food Planner" sub="Practical, affordable meals from everyday foods. Log what you actually eat — perfection isn’t required." actions={canLog && <Button icon="plus" onClick={() => setAddOpen(true)}>Log food</Button>} />
      <div className="row mb-3" role="group" aria-label="Choose day" style={{ overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 4 }}>
        {dates.map((dt) => (
          <button key={dt} type="button" className="chip" aria-pressed={dt === date} onClick={() => setDate(dt)} style={{ flex: 'none' }}>
            {dt === today ? 'Today' : formatDate(dt, { weekday: 'short', day: 'numeric' })}
          </button>
        ))}
      </div>

      <div className="grid-3 mb-3">
        <Card title="Daily guide" className="span-2">
          {guidance.mode === 'targets' ? (
            <div className="stack">
              <div className="row" style={{ gap: 24 }}>
                <div className="stat">
                  <span className="value">
                    {guidance.kcalRange![0]}–{guidance.kcalRange![1]}
                  </span>
                  <span className="label">kcal per day (approximate range)</span>
                </div>
                <div className="stat">
                  <span className="value">
                    {guidance.proteinRange![0]}–{guidance.proteinRange![1]} g
                  </span>
                  <span className="label">protein per day</span>
                </div>
              </div>
              <p className="small mb-0">{guidance.goalAdjustment}</p>
              <p className="small muted mb-0">
                Estimated maintenance: {guidance.maintenance![0] === guidance.maintenance![1] ? guidance.maintenance![0] : `${guidance.maintenance![0]}–${guidance.maintenance![1]}`} kcal. {guidance.method}
              </p>
            </div>
          ) : (
            <Note tone="info" title="Balanced-eating guidance">
              <p>{guidance.reason}</p>
              <p className="mb-0">Build each meal around: a protein food (eggs, fish, dal, beans, chicken, milk/yogurt), a staple (rice, roti, potatoes), vegetables and fruit. Eat regularly and enough to fuel growth, training and recovery.</p>
            </Note>
          )}
        </Card>
        <Card title={date === today ? 'Logged today' : `Logged ${formatDate(date)}`}>
          {totals.knownItems + totals.unknownItems === 0 ? (
            <p className="muted mb-0">Nothing logged yet.</p>
          ) : (
            <div className="stack">
              <div className="stat">
                <span className="value">{fmtApprox(totals.kcal)}</span>
                <span className="label">kcal (approximate)</span>
              </div>
              {guidance.mode === 'targets' && <ProgressBar value={totals.kcal} max={guidance.kcalRange![1]} variant="food" label="Calories logged vs upper guide" />}
              <Macros n={totals} unknown={totals.unknownItems} />
              {guidance.mode === 'targets' && <ProgressBar value={totals.protein} max={guidance.proteinRange![0]} variant="food" label="Protein logged vs lower guide" />}
            </div>
          )}
        </Card>
      </div>

      {profile.allergies.length > 0 && (
        <div className="mb-3">
          <Note tone="info">
            Meals containing {profile.allergies.map((a) => ALLERGEN_LABEL[a].toLowerCase()).join(', ')} are excluded. Always check ingredient labels — cross-contamination is possible.
          </Note>
        </div>
      )}

      <div className="stack-lg">
        {SLOTS.map((slot) => {
          const meal = resolveMeal(date, slot, day?.selections[slot], profile);
          const status = day?.eaten[slot];
          const slotEntries = entries.filter((e) => e.slot === slot && !e.fromMealId);
          return (
            <Card key={slot} title={SLOT_LABEL[slot]} action={meal && <Button size="sm" variant="secondary" icon="swap" onClick={() => setReplaceSlot(slot)}>Replace meal</Button>}>
              {!meal ? (
                <EmptyState icon="food" title="No suitable suggestion">
                  No sample meal matches your diet and allergy settings for this slot. Log what you eat with “Log food”.
                </EmptyState>
              ) : (
                <MealView meal={meal} />
              )}
              {meal && canLog && (
                <div className="mt-3">
                  <span className="small" style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>
                    What did you actually eat?
                  </span>
                  <Segmented<Status | 'none'>
                    label={`${SLOT_LABEL[slot]} status`}
                    value={status ?? 'none'}
                    onChange={(v) => run(setMealStatus, date, slot, v === 'none' ? null : v)}
                    options={[
                      { value: 'as-planned', label: 'As planned' },
                      { value: 'partly', label: 'About half' },
                      { value: 'different', label: 'Something else' },
                      { value: 'skipped', label: 'Skipped' },
                      { value: 'none', label: 'Not yet' },
                    ]}
                  />
                  {status === 'different' && (
                    <p className="small muted mt-2 mb-0">
                      Use <button className="btn btn-ghost btn-sm" onClick={() => setAddOpen(true)}>Log food</button> to record what you had instead.
                    </p>
                  )}
                </div>
              )}
              {slotEntries.length > 0 && (
                <ul className="list mt-2">
                  {slotEntries.map((e) => {
                    const f = e.foodId ? FOOD_MAP[e.foodId] : null;
                    const n = f?.nutrition ? { kcal: f.nutrition.kcal * (e.servings ?? 1), protein: f.nutrition.protein * (e.servings ?? 1) } : e.customNutrition;
                    return (
                      <li key={e.id} className="list-row">
                        <span className="grow">
                          {f ? `${f.name} × ${e.servings}` : e.customName}
                          <span className="small muted">
                            {' '}
                            {n?.kcal !== undefined ? `· ${fmtApprox(n.kcal, ' kcal')}${f ? '' : ' (your estimate)'}` : '· nutrition not estimated'}
                          </span>
                        </span>
                        <button className="icon-btn" onClick={() => run(removeFood, e.id)} aria-label={`Remove ${f?.name ?? e.customName}`}>
                          <Icon name="trash" size={18} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      <div className="grid-2 mt-3">
        <Note tone="accent" icon="info" title="Supplements are optional">
          {SUPPLEMENT_NOTE}
        </Note>
        <Note title="About these numbers">{FOOD_DATA_SOURCE} BODYQUEST never prescribes extreme deficits, fasting, dehydration or rapid bulking.</Note>
      </div>

      {replaceSlot && (
        <Modal title={`Replace ${SLOT_LABEL[replaceSlot].toLowerCase()}`} onClose={() => setReplaceSlot(null)} wide>
          <p className="small muted">Showing meals that match your diet and allergy settings. Local options first.</p>
          <div className="grid-2">
            {eligibleMeals(replaceSlot, profile).map((m) => {
              const t = mealTotals(m);
              const current = resolveMeal(date, replaceSlot, day?.selections[replaceSlot], profile)?.id === m.id;
              return (
                <div key={m.id} className={`card flat stack ${current ? 'selected' : ''}`}>
                  <strong>{m.name}</strong>
                  <span className="small muted">{m.items.map((it) => FOOD_MAP[it.foodId]?.name).join(', ')}</span>
                  <Macros n={t} unknown={t.unknownItems} />
                  <Button
                    size="sm"
                    variant={current ? 'dark' : 'primary'}
                    disabled={current}
                    onClick={() => {
                      if (run(selectMeal, date, replaceSlot, m.id)) setReplaceSlot(null);
                    }}
                  >
                    {current ? 'Current meal' : 'Choose'}
                  </Button>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
      {addOpen && <AddFoodModal date={date} onClose={() => setAddOpen(false)} />}
    </>
  );
}

function MealView({ meal }: { meal: Meal }) {
  const t = mealTotals(meal);
  const allergens = mealAllergens(meal);
  return (
    <div className="grid-2">
      <div className="stack">
        <h3 className="mb-0">{meal.name}</h3>
        <ul className="list">
          {meal.items.map((it) => {
            const f = FOOD_MAP[it.foodId];
            return (
              <li key={it.foodId} className="list-row">
                <span className="grow">
                  {f.name}
                  {f.localName && <span className="small muted"> ({f.localName})</span>}
                </span>
                <span className="small muted">
                  {it.servings} × {f.serving}
                </span>
              </li>
            );
          })}
        </ul>
        <Macros n={t} unknown={t.unknownItems} />
        {allergens.length > 0 && (
          <div className="row" style={{ gap: 6 }}>
            <span className="small muted">Contains:</span>
            {allergens.map((a) => (
              <Badge key={a} tone="warning">
                {ALLERGEN_LABEL[a]}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="stack">
        <div>
          <span className="card-title">Preparation</span>
          <p className="small mt-1 mb-0">{meal.preparation}</p>
        </div>
        <div>
          <span className="card-title">Affordable alternatives</span>
          <ul className="bullets small mt-1">
            {meal.affordableAlternatives.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function AddFoodModal({ date, onClose }: { date: string; onClose: () => void }) {
  const { data, run } = useApp();
  const [mode, setMode] = useState<'db' | 'custom'>('db');
  const [slot, setSlot] = useState<MealSlot>('lunch');
  const [foodId, setFoodId] = useState('');
  const [servings, setServings] = useState('1');
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [error, setError] = useState('');
  const profile = data.profile!;
  const foods = FOODS.filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase()) || f.localName?.toLowerCase().includes(q.toLowerCase()));
  const sel = FOOD_MAP[foodId];
  const allergyHit = sel?.allergens.filter((a) => profile.allergies.includes(a)) ?? [];
  const num = (s: string) => (s.trim() === '' ? undefined : Number(s));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const ok =
      mode === 'db'
        ? (() => {
            if (!foodId) {
              setError('Choose a food from the list.');
              return false;
            }
            return run(addFood, { date, slot, foodId, servings: Number(servings) });
          })()
        : run(addFood, { date, slot, customName: name, customNutrition: kcal || protein ? { kcal: num(kcal), protein: num(protein) } : undefined });
    if (ok) onClose();
  };

  return (
    <Modal title={`Log food · ${formatDate(date)}`} onClose={onClose} wide>
      <form onSubmit={submit} className="stack-lg" noValidate>
        <div className="row">
          <Segmented
            label="Entry type"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'db', label: 'From food list' },
              { value: 'custom', label: 'Type it in' },
            ]}
          />
          <select className="select" style={{ width: 'auto' }} aria-label="Meal" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
            {SLOTS.map((s) => (
              <option key={s} value={s}>
                {SLOT_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        {mode === 'db' ? (
          <>
            <div className="field">
              <label htmlFor="food-q">Search foods</label>
              <input id="food-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="rice, dal, egg, banana…" />
            </div>
            <div className="field">
              <label htmlFor="food-sel">Food</label>
              <select id="food-sel" className="select" size={6} value={foodId} onChange={(e) => setFoodId(e.target.value)} aria-invalid={Boolean(error && !foodId)}>
                {foods.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} — {f.serving}
                    {f.nutrition ? ` (≈${f.nutrition.kcal} kcal)` : ' (not estimated)'}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Servings" hint={sel ? `1 serving = ${sel.serving}` : 'Between 0.25 and 10'}>
              {(p) => <input {...p} className="input" type="number" min={0.25} max={10} step={0.25} value={servings} onChange={(e) => setServings(e.target.value)} />}
            </Field>
            {sel && !sel.nutrition && <Note>Nutrition for “{sel.name}” varies too much by recipe, so it is logged without calorie or macro estimates.</Note>}
            {allergyHit.length > 0 && <Note tone="warning">This food contains {allergyHit.map((a) => ALLERGEN_LABEL[a]).join(', ')}, which you listed as an allergy or intolerance.</Note>}
          </>
        ) : (
          <>
            <Field label="What did you eat?">{(p) => <input {...p} className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken biryani, 1 plate" />}</Field>
            <div className="form-grid">
              <Field label="Calories (optional, your estimate)">{(p) => <input {...p} className="input" type="number" min={0} max={3000} value={kcal} onChange={(e) => setKcal(e.target.value)} />}</Field>
              <Field label="Protein g (optional)">{(p) => <input {...p} className="input" type="number" min={0} max={300} value={protein} onChange={(e) => setProtein(e.target.value)} />}</Field>
            </div>
            <p className="small muted mb-0">Leave values blank if you don’t know them — BODYQUEST won’t guess.</p>
          </>
        )}
        {error && <Note tone="danger">{error}</Note>}
        <div className="modal-foot" style={{ marginTop: 0 }}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add to log</Button>
        </div>
      </form>
    </Modal>
  );
}
