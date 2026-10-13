import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  real,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  primaryKey,
  date,
  serial,
} from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts('created_at').notNull().defaultNow();
const updatedAt = () => ts('updated_at').notNull().defaultNow();

export const roleEnum = pgEnum('user_role', ['user', 'admin']);
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'deactivated']);
export const contentStatusEnum = pgEnum('content_status', ['draft', 'published', 'archived']);
export const ieltsVariantEnum = pgEnum('ielts_variant', ['academic', 'general']);
export const planEnum = pgEnum('plan_id', ['free', 'premium']);

// ---------------------------------------------------------------- accounts

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash'),
    googleSub: text('google_sub'),
    role: roleEnum('role').notNull().default('user'),
    status: userStatusEnum('status').notNull().default('active'),
    emailVerified: boolean('email_verified').notNull().default(false),
    createdAt: createdAt(),
    lastLoginAt: ts('last_login_at'),
    deactivatedAt: ts('deactivated_at'),
  },
  (t) => [uniqueIndex('users_email_uq').on(sql`lower(${t.email})`), uniqueIndex('users_google_sub_uq').on(t.googleSub)],
);

export const profiles = pgTable('profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  bio: text('bio').notNull().default(''),
  nativeLanguage: text('native_language'),
  /** Language used for translations in the reader. */
  preferredLanguage: text('preferred_language'),
  goals: text('goals').array().notNull().default(sql`'{}'::text[]`),
  preferredActivities: text('preferred_activities').array().notNull().default(sql`'{}'::text[]`),
  ieltsModule: ieltsVariantEnum('ielts_module'),
  ieltsTargetBand: real('ielts_target_band'),
  ieltsExamDate: date('ielts_exam_date'),
  confidence: integer('confidence'),
  cefrLevel: text('cefr_level'),
  cefrAssessedAt: ts('cefr_assessed_at'),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  timezone: text('timezone').notNull().default('UTC'),
  updatedAt: updatedAt(),
});

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  theme: text('theme').notNull().default('system'),
  dailyGoalMinutes: integer('daily_goal_minutes').notNull().default(15),
  notifyEmail: boolean('notify_email').notNull().default(true),
  notifyStreak: boolean('notify_streak').notNull().default(true),
  notifyFeedback: boolean('notify_feedback').notNull().default(true),
  notifyProduct: boolean('notify_product').notNull().default(false),
  allowCalls: boolean('allow_calls').notNull().default(true),
  showLevelInCalls: boolean('show_level_in_calls').notNull().default(true),
  profileVisibleOnLeaderboard: boolean('profile_visible_on_leaderboard').notNull().default(false),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    client: text('client').notNull().default('web'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    lastUsedAt: ts('last_used_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
  },
  (t) => [uniqueIndex('sessions_token_uq').on(t.tokenHash), index('sessions_user_idx').on(t.userId)],
);

export const authTokens = pgTable(
  'auth_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** password_reset | oauth_mobile_code */
    purpose: text('purpose').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: ts('expires_at').notNull(),
    usedAt: ts('used_at'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('auth_tokens_hash_uq').on(t.tokenHash)],
);

export const emailOutbox = pgTable('email_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  to: text('to_address').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  /** sent | logged (no SMTP configured) | failed */
  status: text('status').notNull(),
  error: text('error'),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- content

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** vocabulary | grammar | speaking */
    kind: text('kind').notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [uniqueIndex('categories_kind_slug_uq').on(t.kind, t.slug)],
);

export const lessons = pgTable(
  'lessons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    /** grammar | general */
    track: text('track').notNull().default('grammar'),
    pathLevel: text('path_level').notNull(),
    cefrLevel: text('cefr_level').notNull(),
    categorySlug: text('category_slug'),
    summary: text('summary').notNull(),
    /** Markdown-lite body (paragraphs, ## headings, - bullets, **bold**) */
    body: text('body').notNull(),
    examples: jsonb('examples').$type<{ text: string; note?: string; correct?: boolean }[]>().notNull().default([]),
    sortOrder: integer('sort_order').notNull().default(0),
    status: contentStatusEnum('status').notNull().default('draft'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('lessons_slug_uq').on(t.slug)],
);

