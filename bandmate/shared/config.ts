// Product-wide constants shared by the client and the server.
// The app name is configurable: set VITE_APP_NAME (client) and APP_NAME (server) to rename the product.

export const DEFAULT_APP_NAME = 'Bandmate'

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type Cefr = (typeof CEFR_LEVELS)[number]

export const CEFR_INFO: Record<Cefr, { name: string; can: string }> = {
  A1: { name: 'Beginner', can: 'Understand and use very basic everyday phrases.' },
  A2: { name: 'Elementary', can: 'Talk about familiar topics in simple sentences.' },
  B1: { name: 'Intermediate', can: 'Handle most everyday situations and describe experiences.' },
  B2: { name: 'Upper intermediate', can: 'Discuss many topics fluently and follow complex texts.' },
  C1: { name: 'Advanced', can: 'Use English flexibly for study and work, with few errors.' },
  C2: { name: 'Proficient', can: 'Understand almost everything and express ideas precisely.' },
}

export const cefrIndex = (l: string) => CEFR_LEVELS.indexOf(l as Cefr)

export const TARGET_BANDS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5] as const

export type Goal = 'ielts' | 'general' | 'work'
export type TestType = 'academic' | 'general_training'

export const TEST_TYPE_LABEL: Record<TestType, string> = {
  academic: 'IELTS Academic',
  general_training: 'IELTS General Training',
}

/** Conversation topics offered before matching. `ielts` topics switch the call into structured IELTS mode. */
export const CALL_TOPICS = [
  { id: 'random', label: 'Random topic' },
  { id: 'free', label: 'Free conversation' },
  { id: 'daily-life', label: 'Daily life' },
  { id: 'education', label: 'Education' },
  { id: 'technology', label: 'Technology' },
  { id: 'travel', label: 'Travel' },
  { id: 'food', label: 'Food' },
  { id: 'hobbies', label: 'Hobbies' },
  { id: 'career', label: 'Career and interviews' },
  { id: 'current-affairs', label: 'Current affairs' },
  { id: 'ielts-1', label: 'IELTS Speaking Part 1', ielts: true },
  { id: 'ielts-2', label: 'IELTS Speaking Part 2', ielts: true },
  { id: 'ielts-3', label: 'IELTS Speaking Part 3', ielts: true },
] as const
export type CallTopicId = (typeof CALL_TOPICS)[number]['id']

export type CallMode = 'casual' | 'ielts'

/** Keys of per-plan limits. Values live in the database (plans.limits) and are enforced on the server. */
export const LIMIT_KEYS = {
  callsPerDay: 'Voice calls per day',
  callMaxMinutes: 'Maximum call length (minutes)',
  writingFeedbackPerDay: 'AI writing feedback per day',
  speakingAnalysesPerDay: 'Speaking analyses per day',
  ocrPagesPerDay: 'Photo pages read per day',
  translationsPerDay: 'Translations per day',
  mockTestsPerWeek: 'Mock tests per week',
  battlesPerDay: 'Battles per day',
  premiumContent: 'Premium IELTS content',
  genderPreference: 'Partner gender preference',
  advancedReports: 'Advanced progress reports',
} as const
export type LimitKey = keyof typeof LIMIT_KEYS
export type PlanLimits = Record<LimitKey, number | boolean>

/** -1 means unlimited. */
export const UNLIMITED = -1
