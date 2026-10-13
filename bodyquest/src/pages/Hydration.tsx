import { useState, type FormEvent } from 'react';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import { Button, Card, EmptyState, Field, Modal, Note, Ring, Toggle } from '../components/ui';
import type { BeverageType } from '../domain/types';
import { addDays, formatDate } from '../services/dates';
import { dayTotal, HYDRATION_TIPS, hydrationWarnings, validateAmount } from '../services/hydration';
import { addWater, editWater, removeWater, updateHydrationSettings } from '../store/actions';
import { useApp } from '../store/AppStore';
import { hydrationTargetFor } from '../store/selectors';

const BEV: Record<BeverageType, string> = { water: 'Water', 'tea-coffee': 'Tea / coffee', milk: 'Milk', juice: 'Juice', other: 'Other' };

export default function HydrationPage() {
  const { data, today, run, now, pushToast } = useApp();
  const target = hydrationTargetFor(data, today)!;
  const total = dayTotal(data.hydration, today);
  const pct = total / target.ml;
  const entries = data.hydration.filter((h) => h.date === today).sort((a, b) => (a.at < b.at ? 1 : -1));
  const [custom, setCustom] = useState('');
  const [bev, setBev] = useState<BeverageType>('water');
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState<{ id: string; ml: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const s = data.hydrationSettings;

  const add = (ml: number) => {
    const v = validateAmount(ml);
    if (v) {
      setErr(v);
      return;
    }
    setErr('');
    const warns = hydrationWarnings(data.hydration, today, new Date(now()).toISOString(), ml, target);
    if (run(addWater, ml, bev)) {
      warns.forEach((w) => pushToast(w.level === 'info' ? 'info' : 'error', w.message));
      setCustom('');
    }
  };
  const submitCustom = (e: FormEvent) => {
    e.preventDefault();
    add(custom.trim() === '' ? NaN : Number(custom));
  };
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  return (
    <>
      <PageHead title="Hydration" sub="Drink regularly, follow your thirst, and adjust for heat and exercise." actions={<Button variant="secondary" icon="settings" onClick={() => setSettingsOpen(true)}>Hydration settings</Button>} />
      <div className="grid-3">
        <Card className="span-2">
          <div className="row" style={{ gap: 24, alignItems: 'center' }}>
            <Ring value={pct} size={150} stroke={14} color="var(--water)" label={`${total} of ${target.ml} millilitres`}>
              <span className="ring-value" style={{ fontSize: '1.5rem' }}>{(total / 1000).toFixed(2)} L</span>
              <div className="small muted">of {(target.ml / 1000).toFixed(1)} L</div>
            </Ring>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h2 className="mb-1">{target.isLimit ? 'Daily fluid limit' : 'Today’s drinks target'}</h2>
              <p className="small muted">{target.explanation}</p>
              <div className="row" role="group" aria-label="Drink type">
                {(Object.keys(BEV) as BeverageType[]).map((b) => (
                  <button key={b} type="button" className="chip" aria-pressed={bev === b} onClick={() => setBev(b)}>
                    {BEV[b]}
                  </button>
                ))}
              </div>
              <div className="row mt-2">
                {[150, 250, 500].map((ml) => (
                  <Button key={ml} icon="plus" onClick={() => add(ml)}>
                    {ml} ml
                  </Button>
                ))}
              </div>
              <form className="input-group mt-2" onSubmit={submitCustom} noValidate style={{ maxWidth: 340 }}>
                <label htmlFor="custom-ml" className="sr-only">
                  Custom amount in millilitres
                </label>
                <input id="custom-ml" className="input" type="number" inputMode="numeric" placeholder="Custom ml" value={custom} onChange={(e) => setCustom(e.target.value)} aria-invalid={Boolean(err)} aria-describedby={err ? 'ml-err' : undefined} />
                <Button type="submit" variant="secondary">
                  Add
                </Button>
              </form>
              {err && (
                <p id="ml-err" className="small mt-1 mb-0" role="alert" style={{ color: 'var(--danger)', fontWeight: 600 }}>
                  {err}
                </p>
              )}
            </div>
          </div>
        </Card>
        <Card title="Last 7 days">
          <ul className="list">
            {week.map((d) => {
              const t = dayTotal(data.hydration, d);
              const tg = hydrationTargetFor(data, d)!.ml;
              return (
                <li key={d} className="list-row">
                  <span className="grow small">{d === today ? 'Today' : formatDate(d)}</span>
                  <span className="small mono">{(t / 1000).toFixed(1)} L</span>
                  <span style={{ width: 70 }}>
                    <span className="progress water thin" style={{ display: 'block' }} role="img" aria-label={`${Math.round((t / tg) * 100)}%`}>
                      <span style={{ width: `${Math.min(100, (t / tg) * 100)}%` }} />
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="grid-2 mt-3">
        <Card title="Today’s entries">
          {entries.length === 0 ? (
            <EmptyState icon="droplet" title="No drinks logged yet">
              Use the quick-add buttons above.
            </EmptyState>
          ) : (
            <ul className="list">
              {entries.map((e) => (
                <li key={e.id} className="list-row">
                  <Icon name="droplet" size={18} style={{ color: 'var(--water)' }} />
                  <span className="grow">
                    {e.ml} ml {BEV[e.beverage].toLowerCase()}
                    <span className="small muted"> · {new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                  <button className="icon-btn" aria-label={`Edit ${e.ml} ml entry`} onClick={() => setEdit({ id: e.id, ml: String(e.ml) })}>
                    <Icon name="edit" size={18} />
                  </button>
                  <button className="icon-btn" aria-label={`Remove ${e.ml} ml entry`} onClick={() => run(removeWater, e.id)}>
                    <Icon name="trash" size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Hydration guidance">
          <ul className="bullets">
            {HYDRATION_TIPS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <div className="mt-2">
            <Note tone="warning">Don’t force large amounts quickly. Seek medical advice for confusion, severe headache, nausea or vomiting after drinking a lot — these can be signs of overhydration.</Note>
          </div>
        </Card>
      </div>

      {edit && (
        <Modal
          title="Edit entry"
          onClose={() => setEdit(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (run(editWater, edit.id, Number(edit.ml))) setEdit(null);
                }}
              >
                Save
              </Button>
            </>
          }
        >
          <Field label="Amount (ml)" error={validateAmount(Number(edit.ml)) ?? undefined}>
            {(p) => <input {...p} className="input" type="number" value={edit.ml} onChange={(e) => setEdit({ ...edit, ml: e.target.value })} />}
          </Field>
        </Modal>
      )}
      {settingsOpen && <HydrationSettingsModal onClose={() => setSettingsOpen(false)} initial={s} />}
    </>
  );
}

function HydrationSettingsModal({ onClose, initial }: { onClose: () => void; initial: ReturnType<typeof useApp>['data']['hydrationSettings'] }) {
  const { run, pushToast } = useApp();
  const [customOn, setCustomOn] = useState(initial.customTargetMl !== null);
  const [custom, setCustom] = useState(String(initial.customTargetMl ?? 2000));
  const [limitOn, setLimitOn] = useState(initial.medicalLimitMl !== null);
  const [limit, setLimit] = useState(String(initial.medicalLimitMl ?? 1500));
  const [hot, setHot] = useState(initial.hotClimate);
  const [rem, setRem] = useState(initial.remindersEnabled);
  const [interval, setIntervalMin] = useState(String(initial.reminderIntervalMin));
  const save = async () => {
    if (rem && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        /* in-app toasts are used instead */
      }
    }
    const ok = run(updateHydrationSettings, {
      customTargetMl: customOn ? Number(custom) : null,
      medicalLimitMl: limitOn ? Number(limit) : null,
      hotClimate: hot,
      remindersEnabled: rem,
      reminderIntervalMin: Number(interval),
    });
    if (ok) {
      if (rem) pushToast('info', 'Reminders only appear while BODYQUEST is open in a browser tab.');
      onClose();
    }
  };
  return (
    <Modal
      title="Hydration settings"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </>
      }
    >
      <Toggle label="Hot or humid climate" description="Adds about 500 ml to the starting estimate." checked={hot} onChange={setHot} />
      <Toggle label="Use my own daily target" checked={customOn} onChange={setCustomOn} />
      {customOn && (
        <Field label="Custom target (ml)" hint="500–6000 ml">
          {(p) => <input {...p} className="input" type="number" value={custom} onChange={(e) => setCustom(e.target.value)} />}
        </Field>
      )}
      <Toggle label="I have a medical fluid limit" description="If a doctor has limited your fluids (e.g. heart or kidney conditions), enter it here. It overrides every other target." checked={limitOn} onChange={setLimitOn} />
      {limitOn && (
        <Field label="Doctor-advised limit (ml per day)">
          {(p) => <input {...p} className="input" type="number" value={limit} onChange={(e) => setLimit(e.target.value)} />}
        </Field>
      )}
      <Toggle label="Gentle reminders" description="Only while this app is open in a browser tab (no push server in this build). Quiet 22:00–07:00." checked={rem} onChange={setRem} />
      {rem && (
        <Field label="Remind every (minutes)" hint="30–240">
          {(p) => <input {...p} className="input" type="number" value={interval} onChange={(e) => setIntervalMin(e.target.value)} />}
        </Field>
      )}
    </Modal>
  );
}
