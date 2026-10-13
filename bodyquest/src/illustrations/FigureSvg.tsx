import { FIG, layoutFigure, type FigureGeometry, type Limb, type Pt } from './figure';
import { getPose } from './poses';

type PropKind = 'wall' | 'chair' | 'mat' | 'step';

interface Props {
  pose: string;
  props?: PropKind[];
  label?: string;
  title: string;
  className?: string;
}

/** Where to anchor a prop for a given pose (keeps the exercise data simple). */
const PROP_ANCHORS: Record<string, { wall?: 'front' | 'back'; chair?: 'hands' | 'hips' | 'feet' | 'shoulders' | 'footF'; chairBack?: 'left' | 'right' }> = {
  'wallpush-a': { wall: 'front' },
  'wallpush-b': { wall: 'front' },
  'wall-sit': { wall: 'back' },
  'calf-up': { wall: 'front' },
  'calf-one-up': { wall: 'front' },
  'calf-one-down': { wall: 'front' },
  'stand-wall-hand': { wall: 'front' },
  'quad-stretch': { wall: 'front' },
  'calf-stretch': { wall: 'front' },
  'chest-stretch': { wall: 'back' },
  'incline-a': { chair: 'hands', chairBack: 'right' },
  'incline-b': { chair: 'hands', chairBack: 'right' },
  'decline-top': { chair: 'feet', chairBack: 'left' },
  'decline-bottom': { chair: 'feet', chairBack: 'left' },
  'dip-top': { chair: 'hands', chairBack: 'left' },
  'dip-bottom': { chair: 'hands', chairBack: 'left' },
  'chair-squat-bottom': { chair: 'hips', chairBack: 'left' },
  'stand-arms-forward': { chair: 'hips', chairBack: 'left' },
  'thrust-down': { chair: 'shoulders', chairBack: 'left' },
  'thrust-up': { chair: 'shoulders', chairBack: 'left' },
  'bss-top': { chair: 'footF', chairBack: 'left' },
  'bss-bottom': { chair: 'footF', chairBack: 'left' },
};

function limbPath(l: Limb): string {
  return l.pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
}

function lowest(pts: Pt[]): Pt {
  return pts.reduce((a, b) => (b[1] > a[1] ? b : a));
}

function Chair({ x, seatY, back }: { x: number; seatY: number; back: 'left' | 'right' }) {
  const w = 30;
  const left = x - w / 2;
  const right = x + w / 2;
  const backX = back === 'left' ? left : right;
  const floor = FIG.floorY;
  return (
    <g className="fig-prop" aria-hidden="true">
      <rect x={left} y={seatY} width={w} height={4} rx={1.5} />
      <rect x={left + 2} y={seatY + 4} width={3} height={Math.max(0, floor - seatY - 4)} />
      <rect x={right - 5} y={seatY + 4} width={3} height={Math.max(0, floor - seatY - 4)} />
      <rect x={backX - (back === 'left' ? 0 : 3)} y={seatY - 26} width={3} height={26} />
    </g>
  );
}

