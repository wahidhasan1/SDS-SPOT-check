import { getDb, tx } from "@/server/db";
import { HttpError, apiUser, handler, ok, parseBody } from "@/server/http";
import { battleXpItems, recordSession } from "@/server/services/gamification";
import { saveBattle, saveFeedback } from "@/server/services/practice";
import { analyzeResponse } from "@/server/ai";
import { config } from "@/server/config";
import { blockedIds, getBattleBySession } from "@/server/queries";
import { dailyChallengeFor, getBattlePrompt, modeOfPrompt } from "@/content/battle-prompts";
import { dateKeyInZone } from "@/lib/dates";
import { getDemoPartner } from "@/content/partners";
import { getTopic } from "@/content/topics";
import { buildBattleEvaluation } from "@/lib/analysis/battle";
import { battleCompleteSchema } from "@/lib/schemas";
import { XP_RULES } from "@/lib/game-rules";

// The demo opponent's answer is the same pre-written sample every time, so its
// analysis is cached per prompt, timer, and engine. With Claude configured this
// halves the cost of a battle. Fallback results are never cached.
type Outcome = Awaited<ReturnType<typeof analyzeResponse>>;
const sampleCache = new Map<string, Outcome>();

async function analyzeSample(key: string, run: () => Promise<Outcome>): Promise<Outcome> {
  const hit = sampleCache.get(key);
  if (hit) return hit;
  const outcome = await run();
  if (!outcome.providerNotice) sampleCache.set(key, outcome);
  return outcome;
}

export const POST = handler(async (request: Request) => {
  const user = await apiUser();
  const body = await parseBody(request, battleCompleteSchema);
  const prompt = getBattlePrompt(body.promptId);
  if (!prompt) throw new HttpError(400, "Unknown challenge.");
  const opponent = getDemoPartner(body.opponentId);
  if (!opponent) throw new HttpError(400, "Unknown demo opponent.");
  if (blockedIds(user.id).includes(opponent.id)) throw new HttpError(400, "You blocked this partner. Start a new battle to get another opponent.");

  const ctx = { prompt: prompt.prompt, guidance: prompt.guidance, keywords: getTopic(prompt.topicId)?.tags, targetSeconds: body.speakSeconds };
  const [mine, theirs] = await Promise.all([
    analyzeResponse({ text: body.response, prompt: prompt.prompt, inputMode: body.inputMode, score: ctx }),
    analyzeSample(`${prompt.id}:${body.speakSeconds}:${config.ai.anthropicKey ? config.ai.model : "rules"}`, () =>
      analyzeResponse({ text: prompt.sampleResponse.text, prompt: prompt.prompt, inputMode: "typed", score: ctx }),
    ),
  ]);
  if (!mine.score || !theirs.score) throw new HttpError(500, "Scoring failed. Please try again.");
  const evaluation = buildBattleEvaluation(
    { analysis: mine.analysis, score: mine.score },
    { analysis: theirs.analysis, score: theirs.score },
    { simulatedOpponent: true },
  );
  const providerNotice = mine.providerNotice ?? theirs.providerNotice;

  const db = getDb();
  const endedAt = new Date();
  const startedAt = new Date(Math.min(new Date(body.startedAt).getTime(), endedAt.getTime()));
  const durationSeconds = Math.min(600, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
  const practiceSeconds = body.inputMode === "spoken" ? Math.min(body.recordedSeconds, body.speakSeconds + 5) : 0;
  const today = dateKeyInZone(endedAt, user.timezone);
  const isDailyChallenge = dailyChallengeFor(today).id === prompt.id;

  const result = tx(db, () => {
    const recorded = recordSession(db, {
      userId: user.id,
      type: "battle",
      partner: { id: opponent.id, kind: "demo_partner", name: opponent.displayName },
      topicId: prompt.topicId,
      promptText: prompt.prompt,
      plannedSeconds: body.speakSeconds,
      durationSeconds,
      practiceSeconds,
      startedAt,
      endedAt,
      status: "completed",
      endReason: "completed",
      origin: "demo",
      idempotencyKey: body.idempotencyKey,
      xp: battleXpItems(db, user.id, evaluation.user.score.total, prompt.id, { dailyChallengeDate: isDailyChallenge ? today : null }),
    });
    if (recorded.created) {
      saveBattle(db, {
        userId: user.id,
        sessionId: recorded.sessionId,
        promptId: prompt.id,
        topicId: prompt.topicId,
        promptText: prompt.prompt,
        difficulty: prompt.difficulty,
        prepSeconds: body.prepSeconds,
        speakSeconds: body.speakSeconds,
        opponent: { id: opponent.id, kind: "demo_partner", name: opponent.displayName },
        userResponse: body.response,
        userInputMode: body.inputMode,
        opponentResponse: prompt.sampleResponse.text,
        opponentResponseKind: "sample",
        evaluation,
        origin: "demo",
        at: endedAt,
      });
      saveFeedback(db, {
        userId: user.id,
        sessionId: recorded.sessionId,
        kind: "battle",
        analysis: mine.analysis,
        scores: mine.score,
        inputMode: body.inputMode,
        promptText: prompt.prompt,
        origin: "generated",
        at: endedAt,
      });
    }
    return recorded;
  });

  // On a duplicate submit, return the stored evaluation rather than the fresh one.
  const stored = getBattleBySession(user.id, result.sessionId);
  return ok({
    sessionId: result.sessionId,
    duplicate: !result.created,
    evaluation: stored?.evaluation ?? evaluation,
    rewards: result.rewards,
    providerNotice,
    xpRules: { battle: modeOfPrompt(prompt).xp, personalBest: XP_RULES.battlePersonalBest, dailyChallenge: XP_RULES.dailyChallenge },
    isDailyChallenge,
  });
});
