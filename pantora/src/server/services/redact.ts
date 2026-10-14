import type { AnalysisResult } from "@/lib/types";

/** Strips learner text from an analysis when the user has chosen not to retain transcripts. */
export function redactAnalysis(analysis: AnalysisResult): AnalysisResult {
  return {
    ...analysis,
    original: "",
    improved: "",
    sentences: [],
    issues: analysis.issues.map((i) => ({ ...i, original: "", corrected: "" })),
    limitations: [...analysis.limitations, "Your transcript was not stored because transcript retention is turned off in Settings."],
  };
}
