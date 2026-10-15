import type { DatabaseSync } from "node:sqlite";
import { all, get, newId, run, tx } from "./sql";
import { TOPICS, getTopic } from "@/content/topics";
import { DEMO_PARTNERS, getDemoPartner } from "@/content/partners";
import { getBattlePrompt } from "@/content/battle-prompts";
import { getCoachPrompt } from "@/content/coach-prompts";
import { ACHIEVEMENTS, XP_RULES, conversationXp } from "@/lib/game-rules";
import { analyzeText, scoreAnalysis } from "@/lib/analysis/demo-analyzer";
import { buildBattleEvaluation } from "@/lib/analysis/battle";
import { createUser } from "../services/users";
import { battleXpItems, evaluateAchievements, notify, recordReview, recordSession } from "../services/gamification";
import { entriesFromAnalysis, saveBattle, saveFeedback, saveSentence, saveTranscript } from "../services/practice";
import { DEMO_USER_ID, SEED_BATTLES, SEED_COACH, SEED_CONVERSATIONS } from "./seed-content";

export { DEMO_USER_ID };

/** Keeps reference content (topics, partners, achievements) in sync with the code. */
export function syncContent(db: DatabaseSync) {
  tx(db, () => {
    for (const t of TOPICS) {
      run(
        db,
        `INSERT INTO topics (id, title, category, difficulty, description, duration_minutes, opening_question, follow_ups, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET title = excluded.title, category = excluded.category, difficulty = excluded.difficulty,
           description = excluded.description, duration_minutes = excluded.duration_minutes, opening_question = excluded.opening_question,
           follow_ups = excluded.follow_ups, tags = excluded.tags`,
        t.id, t.title, t.category, t.difficulty, t.description, t.durationMinutes, t.openingQuestion, JSON.stringify(t.followUps), JSON.stringify(t.tags),
      );
    }
    for (const p of DEMO_PARTNERS) {
      run(
        db,
        `INSERT INTO demo_partners (id, display_name, avatar, proficiency, interests, bio) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET display_name = excluded.display_name, avatar = excluded.avatar, proficiency = excluded.proficiency,
           interests = excluded.interests, bio = excluded.bio`,
        p.id, p.displayName, p.avatar, p.proficiency, JSON.stringify(p.interests), p.bio,
      );
    }
    for (const a of ACHIEVEMENTS) {
      run(
        db,
        `INSERT INTO achievements (id, name, description, icon, metric, target) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, description = excluded.description, icon = excluded.icon,
           metric = excluded.metric, target = excluded.target`,
        a.id, a.name, a.description, a.icon, a.metric, a.target,
      );
    }
  });
}

