import type { BattleModeId } from "@/content/battle-modes";
import { INK, MINT, MINT_DARK, ORANGE, PINK, SKY, SKY_LIGHT, STROKE, SUN, SUN_LIGHT, VIOLET, VIOLET_DARK, WHITE, burst, sparkle } from "./palette";

// One illustration per battle type, drawn on a 200×150 canvas.

function QuickFire() {
  return (
    <g {...STROKE} fill="none">
      <path d="M14 64 H46 M6 84 H40 M18 104 H48" strokeWidth="4" opacity="0.35" />
      <rect x="88" y="14" width="24" height="12" rx="4" fill={PINK} />
      <path d="M100 26 V34" strokeWidth="5" />
      <path d="M136 42 L145 33" strokeWidth="5" />
      <circle cx="100" cy="84" r="50" fill={WHITE} />
      <circle cx="100" cy="84" r="38" fill={SUN_LIGHT} strokeWidth="3" />
      <path d="M100 84 L100 46 A38 38 0 0 1 136.1 72.3 Z" fill={PINK} stroke="none" opacity="0.85" />
      <path d="M100 48 V55 M100 113 V120 M64 84 H71 M129 84 H136" strokeWidth="3" />
      <path d="M100 84 L121 63" strokeWidth="4.5" />
      <circle cx="100" cy="84" r="5" fill={INK} stroke="none" />
      <path d="M166 22 L140 76 H157 L146 128 L188 62 H168 L180 22 Z" fill={SUN} />
    </g>
  );
}

function OpinionClash() {
  return (
    <g {...STROKE} fill="none">
      <path d="M14 30 H84 Q96 30 96 42 V82 Q96 94 84 94 H46 L28 110 L31 94 H26 Q14 94 14 82 V42 Q14 30 26 30 Z" fill={PINK} />
      <path d="M55 44 V67" stroke={WHITE} strokeWidth="8" />
      <circle cx="55" cy="81" r="5" fill={WHITE} stroke="none" />
      <path d="M116 46 H174 Q186 46 186 58 V98 Q186 110 174 110 H170 L172 128 L154 110 H116 Q104 110 104 98 V58 Q104 46 116 46 Z" fill={SKY} />
      <path d="M135 70 Q135 59 146 59 Q157 59 157 69 Q157 77 146 80 V86" stroke={WHITE} strokeWidth="7" />
      <circle cx="146" cy="98" r="4.5" fill={WHITE} stroke="none" />
      <path d={burst(100, 74, 28, 18, 10)} fill={SUN} />
      <text x="100" y="82" textAnchor="middle" fontSize="21" fontWeight="800" fill={INK} stroke="none" style={{ fontFamily: "var(--font-display)" }}>
        VS
      </text>
    </g>
  );
}

function StorySprint() {
  return (
    <g {...STROKE} fill="none">
      <path d="M22 54 V126 Q64 120 100 134 Q136 120 178 126 V54" fill={MINT_DARK} />
      <path d="M100 58 Q72 44 30 50 V120 Q72 114 100 128 Z" fill={WHITE} />
      <path d="M100 58 Q128 44 170 50 V120 Q128 114 100 128 Z" fill={WHITE} />
      <path d="M44 66 Q64 62 86 68 M44 80 Q64 76 86 82 M44 94 Q60 91 74 95" strokeWidth="3" opacity="0.3" />
      <path d="M114 68 Q136 62 156 66 M114 82 Q136 76 156 80" strokeWidth="3" opacity="0.3" />
      <path d="M102 52 Q108 40 122 42" strokeDasharray="1 8" strokeWidth="4" />
      <path d="M134 40 Q118 46 116 58 Q128 56 138 48 Z" fill={SUN} />
      <path d="M130 34 Q148 8 176 4 Q174 32 148 50 Z" fill={PINK} />
      <circle cx="155" cy="25" r="5.5" fill={WHITE} strokeWidth="3" />
      <path d="M135 26 L124 26 L130 36 M152 50 L152 60 L142 54" fill={VIOLET} strokeWidth="3" />
      <path d={sparkle(40, 26, 8)} fill={SUN} strokeWidth="2.5" />
      <path d={sparkle(186, 76, 6)} fill={WHITE} strokeWidth="2.5" />
    </g>
  );
}

