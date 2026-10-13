/**
 * Lightweight computer-adaptive testing (CAT) helpers for the placement assessment.
 * Ability (theta) and item difficulty share a 1..6 scale mapped to CEFR A1..C2.
 * This is an application-level estimate, not a validated psychometric instrument.
 */
import { CEFR_LEVELS, type CefrLevel } from '../config';

export function probabilityCorrect(theta: number, difficulty: number): number {
  return 1 / (1 + Math.exp(-1.7 * (theta - difficulty)));
}

export function updateTheta(theta: number, difficulty: number, correct: boolean, answeredSoFar: number): number {
  const k = Math.max(0.35, 1.2 / Math.sqrt(answeredSoFar + 1));
  const p = probabilityCorrect(theta, difficulty);
  const next = theta + k * ((correct ? 1 : 0) - p) * 1.4;
  return Math.max(0.5, Math.min(6.5, next));
}

export function thetaToCefr(theta: number): CefrLevel {
  // theta 1.0-1.74 => A1, 1.75-2.74 => A2 ... >= 5.75 => C2
  const idx = Math.max(0, Math.min(5, Math.floor(theta - 0.25)));
  return CEFR_LEVELS[idx];
}

export function cefrToTheta(level: CefrLevel): number {
  return CEFR_LEVELS.indexOf(level) + 1;
}
