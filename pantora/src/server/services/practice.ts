import type { DB } from "../db/sql";
import { newId, run } from "../db/sql";
import type { AnalysisResult, BattleEvaluation, ScoreCard } from "@/lib/types";

export interface TranscriptEntryInput {
  speaker: "user" | "partner";
  original: string;
  corrected?: string | null;
  explanation?: string | null;
  category?: string | null;
  alternative?: string | null;
  reviewed?: boolean;
}

export function saveTranscript(
  db: DB,
  input: {
    sessionId: string;
    status: "available" | "unavailable" | "not_retained" | "failed";
    source: "sample" | "browser_speech" | "stt_provider" | "typed" | null;
    note?: string | null;
    retention: "keep" | "30d" | "none";
    entries: TranscriptEntryInput[];
    at: Date;
  },
): string {
  const id = newId();
  const expiresAt = input.retention === "30d" ? new Date(input.at.getTime() + 30 * 86_400_000).toISOString() : null;
  run(
    db,
    `INSERT INTO transcripts (id, session_id, status, source, note, retention, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.sessionId,
    input.status,
    input.source,
    input.note ?? null,
    input.retention,
    expiresAt,
    input.at.toISOString(),
  );
  input.entries.forEach((e, position) => {
    run(
      db,
      `INSERT INTO transcript_entries (id, transcript_id, position, speaker, original, corrected, explanation, category, alternative, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId(),
      id,
      position,
      e.speaker,
      e.original,
      e.corrected ?? null,
      e.explanation ?? null,
      e.category ?? null,
      e.alternative ?? null,
      e.reviewed ? input.at.toISOString() : null,
    );
  });
  return id;
}

/** Turns per-sentence analysis into transcript entries for the user's lines. */
export function entriesFromAnalysis(analysis: AnalysisResult): TranscriptEntryInput[] {
  return analysis.sentences.map((s) => ({
    speaker: "user" as const,
    original: s.original,
    corrected: s.changed ? s.corrected : null,
    explanation: s.changed ? s.explanation : null,
    category: s.category,
    alternative: s.alternative,
  }));
}

export function saveFeedback(
  db: DB,
  input: {
    userId: string;
    sessionId: string | null;
    kind: "session" | "battle" | "coach";
    analysis: AnalysisResult;
    scores?: ScoreCard | null;
    inputMode: "typed" | "spoken";
    promptText?: string | null;
    origin: "seed" | "generated";
    reviewed?: boolean;
    at: Date;
  },
): string {
  const id = newId();
  run(
    db,
    `INSERT INTO feedback (id, user_id, session_id, kind, analyzer, model, origin, input_mode, prompt_text, analysis, scores, reviewed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.userId,
    input.sessionId,
    input.kind,
    input.analysis.analyzer,
    input.analysis.model,
    input.origin,
    input.inputMode,
    input.promptText ?? null,
    JSON.stringify(input.analysis),
    input.scores ? JSON.stringify(input.scores) : null,
    input.reviewed ? input.at.toISOString() : null,
    input.at.toISOString(),
  );
  return id;
}

export function saveBattle(
  db: DB,
  input: {
    userId: string;
    sessionId: string;
    promptId: string;
    topicId: string | null;
    promptText: string;
    difficulty: string;
    prepSeconds: number;
    speakSeconds: number;
    opponent: { id: string; kind: "demo_partner" | "user"; name: string };
    userResponse: string;
    userInputMode: "typed" | "spoken";
    opponentResponse: string;
    opponentResponseKind: "sample" | "live";
    evaluation: BattleEvaluation | null;
    origin: "seed" | "demo" | "live";
    at: Date;
  },
): string {
  const id = newId();
  const ev = input.evaluation;
  run(
    db,
    `INSERT INTO battles (id, user_id, session_id, prompt_id, topic_id, prompt_text, difficulty, prep_seconds, speak_seconds,
       opponent_id, opponent_kind, opponent_name, user_response, user_input_mode, opponent_response, opponent_response_kind,
       evaluation_status, result, user_score, opponent_score, evaluation, origin, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.userId,
    input.sessionId,
    input.promptId,
    input.topicId,
    input.promptText,
    input.difficulty,
    input.prepSeconds,
    input.speakSeconds,
    input.opponent.id,
    input.opponent.kind,
    input.opponent.name,
    input.userResponse,
    input.userInputMode,
    input.opponentResponse,
    input.opponentResponseKind,
    ev ? "evaluated" : "failed",
    ev?.result ?? "no_result",
    ev?.user.score.total ?? null,
    ev?.opponent.score.total ?? null,
    ev ? JSON.stringify(ev) : null,
    input.origin,
    input.at.toISOString(),
  );
  return id;
}

export function saveSentence(
  db: DB,
  input: {
    userId: string;
    original: string;
    corrected: string;
    explanation?: string | null;
    category?: string | null;
    sourceKind: "transcript" | "coach" | "battle";
    sourceId?: string | null;
    reviewed?: boolean;
    at: Date;
  },
): { id: string | null; created: boolean } {
  const id = newId();
  const result = run(
    db,
    `INSERT OR IGNORE INTO saved_sentences (id, user_id, original, corrected, explanation, category, source_kind, source_id, reviewed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.userId,
    input.original,
    input.corrected,
    input.explanation ?? null,
    input.category ?? null,
    input.sourceKind,
    input.sourceId ?? null,
    input.reviewed ? input.at.toISOString() : null,
    input.at.toISOString(),
  );
  return { id: result.changes ? id : null, created: result.changes > 0 };
}
