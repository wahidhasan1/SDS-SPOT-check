import type { BodyGoalInfo } from '../data/bodyGoals';
import type { Exercise } from '../domain/types';
import { FigureSvg } from '../illustrations/FigureSvg';

/** Two-frame (or multi-frame) movement illustration for an exercise. */
export function ExerciseFrames({ exercise, compact, max }: { exercise: Exercise; compact?: boolean; max?: number }) {
  const frames = exercise.frames.slice(0, max ?? exercise.frames.length);
  return (
    <div className="frames" style={compact ? { gridTemplateColumns: `repeat(${frames.length}, minmax(0, 1fr))`, gap: 6 } : undefined}>
      {frames.map((f, i) => (
        <figure className="frame" key={i} style={{ margin: 0 }}>
          {frames.length > 1 && <span className="frame-step">{i + 1}</span>}
          <FigureSvg pose={f.pose} props={f.props} title={`${exercise.name} — ${f.label}`} />
          <figcaption className="frame-caption">{f.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/**
 * Stylised front-view silhouette for the body-goal gallery. These are generic illustrations
 * of a training emphasis — not predictions or promises of anyone’s results.
 */
export function BodyGoalFigure({ goal, title }: { goal: BodyGoalInfo; title: string }) {
  const { shoulders, waist, hips, arm, leg, highlight } = goal.shape;
  const cx = 80;
  const shY = 52;
  const waistY = 98;
  const hipY = 116;
  const hl = (k: string) => highlight.includes('whole') || highlight.includes(k as never);
  const torso = `M${cx - shoulders / 2} ${shY}
    Q${cx - shoulders / 2 - 2} ${shY + 22} ${cx - waist / 2} ${waistY}
    L${cx - hips / 2} ${hipY}
    L${cx + hips / 2} ${hipY}
    L${cx + waist / 2} ${waistY}
    Q${cx + shoulders / 2 + 2} ${shY + 22} ${cx + shoulders / 2} ${shY}
    Q${cx} ${shY - 8} ${cx - shoulders / 2} ${shY} Z`;
  const armL = `M${cx - shoulders / 2 + 2} ${shY + 4} L${cx - shoulders / 2 - 9} ${shY + 40} L${cx - shoulders / 2 - 11} ${shY + 76}`;
  const armR = `M${cx + shoulders / 2 - 2} ${shY + 4} L${cx + shoulders / 2 + 9} ${shY + 40} L${cx + shoulders / 2 + 11} ${shY + 76}`;
  const legL = `M${cx - hips / 4} ${hipY} L${cx - hips / 4 - 3} ${hipY + 42} L${cx - hips / 4 - 4} ${hipY + 82}`;
  const legR = `M${cx + hips / 4} ${hipY} L${cx + hips / 4 + 3} ${hipY + 42} L${cx + hips / 4 + 4} ${hipY + 82}`;
  return (
    <svg viewBox="0 0 160 210" role="img" aria-label={title}>
      <title>{title}</title>
      <ellipse className="bodyfig-ground" cx={cx} cy={203} rx={46} ry={5} />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={armL} stroke={hl('arms') ? 'var(--accent-strong)' : 'var(--fig-near)'} strokeWidth={arm} />
        <path d={armR} stroke={hl('arms') ? 'var(--accent-strong)' : 'var(--fig-near)'} strokeWidth={arm} />
        <path d={legL} stroke={hl('legs') ? 'var(--accent-strong)' : 'var(--fig-near)'} strokeWidth={leg} />
        <path d={legR} stroke={hl('legs') ? 'var(--accent-strong)' : 'var(--fig-near)'} strokeWidth={leg} />
      </g>
      <path d={torso} fill={highlight.includes('whole') ? 'var(--accent-strong)' : 'var(--fig-near)'} />
      {hl('shoulders') && !highlight.includes('whole') && (
        <g fill="var(--accent-strong)">
          <circle cx={cx - shoulders / 2 + 3} cy={shY + 3} r={arm * 0.85} />
          <circle cx={cx + shoulders / 2 - 3} cy={shY + 3} r={arm * 0.85} />
        </g>
      )}
      {hl('chest') && !highlight.includes('whole') && <rect x={cx - shoulders / 2 + 8} y={shY + 6} width={shoulders - 16} height={18} rx={8} fill="var(--accent-strong)" />}
      {hl('core') && !highlight.includes('whole') && <rect x={cx - waist / 2 + 4} y={shY + 28} width={waist - 8} height={30} rx={8} fill="var(--accent-strong)" opacity={0.9} />}
      <rect x={cx - 5} y={34} width={10} height={14} rx={4} fill="var(--fig-near)" />
      <circle cx={cx} cy={24} r={14} fill="var(--fig-near)" />
    </svg>
  );
}