export function FigureSvg({ pose, props = [], label, title, className }: Props) {
  const spec = getPose(pose);
  const g: FigureGeometry = layoutFigure(spec);
  const anchors = PROP_ANCHORS[pose] ?? {};
  const r = FIG.limbW / 2;
  const floor = FIG.floorY;
  const showFloor = (spec.view ?? 'side') !== 'top';

  const torsoPath = g.spineCtrl
    ? `M${g.hip[0]} ${g.hip[1]} Q${g.spineCtrl[0]} ${g.spineCtrl[1]} ${g.shoulder[0]} ${g.shoulder[1]}`
    : `M${g.hip[0]} ${g.hip[1]} L${g.shoulder[0]} ${g.shoulder[1]}`;

  const propEls: JSX.Element[] = [];
  if (props.includes('mat') && showFloor) {
    propEls.push(<rect key="mat" className="fig-mat" x={g.bbox.minX - 8} y={floor - 1} width={g.bbox.maxX - g.bbox.minX + 16} height={4} rx={2} />);
  }
  if (props.includes('wall')) {
    const side = anchors.wall ?? 'front';
    let x: number;
    if (side === 'front') {
      x = Math.max(g.armN.pts[2][0], g.armF.pts[2][0]) + r;
    } else {
      x = Math.min(g.hip[0], g.shoulder[0], g.armN.pts[2][0], g.armF.pts[2][0]) - FIG.torsoW / 2;
      if (pose === 'chest-stretch') x = Math.min(g.armN.pts[2][0], g.armF.pts[2][0]) - r;
      x -= 6;
    }
    propEls.push(
      <g key="wall" className="fig-prop" aria-hidden="true">
        <rect x={x} y={8} width={6} height={floor - 8} />
      </g>,
    );
  }
  if (props.includes('chair')) {
    const a = anchors.chair ?? 'hips';
    let pt: Pt;
    let extra = r;
    switch (a) {
      case 'hands':
        pt = lowest([g.armN.pts[2], g.armF.pts[2]]);
        break;
      case 'feet':
        pt = lowest([g.legN.pts[3], g.legF.pts[3], g.legN.pts[2], g.legF.pts[2]]);
        break;
      case 'footF':
        pt = lowest([g.legF.pts[2], g.legF.pts[3]]);
        break;
      case 'shoulders':
        pt = g.shoulder;
        extra = FIG.torsoW / 2;
        break;
      default:
        pt = g.hip;
        extra = FIG.torsoW / 2;
    }
    const seatY = pt[1] + extra;
    let cx = pt[0];
    if (a === 'hips' && pose === 'stand-arms-forward') cx = g.hip[0] - 22;
    if (seatY < floor - 6) propEls.push(<Chair key="chair" x={cx} seatY={seatY} back={anchors.chairBack ?? 'left'} />);
  }
  if (props.includes('step')) {
    const foot = g.legN.pts[2];
    const top = Math.max(foot[1], g.legN.pts[3][1]) + r;
    if (top < floor - 2) {
      propEls.push(
        <g key="step" className="fig-prop" aria-hidden="true">
          <rect x={foot[0] - 16} y={top} width={36} height={floor - top} rx={2} />
        </g>,
      );
    }
  }

  const front = (spec.view ?? 'side') !== 'side';

  return (
    <svg
      className={`figure-svg ${className ?? ''}`}
      viewBox={`0 0 ${FIG.width} ${FIG.height}`}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {showFloor && <line className="fig-floor" x1={6} x2={FIG.width - 6} y1={floor + 0.5} y2={floor + 0.5} />}
      {propEls}
      {/* far limbs behind the body */}
      <path className={front ? 'fig-limb fig-near' : 'fig-limb fig-far'} d={limbPath(g.legF)} strokeWidth={FIG.limbW} />
      <path className={front ? 'fig-limb fig-near' : 'fig-limb fig-far'} d={limbPath(g.armF)} strokeWidth={FIG.limbW} />
      {front && (
        <>
          <line className="fig-torso" x1={g.hipL[0]} y1={g.hipL[1]} x2={g.hipR[0]} y2={g.hipR[1]} strokeWidth={FIG.torsoW} />
          <line className="fig-torso" x1={g.shoulderL[0]} y1={g.shoulderL[1]} x2={g.shoulderR[0]} y2={g.shoulderR[1]} strokeWidth={FIG.torsoW} />
        </>
      )}
      <path className="fig-torso" d={torsoPath} strokeWidth={FIG.torsoW} fill="none" />
      <line className="fig-torso" x1={g.shoulder[0]} y1={g.shoulder[1]} x2={g.head[0]} y2={g.head[1]} strokeWidth={5} />
      <circle className="fig-head" cx={g.head[0]} cy={g.head[1]} r={FIG.headR} />
      {g.face && <circle className="fig-face" cx={g.face[0]} cy={g.face[1]} r={1.6} />}
      <path className="fig-limb fig-near" d={limbPath(g.legN)} strokeWidth={FIG.limbW} />
      <path className="fig-limb fig-near" d={limbPath(g.armN)} strokeWidth={FIG.limbW} />
      {label && (
        <text className="fig-label" x={8} y={16}>
          {label}
        </text>
      )}
    </svg>
  );
}
