import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, LineChart } from '../components/charts';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import { Badge, Button, Card, EmptyState, Field, Modal, Note, Segmented } from '../components/ui';
import type { MeasurementKey, PerformanceKey, ProgressEntry } from '../domain/types';
import { MEASUREMENT_LABEL, movingAverage, PERFORMANCE_LABEL, personalRecords, series, weeklyConsistency, weightTrend } from '../services/analytics';
import { formatDate } from '../services/dates';
import { kgToLb, lbToKg } from '../services/profileValidation';
import { addPhotoMeta, addProgress, removePhotoMeta, removeProgress } from '../store/actions';
import { useApp } from '../store/AppStore';
import { useDerived } from '../store/hooks';
import { deletePhoto, fileToCompressedDataUrl, loadPhoto, savePhoto } from '../store/photos';
import { newId } from '../store/storage';

type Metric = MeasurementKey | PerformanceKey | 'sleepHours';

export default function ProgressPage() {
  const { data } = useApp();
  const d = useDerived();
  const [open, setOpen] = useState(false);
  const imperial = d.profile.unitSystem === 'imperial';
  const track = data.settings.trackBodyWeight;
  const metrics: Array<{ key: Metric; label: string }> = [
    ...(track ? [{ key: 'weightKg' as Metric, label: imperial ? 'Body weight (lb)' : 'Body weight (kg)' }] : []),
    ...(Object.keys(PERFORMANCE_LABEL) as PerformanceKey[]).map((k) => ({ key: k as Metric, label: PERFORMANCE_LABEL[k] })),
    { key: 'sleepHours', label: 'Sleep (hours)' },
    ...(['waistCm', 'chestCm', 'hipsCm', 'armCm', 'thighCm'] as MeasurementKey[]).map((k) => ({ key: k as Metric, label: MEASUREMENT_LABEL[k] })),
  ];
  const [metric, setMetric] = useState<Metric>(metrics[0].key);
  const pick = (e: ProgressEntry): number | undefined => {
    if (metric === 'sleepHours') return e.sleepHours;
    if (metric in PERFORMANCE_LABEL) return e.performance[metric as PerformanceKey];
    const v = e.measurements[metric as MeasurementKey];
    if (metric === 'weightKg' && v !== undefined && imperial) return kgToLb(v);
    return v;
  };
  const pts = series(data.progress, pick);
  const trend = metric === 'weightKg' ? movingAverage(pts, 7) : undefined;
  const consistency = weeklyConsistency(d.ctx, 8);
  const prs = personalRecords(data.progress, data.sessions);
  const history = data.sessions.filter((s) => s.status === 'completed').sort((a, b) => ((a.finishedAt ?? '') < (b.finishedAt ?? '') ? 1 : -1));
  const hiddenMeasure = data.settings.hideMeasurements && (metric.endsWith('Cm') || metric === 'weightKg');

  return (
    <>
      <PageHead title="Progress" sub="Look at long-term trends in performance, consistency and (optionally) measurements." actions={<Button icon="plus" onClick={() => setOpen(true)}>Record progress</Button>} />
      <div className="grid-4 mb-3">
        <Card>
          <div className="stat">
            <span className="value">{history.filter((s) => s.kind === 'planned').length}</span>
            <span className="label">Planned workouts completed</span>
          </div>
        </Card>
        <Card>
          <div className="stat">
            <span className="value">{d.streak.longest}</span>
            <span className="label">Best streak</span>
          </div>
        </Card>
        <Card>
          <div className="stat">
            <span className="value">{prs.length}</span>
            <span className="label">Personal records</span>
          </div>
        </Card>
        <Card>
          <div className="stat">
            <span className="value">{Math.round(history.reduce((s, x) => s + x.activeMs, 0) / 60000)}</span>
            <span className="label">Active minutes total</span>
          </div>
        </Card>
      </div>

      <div className="grid-3">
        <Card className="span-2" title="Trends" action={
          <select className="select" style={{ width: 'auto', minHeight: 36 }} value={metric} onChange={(e) => setMetric(e.target.value as Metric)} aria-label="Metric">
            {metrics.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        }>
          {hiddenMeasure ? (
            <Note icon="eyeOff">Measurements are hidden (Settings → Privacy). Turn off “Hide body measurements” to view this chart.</Note>
          ) : pts.length === 0 ? (
            <EmptyState icon="chart" title="No data yet" action={<Button onClick={() => setOpen(true)}>Record progress</Button>}>
              Log a value to start your chart.
            </EmptyState>
          ) : (
            <>
              <LineChart points={pts} trend={trend} unit={metric === 'weightKg' ? (imperial ? ' lb' : ' kg') : metric.endsWith('Cm') ? ' cm' : metric === 'sleepHours' ? ' h' : ''} label={metrics.find((m) => m.key === metric)!.label} />
              {metric === 'weightKg' && (
                <p className="small mt-2 mb-0">
                  <strong>Trend:</strong> {weightTrend(series(data.progress, (e) => e.measurements.weightKg)).text} The dashed line shows individual entries; the solid line is a 7-day average.
                </p>
              )}
            </>
          )}
        </Card>
        <Card title="Personal records">
          {prs.length === 0 ? (
            <p className="muted mb-0">Complete workouts and log performance tests (max push-ups, plank hold…) to see your records.</p>
          ) : (
            <ul className="list" style={{ maxHeight: 320, overflow: 'auto' }}>
              {prs.map((p) => (
                <li key={p.key} className="list-row">
                  <Icon name="trophy" size={18} style={{ color: 'var(--streak)' }} />
                  <span className="grow small">{p.label}</span>
                  <strong className="mono">
                    {p.value} {p.unit}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid-2 mt-3">
        <Card title="Weekly consistency (last 8 weeks)">
          {consistency.length ? (
            <BarChart label="Weekly consistency" bars={consistency.map((w) => ({ label: formatDate(w.weekStart, { month: 'short', day: 'numeric' }), value: w.pct, title: `Week of ${formatDate(w.weekStart)}: ${w.kept}/${w.due} due sessions kept` }))} />
          ) : (
            <p className="muted mb-0">Your first week is in progress.</p>
          )}
        </Card>
        <Card title="Workout history">
          {history.length === 0 ? (
            <p className="muted mb-0">No completed sessions yet. <Link to="/app/workout">Start today’s workout</Link>.</p>
          ) : (
            <ul className="list" style={{ maxHeight: 280, overflow: 'auto' }}>
              {history.map((s) => (
                <li key={s.id} className="list-row">
                  <span className="grow">
                    {s.workout.title}
                    <span className="small muted"> · {formatDate(s.performedDate ?? s.plannedDate)}</span>
                  </span>
                  <Badge>{Math.round(s.activeMs / 60000)} min</Badge>
                  <Badge tone="xp">+{s.xpAwarded} XP</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Entries" className="mt-3">
        {data.progress.length === 0 ? (
          <p className="muted mb-0">No entries yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Values</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...data.progress]
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .map((e) => (
                    <EntryRow key={e.id} e={e} imperial={imperial} hide={data.settings.hideMeasurements} />
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PhotoSection />
      {open && <RecordModal onClose={() => setOpen(false)} imperial={imperial} track={track} />}
    </>
  );
}

function EntryRow({ e, imperial, hide }: { e: ProgressEntry; imperial: boolean; hide: boolean }) {
  const { run } = useApp();
  const parts: string[] = [];
  for (const [k, v] of Object.entries(e.measurements)) {
    if (v === undefined) continue;
    if (hide) {
      parts.push(`${MEASUREMENT_LABEL[k as MeasurementKey].split(' (')[0]}: hidden`);
      continue;
    }
    parts.push(k === 'weightKg' ? `Weight ${imperial ? `${kgToLb(v)} lb` : `${v} kg`}` : `${MEASUREMENT_LABEL[k as MeasurementKey].split(' (')[0]} ${v} cm`);
  }
  for (const [k, v] of Object.entries(e.performance)) if (v !== undefined) parts.push(`${PERFORMANCE_LABEL[k as PerformanceKey].split(' (')[0]}: ${v}`);
  if (e.sleepHours !== undefined) parts.push(`Sleep ${e.sleepHours} h`);
  return (
    <tr>
      <td className="nowrap">{formatDate(e.date)}</td>
      <td className="small">
        {parts.join(' · ')}
        {e.note ? <span className="muted"> — {e.note}</span> : null}
      </td>
      <td>
        <button className="icon-btn" aria-label={`Delete entry from ${formatDate(e.date)}`} onClick={() => run(removeProgress, e.id)}>
          <Icon name="trash" size={18} />
        </button>
      </td>
    </tr>
  );
}

function RecordModal({ onClose, imperial, track }: { onClose: () => void; imperial: boolean; track: boolean }) {
  const { today, run } = useApp();
  const [date, setDate] = useState(today);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [showMeasure, setShowMeasure] = useState(false);
  const num = (k: string) => (vals[k]?.trim() ? Number(vals[k]) : undefined);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setVals({ ...vals, [k]: e.target.value });
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const w = num('weight');
    const measurements: ProgressEntry['measurements'] = {
      weightKg: w === undefined ? undefined : imperial ? lbToKg(w) : w,
      waistCm: num('waistCm'),
      chestCm: num('chestCm'),
      hipsCm: num('hipsCm'),
      armCm: num('armCm'),
      thighCm: num('thighCm'),
    };
    const performance: ProgressEntry['performance'] = { pushupMaxReps: num('pushupMaxReps'), plankSeconds: num('plankSeconds'), squats60s: num('squats60s'), wallSitSeconds: num('wallSitSeconds') };
    const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
    if (run(addProgress, { date, measurements: clean(measurements), performance: clean(performance), sleepHours: num('sleep'), note: note.trim() || undefined })) onClose();
  };
  return (
    <Modal title="Record progress" onClose={onClose} wide>
      <form onSubmit={submit} className="stack-lg" noValidate>
        <Field label="Date">{(p) => <input {...p} className="input" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <div>
          <h3>Performance tests</h3>
          <p className="small muted">Test once a month with good form, after a warm-up. Stop before form breaks — no all-out efforts needed.</p>
          <div className="form-grid">
            {(Object.keys(PERFORMANCE_LABEL) as PerformanceKey[]).map((k) => (
              <Field key={k} label={PERFORMANCE_LABEL[k]}>
                {(p) => <input {...p} className="input" type="number" inputMode="numeric" min={0} value={vals[k] ?? ''} onChange={set(k)} />}
              </Field>
            ))}
          </div>
        </div>
        <div className="form-grid">
          <Field label="Last night’s sleep (hours)">{(p) => <input {...p} className="input" type="number" step="0.5" min={0} max={16} value={vals.sleep ?? ''} onChange={set('sleep')} />}</Field>
          {track && (
            <Field label={`Body weight (${imperial ? 'lb' : 'kg'}) — optional`} hint="Weigh at a similar time of day. Daily ups and downs are normal (water, food).">
              {(p) => <input {...p} className="input" type="number" step="0.1" value={vals.weight ?? ''} onChange={set('weight')} />}
            </Field>
          )}
        </div>
        <div>
          <Button variant="ghost" size="sm" icon={showMeasure ? 'minus' : 'plus'} onClick={() => setShowMeasure(!showMeasure)} aria-expanded={showMeasure}>
            Optional body measurements
          </Button>
          {showMeasure && (
            <div className="form-grid mt-2">
              {(['waistCm', 'chestCm', 'hipsCm', 'armCm', 'thighCm'] as MeasurementKey[]).map((k) => (
                <Field key={k} label={MEASUREMENT_LABEL[k]}>
                  {(p) => <input {...p} className="input" type="number" step="0.5" value={vals[k] ?? ''} onChange={set(k)} />}
                </Field>
              ))}
            </div>
          )}
        </div>
        <Field label="Note (optional)">{(p) => <input {...p} className="input" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
        <div className="modal-foot" style={{ marginTop: 0 }}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Modal>
  );
}

function PhotoSection() {
  const { data, user, today, run, pushToast } = useApp();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'hidden' | 'shown'>('hidden');
  const ids = useMemo(() => data.photos.map((p) => p.id).join(','), [data.photos]);
  useEffect(() => {
    if (!user || mode === 'hidden') return;
    let cancelled = false;
    Promise.all(data.photos.map(async (p) => [p.id, await loadPhoto(user.id, p.id).catch(() => undefined)] as const)).then((pairs) => {
      if (!cancelled) setUrls(Object.fromEntries(pairs.filter(([, v]) => v).map(([k, v]) => [k, v!])));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, user, mode]);

  const onFile = async (f: File | undefined) => {
    if (!f || !user) return;
    setBusy(true);
    try {
      const url = await fileToCompressedDataUrl(f);
      const id = newId('photo');
      await savePhoto(user.id, id, url);
      run(addPhotoMeta, id, today, '');
      setUrls((u) => ({ ...u, [id]: url }));
    } catch (e) {
      pushToast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    if (!user) return;
    await deletePhoto(user.id, id).catch(() => undefined);
    run(removePhotoMeta, id);
  };

  return (
    <Card title="Progress photos (optional & private)" className="mt-3" action={
      <Segmented label="Photo visibility" value={mode} onChange={setMode} options={[{ value: 'hidden', label: 'Hidden' }, { value: 'shown', label: 'Show (blurred)' }]} />
    }>
      <Note icon="lock">
        Photos are stored only in this browser (IndexedDB), never uploaded, never used for assessments, and never shown in battles or leaderboards. They stay blurred until you tap to reveal. Deleting your account deletes them.
      </Note>
      <div className="row mt-2">
        <label className="btn btn-secondary" style={{ cursor: busy ? 'wait' : 'pointer' }}>
          <Icon name="camera" size={18} /> {busy ? 'Saving…' : 'Add photo'}
          <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <span className="small muted">{data.photos.length} photo(s)</span>
      </div>
      {mode === 'shown' && data.photos.length > 0 && (
        <div className="grid-4 mt-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
          {data.photos.map((p) => (
            <div key={p.id} className={`photo-thumb ${revealed[p.id] ? '' : 'blurred'}`}>
              {urls[p.id] ? <img src={urls[p.id]} alt={`Progress photo from ${formatDate(p.date)}`} /> : <div className="empty small">Loading…</div>}
              <div className="ph-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => setRevealed((r) => ({ ...r, [p.id]: !r[p.id] }))} aria-label={revealed[p.id] ? 'Blur photo' : 'Reveal photo'}>
                  <Icon name={revealed[p.id] ? 'eyeOff' : 'eye'} size={14} />
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => remove(p.id)} aria-label={`Delete photo from ${formatDate(p.date)}`}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
