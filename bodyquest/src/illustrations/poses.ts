import type { PoseSpec } from './figure';

/**
 * Pose library. Side-view figures face right. See figure.ts for the angle convention.
 * Poses are reused across exercises (e.g. "high-plank" is the start of push-ups and
 * mountain climbers) so illustrations stay consistent throughout the app.
 */

type Arm = [number, number];
type Leg = [number, number, number?];

const ARMS_DOWN: { armN: Arm; armF: Arm } = { armN: [96, 86], armF: [86, 94] };
const ARMS_FORWARD: { armN: Arm; armF: Arm } = { armN: [-2, -2], armF: [3, 3] };
const ARMS_UP: { armN: Arm; armF: Arm } = { armN: [-94, -92], armF: [-86, -88] };
const HANDS_HIPS: { armN: Arm; armF: Arm } = { armN: [118, 38], armF: [112, 45] };
const LEGS_STAND: { legN: Leg; legF: Leg } = { legN: [90, 90, 0], legF: [93, 90, 0] };

// Front-view (facing the viewer) building blocks. N = image-right side.
const F_LEGS_CLOSED: { legN: Leg; legF: Leg } = { legN: [86, 90, 20], legF: [94, 90, 160] };
const F_LEGS_WIDE: { legN: Leg; legF: Leg } = { legN: [72, 82, 15], legF: [108, 98, 165] };
const F_ARMS_DOWN: { armN: Arm; armF: Arm } = { armN: [80, 86], armF: [100, 94] };

