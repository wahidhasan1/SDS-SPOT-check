import { z } from "zod";
import {
  CONVERSATION_PREFS,
  DAILY_GOALS,
  LEARNING_GOALS,
  PROFICIENCY_LEVELS,
  TOPIC_CATEGORIES,
} from "./types";
import { AVATAR_KEYS } from "./avatars";

// Request validation shared by API routes (and reused by forms where useful).

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Display name must be at least 2 characters.")
  .max(24, "Display name must be 24 characters or fewer.")
  .regex(/^[\p{L}\p{N} ._'-]+$/u, "Use letters, numbers, spaces, dots, dashes, or underscores.");

export const proficiencySchema = z.enum(PROFICIENCY_LEVELS);
export const avatarSchema = z.enum(AVATAR_KEYS as [string, ...string[]]);
export const dailyGoalSchema = z.union(DAILY_GOALS.map((g) => z.literal(g)) as [z.ZodLiteral<5>, z.ZodLiteral<10>, z.ZodLiteral<15>, z.ZodLiteral<30>]);

export const onboardingSchema = z.object({
  displayName: displayNameSchema,
  avatar: avatarSchema,
  proficiency: proficiencySchema,
  goals: z.array(z.enum(LEARNING_GOALS)).min(1, "Choose at least one goal.").max(LEARNING_GOALS.length),
  conversationPref: z.enum(CONVERSATION_PREFS),
  dailyGoalMinutes: dailyGoalSchema,
  timezone: z.string().max(64).optional(),
});

export const settingsSchema = z.object({
  profile: z
    .object({
      displayName: displayNameSchema,
      avatar: avatarSchema,
      proficiency: proficiencySchema,
      goals: z.array(z.enum(LEARNING_GOALS)).min(1, "Choose at least one goal."),
      dailyGoalMinutes: dailyGoalSchema,
      conversationPref: z.enum(CONVERSATION_PREFS),
    })
    .optional(),
  matching: z
    .object({
      proficiencyRange: z.tuple([proficiencySchema, proficiencySchema]),
      topicCategories: z.array(z.enum(TOPIC_CATEGORIES)),
      durationMinutes: z.union([z.literal(5), z.literal(10), z.literal(15)]),
      globalMatching: z.boolean(),
      englishOnly: z.boolean(),
      suggestTopic: z.boolean(),
      modePreference: z.enum(CONVERSATION_PREFS),
    })
    .optional(),
  notifications: z
    .object({ practiceReminders: z.boolean(), streakReminders: z.boolean(), achievementNotifications: z.boolean() })
    .optional(),
  privacy: z
    .object({
      showDisplayName: z.boolean(),
      showPartnerNamesInHistory: z.boolean(),
      transcriptRetention: z.enum(["keep", "30d", "none"]),
    })
    .optional(),
  accessibility: z.object({ reducedMotion: z.boolean(), largerText: z.boolean() }).optional(),
});

export const REPORT_REASONS = ["harassment", "hate", "sexual_harassment", "spam", "impersonation", "other"] as const;
export const REPORT_REASON_LABELS: Record<(typeof REPORT_REASONS)[number], string> = {
  harassment: "Harassment",
  hate: "Hate or abusive behavior",
  sexual_harassment: "Sexual harassment",
  spam: "Spam",
  impersonation: "Impersonation",
  other: "Other inappropriate behavior",
};

export const reportSchema = z.object({
  reportedId: z.string().min(1).max(80),
  reportedKind: z.enum(["demo_partner", "user"]),
  reportedName: z.string().min(1).max(60),
  sessionId: z.string().max(80).nullish(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(1000).optional().default(""),
});

export const blockSchema = z.object({
  blockedId: z.string().min(1).max(80),
  blockedKind: z.enum(["demo_partner", "user"]),
  blockedName: z.string().min(1).max(60),
});

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

export const freeTalkCompleteSchema = z.object({
  idempotencyKey: z.string().min(8).max(80),
  partnerId: z.string().min(1).max(80),
  partnerKind: z.enum(["demo_partner", "user"]).default("demo_partner"),
  topicId: z.string().max(80).nullable(),
  startedAt: isoDate,
  endedAt: isoDate,
  plannedSeconds: z.number().int().min(60).max(3600),
  activeSeconds: z.number().min(0).max(4 * 3600),
  endReason: z.enum(["completed", "ended_early", "time_up", "skipped", "left", "connection_lost", "reported", "blocked"]),
  /** Ordered transcript lines. Partner lines are the scripted prompts shown during a demo call. */
  captions: z
    .object({
      source: z.enum(["browser_speech", "typed"]),
      lines: z.array(z.object({ speaker: z.enum(["user", "partner"]), text: z.string().trim().min(1).max(1000) })).max(400),
    })
    .nullable(),
  liveRoomId: z.string().max(80).nullish(),
});

export const battleCompleteSchema = z.object({
  idempotencyKey: z.string().min(8).max(80),
  promptId: z.string().min(1).max(80),
  opponentId: z.string().min(1).max(80),
  prepSeconds: z.number().int().min(0).max(120),
  speakSeconds: z.number().int().min(15).max(120),
  response: z.string().trim().min(1, "Your response is empty.").max(4000),
  inputMode: z.enum(["typed", "spoken"]),
  recordedSeconds: z.number().min(0).max(180).default(0),
  startedAt: isoDate,
});

export const coachSchema = z.object({
  promptId: z.string().max(80).nullish(),
  promptText: z.string().trim().min(3).max(500),
  response: z.string().trim().min(3, "Write or record a response first.").max(4000),
  inputMode: z.enum(["typed", "spoken"]),
  recordedSeconds: z.number().min(0).max(300).default(0),
  idempotencyKey: z.string().min(8).max(80),
});

export const saveSentenceSchema = z.object({
  original: z.string().trim().min(1).max(1000),
  corrected: z.string().trim().min(1).max(1000),
  explanation: z.string().max(1000).nullish(),
  category: z.string().max(40).nullish(),
  sourceKind: z.enum(["transcript", "coach", "battle"]),
  sourceId: z.string().max(80).nullish(),
});
