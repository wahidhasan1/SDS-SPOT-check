import { z } from 'zod';
import { BATTLE_TYPES, CEFR_LEVELS, LEARNING_GOALS, PRACTICE_MODES, TEST_TYPES } from './config';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .refine((p) => /[A-Za-z]/.test(p) && /[0-9]/.test(p), 'Use at least one letter and one number');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(2).max(40),
  birthYear: z.number({ required_error: "Birth year is required" }).int().min(1900).max(new Date().getFullYear()),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms and community guidelines' }) }),
});
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema });
export const deleteAccountSchema = z.object({ password: z.string().min(1), confirm: z.literal('DELETE') });

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(40),
    avatar: z.string().max(40),
    goals: z.array(z.enum(LEARNING_GOALS)).max(6),
    testType: z.enum(TEST_TYPES),
    targetBand: z.number().min(4).max(9).multipleOf(0.5).nullable(),
    interests: z.array(z.string().max(40)).max(20),
    nativeLanguage: z.string().max(40).nullable(),
    translationLanguage: z.string().max(40).nullable(),
    timezone: z.string().max(64),
    onboardingCompleted: z.boolean(),
    privacy: z.object({ showLevelToPartners: z.boolean(), showOnLeaderboard: z.boolean() }).partial(),
    notificationPrefs: z
      .object({
        dailyReminder: z.boolean(),
        reminderHour: z.number().int().min(0).max(23),
        vocabReview: z.boolean(),
        battleInvites: z.boolean(),
        streaks: z.boolean(),
      })
      .partial(),
  })
  .partial();

export const matchJoinSchema = z.object({
  mode: z.enum(PRACTICE_MODES),
  topicId: z.string().max(40),
  levelPreference: z.enum(['similar', 'any', 'higher']).optional(),
});

export const REPORT_REASONS = [
  'harassment',
  'hate_speech',
  'sexual_content',
  'spam_or_scam',
  'inappropriate_language',
  'underage',
  'not_practising_english',
  'other',
] as const;
export const reportSchema = z.object({
  callId: z.string().uuid().optional(),
  battleId: z.string().uuid().optional(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(1000).optional(),
  alsoBlock: z.boolean().optional(),
});
export const blockSchema = z.object({ callId: z.string().uuid().optional(), battleId: z.string().uuid().optional() });
export const callFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export const answerMapSchema = z.record(z.string().max(40), z.string().max(300));
export const saveAnswersSchema = z.object({ answers: answerMapSchema, elapsedSec: z.number().int().min(0).max(36000).optional() });

export const writingDraftSchema = z.object({
  promptId: z.string().uuid(),
  text: z.string().max(20000),
  elapsedSec: z.number().int().min(0).max(36000).optional(),
  mockAttemptId: z.string().uuid().optional(),
});

export const speakingAnalyseSchema = z.object({
  promptId: z.string().uuid().optional(),
  part: z.number().int().min(1).max(3),
  question: z.string().max(1000),
  transcript: z.string().min(1).max(20000),
  durationSec: z.number().min(1).max(1200),
  transcriptSource: z.enum(['web_speech', 'native_speech', 'server_stt', 'typed']),
  consent: z.literal(true),
  mockAttemptId: z.string().uuid().optional(),
});

export const lookupSchema = z.object({
  word: z.string().trim().min(1).max(60),
  sentence: z.string().max(1200).optional(),
  sessionId: z.string().uuid().optional(),
});
export const translateSchema = z.object({
  text: z.string().trim().min(1).max(1500),
  targetLanguage: z.string().trim().min(2).max(40),
  context: z.string().max(1200).optional(),
});
export const ocrCorrectionSchema = z.object({ text: z.string().max(20000) });

export const saveWordSchema = z.object({
  word: z.string().trim().min(1).max(60),
  vocabularyId: z.string().uuid().optional(),
  meaning: z.string().max(600).optional(),
  example: z.string().max(600).optional(),
  source: z.enum(['quiz', 'reading', 'ai_reading', 'writing_feedback', 'speaking', 'call', 'manual', 'daily']),
  context: z.string().max(1200).optional(),
});
export const reviewWordSchema = z.object({ quality: z.number().int().min(0).max(5) });

export const assessmentAnswerSchema = z.object({ itemId: z.string().uuid(), answer: z.string().max(200) });
export const grammarAnswerSchema = z.object({ answers: z.record(z.string(), z.string().max(300)) });
export const battleJoinSchema = z.object({ battleType: z.enum(BATTLE_TYPES), ranked: z.boolean() });
export const cefrSchema = z.enum(CEFR_LEVELS);

export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
