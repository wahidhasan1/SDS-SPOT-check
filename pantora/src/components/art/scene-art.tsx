import { MascotFigure, type MascotAccessory, type MascotMood } from "./mascot";
import { INK, MINT, MINT_DARK, ORANGE, ORANGE_DARK, PINK, SKY, SKY_LIGHT, STROKE, SUN, SUN_DARK, VIOLET, WHITE, sparkle } from "./palette";

// Scene illustrations for the main areas of the app (200×150 canvas).

function Svg({ className, children, viewBox = "0 0 200 150" }: { className?: string; children: React.ReactNode; viewBox?: string }) {
  return (
    <svg viewBox={viewBox} className={className} aria-hidden>
      {children}
    </svg>
  );
}

function Figure({ x, y, scale, flip, ...props }: { x: number; y: number; scale: number; flip?: boolean; mood?: MascotMood; color?: string; accessory?: MascotAccessory }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
      <MascotFigure {...props} />
    </g>
  );
}

/** Two mascots chatting: Free Talk. */
export function FreeTalkArt({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="100" cy="82" r="48" fill={SKY_LIGHT} />
      <path d="M58 70 Q100 56 142 70 M54 92 Q100 108 146 92 M100 34 Q78 82 100 130 M100 34 Q122 82 100 130" fill="none" stroke={WHITE} strokeWidth="3" />
      <Figure x={6} y={44} scale={0.8} color={VIOLET} mood="wave" />
      <Figure x={194} y={50} scale={0.75} flip color={PINK} mood="happy" />
      <g {...STROKE}>
        <path d="M74 6 H126 Q134 6 134 14 V30 Q134 38 126 38 H106 L96 46 L97 38 H74 Q66 38 66 30 V14 Q66 6 74 6 Z" fill={WHITE} />
        <text x="100" y="29" textAnchor="middle" fontSize="16" fontWeight="800" fill={INK} stroke="none" style={{ fontFamily: "var(--font-display)" }}>
          Hi!
        </text>
      </g>
      <path d={sparkle(160, 18, 7)} fill={SUN} {...STROKE} strokeWidth="2.5" />
    </Svg>
  );
}

/** Mascot with a graduation cap and a checklist: AI Coach. */
export function CoachArt({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <Figure x={2} y={26} scale={0.92} color={MINT} mood="happy" accessory="cap" />
      <g {...STROKE} fill="none">
        <rect x="118" y="32" width="66" height="92" rx="12" fill={WHITE} />
        <rect x="136" y="24" width="30" height="14" rx="5" fill={PINK} />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <path d={`M128 ${62 + i * 22} l5 5 l10 -11`} stroke={MINT_DARK} strokeWidth="4.5" />
            <path d={`M152 ${62 + i * 22} H174`} opacity="0.3" />
          </g>
        ))}
        <path d={sparkle(108, 20, 8)} fill={SUN} strokeWidth="2.5" />
      </g>
    </Svg>
  );
}

/** Target with an arrow: Daily Challenge. */
export function DailyChallengeArt({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <g {...STROKE}>
        <circle cx="94" cy="82" r="56" fill={PINK} />
        <circle cx="94" cy="82" r="41" fill={WHITE} />
        <circle cx="94" cy="82" r="27" fill={PINK} />
        <circle cx="94" cy="82" r="12" fill={WHITE} />
        <path d="M96 80 L164 20" strokeWidth="6" fill="none" />
        <path d="M156 14 L176 10 L172 30 L164 20 Z" fill={SUN} />
        <path d="M150 30 L162 34 M144 24 L158 26" strokeWidth="3" />
        <path d={sparkle(30, 26, 9)} fill={SUN} strokeWidth="2.5" />
        <path d={sparkle(176, 120, 7)} fill={VIOLET} strokeWidth="2.5" />
      </g>
    </Svg>
  );
}

/** Trophy: victories and personal bests. */
export function TrophyArt({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <g {...STROKE}>
        <path d="M66 42 H46 Q38 42 38 52 Q38 76 68 80" fill="none" strokeWidth="6" />
        <path d="M134 42 H154 Q162 42 162 52 Q162 76 132 80" fill="none" strokeWidth="6" />
        <path d="M62 24 H138 V58 Q138 100 100 106 Q62 100 62 58 Z" fill={SUN} />
        <path d="M74 34 V58 Q74 80 88 90" fill="none" stroke={WHITE} strokeWidth="5" opacity="0.6" />
        <rect x="91" y="106" width="18" height="14" fill={SUN_DARK} />
        <rect x="68" y="118" width="64" height="18" rx="5" fill={VIOLET} />
        <path d={sparkle(100, 60, 15)} fill={WHITE} strokeWidth="3" />
        <path d={sparkle(30, 22, 8)} fill={PINK} strokeWidth="2.5" />
        <path d={sparkle(174, 18, 9)} fill={SKY} strokeWidth="2.5" />
        <path d={sparkle(178, 108, 6)} fill={MINT} strokeWidth="2.5" />
      </g>
    </Svg>
  );
}

/** Podium: weekly league. */
export function LeagueArt({ className }: { className?: string }) {
  const label = (x: number, y: number, t: string) => (
    <text x={x} y={y} textAnchor="middle" fontSize="24" fontWeight="800" fill={INK} stroke="none" style={{ fontFamily: "var(--font-display)" }}>
      {t}
    </text>
  );
  return (
    <Svg className={className}>
      <g {...STROKE}>
        <rect x="76" y="58" width="48" height="80" rx="6" fill={SUN} />
        <rect x="28" y="82" width="48" height="56" rx="6" fill={SKY} />
        <rect x="124" y="96" width="48" height="42" rx="6" fill={PINK} />
        {label(100, 92, "1")}
        {label(52, 116, "2")}
        {label(148, 128, "3")}
        <path d="M80 50 L84 26 L94 38 L100 22 L106 38 L116 26 L120 50 Z" fill={SUN} />
        <path d={sparkle(36, 36, 8)} fill={VIOLET} strokeWidth="2.5" />
        <path d={sparkle(166, 46, 9)} fill={MINT} strokeWidth="2.5" />
      </g>
    </Svg>
  );
}