export type ExerciseOption = string;
export const exercises = pgTable(
  'exercises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lessonId: uuid('lesson_id').references(() => lessons.id, { onDelete: 'cascade' }),
    /** lesson | placement | battle_grammar */
    purpose: text('purpose').notNull().default('lesson'),
    /** mcq | fill */
    type: text('type').notNull(),
    /** For placement: grammar | vocabulary | reading */
    skill: text('skill'),
    cefrLevel: text('cefr_level'),
    prompt: text('prompt').notNull(),
    /** Optional reading text shown above the question (placement reading items). */
    passage: text('passage'),
    options: jsonb('options').$type<string[]>().notNull().default([]),
    answers: jsonb('answers').$type<string[]>().notNull(),
    explanation: text('explanation').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    status: contentStatusEnum('status').notNull().default('published'),
    createdAt: createdAt(),
  },
  (t) => [index('exercises_lesson_idx').on(t.lessonId), index('exercises_purpose_idx').on(t.purpose)],
);

export const words = pgTable(
  'words',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    word: text('word').notNull(),
    partOfSpeech: text('part_of_speech').notNull(),
    phonetic: text('phonetic'),
    definition: text('definition').notNull(),
    example: text('example').notNull(),
    synonyms: text('synonyms').array().notNull().default(sql`'{}'::text[]`),
    antonyms: text('antonyms').array().notNull().default(sql`'{}'::text[]`),
    cefrLevel: text('cefr_level').notNull(),
    categorySlug: text('category_slug'),
    audioUrl: text('audio_url'),
    status: contentStatusEnum('status').notNull().default('published'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('words_word_pos_uq').on(sql`lower(${t.word})`, t.partOfSpeech), index('words_level_idx').on(t.cefrLevel)],
);

export const userWords = pgTable(
  'user_words',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    wordId: uuid('word_id').references(() => words.id, { onDelete: 'set null' }),
    word: text('word').notNull(),
    definition: text('definition').notNull(),
    context: text('context'),
    translation: text('translation'),
    /** daily | lesson | reading | reader | listening | manual */
    source: text('source').notNull(),
    status: text('status').notNull().default('learning'),
    ease: real('ease').notNull().default(2.5),
    intervalDays: integer('interval_days').notNull().default(0),
    repetitions: integer('repetitions').notNull().default(0),
    dueAt: ts('due_at').notNull().defaultNow(),
    lastReviewedAt: ts('last_reviewed_at'),
    correctCount: integer('correct_count').notNull().default(0),
    wrongCount: integer('wrong_count').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('user_words_uq').on(t.userId, sql`lower(${t.word})`), index('user_words_due_idx').on(t.userId, t.dueAt)],
);

export const ieltsSets = pgTable(
  'ielts_sets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    /** reading | listening */
    module: text('module').notNull(),
    variant: text('variant').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    difficulty: text('difficulty').notNull().default('medium'),
    timeLimitSec: integer('time_limit_sec').notNull(),
    content: jsonb('content').notNull(),
    questionCount: integer('question_count').notNull(),
    isPremium: boolean('is_premium').notNull().default(false),
    /** true when used only inside mock tests */
    mockOnly: boolean('mock_only').notNull().default(false),
    status: contentStatusEnum('status').notNull().default('draft'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('ielts_sets_slug_uq').on(t.slug), index('ielts_sets_module_idx').on(t.module, t.variant)],
);

export const writingTasks = pgTable(
  'writing_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    variant: text('variant').notNull(),
    taskNumber: integer('task_number').notNull(),
    taskType: text('task_type').notNull(),
    title: text('title').notNull(),
    prompt: text('prompt').notNull(),
    instructions: text('instructions').notNull(),
    visual: jsonb('visual'),
    minWords: integer('min_words').notNull(),
    timeMinutes: integer('time_minutes').notNull(),
    modelOutline: text('model_outline').notNull().default(''),
    isPremium: boolean('is_premium').notNull().default(false),
    mockOnly: boolean('mock_only').notNull().default(false),
    status: contentStatusEnum('status').notNull().default('draft'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('writing_tasks_slug_uq').on(t.slug)],
);

export const speakingPrompts = pgTable(
  'speaking_prompts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    part: integer('part').notNull(),
    topic: text('topic').notNull(),
    /** Part 1/3: list of questions. Part 2: cue card bullet points. */
    questions: text('questions').array().notNull(),
    cueCard: text('cue_card'),
    prepSeconds: integer('prep_seconds').notNull().default(0),
    speakSeconds: integer('speak_seconds').notNull(),
    status: contentStatusEnum('status').notNull().default('draft'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('speaking_prompts_slug_uq').on(t.slug)],
);

