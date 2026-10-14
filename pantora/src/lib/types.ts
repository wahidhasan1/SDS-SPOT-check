// Shared domain types used by both server and client code.

export const PROFICIENCY_LEVELS = [
  "beginner",
  "elementary",
  "intermediate",
  "upper-intermediate",
  "advanced",
] as const;
export type Proficiency = (typeof PROFICIENCY_LEVELS)[number];

export const LEARNING_GOALS = [
  "confidence",
  "fluency",
  "grammar",
  "vocabulary",
  "work",
  "everyday",
  "pronunciation",
] as const;
export type LearningGoal = (typeof LEARNING_GOALS)[number];

export const CONVERSATION_PREFS = ["free_talk", "battles", "both"] as const;
export type ConversationPref = (typeof CONVERSATION_PREFS)[number];

export const DAILY_GOALS = [5, 10, 15, 30] as const;
export type DailyGoal = (typeof DAILY_GOALS)[number];

export const TOPIC_CATEGORIES = [
  "everyday-life",
  "hobbies",
  "travel-culture",
  "education",
  "career",
  "personal-development",
  "technology",
  "food-lifestyle",
  "opinions-debate",
  "storytelling",
] as const;
export type TopicCategory = (typeof TOPIC_CATEGORIES)[number];

export const DIFFICULTIES = ["easy", "medium", "challenging"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type SessionType = "free_talk" | "battle" | "coach";
export type SessionStatus = "completed" | "incomplete";
/** seed = preloaded sample history, demo = user activity with simulated partner/opponent, live = real peer session */
export type SessionOrigin = "seed" | "demo" | "live";

export type AnalyzerId = "demo-rules" | "anthropic";

export interface Topic {
  id: string;
  title: string;
  category: TopicCategory;
  difficulty: Difficulty;
  description: string;
  durationMinutes: number;
  openingQuestion: string;
  followUps: string[];
  tags: string[];
}

export interface DemoPartner {
  id: string;
  displayName: string;
  avatar: string;
  proficiency: Proficiency;
  interests: string[];
  bio: string;
}

export interface MatchingPrefs {
  proficiencyRange: [Proficiency, Proficiency];
  topicCategories: TopicCategory[];
  durationMinutes: 5 | 10 | 15;
  globalMatching: boolean;
  englishOnly: boolean;
  suggestTopic: boolean;
  modePreference: ConversationPref;
}

export interface NotificationPrefs {
  practiceReminders: boolean;
  streakReminders: boolean;
  achievementNotifications: boolean;
}

export interface PrivacyPrefs {
  showDisplayName: boolean;
  showPartnerNamesInHistory: boolean;
  transcriptRetention: "keep" | "30d" | "none";
}

export interface AccessibilityPrefs {
  reducedMotion: boolean;
  largerText: boolean;
}

export interface UserSettings {
  matching: MatchingPrefs;
  notifications: NotificationPrefs;
  privacy: PrivacyPrefs;
  accessibility: AccessibilityPrefs;
}

export interface UserProfile {
  id: string;
  displayName: string;
  avatar: string;
  proficiency: Proficiency;
  goals: LearningGoal[];
  conversationPref: ConversationPref;
  dailyGoalMinutes: number;
  timezone: string;
  isDemoAccount: boolean;
  createdAt: string;
}

// ---------- Analysis ----------

export type IssueCategory =
  | "tense"
  | "agreement"
  | "articles"
  | "prepositions"
  | "word-choice"
  | "word-form"
  | "sentence-structure"
  | "punctuation";

export interface LanguageIssue {
  original: string;
  corrected: string;
  explanation: string;
  category: IssueCategory;
  ruleId?: string;
  /** Capitalization or punctuation tidy-ups: shown, but not counted as speaking mistakes. */
  minor?: boolean;
}

export interface VocabularySuggestion {
  phrase: string;
  alternatives: string[];
  note: string;
}

export interface TextMetrics {
  words: number;
  sentences: number;
  avgSentenceLength: number;
  uniqueWordRatio: number;
  connectors: string[];
  fillerCount: number;
  repeatedWords: number;
}

export interface SpeechMetrics {
  durationSeconds: number;
  wordsPerMinute: number;
  source: "recording" | "live-captions";
}

export interface SentenceReview {
  original: string;
  corrected: string;
  changed: boolean;
  explanation: string;
  category: IssueCategory | null;
  alternative: string | null;
}

export interface AnalysisResult {
  analyzer: AnalyzerId;
  model: string | null;
  original: string;
  improved: string;
  summary: string;
  strengths: string[];
  issues: LanguageIssue[];
  sentences: SentenceReview[];
  vocabulary: VocabularySuggestion[];
  metrics: TextMetrics;
  speech: SpeechMetrics | null;
  fluencyNotes: string[] | null;
  exercise: { title: string; instructions: string };
  limitations: string[];
}

export type ScoreDimensionKey = "fluency" | "grammar" | "vocabulary" | "relevance" | "development";

export interface ScoreDimension {
  key: ScoreDimensionKey;
  label: string;
  max: number;
  score: number;
  explanation: string;
  wentWell: string;
  improve: string[];
}

export interface ScoreCard {
  analyzer: AnalyzerId;
  total: number;
  dimensions: ScoreDimension[];
  pronunciation: { measured: false; note: string };
  basis: "text" | "speech-transcript";
}

export interface BattleEvaluation {
  user: { analysis: AnalysisResult; score: ScoreCard };
  opponent: { analysis: AnalysisResult; score: ScoreCard };
  result: "win" | "loss" | "draw" | "no_result";
  comparable: boolean;
  resultNote: string;
}
