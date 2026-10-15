import { CHEEK, INK, PINK, SUN, WHITE, sparkle } from "./palette";

export type MascotMood = "happy" | "cheer" | "think" | "sleepy" | "wow" | "wave";
export type MascotAccessory = "none" | "cap" | "headset" | "crown";

/**
 * "Pip", Pantora's speech-bubble mascot, as an SVG group in a 120×120 box.
 * Use <Mascot> for a standalone image or place <MascotFigure> inside a scene.
 */
export function MascotFigure({ mood = "happy", color = "#8c7cfb", accessory = "none" }: { mood?: MascotMood; color?: string; accessory?: MascotAccessory }) {
  const armsUp = mood === "cheer";
  return (
    <g fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="58" cy="113" rx="30" ry="4" fill={INK} opacity="0.1" stroke="none" />
      {/* arms */}
      {armsUp ? (
        <>
          <path d="M22 50 Q8 40 10 24" />
          <circle cx="10" cy="22" r="5.5" fill={color} />
          <path d="M98 50 Q112 40 110 24" />
          <circle cx="110" cy="22" r="5.5" fill={color} />
        </>
      ) : mood === "wave" ? (
        <>
          <path d="M18 66 Q6 72 8 82" />
          <circle cx="8" cy="84" r="5.5" fill={color} />
          <path d="M100 54 Q114 46 113 30" />
          <circle cx="113" cy="28" r="5.5" fill={color} />
        </>
      ) : (
        <>
          <path d="M18 66 Q6 72 8 82" />
          <circle cx="8" cy="84" r="5.5" fill={color} />
          <path d="M102 66 Q114 72 112 82" />
          <circle cx="112" cy="84" r="5.5" fill={color} />
        </>
      )}
      {/* body: a speech bubble */}
      <path d="M50 18 H70 C92 18 106 32 106 52 V58 C106 79 92 92 70 92 H56 L38 106 L40 90 C24 86 14 74 14 58 V52 C14 32 28 18 50 18 Z" fill={color} />
      <path d="M28 44 C29 35 36 29 45 28" stroke={WHITE} strokeOpacity="0.55" strokeWidth="5" />
      {/* cheeks */}
      <ellipse cx="36" cy="63" rx="5.5" ry="3.5" fill={CHEEK} stroke="none" opacity="0.9" />
      <ellipse cx="84" cy="63" rx="5.5" ry="3.5" fill={CHEEK} stroke="none" opacity="0.9" />
      {/* eyes */}
      {mood === "cheer" ? (
        <>
          <path d="M40 55 L47 48 L54 55" strokeWidth="4.5" />
          <path d="M66 55 L73 48 L80 55" strokeWidth="4.5" />
        </>
      ) : mood === "sleepy" ? (
        <>
          <path d="M40 52 Q47 57 54 52" />
          <path d="M66 52 Q73 57 80 52" />
        </>
      ) : mood === "wow" ? (
        <>
          <circle cx="47" cy="51" r="8" fill={WHITE} strokeWidth="3" />
          <circle cx="73" cy="51" r="8" fill={WHITE} strokeWidth="3" />
          <circle cx="47" cy="52" r="3.6" fill={INK} stroke="none" />
          <circle cx="73" cy="52" r="3.6" fill={INK} stroke="none" />
        </>
      ) : mood === "think" ? (
        <>
          <ellipse cx="48" cy="52" rx="5" ry="6.5" fill={INK} stroke="none" />
          <ellipse cx="74" cy="52" rx="5" ry="6.5" fill={INK} stroke="none" />
          <circle cx="50" cy="49" r="1.8" fill={WHITE} stroke="none" />
          <circle cx="76" cy="49" r="1.8" fill={WHITE} stroke="none" />
          <path d="M66 39 L82 36" strokeWidth="3.5" />
        </>
      ) : (
        <>
          <ellipse cx="47" cy="52" rx="5" ry="6.5" fill={INK} stroke="none" />
          <ellipse cx="73" cy="52" rx="5" ry="6.5" fill={INK} stroke="none" />
          <circle cx="48.8" cy="49.5" r="1.8" fill={WHITE} stroke="none" />
          <circle cx="74.8" cy="49.5" r="1.8" fill={WHITE} stroke="none" />
        </>
      )}
      {/* mouth */}
      {mood === "cheer" ? (
        <>
          <path d="M49 63 Q60 81 71 63 Z" fill={INK} strokeWidth="3" />
          <path d="M55 71 Q60 76 65 71" fill={PINK} stroke="none" />
        </>
      ) : mood === "think" ? (
        <path d="M54 69 Q60 66 66 69" />
      ) : mood === "sleepy" ? (
        <ellipse cx="60" cy="67" rx="3" ry="2.5" fill={INK} stroke="none" />
      ) : mood === "wow" ? (
        <ellipse cx="60" cy="69" rx="5" ry="6" fill={INK} stroke="none" />
      ) : (
        <path d="M51 64 Q60 73 69 64" />
      )}
      {/* accessories */}
      {accessory === "cap" && (
        <g strokeWidth="3">
          <rect x="45" y="12" width="30" height="10" rx="2" fill={INK} />
          <path d="M30 14 L60 2 L90 14 L60 26 Z" fill={INK} />
          <path d="M90 14 V30" stroke={SUN} strokeWidth="3" />
          <circle cx="90" cy="32" r="3.5" fill={SUN} stroke="none" />
        </g>
      )}
      {accessory === "headset" && (
        <g>
          <path d="M22 46 C22 14 98 14 98 46" strokeWidth="5" />
          <rect x="13" y="40" width="13" height="20" rx="5" fill={PINK} strokeWidth="3" />
          <rect x="94" y="40" width="13" height="20" rx="5" fill={PINK} strokeWidth="3" />
          <path d="M20 60 Q22 76 40 76" strokeWidth="3" />
          <circle cx="42" cy="76" r="3.5" fill={INK} stroke="none" />
        </g>
      )}
      {accessory === "crown" && <path d="M40 20 L43 4 L52 13 L60 1 L68 13 L77 4 L80 20 Z" fill={SUN} strokeWidth="3" />}
      {/* extras */}
      {mood === "cheer" && (
        <>
          <path d={sparkle(26, 10, 6)} fill={SUN} strokeWidth="2.5" />
          <path d={sparkle(96, 6, 4.5)} fill={PINK} strokeWidth="2.5" />
        </>
      )}
      {mood === "sleepy" && <path d="M94 14 h9 l-9 10 h9 M106 2 h6 l-6 7 h6" strokeWidth="2.5" />}
      {mood === "think" && (
        <g strokeWidth="2.5">
          <circle cx="104" cy="16" r="11" fill={WHITE} />
          <path d="M100 12 Q100 8 104 8 Q108 8 108 12 Q108 15 104 16 V18" />
          <circle cx="104" cy="22" r="1.2" fill={INK} />
        </g>
      )}
    </g>
  );
}

export function Mascot({
  mood = "happy",
  color,
  accessory = "none",
  className,
  title,
}: {
  mood?: MascotMood;
  color?: string;
  accessory?: MascotAccessory;
  className?: string;
  title?: string;
}) {
  return (
    <svg viewBox="-4 -4 128 128" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <MascotFigure mood={mood} color={color} accessory={accessory} />
    </svg>
  );
}