export const mockTests = pgTable(
  'mock_tests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    variant: text('variant').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    /** Ordered list of sections, each references content by slug. */
    sections: jsonb('sections')
      .$type<{ module: 'listening' | 'reading' | 'writing' | 'speaking'; refs: string[]; timeLimitSec: number }[]>()
      .notNull(),
    isPremium: boolean('is_premium').notNull().default(false),
    status: contentStatusEnum('status').notNull().default('draft'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('mock_tests_slug_uq').on(t.slug)],
);

export const mediaFiles = pgTable('media_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }),
  /** listening_audio | speaking_audio | reader_image | word_audio */
  kind: text('kind').notNull(),
  path: text('path').notNull(),
  originalName: text('original_name'),
  mime: text('mime').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  isPublic: boolean('is_public').notNull().default(false),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- learner activity

export const assessments = pgTable('assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  questionIds: jsonb('question_ids').$type<string[]>().notNull(),
  answers: jsonb('answers').$type<Record<string, string>>().notNull().default({}),
  breakdown: jsonb('breakdown'),
  score: integer('score'),
  maxScore: integer('max_score'),
  cefrResult: text('cefr_result'),
  startedAt: ts('started_at').notNull().defaultNow(),
  completedAt: ts('completed_at'),
});

export const attempts = pgTable(
  'attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** lesson | vocab_quiz | ielts_reading | ielts_listening */
    kind: text('kind').notNull(),
    refId: uuid('ref_id'),
    title: text('title').notNull(),
    status: text('status').notNull().default('in_progress'),
    answers: jsonb('answers').$type<Record<string, string>>().notNull().default({}),
    results: jsonb('results'),
    score: integer('score'),
    maxScore: integer('max_score'),
    bandEstimate: real('band_estimate'),
    durationSec: integer('duration_sec'),
    deadlineAt: ts('deadline_at'),
    startedAt: ts('started_at').notNull().defaultNow(),
    completedAt: ts('completed_at'),
  },
  (t) => [index('attempts_user_idx').on(t.userId, t.kind, t.startedAt)],
);

export const lessonProgress = pgTable(
  'lesson_progress',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('started'),
    bestScore: integer('best_score').notNull().default(0),
    maxScore: integer('max_score').notNull().default(0),
    attemptsCount: integer('attempts_count').notNull().default(0),
    completedAt: ts('completed_at'),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);

export const writingSubmissions = pgTable(
  'writing_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => writingTasks.id, { onDelete: 'cascade' }),
    mockAttemptId: uuid('mock_attempt_id'),
    text: text('text').notNull().default(''),
    wordCount: integer('word_count').notNull().default(0),
    /** draft | submitted | evaluated | evaluation_failed | not_evaluated */
    status: text('status').notNull().default('draft'),
    feedback: jsonb('feedback'),
    bandEstimate: real('band_estimate'),
    feedbackError: text('feedback_error'),
    timeSpentSec: integer('time_spent_sec').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    submittedAt: ts('submitted_at'),
  },
  (t) => [index('writing_user_idx').on(t.userId, t.createdAt)],
);

export const speakingAttempts = pgTable(
  'speaking_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    promptId: uuid('prompt_id').references(() => speakingPrompts.id, { onDelete: 'set null' }),
    mockAttemptId: uuid('mock_attempt_id'),
    /** ielts | challenge */
    mode: text('mode').notNull(),
    title: text('title').notNull(),
    question: text('question').notNull(),
    audioFileId: uuid('audio_file_id').references(() => mediaFiles.id, { onDelete: 'set null' }),
    durationSec: real('duration_sec').notNull().default(0),
    transcript: text('transcript').notNull().default(''),
    /** browser | device | manual | none */
    transcriptSource: text('transcript_source').notNull().default('none'),
    metrics: jsonb('metrics'),
    feedback: jsonb('feedback'),
    feedbackError: text('feedback_error'),
    score: integer('score'),
    createdAt: createdAt(),
  },
  (t) => [index('speaking_user_idx').on(t.userId, t.createdAt)],
);

export const mockAttempts = pgTable(
  'mock_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mockTestId: uuid('mock_test_id')
      .notNull()
      .references(() => mockTests.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('in_progress'),
    currentSection: integer('current_section').notNull().default(0),
    sectionState: jsonb('section_state')
      .$type<{ startedAt?: string; deadlineAt?: string; answers: Record<string, string>; submittedAt?: string; result?: unknown }[]>()
      .notNull(),
    results: jsonb('results'),
    startedAt: ts('started_at').notNull().defaultNow(),
    completedAt: ts('completed_at'),
  },
  (t) => [index('mock_attempts_user_idx').on(t.userId, t.startedAt)],
);