function seedTime(now: Date, daysAgo: number, hour: number, minute = 0): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function serverTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Creates the demo account and its labeled sample history, relative to `now`. */
export function seedDemoData(db: DatabaseSync, now = new Date()) {
  syncContent(db);
  tx(db, () => {
    const timezone = serverTimeZone();
    createUser(db, {
      id: DEMO_USER_ID,
      displayName: "Alex",
      avatar: "aurora",
      proficiency: "intermediate",
      goals: ["confidence", "fluency", "work"],
      conversationPref: "both",
      dailyGoalMinutes: 5,
      timezone,
      isDemoAccount: true,
      origin: "seed",
      createdAt: seedTime(now, 21, 18).toISOString(),
      settings: {
        matching: {
          proficiencyRange: ["elementary", "upper-intermediate"],
          topicCategories: ["everyday-life", "career", "travel-culture"],
          durationMinutes: 5,
          globalMatching: true,
          englishOnly: true,
          suggestTopic: true,
          modePreference: "both",
        },
      },
    });

    type Event =
      | { kind: "conversation"; daysAgo: number; data: (typeof SEED_CONVERSATIONS)[number] }
      | { kind: "battle"; daysAgo: number; data: (typeof SEED_BATTLES)[number] }
      | { kind: "coach"; daysAgo: number; data: (typeof SEED_COACH)[number] };
    const events: Event[] = [
      ...SEED_CONVERSATIONS.map((data) => ({ kind: "conversation" as const, daysAgo: data.daysAgo, data })),
      ...SEED_BATTLES.map((data) => ({ kind: "battle" as const, daysAgo: data.daysAgo, data })),
      ...SEED_COACH.map((data) => ({ kind: "coach" as const, daysAgo: data.daysAgo, data })),
    ].sort((a, b) => b.daysAgo - a.daysAgo || a.kind.localeCompare(b.kind));

    const savedFrom: { original: string; corrected: string; explanation: string; category: string | null; sourceKind: "transcript" | "coach" | "battle"; sourceId: string }[] = [];
    const reviewTargets: { kind: "feedback" | "entry"; id: string }[] = [];

    for (const event of events) {
      if (event.kind === "conversation") {
        const c = event.data;
        const partner = getDemoPartner(c.partnerId)!;
        const topic = getTopic(c.topicId)!;
        const seconds = Math.round(c.minutes * 60);
        const endedAt = seedTime(now, c.daysAgo, 19, 30);
        const startedAt = new Date(endedAt.getTime() - seconds * 1000);
        const { sessionId } = recordSession(
          db,
          {
            userId: DEMO_USER_ID,
            type: "free_talk",
            partner: { id: partner.id, kind: "demo_partner", name: partner.displayName },
            topicId: topic.id,
            promptText: topic.openingQuestion,
            plannedSeconds: topic.durationMinutes * 60,
            durationSeconds: seconds,
            practiceSeconds: seconds,
            startedAt,
            endedAt,
            status: c.incomplete ? "incomplete" : "completed",
            endReason: c.incomplete ? "skipped" : "completed",
            origin: "seed",
            idempotencyKey: `seed-conversation-${c.daysAgo}-${c.topicId}`,
            xp: c.incomplete ? [] : [{ key: "conversation", amount: conversationXp(seconds), reason: "Completed a Free Talk conversation" }],
          },
          { silent: true },
        );
        if (c.script) {
          const userText = c.script.filter((l) => l.speaker === "user").map((l) => l.text).join(" ");
          const analysis = analyzeText(userText, { inputMode: "spoken" });
          const userEntries = entriesFromAnalysis(analysis);
          let ui = 0;
          const entries = c.script.flatMap((line) => {
            if (line.speaker === "partner") return [{ speaker: "partner" as const, original: line.text }];
            // Each scripted user line may contain several sentences.
            const count = analyzeText(line.text, { inputMode: "spoken" }).sentences.length;
            const slice = userEntries.slice(ui, ui + count);
            ui += count;
            return slice;
          });
          const transcriptId = saveTranscript(db, {
            sessionId,
            status: "available",
            source: "sample",
            note: "Sample transcript created for the demo account. It was not transcribed from real audio.",
            retention: "keep",
            entries,
            at: endedAt,
          });
          const feedbackId = saveFeedback(db, {
            userId: DEMO_USER_ID,
            sessionId,
            kind: "session",
            analysis,
            inputMode: "spoken",
            promptText: topic.openingQuestion,
            origin: "seed",
            at: endedAt,
          });
          if (c.daysAgo === 1 || c.daysAgo === 3) reviewTargets.push({ kind: "feedback", id: feedbackId });
          const corrected = all<{ id: string; original: string; corrected: string; explanation: string; category: string | null }>(
            db,
            "SELECT id, original, corrected, explanation, category FROM transcript_entries WHERE transcript_id = ? AND corrected IS NOT NULL ORDER BY position",
            transcriptId,
          );
          if (c.daysAgo === 1 || c.daysAgo === 6) corrected.slice(0, c.daysAgo === 1 ? 3 : 2).forEach((e) => reviewTargets.push({ kind: "entry", id: e.id }));
          if (corrected[0]) savedFrom.push({ ...corrected[0], sourceKind: "transcript", sourceId: sessionId });
        } else if (!c.incomplete) {
          saveTranscript(db, {
            sessionId,
            status: "unavailable",
            source: null,
            note: "Captions were off during this sample session, so no transcript exists.",
            retention: "keep",
            entries: [],
            at: endedAt,
          });
        }
      } else if (event.kind === "battle") {
        const b = event.data;
        const prompt = getBattlePrompt(b.promptId)!;
        const opponent = getDemoPartner(prompt.sampleResponse.partnerId)!;
        const endedAt = seedTime(now, b.daysAgo, 20, 15);
        const ctx = { prompt: prompt.prompt, guidance: prompt.guidance, keywords: getTopic(prompt.topicId)?.tags, targetSeconds: b.speakSeconds };
        const userAnalysis = analyzeText(b.response, { inputMode: b.mode === "spoken" ? "spoken" : "typed" });
        const oppAnalysis = analyzeText(prompt.sampleResponse.text, { inputMode: "typed" });
        const evaluation = buildBattleEvaluation(
          { analysis: userAnalysis, score: scoreAnalysis(userAnalysis, ctx) },
          { analysis: oppAnalysis, score: scoreAnalysis(oppAnalysis, ctx) },
          { simulatedOpponent: true },
        );
        const totalSeconds = 30 + b.speakSeconds + 40;
        const { sessionId } = recordSession(
          db,
          {
            userId: DEMO_USER_ID,
            type: "battle",
            partner: { id: opponent.id, kind: "demo_partner", name: opponent.displayName },
            topicId: prompt.topicId,
            promptText: prompt.prompt,
            plannedSeconds: b.speakSeconds,
            durationSeconds: totalSeconds,
            practiceSeconds: b.recordedSeconds,
            startedAt: new Date(endedAt.getTime() - totalSeconds * 1000),
            endedAt,
            status: "completed",
            endReason: "completed",
            origin: "seed",
            idempotencyKey: `seed-battle-${b.daysAgo}-${b.promptId}`,
            xp: battleXpItems(db, DEMO_USER_ID, evaluation.user.score.total, prompt.id),
          },
          { silent: true },
        );
        saveBattle(db, {
          userId: DEMO_USER_ID,
          sessionId,
          promptId: prompt.id,
          topicId: prompt.topicId,
          promptText: prompt.prompt,
          difficulty: prompt.difficulty,
          prepSeconds: 30,
          speakSeconds: b.speakSeconds,
          opponent: { id: opponent.id, kind: "demo_partner", name: opponent.displayName },
          userResponse: b.response,
          userInputMode: b.mode,
          opponentResponse: prompt.sampleResponse.text,
          opponentResponseKind: "sample",
          evaluation,
          origin: "seed",
          at: endedAt,
        });
        saveFeedback(db, {
          userId: DEMO_USER_ID,
          sessionId,
          kind: "battle",
          analysis: userAnalysis,
          scores: evaluation.user.score,
          inputMode: b.mode,
          promptText: prompt.prompt,
          origin: "seed",
          at: endedAt,
        });
        const issue = userAnalysis.sentences.find((s) => s.changed);
        if (issue && b.daysAgo === 10) {
          savedFrom.push({ original: issue.original, corrected: issue.corrected, explanation: issue.explanation, category: issue.category, sourceKind: "battle", sourceId: sessionId });
        }
      } else {
        const c = event.data;
        const prompt = getCoachPrompt(c.promptId)!;
        const endedAt = seedTime(now, c.daysAgo, 12, 40);
        const analysis = analyzeText(prompt.sampleAnswer, {
          inputMode: c.mode,
          speech: c.mode === "spoken" ? { durationSeconds: c.recordedSeconds, wordsPerMinute: Math.round((analyzeText(prompt.sampleAnswer).metrics.words / c.recordedSeconds) * 60), source: "recording" } : null,
        });
        const { sessionId } = recordSession(
          db,
          {
            userId: DEMO_USER_ID,
            type: "coach",
            promptText: prompt.prompt,
            durationSeconds: c.recordedSeconds || 90,
            practiceSeconds: c.recordedSeconds,
            startedAt: new Date(endedAt.getTime() - 90_000),
            endedAt,
            status: "completed",
            endReason: "completed",
            origin: "seed",
            idempotencyKey: `seed-coach-${c.daysAgo}-${c.promptId}`,
            xp: [{ key: "coach", amount: c.mode === "spoken" ? XP_RULES.coachRecorded : XP_RULES.coachTyped, reason: "Completed an AI Coach exercise" }],
          },
          { silent: true },
        );
        saveFeedback(db, {
          userId: DEMO_USER_ID,
          sessionId,
          kind: "coach",
          analysis,
          inputMode: c.mode,
          promptText: prompt.prompt,
          origin: "seed",
          at: endedAt,
        });
        const changed = analysis.sentences.find((s) => s.changed);
        if (changed) savedFrom.push({ original: changed.original, corrected: changed.corrected, explanation: changed.explanation, category: changed.category, sourceKind: "coach", sourceId: sessionId });
      }
    }

    // Saved sentences and reviews happened over the sample period.
    savedFrom.slice(0, 6).forEach((s, i) => {
      saveSentence(db, { userId: DEMO_USER_ID, ...s, reviewed: false, at: seedTime(now, 14 - i * 2, 21) });
    });
    reviewTargets.slice(0, 7).forEach((target, i) => {
      const at = seedTime(now, Math.max(1, 6 - i), 21, 10);
      if (target.kind === "feedback") run(db, "UPDATE feedback SET reviewed_at = ? WHERE id = ?", at.toISOString(), target.id);
      else run(db, "UPDATE transcript_entries SET reviewed_at = ? WHERE id = ?", at.toISOString(), target.id);
      recordReview(db, DEMO_USER_ID, target.kind, target.id, at);
    });
    evaluateAchievements(db, DEMO_USER_ID, seedTime(now, 1, 21, 30), { silent: true });
    // recordReview may have created notifications; sample notifications below replace them.
    run(db, "DELETE FROM notifications WHERE user_id = ?", DEMO_USER_ID);

    notify(db, DEMO_USER_ID, {
      kind: "welcome",
      title: "Welcome to the Pantora demo",
      body: "This account comes with sample history so you can explore. Everything you do from now on is tracked for real.",
      href: "/dashboard",
      dedupeKey: "welcome",
      at: seedTime(now, 21, 18, 5),
    });
    const topicExplorer = get<{ unlocked_at: string }>(db, "SELECT unlocked_at FROM user_achievements WHERE user_id = ? AND achievement_id = 'topic-explorer'", DEMO_USER_ID);
    if (topicExplorer) {
      notify(db, DEMO_USER_ID, {
        kind: "achievement",
        title: "Achievement unlocked: Topic Explorer",
        body: "You practiced topics from five different categories.",
        href: "/achievements",
        dedupeKey: "achievement:topic-explorer",
        at: new Date(topicExplorer.unlocked_at),
      });
    }
    run(db, "UPDATE notifications SET read_at = created_at WHERE user_id = ?", DEMO_USER_ID);
    notify(db, DEMO_USER_ID, {
      kind: "streak",
      title: "You're on a 6-day streak",
      body: "Practice for 2 minutes today to reach 7 days and unlock the Seven-Day Streak achievement.",
      href: "/free-talk",
      dedupeKey: "seed-streak-reminder",
      at: seedTime(now, 0, 0, 1) > now ? now : seedTime(now, 0, 0, 1),
    });

    seedSampleCommunity(db, now);
    run(db, "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('seeded_at', ?)", now.toISOString());
  });
}

