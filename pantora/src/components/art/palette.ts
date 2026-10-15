// Shared palette for Pantora's illustrations. Every illustration uses the same
// ink outline, flat fills, and these accent colors so the set feels consistent.
export const INK = "#17132f";
export const WHITE = "#ffffff";
export const VIOLET = "#8c7cfb";
export const VIOLET_DARK = "#5a45e8";
export const VIOLET_LIGHT = "#d0c8ff";
export const PINK = "#ff3d9a";
export const PINK_LIGHT = "#ff9fcf";
export const SUN = "#ffd23f";
export const SUN_DARK = "#f5b700";
export const SUN_LIGHT = "#fff1b8";
export const MINT = "#3ee6a8";
export const MINT_DARK = "#10c98a";
export const SKY = "#4cc3ff";
export const SKY_LIGHT = "#cdeeff";
export const ORANGE = "#ff9a52";
export const ORANGE_DARK = "#ff7a1a";
export const CHEEK = "#ff8fc4";

/** Four-point sparkle centred on (cx, cy). */
export function sparkle(cx: number, cy: number, r: number) {
  const k = r * 0.28;
  return `M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r} Z`;
}

/** Comic-style burst with `n` points. */
export function burst(cx: number, cy: number, outer: number, inner: number, n: number) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}

export const STROKE = { stroke: INK, strokeWidth: 3.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
