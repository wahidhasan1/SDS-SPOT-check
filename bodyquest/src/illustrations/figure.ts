/**
 * Pose → geometry for BODYQUEST's instructional figures.
 *
 * Every illustration in the app is generated from a pose specification using
 * simple forward kinematics, so the figures are consistent, theme-aware, and
 * never depend on external/unlicensed image files.
 *
 * Angle convention (SVG coordinates): 0° = pointing right, 90° = pointing down,
 * -90° = pointing up, 180° = pointing left. Limb angles are absolute.
 * Side-view figures face right.
 */

export type Pt = [number, number];

export interface PoseSpec {
  /** side = profile view (default); front = facing viewer; top = viewed from above (lying). */
  view?: 'side' | 'front' | 'top';
  /** Direction from hip to shoulder. */
  torso: number;
  /** Spine curvature: + rounds the back toward the face-opposite side (cat), − arches (cow). */
  spine?: number;
  /** Direction from shoulder to head (defaults to torso). */
  head?: number;
  /** Near (side) / right-of-image (front, top) arm: [upper arm, forearm]. */
  armN: [number, number];
  armF: [number, number];
  /** [thigh, shin, foot?]. Foot defaults to shin − 90. */
  legN: [number, number, number?];
  legF: [number, number, number?];
  /** 'floor' grounds the lowest point on the floor line; 'none' centres vertically. */
  ground?: 'floor' | 'none';
  /** Lift off the floor (e.g. jumping). */
  lift?: number;
}

export type PropSpec =
  | { kind: 'wall'; side: 'front' | 'back' }
  | { kind: 'chair'; anchor: 'hands' | 'hips' | 'feet' | 'shoulders' | 'footF'; back?: 'left' | 'right' }
  | { kind: 'step'; anchor: 'footN' }
  | { kind: 'mat' }
  | { kind: 'towel'; from: 'handN'; to: 'footN' };