/** Treasure chest: quests and rewards. */
export function QuestArt({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <g {...STROKE}>
        <path d="M100 30 L92 10 M120 34 L134 18 M80 34 L66 18" fill="none" stroke={SUN_DARK} strokeWidth="4" />
        <rect x="40" y="70" width="120" height="62" rx="10" fill={ORANGE} />
        <path d="M40 74 V60 Q40 36 100 36 Q160 36 160 60 V74 Z" fill={ORANGE_DARK} />
        <rect x="90" y="36" width="20" height="96" fill={SUN} />
        <rect x="86" y="62" width="28" height="24" rx="5" fill={SUN} />
        <circle cx="100" cy="72" r="3.5" fill={INK} stroke="none" />
        <path d="M100 74 V80" />
        <path d={sparkle(32, 40, 8)} fill={PINK} strokeWidth="2.5" />
        <path d={sparkle(172, 34, 9)} fill={SKY} strokeWidth="2.5" />
      </g>
    </Svg>
  );
}

/** Rising chart with a sparkle: progress. */
export function ProgressArt({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <g {...STROKE}>
        <rect x="24" y="92" width="28" height="42" rx="6" fill={SKY} />
        <rect x="62" y="72" width="28" height="62" rx="6" fill={VIOLET} />
        <rect x="100" y="52" width="28" height="82" rx="6" fill={PINK} />
        <rect x="138" y="30" width="28" height="104" rx="6" fill={SUN} />
        <path d="M20 70 L66 46 L100 54 L170 12" fill="none" strokeWidth="5" />
        <path d="M156 10 L174 8 L170 26" fill="none" strokeWidth="5" />
        <path d={sparkle(34, 28, 8)} fill={MINT} strokeWidth="2.5" />
      </g>
    </Svg>
  );
}

/** Sleepy mascot used for empty states. */
export function EmptyArt({ className, mood = "sleepy" }: { className?: string; mood?: MascotMood }) {
  return (
    <svg viewBox="-4 -4 128 128" className={className} aria-hidden>
      <MascotFigure mood={mood} color={VIOLET} />
    </svg>
  );
}


/** Fanned topic cards: the Topics library. */
export function TopicsArt({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <g {...STROKE}>
        <rect x="30" y="34" width="70" height="92" rx="12" fill={SKY} transform="rotate(-14 65 80)" />
        <rect x="100" y="34" width="70" height="92" rx="12" fill={PINK} transform="rotate(14 135 80)" />
        <rect x="64" y="22" width="72" height="96" rx="12" fill={WHITE} />
        <path d="M78 46 H122 M78 60 H114 M78 74 H118" strokeWidth="4" opacity="0.3" fill="none" />
        <path d="M80 96 Q80 88 88 88 H112 Q120 88 120 96 Q120 104 112 104 H96 L88 110 L89 104 Q80 104 80 96 Z" fill={SUN} strokeWidth="3" />
        <path d={sparkle(160, 20, 8)} fill={SUN} strokeWidth="2.5" />
        <path d={sparkle(30, 22, 6)} fill={MINT} strokeWidth="2.5" />
      </g>
    </Svg>
  );
}

/** Clock with chat bubbles: History. */
export function HistoryArt({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <g {...STROKE}>
        <circle cx="86" cy="80" r="50" fill={WHITE} />
        <circle cx="86" cy="80" r="40" fill={SUN} strokeWidth="3" />
        <path d="M86 52 V80 L106 92" fill="none" strokeWidth="5" />
        <circle cx="86" cy="80" r="5" fill={INK} stroke="none" />
        <path d="M136 24 H178 Q186 24 186 32 V54 Q186 62 178 62 H164 L154 72 L155 62 H136 Q128 62 128 54 V32 Q128 24 136 24 Z" fill={PINK} />
        <path d="M142 38 H172 M142 48 H162" stroke={WHITE} strokeWidth="4" fill="none" />
        <path d="M150 96 H184 Q190 96 190 102 V118 Q190 124 184 124 H180 L182 134 L170 124 H150 Q144 124 144 118 V102 Q144 96 150 96 Z" fill={MINT} />
        <path d={sparkle(22, 30, 8)} fill={VIOLET} strokeWidth="2.5" />
      </g>
    </Svg>
  );
}

/** Shield with a heart: Privacy & Safety. */
export function ShieldArt({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <g {...STROKE}>
        <path d="M100 14 L156 34 V74 Q156 116 100 138 Q44 116 44 74 V34 Z" fill={MINT} />
        <path d="M100 28 L142 44 V76 Q142 106 100 124 Q58 106 58 76 V44 Z" fill={WHITE} strokeWidth="3" />
        <path d="M100 98 Q74 82 78 66 Q82 54 94 56 Q99 58 100 64 Q101 58 106 56 Q118 54 122 66 Q126 82 100 98 Z" fill={PINK} strokeWidth="3" />
        <path d={sparkle(170, 24, 8)} fill={SUN} strokeWidth="2.5" />
        <path d={sparkle(30, 120, 6)} fill={SKY} strokeWidth="2.5" />
      </g>
    </Svg>
  );
}
