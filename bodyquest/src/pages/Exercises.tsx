import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExerciseDetail } from '../components/ExerciseDetail';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import { Badge, EmptyState, Segmented } from '../components/ui';
import { ExerciseFrames } from '../components/visuals';
import { CATEGORY_LABEL, DIFFICULTY_LABEL, EXERCISES, EXERCISE_MAP } from '../data/exercises';
import type { ExerciseCategory } from '../domain/types';
import { isAllowed } from '../services/safety';
import { useApp } from '../store/AppStore';

export function ExerciseLibrary() {
  const { data } = useApp();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<ExerciseCategory | 'all'>('all');
  const [fit, setFit] = useState<'all' | 'mine'>('mine');
  const [maxDiff, setMaxDiff] = useState(5);
  const list = useMemo(
    () =>
      EXERCISES.filter((e) => (cat === 'all' || e.category === cat) && e.difficulty <= maxDiff)
        .filter((e) => fit === 'all' || !data.profile || isAllowed(e, data.profile))
        .filter((e) => {
          const s = q.trim().toLowerCase();
          return !s || e.name.toLowerCase().includes(s) || e.muscles.some((m) => m.includes(s)) || e.tags.some((t) => t.includes(s));
        }),
    [cat, maxDiff, fit, q, data.profile],
  );
  const cats = Object.keys(CATEGORY_LABEL) as ExerciseCategory[];
  return (
    <>
      <PageHead title="Exercise Library" sub={`${EXERCISES.length} equipment-free exercises with visual guides. No purchases required — a wall, a sturdy chair or a stair step at most.`} />
      <div className="card mb-3">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="ex-search">Search</label>
            <div className="input-group">
              <input id="ex-search" className="input" placeholder="e.g. push-up, glutes, core" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="ex-cat">Category</label>
            <select id="ex-cat" className="select" value={cat} onChange={(e) => setCat(e.target.value as ExerciseCategory | 'all')}>
              <option value="all">All categories</option>
              {cats.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="label">Show</span>
            <Segmented
              label="Filter by suitability"
              value={fit}
              onChange={setFit}
              options={[
                { value: 'mine', label: 'Suitable for me' },
                { value: 'all', label: 'All exercises' },
              ]}
            />
          </div>
          <div className="field">
            <label htmlFor="ex-diff">Max difficulty: {maxDiff} ({DIFFICULTY_LABEL[maxDiff as 1]})</label>
            <input id="ex-diff" type="range" min={1} max={5} value={maxDiff} onChange={(e) => setMaxDiff(Number(e.target.value))} />
          </div>
        </div>
      </div>
      <p className="small muted" role="status">
        {list.length} exercise{list.length === 1 ? '' : 's'}
      </p>
      {list.length === 0 ? (
        <EmptyState icon="search" title="No exercises match">
          Try a different search or show all exercises.
        </EmptyState>
      ) : (
        <div className="grid-auto">
          {list.map((e) => (
            <Link key={e.id} to={`/app/exercises/${e.id}`} className="card clickable stack" aria-label={`${e.name}, ${CATEGORY_LABEL[e.category]}, difficulty ${e.difficulty}`}>
              <ExerciseFrames exercise={e} compact max={2} />
              <div className="row-between">
                <strong>{e.name}</strong>
                <Icon name="chevronRight" size={18} />
              </div>
              <div className="row" style={{ gap: 6 }}>
                <Badge tone="accent">{CATEGORY_LABEL[e.category]}</Badge>
                <Badge>Lvl {e.difficulty}</Badge>
                {e.impact === 'high' && <Badge tone="warning">Jumping</Badge>}
                {data.profile && !isAllowed(e, data.profile) && <Badge tone="danger">Not in your plan</Badge>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export function ExerciseDetailPage() {
  const { id } = useParams();
  const { data } = useApp();
  const ex = id ? EXERCISE_MAP[id] : undefined;
  if (!ex) {
    return (
      <EmptyState icon="search" title="Exercise not found" action={<Link className="btn btn-primary" to="/app/exercises">Back to library</Link>}>
        This exercise isn’t in the library.
      </EmptyState>
    );
  }
  return (
    <>
      <nav aria-label="Breadcrumb" className="small mb-2">
        <Link to="/app/exercises">Exercise Library</Link> / <span className="muted">{ex.name}</span>
      </nav>
      <DocTitle title={ex.name} />
      <ExerciseDetail exercise={ex} profile={data.profile} />
    </>
  );
}

function DocTitle({ title }: { title: string }) {
  document.title = `${title} · BODYQUEST`;
  return null;
}