export const POSES: Record<string, PoseSpec> = {
  // ---------------------------------------------------------------- standing
  stand: { torso: -90, ...ARMS_DOWN, ...LEGS_STAND },
  'stand-arms-forward': { torso: -90, ...ARMS_FORWARD, ...LEGS_STAND },
  'stand-hands-hips': { torso: -90, ...HANDS_HIPS, ...LEGS_STAND },
  'stand-arms-up': { torso: -90, ...ARMS_UP, ...LEGS_STAND },
  'march-a': { torso: -90, armN: [128, 100], armF: [60, -25], legN: [12, 95, 5], legF: [90, 90, 0] },
  'march-b': { torso: -90, armN: [60, -25], armF: [128, 100], legN: [90, 90, 0], legF: [12, 95, 5] },
  'highknee-a': { torso: -88, armN: [130, 100], armF: [55, -35], legN: [-5, 95, 20], legF: [92, 95, 55], lift: 6 },
  'highknee-b': { torso: -88, armN: [55, -35], armF: [130, 100], legN: [92, 95, 55], legF: [-5, 95, 20], lift: 6 },
  'armswing-a': { torso: -90, armN: [-55, -55], armF: [-65, -65], ...LEGS_STAND },
  'armswing-b': { torso: -90, armN: [130, 130], armF: [140, 140], ...LEGS_STAND },
  'ankle-a': { torso: -90, ...HANDS_HIPS, legN: [55, 80, -25], legF: [92, 90, 0] },
  'ankle-b': { torso: -90, ...HANDS_HIPS, legN: [55, 80, 55], legF: [92, 90, 0] },
  'legswing-front': { torso: -92, armN: [118, 38], armF: [10, 10], legN: [35, 35, -40], legF: [92, 90, 0] },
  'legswing-back': { torso: -86, armN: [118, 38], armF: [10, 10], legN: [118, 118, 40], legF: [90, 90, 0] },
  'boxing-a': { torso: -86, armN: [70, -70], armF: [60, -60], legN: [72, 92, 0], legF: [112, 100, 30] },
  'boxing-b': { torso: -84, armN: [-5, -3], armF: [70, -75], legN: [72, 92, 0], legF: [112, 100, 30] },

  // ---------------------------------------------------------------- squats / lunges
  'squat-bottom': { torso: -50, armN: [-10, -10], armF: [-6, -6], legN: [10, 110, 0], legF: [13, 112, 0] },
  'squat-deep': { torso: -66, armN: [55, -45], armF: [60, -40], legN: [-6, 116, 0], legF: [-3, 118, 0] },
  'chair-squat-bottom': { torso: -62, armN: [-8, -8], armF: [-4, -4], legN: [0, 98, 0], legF: [3, 100, 0] },
  'wall-sit': { torso: -90, armN: [92, 88], armF: [88, 92], legN: [0, 90, 0], legF: [3, 90, 0] },
  'jump-air': { torso: -90, armN: [-80, -85], armF: [-95, -95], legN: [90, 92, 60], legF: [94, 96, 62], lift: 16 },
  'lunge-bottom': { torso: -90, ...HANDS_HIPS, legN: [10, 95, 0], legF: [110, 185, 95] },
  'split-top': { torso: -90, ...HANDS_HIPS, legN: [80, 90, 0], legF: [115, 115, 60] },
  'stepup-a': { torso: -84, ...ARMS_DOWN, legN: [14, 100, 0], legF: [95, 90, 0] },
  'stepup-b': { torso: -90, ...ARMS_DOWN, legN: [90, 90, 0], legF: [70, 110, 20], lift: 20 },
  'bss-top': { torso: -88, ...HANDS_HIPS, legN: [78, 92, 0], legF: [112, 205, 180] },
  'bss-bottom': { torso: -80, ...HANDS_HIPS, legN: [14, 100, 0], legF: [100, 228, 180] },
  'front-stand-wide': { view: 'front', torso: -90, ...F_ARMS_DOWN, ...F_LEGS_WIDE },
  'front-lateral-lunge': { view: 'front', torso: -80, armN: [100, 150], armF: [80, 30], legN: [40, 102, 15], legF: [124, 124, 165] },

  // ---------------------------------------------------------------- hinges / bridges
  hinge: { torso: -38, armN: [92, 90], armF: [88, 88], legN: [80, 96, 0], legF: [83, 97, 0] },
  'single-leg-rdl': { torso: -6, armN: [90, 90], armF: [86, 86], legN: [86, 94, 0], legF: [174, 174, 120] },
  'bridge-down': { torso: 180, head: 180, armN: [4, 0], armF: [6, 2], legN: [-50, 100, 0], legF: [-47, 103, 0] },
  'bridge-up': { torso: 160, head: 180, armN: [6, 0], armF: [8, 2], legN: [-20, 100, 0], legF: [-17, 103, 0] },
  'slbridge-down': { torso: 180, head: 180, armN: [4, 0], armF: [6, 2], legN: [-38, -38, -110], legF: [-48, 101, 0] },
  'slbridge-up': { torso: 160, head: 180, armN: [6, 0], armF: [8, 2], legN: [-20, -20, -100], legF: [-18, 102, 0] },
  'thrust-down': { torso: -148, head: -150, armN: [170, 175], armF: [168, 172], legN: [-40, 95, 0], legF: [-37, 97, 0] },
  'thrust-up': { torso: 180, head: 180, armN: [178, 178], armF: [176, 176], legN: [0, 90, 0], legF: [3, 92, 0] },
  'calf-up': { torso: -90, armN: [-8, 0], armF: [96, 86], legN: [90, 90, 55], legF: [93, 90, 55] },
  'calf-one-up': { torso: -90, armN: [-8, 0], armF: [96, 86], legN: [90, 90, 55], legF: [100, 165] },
  'calf-one-down': { torso: -90, armN: [-8, 0], armF: [96, 86], legN: [90, 90, 0], legF: [100, 165] },
  'stand-wall-hand': { torso: -90, armN: [-8, 0], armF: [96, 86], ...LEGS_STAND },

  // ---------------------------------------------------------------- push
  'wallpush-a': { torso: -64, armN: [-4, -4], armF: [0, 0], legN: [116, 116, 20], legF: [118, 118, 22] },
  'wallpush-b': { torso: -54, armN: [62, -30], armF: [66, -26], legN: [126, 126, 30], legF: [128, 128, 32] },
  'incline-a': { torso: -36, armN: [94, 94], armF: [90, 90], legN: [144, 144], legF: [146, 146] },
  'incline-b': { torso: -24, armN: [-165, 72], armF: [-162, 76], legN: [156, 156], legF: [158, 158] },
  'kneepush-a': { torso: -37, armN: [92, 92], armF: [88, 88], legN: [143, -158, -158], legF: [145, -155, -155] },
  'kneepush-b': { torso: -12, armN: [-165, 75], armF: [-162, 78], legN: [168, -150, -150], legF: [170, -147, -147] },
  'high-plank': { torso: -19, armN: [92, 92], armF: [88, 88], legN: [161, 161], legF: [162, 162] },
  'pushup-bottom': { torso: -3, armN: [-165, 75], armF: [-162, 78], legN: [177, 177], legF: [178, 178] },
  'high-plank-tap': { torso: -19, armN: [92, 92], armF: [-120, 30], legN: [161, 161], legF: [162, 162] },
  'pike-top': { torso: 46, head: 70, armN: [46, 48], armF: [44, 46], legN: [110, 110, 20], legF: [112, 112, 22] },
  'pike-bottom': { torso: 64, head: 85, armN: [18, 100], armF: [22, 104], legN: [110, 110, 20], legF: [112, 112, 22] },
  'decline-top': { torso: 14, armN: [92, 92], armF: [88, 88], legN: [-166, -166, -76], legF: [-165, -165, -75] },
  'decline-bottom': { torso: 17, armN: [-150, 82], armF: [-147, 85], legN: [-156, -156, -66], legF: [-155, -155, -65] },
  'dip-top': { torso: -90, armN: [100, 92], armF: [98, 90], legN: [0, 90, 0], legF: [3, 92, 0] },
  'dip-bottom': { torso: -90, armN: [176, 90], armF: [172, 92], legN: [-25, 75, 0], legF: [-22, 78, 0] },

  // ---------------------------------------------------------------- pull / posterior (top view = from above)
  'ytw-y': { view: 'top', torso: -90, armN: [-60, -60], armF: [-120, -120], legN: [88, 90, 90], legF: [92, 90, 90] },
  'ytw-t': { view: 'top', torso: -90, armN: [0, 0], armF: [180, 180], legN: [88, 90, 90], legF: [92, 90, 90] },
  'ytw-w': { view: 'top', torso: -90, armN: [35, -55], armF: [145, -125], legN: [88, 90, 90], legF: [92, 90, 90] },
  'rsa-a': { view: 'top', torso: -90, armN: [82, 86], armF: [98, 94], legN: [88, 90, 90], legF: [92, 90, 90] },
  'rsa-b': { view: 'top', torso: -90, armN: [-72, -76], armF: [-108, -104], legN: [88, 90, 90], legF: [92, 90, 90] },
  'prone-flat': { torso: 0, head: 2, armN: [0, 0], armF: [2, 2], legN: [180, 180, 180], legF: [180, 180, 180] },
  'superman-up': { torso: -9, head: -14, armN: [-10, -10], armF: [-7, -7], legN: [172, 172, 172], legF: [173, 173, 173] },
  sphinx: { torso: -28, head: -40, armN: [90, 0], armF: [92, 2], legN: [180, 180, 180], legF: [180, 180, 180] },
  'wallangel-a': { view: 'front', torso: -90, armN: [15, -90], armF: [165, -90], ...F_LEGS_CLOSED },
  'wallangel-b': { view: 'front', torso: -90, armN: [-50, -65], armF: [-130, -115], ...F_LEGS_CLOSED },

  // ---------------------------------------------------------------- core
  'forearm-plank': { torso: -7, armN: [90, 0], armF: [92, 2], legN: [173, 173], legF: [174, 174] },
  'knee-plank': { torso: -18, armN: [90, 0], armF: [92, 2], legN: [162, -155, -155], legF: [164, -152, -152] },
  'side-plank': { view: 'front', torso: -14, armN: [90, 0], armF: [-90, -90], legN: [166, 166, 166], legF: [166, 166, 166] },
  'knee-side-plank': { view: 'front', torso: -24, armN: [90, 0], armF: [-90, -90], legN: [156, 215, 215], legF: [156, 215, 215] },
  'deadbug-a': { torso: 180, head: 180, armN: [-90, -90], armF: [-93, -93], legN: [-88, 2, -88], legF: [-92, -2, -92] },
  'deadbug-b': { torso: 180, head: 180, armN: [-160, -165], armF: [-93, -93], legN: [-88, 2, -88], legF: [-10, -10, -100] },
  quadruped: { torso: -16, head: 5, armN: [90, 90], armF: [92, 92], legN: [90, 180, 180], legF: [92, 182, 182] },
  birddog: { torso: -16, head: -10, armN: [-16, -16], armF: [92, 92], legN: [90, 180, 180], legF: [164, 164, 164] },
  cat: { torso: -16, spine: 9, head: 70, armN: [90, 90], armF: [92, 92], legN: [90, 180, 180], legF: [92, 182, 182] },
  cow: { torso: -16, spine: -7, head: -40, armN: [90, 90], armF: [92, 92], legN: [90, 180, 180], legF: [92, 182, 182] },
  hollow: { torso: -168, head: -165, armN: [-168, -168], armF: [-166, -166], legN: [-14, -14, -100], legF: [-12, -12, -98] },
  'hollow-tuck': { torso: -165, head: -150, armN: [-20, -20], armF: [-18, -18], legN: [-62, 15, -70], legF: [-60, 17, -68] },
  'mc-knee': { torso: -19, armN: [92, 92], armF: [88, 88], legN: [22, 122], legF: [162, 162] },
  'mc-knee-b': { torso: -19, armN: [92, 92], armF: [88, 88], legN: [161, 161], legF: [22, 122] },

  // ---------------------------------------------------------------- conditioning (front view)
  'jj-closed': { view: 'front', torso: -90, ...F_ARMS_DOWN, ...F_LEGS_CLOSED },
  'jj-open': { view: 'front', torso: -90, armN: [-38, -52], armF: [-142, -128], ...F_LEGS_WIDE },
  'stepjack-out': { view: 'front', torso: -90, armN: [-38, -52], armF: [-142, -128], legN: [66, 76, 15], legF: [94, 90, 160] },
  'front-t': { view: 'front', torso: -90, armN: [0, 0], armF: [180, 180], ...F_LEGS_CLOSED },
  'front-t-high': { view: 'front', torso: -90, armN: [-18, -18], armF: [-162, -162], ...F_LEGS_CLOSED },
  'front-hips-left': { view: 'front', torso: -82, armN: [62, 150], armF: [118, 30], ...F_LEGS_WIDE },
  'front-hips-right': { view: 'front', torso: -98, armN: [62, 150], armF: [118, 30], ...F_LEGS_WIDE },
  'squat-hands-floor': { torso: -30, head: -10, armN: [86, 86], armF: [84, 84], legN: [-8, 116, 10], legF: [-5, 118, 10] },
  fold: { torso: 72, head: 90, armN: [92, 92], armF: [90, 90], legN: [96, 90, 0], legF: [98, 90, 0] },

  // ---------------------------------------------------------------- stretches / cooldown
  childpose: { torso: 18, head: 30, armN: [6, 0], armF: [8, 2], legN: [28, 180, 180], legF: [30, 182, 182] },
  'half-kneel-stretch': { torso: -88, ...HANDS_HIPS, legN: [12, 92, 0], legF: [128, 180, 180] },
  'lying-hamstring': { torso: 180, head: 180, armN: [-40, -60], armF: [-38, -58], legN: [-75, -75, -165], legF: [-30, 95, 0] },
  'quad-stretch': { torso: -90, armN: [-6, 0], armF: [110, 60], legN: [90, 90, 0], legF: [100, -110, -40] },
  'chest-stretch': { torso: -90, head: -95, armN: [180, 180], armF: [96, 86], legN: [80, 92, 0], legF: [100, 92, 0] },
  'calf-stretch': { torso: -70, armN: [-5, -5], armF: [-2, -2], legN: [70, 100, 0], legF: [118, 118, 0] },
  figure4: { torso: 180, head: 180, armN: [-40, -20], armF: [-42, -22], legN: [-60, 20, -70], legF: [-80, 0, -90] },
  'lying-rest': { torso: 180, head: 180, armN: [10, 5], armF: [12, 6], legN: [-50, 100, 0], legF: [-47, 103, 0] },
};

export function getPose(id: string): PoseSpec {
  const p = POSES[id];
  if (!p) throw new Error(`Unknown pose: ${id}`);
  return p;
}
