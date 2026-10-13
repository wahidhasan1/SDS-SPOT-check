/** Elo rating for competitive battles. Kept separate from proficiency estimates by design. */
export const DEFAULT_BATTLE_RATING = 1000;

export function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

/** result: 1 win, 0.5 draw, 0 loss. K shrinks as players complete more rated games. */
export function eloDelta(ra: number, rb: number, result: number, gamesPlayed: number): number {
  const k = gamesPlayed < 10 ? 40 : gamesPlayed < 30 ? 28 : 20;
  return Math.round(k * (result - expectedScore(ra, rb)));
}
