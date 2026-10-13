/**
 * Product-level configuration shared by every client.
 * The display name is intentionally configurable: clients may override it with
 * VITE_APP_NAME (web), EXPO_PUBLIC_APP_NAME (mobile) or APP_NAME (server).
 */
export const DEFAULT_APP_NAME = 'FluentPath';

export function resolveAppName(override?: string | null): string {
  const v = (override ?? '').trim();
  return v.length > 0 ? v : DEFAULT_APP_NAME;
}

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const CEFR_LABELS: Record<CefrLevel, string> = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper Intermediate',
  C1: 'Advanced',
  C2: 'Proficient',
};

export function cefrIndex(level: CefrLevel): number {
  return CEFR_LEVELS.indexOf(level);
}

export const LEARNING_GOALS = [
  'ielts_academic',
  'ielts_general',
  'general_english',
  'speaking_confidence',
  'business_english',
  'study_abroad',
] as const;
export type LearningGoal = (typeof LEARNING_GOALS)[number];

export const LEARNING_GOAL_LABELS: Record<LearningGoal, string> = {
  ielts_academic: 'IELTS Academic',
  ielts_general: 'IELTS General Training',
  general_english: 'General English',
  speaking_confidence: 'Speaking confidence',
  business_english: 'Business & career English',
  study_abroad: 'Study abroad',
};

export const TEST_TYPES = ['academic', 'general', 'none'] as const;
export type TestType = (typeof TEST_TYPES)[number];

export const TARGET_BANDS = [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9] as const;

export const PRACTICE_MODES = ['free_talk', 'ielts_speaking'] as const;
export type PracticeMode = (typeof PRACTICE_MODES)[number];
export const PRACTICE_MODE_LABELS: Record<PracticeMode, string> = {
  free_talk: 'Conversation practice',
  ielts_speaking: 'IELTS Speaking partner',
};

export const BATTLE_TYPES = [
  'vocabulary',
  'grammar',
  'word_meaning',
  'synonym',
  'spelling',
  'sentence_formation',
  'quick_quiz',
  'ielts_vocabulary',
] as const;
export type BattleType = (typeof BATTLE_TYPES)[number];
export const BATTLE_TYPE_LABELS: Record<BattleType, string> = {
  vocabulary: 'Vocabulary Battle',
  grammar: 'Grammar Battle',
  word_meaning: 'Word Meaning Challenge',
  synonym: 'Synonym Challenge',
  spelling: 'Spelling Challenge',
  sentence_formation: 'Sentence Formation',
  quick_quiz: 'Quick Quiz Duel',
  ielts_vocabulary: 'IELTS Vocabulary Challenge',
};

export const NOTICE_UNOFFICIAL =
  'Practice estimate only. This is not an official IELTS score and is not endorsed by the IELTS partners.';
