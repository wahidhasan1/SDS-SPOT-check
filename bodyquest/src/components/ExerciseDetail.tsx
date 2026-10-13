import { Link } from 'react-router-dom';
import { CATEGORY_LABEL, DIFFICULTY_LABEL, EXERCISE_MAP } from '../data/exercises';
import type { Exercise, UserProfile } from '../domain/types';
import { cautionsFor, checkExercise, LIMITATION_INFO } from '../services/safety';
import { Badge, Note } from './ui';
import { ExerciseFrames } from './visuals';

const EQUIP_LABEL: Record<string, string> = { none: 'No equipment', wall: 'Wall', chair: 'Sturdy chair', towel: 'Towel', step: 'Stair step' };

export function doseText(d: { sets: number; reps?: [number, number]; seconds?: number }, unilateral = false): string {
  const per = unilateral ? ' each side' : '';
  if (d.reps) return `${d.sets} × ${d.reps[0]}–${d.reps[1]} reps${per}`;
  return `${d.sets} × ${d.seconds}s${per}`;
}

/** Reusable visual exercise manual. */
export function ExerciseDetail({ exercise: ex, profile, headingLevel = 1 }: { exercise: Exercise; profile?: UserProfile | null; headingLevel?: 1 | 2 }) {
  const H = headingLevel === 1 ? 'h1' : 'h2';
  const check = profile ? checkExercise(ex, profile) : null;
  const cautions = profile ? cautionsFor(ex, profile) : [];
  const alt = (ids: string[]) => ids.map((id) => EXERCISE_MAP[id]).filter(Boolean);
  return (
    <article className="stack-lg">
      <header>
        <H style={{ marginBottom: 8 }}>{ex.name}</H>
        <div className="row">
          <Badge tone="accent">{CATEGORY_LABEL[ex.category]}</Badge>
          <Badge>
            Difficulty {ex.difficulty}/5 · {DIFFICULTY_LABEL[ex.difficulty]}
          </Badge>
          {ex.equipment.map((e) => (
            <Badge key={e}>{EQUIP_LABEL[e]}</Badge>
          ))}
          <Badge tone={ex.impact === 'high' ? 'warning' : 'success'}>{ex.impact === 'high' ? 'High impact (jumping)' : 'Low impact'}</Badge>
          {ex.unilateral && <Badge tone="info">Each side</Badge>}
        </div>
      </header>

      {check && !check.allowed && (
        <Note tone="warning" title="Not part of your plan">
          <ul className="bullets">
            {check.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Note>
      )}
      {cautions.length > 0 && (
        <Note tone="info" title="For your limitations">
          <ul className="bullets">
            {cautions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Note>
      )}

      <section className="card">
        <h2 className="card-title mb-2">Movement illustration</h2>
        <ExerciseFrames exercise={ex} />
        <p className="small muted mt-2 mb-0">
          Illustrations show general body positions. They can’t guarantee correct technique — move slowly, use a mirror or phone video to check your form, and stop if anything hurts.
        </p>
      </section>

      <div className="grid-2">
        <section className="card">
          <h2 className="card-title mb-2">Starting position</h2>
          <p>{ex.instructions.startingPosition}</p>
          <h2 className="card-title mt-3 mb-2">Steps</h2>
          <ol className="steps-list">
            {ex.instructions.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
        <div className="stack">
          <section className="card">
            <h2 className="card-title mb-2">Body alignment</h2>
            <ul className="bullets">
              {ex.instructions.alignment.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <h2 className="card-title mt-3 mb-2">Breathing</h2>
            <p className="mb-0">{ex.instructions.breathing}</p>
          </section>
          <section className="card">
            <h2 className="card-title mb-2">Target muscles</h2>
            <div className="chips">
              {ex.muscles.map((m) => (
                <span key={m} className="badge">
                  {m.replace('-', ' ')}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2 className="card-title mb-2">Common mistakes</h2>
          <ul className="bullets">
            {ex.instructions.commonMistakes.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2 className="card-title mb-2">Safety notes</h2>
          <ul className="bullets">
            {ex.instructions.safetyNotes.map((s) => (
              <li key={s}>{s}</li>
            ))}
            {ex.contraindications.length > 0 && <li>Not used in plans for: {ex.contraindications.map((c) => LIMITATION_INFO[c].label.toLowerCase()).join(', ')}.</li>}
            <li>Stop immediately if you feel sharp pain, chest pain, dizziness or faintness.</li>
          </ul>
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2 className="card-title mb-2">Beginner modification</h2>
          <p>{ex.instructions.beginnerModification}</p>
          {alt(ex.easier).length > 0 && (
            <p className="mb-0">
              Easier exercises:{' '}
              {alt(ex.easier).map((e, i) => (
                <span key={e.id}>
                  {i > 0 && ', '}
                  <Link to={`/app/exercises/${e.id}`}>{e.name}</Link>
                </span>
              ))}
            </p>
          )}
        </section>
        <section className="card">
          <h2 className="card-title mb-2">Progression option</h2>
          <p>{ex.instructions.progressionOption}</p>
          {alt(ex.harder).length > 0 && (
            <p className="mb-0">
              Harder exercises:{' '}
              {alt(ex.harder).map((e, i) => (
                <span key={e.id}>
                  {i > 0 && ', '}
                  <Link to={`/app/exercises/${e.id}`}>{e.name}</Link>
                </span>
              ))}
            </p>
          )}
        </section>
      </div>

      <section className="card">
        <h2 className="card-title mb-2">Sets & reps guidance</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Level</th>
                <th scope="col">Dose</th>
                <th scope="col">Rest</th>
              </tr>
            </thead>
            <tbody>
              {(['beginner', 'intermediate', 'advanced'] as const).map((l) => (
                <tr key={l} className={profile?.experience === l ? 'me' : ''}>
                  <td style={{ textTransform: 'capitalize' }}>{l}</td>
                  <td>{doseText(ex.dosing[l], ex.unilateral)}</td>
                  <td>{ex.restSec}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted mt-2 mb-0">Leave 1–3 good reps “in the tank” on most sets. Training to failure is not required.</p>
      </section>
    </article>
  );
}
