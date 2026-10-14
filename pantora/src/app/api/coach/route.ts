import { getDb, tx, get } from "@/server/db";
import { apiUser, handler, ok, parseBody } from "@/server/http";
import { recordSession } from "@/server/services/gamification";
import { saveFeedback } from "@/server/services/practice";
import { analyzeResponse } from "@/server/ai";
import { getFeedback } from "@/server/queries";
import { coachSchema } from "@/lib/schemas";
import { XP_RULES } from "@/lib/game-rules";
import { words } from "@/lib/analysis/demo-analyzer";

export const POST = handler(async (request: Request) => {
  const user = await apiUser();
  const body = await parseBody(request, coachSchema);
  const db = getDb();

  const existing = get<{ id: string }>(db, "SELECT id FROM sessions WHERE user_id = ? AND idempotency_key = ?", user.id, body.idempotencyKey);
  if (existing) {
    const fb = get<{ id: string }>(db, "SELECT id FROM feedback WHERE session_id = ?", existing.id);
    const record = fb ? getFeedback(user.id, fb.id) : null;
    return ok({ sessionId: existing.id, feedbackId: fb?.id ?? null, analysis: record?.analysis ?? null, rewards: null, duplicate: true, providerNotice: null });
  }

  const spoken = body.inputMode === "spoken" && body.recordedSeconds > 0;
  const wordCount = words(body.response).length;
  const outcome = await analyzeResponse({
    text: body.response,
    prompt: body.promptText,
    inputMode: body.inputMode,
    speech: spoken
      ? { durationSeconds: Math.round(body.recordedSeconds), wordsPerMinute: Math.round((wordCount / body.recordedSeconds) * 60), source: "recording" }
      : null,
  });

  const endedAt = new Date();
  const result = tx(db, () => {
    const recorded = recordSession(db, {
      userId: user.id,
      type: "coach",
      promptText: body.promptText,
      durationSeconds: spoken ? body.recordedSeconds : 0,
      practiceSeconds: spoken ? body.recordedSeconds : 0,
      startedAt: new Date(endedAt.getTime() - Math.max(1, body.recordedSeconds) * 1000),
      endedAt,
      status: "completed",
      endReason: "completed",
      origin: "demo",
      idempotencyKey: body.idempotencyKey,
      xp: [{ key: "coach", amount: spoken ? XP_RULES.coachRecorded : XP_RULES.coachTyped, reason: "Completed an AI Coach exercise" }],
    });
    const feedbackId = saveFeedback(db, {
      userId: user.id,
      sessionId: recorded.sessionId,
      kind: "coach",
      analysis: outcome.analysis,
      inputMode: body.inputMode,
      promptText: body.promptText,
      origin: "generated",
      at: endedAt,
    });
    return { ...recorded, feedbackId };
  });

  return ok({
    sessionId: result.sessionId,
    feedbackId: result.feedbackId,
    analysis: outcome.analysis,
    rewards: result.rewards,
    duplicate: false,
    providerNotice: outcome.providerNotice,
  });
});
