import { Lock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { INK, MINT, ORANGE, PINK, SKY, SUN, VIOLET } from "./palette";

export type MedalColor = "violet" | "pink" | "orange" | "sky" | "mint" | "sun";

const FILL: Record<MedalColor, string> = { violet: VIOLET, pink: PINK, orange: ORANGE, sky: SKY, mint: MINT, sun: SUN };
const RIBBON: Record<MedalColor, [string, string]> = {
  violet: [PINK, SKY],
  pink: [VIOLET, SUN],
  orange: [PINK, SUN],
  sky: [VIOLET, MINT],
  mint: [SKY, SUN],
  sun: [PINK, VIOLET],
};

/** Achievement medal: ribbons, a coloured disc, and an icon. Locked medals are greyed out. */
export function Medal({
  icon: Icon,
  color = "violet",
  locked = false,
  size = "md",
  className,
}: {
  icon: LucideIcon;
  color?: MedalColor;
  locked?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box = { sm: "h-14 w-14", md: "h-20 w-20", lg: "h-28 w-28" }[size];
  const iconSize = { sm: "h-5 w-5", md: "h-7 w-7", lg: "h-10 w-10" }[size];
  const [r1, r2] = RIBBON[color];
  return (
    <span className={cn("relative inline-flex shrink-0", box, locked && "opacity-80 grayscale", className)} aria-hidden>
      <svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full">
        <g stroke={INK} strokeWidth="2.5" strokeLinejoin="round">
          <path d="M27 50 L17 77 L28 72 L34 80 L42 56 Z" fill={locked ? "#c9c5d8" : r1} />
          <path d="M53 50 L63 77 L52 72 L46 80 L38 56 Z" fill={locked ? "#b9b4cc" : r2} />
          <circle cx="40" cy="35" r="29" fill={locked ? "#e2deef" : FILL[color]} />
          <circle cx="40" cy="35" r="21.5" fill="#fff" fillOpacity={locked ? 0.5 : 0.32} stroke="none" />
          <path d="M22 26 Q26 14 38 11" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="3.5" strokeLinecap="round" />
        </g>
      </svg>
      <span className="absolute inset-x-0 top-0 flex h-[87%] items-center justify-center text-ink">
        {locked ? <Lock className={cn(iconSize, "text-subtle")} strokeWidth={2.5} /> : <Icon className={iconSize} strokeWidth={2.5} />}
      </span>
    </span>
  );
}

const LEVEL_FILL = [MINT, SKY, VIOLET, PINK, SUN];

/** Hexagon level badge with the level number. */
export function LevelBadge({ level, className, locked = false }: { level: number; className?: string; locked?: boolean }) {
  const fill = locked ? "#e2deef" : LEVEL_FILL[(level - 1) % LEVEL_FILL.length];
  return (
    <svg viewBox="0 0 80 84" className={cn("h-12 w-12 shrink-0", className)} aria-hidden>
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M40 4 L73 22 V62 L40 80 L7 62 V22 Z" fill={fill} />
        <path d="M40 15 L63 28 V56 L40 69 L17 56 V28 Z" fill="#fff" fillOpacity="0.35" stroke="none" />
      </g>
      <text
        x="40"
        y="53"
        textAnchor="middle"
        fontSize="30"
        fontWeight="800"
        fill={locked ? "#8b86a6" : INK}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {level}
      </text>
    </svg>
  );
}