export const FIG = {
  width: 220,
  height: 168,
  floorY: 158,
  torso: 36,
  neck: 4,
  headR: 8,
  upperArm: 20,
  forearm: 19,
  thigh: 29,
  shin: 28,
  foot: 9,
  limbW: 7.5,
  torsoW: 14,
  shoulderHalf: 10,
  hipHalf: 6.5,
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const step = (p: Pt, angle: number, len: number): Pt => [p[0] + Math.cos(rad(angle)) * len, p[1] + Math.sin(rad(angle)) * len];

export interface Limb {
  pts: Pt[];
  layer: 'near' | 'far';
}

export interface FigureGeometry {
  view: 'side' | 'front' | 'top';
  hip: Pt;
  shoulder: Pt;
  spineCtrl: Pt | null;
  head: Pt;
  face: Pt | null;
  hipL: Pt;
  hipR: Pt;
  shoulderL: Pt;
  shoulderR: Pt;
  armN: Limb;
  armF: Limb;
  legN: Limb;
  legF: Limb;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

function computeRaw(p: PoseSpec): Omit<FigureGeometry, 'bbox'> {
  const view = p.view ?? 'side';
  const hip: Pt = [0, 0];
  const shoulder = step(hip, p.torso, FIG.torso);
  const perp = p.torso + 90;
  let spineCtrl: Pt | null = null;
  if (p.spine) {
    const mid: Pt = [(hip[0] + shoulder[0]) / 2, (hip[1] + shoulder[1]) / 2];
    spineCtrl = step(mid, p.torso - 90, p.spine);
  }
  const headAngle = p.head ?? p.torso;
  const head = step(shoulder, headAngle, FIG.neck + FIG.headR);
  const face = view === 'side' ? step(head, headAngle + 90, FIG.headR * 0.55) : null;

  const lateral = view === 'side' ? 0 : 1;
  const shoulderR = step(shoulder, perp, FIG.shoulderHalf * lateral);
  const shoulderL = step(shoulder, perp, -FIG.shoulderHalf * lateral);
  const hipR = step(hip, perp, FIG.hipHalf * lateral);
  const hipL = step(hip, perp, -FIG.hipHalf * lateral);

  const arm = (anchor: Pt, a: [number, number]): Pt[] => {
    const e = step(anchor, a[0], FIG.upperArm);
    const h = step(e, a[1], FIG.forearm);
    return [anchor, e, h];
  };
  const leg = (anchor: Pt, l: [number, number, number?]): Pt[] => {
    const k = step(anchor, l[0], FIG.thigh);
    const a = step(k, l[1], FIG.shin);
    const footAngle = l[2] ?? l[1] - 90;
    const t = step(a, footAngle, FIG.foot);
    return [anchor, k, a, t];
  };

  // In side view the far limbs share the near anchor. In front/top views, "N" is
  // on the image-right side of the torso axis.
  return {
    view,
    hip,
    shoulder,
    spineCtrl,
    head,
    face,
    hipL,
    hipR,
    shoulderL,
    shoulderR,
    armN: { pts: arm(view === 'side' ? shoulder : shoulderR, p.armN), layer: 'near' },
    armF: { pts: arm(view === 'side' ? shoulder : shoulderL, p.armF), layer: 'far' },
    legN: { pts: leg(view === 'side' ? hip : hipR, p.legN), layer: 'near' },
    legF: { pts: leg(view === 'side' ? hip : hipL, p.legF), layer: 'far' },
  };
}

function translate(g: Omit<FigureGeometry, 'bbox'>, dx: number, dy: number): Omit<FigureGeometry, 'bbox'> {
  const t = (p: Pt): Pt => [p[0] + dx, p[1] + dy];
  const tl = (l: Limb): Limb => ({ ...l, pts: l.pts.map(t) });
  return {
    ...g,
    hip: t(g.hip),
    shoulder: t(g.shoulder),
    spineCtrl: g.spineCtrl ? t(g.spineCtrl) : null,
    head: t(g.head),
    face: g.face ? t(g.face) : null,
    hipL: t(g.hipL),
    hipR: t(g.hipR),
    shoulderL: t(g.shoulderL),
    shoulderR: t(g.shoulderR),
    armN: tl(g.armN),
    armF: tl(g.armF),
    legN: tl(g.legN),
    legF: tl(g.legF),
  };
}

function bboxOf(g: Omit<FigureGeometry, 'bbox'>) {
  const pts: Array<[number, number, number]> = []; // x, y, radius
  const limbR = FIG.limbW / 2;
  for (const l of [g.armN, g.armF, g.legN, g.legF]) for (const p of l.pts) pts.push([p[0], p[1], limbR]);
  for (const p of [g.hip, g.shoulder, g.hipL, g.hipR, g.shoulderL, g.shoulderR]) pts.push([p[0], p[1], FIG.torsoW / 2]);
  pts.push([g.head[0], g.head[1], FIG.headR]);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y, r] of pts) {
    minX = Math.min(minX, x - r);
    maxX = Math.max(maxX, x + r);
    minY = Math.min(minY, y - r);
    maxY = Math.max(maxY, y + r);
  }
  return { minX, minY, maxX, maxY };
}

/** Compute the positioned geometry for a pose inside the standard frame. */
export function layoutFigure(p: PoseSpec): FigureGeometry {
  const raw = computeRaw(p);
  const bb = bboxOf(raw);
  const dx = FIG.width / 2 - (bb.minX + bb.maxX) / 2;
  let dy: number;
  if ((p.ground ?? (p.view === 'top' ? 'none' : 'floor')) === 'floor') {
    dy = FIG.floorY - bb.maxY - (p.lift ?? 0);
  } else {
    dy = FIG.height / 2 - (bb.minY + bb.maxY) / 2;
  }
  const g = translate(raw, dx, dy);
  return { ...g, bbox: bboxOf(g) };
}
