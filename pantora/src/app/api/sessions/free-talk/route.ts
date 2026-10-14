import { getDb, tx } from "@/server/db";
import { HttpError, apiUser, handler, ok, parseBody } from "@/server/http";
import { getSettings } from "@/server/services/users";
import { recordSession } from "@/server/services/gamification";
import { saveFeedback, saveTranscript, type TranscriptEntryInput } from "@/server/services/practice";
import { redactAnalysis } from "@/server/services/redact";
import { analyzeResponse, type AnalyzeOutcome } from "@/server/ai";
import { getDemoPartner } from "@/content/partners";
import { getTopic } from "@/content/topics";
import { MIN_COMPLETED_CONVERSATION_SECONDS, conversationXp } from "@/lib/game-rules";
import { splitSentences, words } from "@/lib/analysis/demo-analyzer";
import { freeTalkCompleteSchema } from "@/lib/schemas";
import { get } from "@/server/db";

export const POST = handler(async (request: Request) => {
  const user = await apiUser();
  const body = await parseBody(request, freeTalkCompleteSchema);
  const db = getDb();
  const settings = getSettings(db, user.id, user);

  let partner: { id: string; kind: "demo_partner" | "user"; name: string };
  let origin: "demo" | "live" = "demo";
  if (body.partnerKind === "demo_partner") {
    const p = getDemoPartner(body.partnerId);
    if (!p) throw new HttpError(400, "Unknown demo partner.");
    partner = { id: p.id, kind: "demo_partner", name: p.displayName };
  } else {
    const room = body.liveRoomId
      ? get<{ caller_id: string; callee_id: string }>(db, "SELECT caller_id, callee_id FROM live_rooms WHERE id = ?", body.liveRoomId)
      : undefined;
    if (!room || ![room.caller_id, room.callee_id].includes(user.id) || ![room.caller_id, room.callee_id].includes(body.partnerId)) {
      throw new HttpError(400, "This live session could not be verified.");
    }
    const other = get<{ display_name: string }>(db, "SELECT display_name FROM users WHERE id = ?", body.partnerId);
    const visible = other && getSettings(db, body.partnerId).privacy.showDisplayName;
    partner = { id: body.partnerId, kind: "user", name: visible ? other.display_name : "Pantora learner" };
    origin = "live";
  }
  const topic = getTopic(body.topicId ?? undefined);
  const startedAt = new Date(body.startedAt);
  const endedAt = new Date(body.endedAt);
  const wallSeconds = Math.max(0, (endedAt.getTime() - startedAt.getTime()) / 1000);
  const activeSeconds = Math.round(Math.min(body.activeSeconds, wallSeconds + 5, body.plannedSeconds + 30));
  const completed = activeSeconds >= MIN_COMPLETED_CONVERSATION_SECONDS;

  // Analyze the learner's captured lines (if any) before writing anything.
  const userLines = body.captions?.lines.filter((l) => l.speaker === "user") ?? [];
  const userText = userLines.map((l) => l.text.trim()).map((t) => (/[.!?]$/.test(t) ? t : `${t}.`)).join(" ");
  const hasSpeech = words(userText).length >= 3;
  let outcome: AnalyzeOutcome | null = null;
  if (completed && hasSpeech) {
    outcome = await analyzeResponse({ text: userText, prompt: topic?.openingQuestion, inputMode: "spoken" });
  }

  const result = tx(db, () => {
    const recorded = recordSession(db, {
      userId: user.id,
      type: "free_talk",
      partner,
      topicId: topic?.id ?? null,
      promptText: topic?.openingQuestion ?? null,
      plannedSeconds: body.plannedSeconds,
      durationSeconds: activeSeconds,
      practiceSeconds: activeSeconds,
      startedAt,
      endedAt,
      status: completed ? "completed" : "incomplete",
      endReason: body.endReason,
      origin,
      idempotencyKey: body.idempotencyKey,
      xp: completed ? [{ key: "conversation", amount: conversationXp(activeSeconds), reason: "Completed a Free Talk conversation" }] : [],
    });
    if (!recorded.created) return { ...recorded, transcriptStatus: null as string | null, feedbackId: null as string | null };

    const retention = settings.privacy.transcriptRetention;
    let transcriptStatus: "available" | "unavailable" | "not_retained" = "unavailable";
    let feedbackId: string | null = null;
    if (!body.captions || !hasSpeech) {
      saveTranscript(db, {
        sessionId: recorded.sessionId,
        status: "unavailable",
        source: null,
        note: body.captions ? "Captions were on, but no speech was captured." : "Captions were off, so this session was not transcribed.",
        retention,
        entries: [],
        at: endedAt,
      });
    } else if (retention === "none") {
      transcriptStatus = "not_retained";
      saveTranscript(db, {
        sessionId: recorded.sessionId,
        status: "not_retained",
        source: body.captions.source,
        note: "Transcript retention is off in your privacy settings, so the text was analyzed and then discarded.",
        retention,
        entries: [],
        at: endedAt,
      });
    } else {
      transcriptStatus = "available";
      const sentences = outcome?.analysis.sentences ?? [];
      const entries: TranscriptEntryInput[] = [];
      let cursor = 0;
      for (const line of body.captions.lines) {
        if (line.speaker === "partner") {
          entries.push({ speaker: "partner", original: line.text });
          continue;
        }
        const count = splitSentences(/[.!?]$/.test(line.text) ? line.text : `${line.text}.`).length || 1;
        const slice = sentences.slice(cursor, cursor + count);
        cursor += count;
        if (slice.length === 0) {
          entries.push({ speaker: "user", original: line.text });
          continue;
        }
        for (const s of slice) {
          entries.push({
            speaker: "user",
            original: s.original,
            corrected: s.changed ? s.corrected : null,
            explanation: s.changed ? s.explanation : null,
            category: s.category,
            alternative: s.alternative,
          });
        }
      }
      for (const s of sentences.slice(cursor)) {
        entries.push({ speaker: "user", original: s.original, corrected: s.changed ? s.corrected : null, explanation: s.changed ? s.explanation : null, category: s.category, alternative: s.alternative });
      }
      saveTranscript(db, {
        sessionId: recorded.sessionId,
        status: "available",
        source: body.captions.source,
        note:
          body.captions.source === "browser_speech"
            ? "Your lines were transcribed by your browser's speech recognition and may contain recognition errors. Partner lines are the scripted demo prompts shown during the call."
            : "Typed notes of what you said.",
        retention,
        entries,
        at: endedAt,
      });
    }
    if (outcome) {
      feedbackId = saveFeedback(db, {
        userId: user.id,
        sessionId: recorded.sessionId,
        kind: "session",
        analysis: retention === "none" ? redactAnalysis(outcome.analysis) : outcome.analysis,
        inputMode: "spoken",
        promptText: topic?.openingQuestion ?? null,
        origin: "generated",
        at: endedAt,
      });
    }
    return { ...recorded, transcriptStatus, feedbackId };
  });

  return ok({
    sessionId: result.sessionId,
    duplicate: !result.created,
    status: completed ? "completed" : "incomplete",
    durationSeconds: activeSeconds,
    rewards: result.rewards,
    transcriptStatus: result.transcriptStatus,
    feedback: outcome
      ? {
          id: result.feedbackId,
          analyzer: outcome.analysis.analyzer,
          summary: outcome.analysis.summary,
          strengths: outcome.analysis.strengths,
          issues: outcome.analysis.issues.filter((i) => !i.minor).slice(0, 4),
          vocabulary: outcome.analysis.vocabulary.slice(0, 2),
          exercise: outcome.analysis.exercise,
          providerNotice: outcome.providerNotice,
        }
      : null,
  });
});