/** Fictional sample accounts and records so the admin area has something to show. */
function seedSampleCommunity(db: DatabaseSync, now: Date) {
  const tz = serverTimeZone();
  createUser(db, {
    id: "sample-riley",
    displayName: "Riley",
    avatar: "sky",
    proficiency: "upper-intermediate",
    goals: ["work", "fluency"],
    conversationPref: "free_talk",
    dailyGoalMinutes: 15,
    timezone: tz,
    origin: "seed",
    createdAt: seedTime(now, 40, 10).toISOString(),
  });
  createUser(db, {
    id: "sample-sam",
    displayName: "Sam",
    avatar: "emerald",
    proficiency: "elementary",
    goals: ["confidence", "everyday"],
    conversationPref: "both",
    dailyGoalMinutes: 10,
    timezone: tz,
    origin: "seed",
    createdAt: seedTime(now, 12, 9).toISOString(),
  });
  const reports = [
    { reporter: "sample-riley", reportedId: "sample-promo", name: "PromoBot88 (sample)", reason: "spam", details: "Kept posting links to a paid course instead of talking.", status: "resolved", note: "Sample record: account suspended.", daysAgo: 9 },
    { reporter: "sample-sam", reportedId: "sample-anon", name: "QuietFox (sample)", reason: "harassment", details: "Made fun of my accent and refused to stop.", status: "reviewing", note: null, daysAgo: 2 },
  ];
  for (const r of reports) {
    const at = seedTime(now, r.daysAgo, 17).toISOString();
    run(
      db,
      `INSERT INTO safety_reports (id, reporter_user_id, reported_id, reported_kind, reported_name, reason, details, status, admin_note, origin, created_at, updated_at)
       VALUES (?, ?, ?, 'user', ?, ?, ?, ?, ?, 'seed', ?, ?)`,
      newId(), r.reporter, r.reportedId, r.name, r.reason, r.details, r.status, r.note, at, at,
    );
  }
  run(
    db,
    "INSERT INTO product_feedback (id, user_id, category, message, created_at) VALUES (?, ?, 'idea', ?, ?)",
    newId(),
    "sample-riley",
    "Sample feedback: it would be great to pick a partner with the same interests.",
    seedTime(now, 5, 11).toISOString(),
  );
}

export function seedIfEmpty(db: DatabaseSync) {
  syncContent(db);
  const seeded = get<{ value: string }>(db, "SELECT value FROM app_meta WHERE key = 'seeded_at'");
  if (!seeded) seedDemoData(db);
}

const DATA_TABLES = [
  "live_signals", "live_rooms", "live_queue", "notifications", "user_achievements", "xp_events", "user_activity",
  "saved_sentences", "battles", "feedback", "transcript_entries", "transcripts", "sessions", "topic_favorites",
  "blocks", "safety_reports", "product_feedback", "user_settings", "users", "app_meta",
];

/** Deletes all user data and restores the initial demo seed. */
export function resetDemoData(db: DatabaseSync, now = new Date()) {
  tx(db, () => {
    for (const table of DATA_TABLES) run(db, `DELETE FROM ${table}`);
  });
  seedDemoData(db, now);
}

