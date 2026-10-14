import type { AnalysisResult, BattleEvaluation, ScoreCard } from "../types";
import { decideResult, type ScoreContext } from "./demo-analyzer";

/** Combines two scored answers into a battle result. Only declares a winner when both were scored the same way. */
export function buildBattleEvaluation(
  user: { analysis: AnalysisResult; score: ScoreCard },
  opponent: { analysis: AnalysisResult; score: ScoreCard },
  opts: { simulatedOpponent: boolean },
): BattleEvaluation {
  const comparable = user.score.analyzer === opponent.score.analyzer && user.score.basis === opponent.score.basis;
  const result = comparable ? decideResult(user.score.total, opponent.score.total) : "no_result";
  const method = user.score.analyzer === "demo-rules" ? "Pantora's demo rules" : "the configured AI provider";
  const parts = [
    comparable
      ? `Both answers were scored as text by ${method} using the same rubric, so the scores can be compared.`
      : "The two answers were scored by different methods, so no winner is declared.",
  ];
  if (result === "draw") parts.push("Scores within 2 points are treated as a draw.");
  if (opts.simulatedOpponent) parts.push("This is a simulated battle: the opponent's answer is a pre-written demo sample, not a live person.");
  return { user, opponent, result, comparable, resultNote: parts.join(" ") };
}

export type { ScoreContext };