export const ocrDocuments = pgTable(
  'ocr_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    imageFileId: uuid('image_file_id').references(() => mediaFiles.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    recognizedText: text('recognized_text').notNull(),
    correctedText: text('corrected_text'),
    confidence: real('confidence'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('ocr_user_idx').on(t.userId, t.createdAt)],
);

export const activityLog = pgTable(
  'activity_log',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    refId: text('ref_id'),
    xp: integer('xp').notNull().default(0),
    minutes: real('minutes').notNull().default(0),
    /** Local calendar day of the activity in the user's timezone (for streaks). */
    day: date('day').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('activity_user_day_idx').on(t.userId, t.day), index('activity_user_created_idx').on(t.userId, t.createdAt)],
);

export const achievements = pgTable(
  'achievements',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    earnedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.code] })],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    link: text('link'),
    readAt: ts('read_at'),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)],
);

export const usageCounters = pgTable(
  'usage_counters',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    feature: text('feature').notNull(),
    day: date('day').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.feature, t.day] })],
);

// ---------------------------------------------------------------- social / realtime

export const callSessions = pgTable(
  'call_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userA: uuid('user_a')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userB: uuid('user_b')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    aliasA: text('alias_a').notNull(),
    aliasB: text('alias_b').notNull(),
    mode: text('mode').notNull(),
    topic: text('topic').notNull(),
    /** matched | active | ended | declined | expired | failed */
    status: text('status').notNull(),
    endReason: text('end_reason'),
    endedBy: uuid('ended_by'),
    matchedAt: ts('matched_at').notNull().defaultNow(),
    connectedAt: ts('connected_at'),
    endedAt: ts('ended_at'),
    durationSec: integer('duration_sec').notNull().default(0),
  },
  (t) => [index('call_user_a_idx').on(t.userA, t.matchedAt), index('call_user_b_idx').on(t.userB, t.matchedAt)],
);

export const blocks = pgTable(
  'blocks',
  {
    /** Opaque id used by the client to unblock, so the blocked user's account id is never exposed. */
    id: uuid('id').notNull().defaultRandom(),
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The anonymous name the blocked user had when blocked (never their real identity). */
    alias: text('alias').notNull(),
    callSessionId: uuid('call_session_id'),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] }), uniqueIndex('blocks_id_uq').on(t.id)],
);

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reportedUserId: uuid('reported_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    callSessionId: uuid('call_session_id').references(() => callSessions.id, { onDelete: 'set null' }),
    battleId: uuid('battle_id'),
    reportedAlias: text('reported_alias').notNull(),
    reason: text('reason').notNull(),
    details: text('details').notNull().default(''),
    /** open | reviewing | actioned | dismissed */
    status: text('status').notNull().default('open'),
    adminNote: text('admin_note'),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: ts('resolved_at'),
    createdAt: createdAt(),
  },
  (t) => [index('reports_status_idx').on(t.status, t.createdAt)],
);

export const battles = pgTable(
  'battles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: text('kind').notNull(),
    userA: uuid('user_a')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userB: uuid('user_b')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    aliasA: text('alias_a').notNull(),
    aliasB: text('alias_b').notNull(),
    questions: jsonb('questions').$type<{ prompt: string; options: string[]; answer: string }[]>().notNull(),
    scoreA: integer('score_a').notNull().default(0),
    scoreB: integer('score_b').notNull().default(0),
    correctA: integer('correct_a').notNull().default(0),
    correctB: integer('correct_b').notNull().default(0),
    winnerId: uuid('winner_id'),
    /** active | finished | abandoned */
    status: text('status').notNull().default('active'),
    endReason: text('end_reason'),
    createdAt: createdAt(),
    finishedAt: ts('finished_at'),
  },
  (t) => [index('battles_a_idx').on(t.userA, t.createdAt), index('battles_b_idx').on(t.userB, t.createdAt)],
);

// ---------------------------------------------------------------- billing

export const subscriptions = pgTable('subscriptions', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  plan: planEnum('plan').notNull().default('free'),
  /** active | canceled | past_due | incomplete */
  status: text('status').notNull().default('active'),
  /** none | stripe | development | admin */
  provider: text('provider').notNull().default('none'),
  providerCustomerId: text('provider_customer_id'),
  providerSubscriptionId: text('provider_subscription_id'),
  currentPeriodEnd: ts('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  updatedAt: updatedAt(),
});

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  target: text('target'),
  details: jsonb('details'),
  createdAt: createdAt(),
});