function DescribeIt() {
  return (
    <g {...STROKE} fill="none">
      <rect x="20" y="20" width="124" height="98" rx="14" fill={ORANGE} />
      <rect x="33" y="33" width="98" height="72" rx="6" fill={SKY_LIGHT} strokeWidth="3" />
      <circle cx="110" cy="53" r="10" fill={SUN} strokeWidth="3" />
      <path d="M34 104 L64 66 L82 88 L97 73 L130 104 Z" fill={MINT} strokeWidth="3" />
      <path d="M163 114 L186 138" strokeWidth="12" />
      <circle cx="148" cy="96" r="26" fill={WHITE} fillOpacity="0.6" strokeWidth="5" />
      <path d="M134 86 Q138 78 147 76" stroke={WHITE} strokeWidth="4" />
      <path d={sparkle(176, 32, 9)} fill={PINK} strokeWidth="2.5" />
      <path d={sparkle(12, 128, 6)} fill={SUN} strokeWidth="2.5" />
    </g>
  );
}

function BigQuestion() {
  return (
    <g {...STROKE} fill="none">
      <g transform="rotate(-14 100 80)">
        <ellipse cx="100" cy="80" rx="82" ry="20" strokeWidth="11" />
        <ellipse cx="100" cy="80" rx="82" ry="20" stroke={SUN} strokeWidth="5" />
      </g>
      <circle cx="100" cy="76" r="46" fill={VIOLET} />
      <circle cx="72" cy="98" r="6" fill={VIOLET_DARK} stroke="none" opacity="0.55" />
      <circle cx="128" cy="56" r="4" fill={VIOLET_DARK} stroke="none" opacity="0.55" />
      <path d="M86 62 Q86 46 101 46 Q116 46 116 60 Q116 70 101 74 V82" stroke={WHITE} strokeWidth="9" />
      <circle cx="101" cy="97" r="6" fill={WHITE} stroke="none" />
      <g transform="rotate(-14 100 80)">
        <path d="M18 80 A82 20 0 0 0 182 80" strokeWidth="11" />
        <path d="M18 80 A82 20 0 0 0 182 80" stroke={SUN} strokeWidth="5" />
      </g>
      <path d={sparkle(28, 26, 9)} fill={WHITE} strokeWidth="2.5" />
      <path d={sparkle(176, 22, 6)} fill={PINK} strokeWidth="2.5" />
      <path d={sparkle(180, 126, 7)} fill={SUN} strokeWidth="2.5" />
    </g>
  );
}

function FreePlay() {
  return (
    <g {...STROKE} fill="none">
      <g transform="rotate(-12 62 80)">
        <rect x="28" y="46" width="68" height="68" rx="15" fill={WHITE} />
        {[
          [46, 64],
          [78, 64],
          [62, 80],
          [46, 96],
          [78, 96],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="5.5" fill={INK} stroke="none" />
        ))}
      </g>
      <g transform="rotate(12 138 86)">
        <rect x="108" y="56" width="60" height="60" rx="13" fill={PINK} />
        <circle cx="124" cy="72" r="5" fill={WHITE} stroke="none" />
        <circle cx="152" cy="100" r="5" fill={WHITE} stroke="none" />
      </g>
      <path d="M100 20 Q112 8 124 20 T148 20" strokeWidth="4" opacity="0.4" />
      <path d={sparkle(176, 30, 9)} fill={SUN} strokeWidth="2.5" />
      <path d={sparkle(20, 24, 6)} fill={WHITE} strokeWidth="2.5" />
    </g>
  );
}

const ART: Record<BattleModeId, () => React.JSX.Element> = {
  "quick-fire": QuickFire,
  "opinion-clash": OpinionClash,
  "story-sprint": StorySprint,
  "describe-it": DescribeIt,
  "big-question": BigQuestion,
  "free-play": FreePlay,
};

export function BattleModeArt({ mode, className }: { mode: BattleModeId; className?: string }) {
  const Art = ART[mode] ?? FreePlay;
  return (
    <svg viewBox="0 0 200 150" className={className} aria-hidden>
      <Art />
    </svg>
  );
}
