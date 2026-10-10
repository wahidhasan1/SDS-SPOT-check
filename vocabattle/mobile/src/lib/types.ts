// Shapes returned by the Vocabattle database RPCs (see supabase/migrations).

export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type QuestionType = 'meaning' | 'synonym' | 'antonym' | 'fill_blank' | 'context' | 'grammar' | 'ielts';

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar: string;
  interface_language: string;
  timezone: string;
  learning_goals: string[];
  ielts_target_band: number | null;
  ielts_exam_date: string | null;
  daily_goal_xp: number;
  gender: 'female' | 'male' | 'nonbinary' | 'prefer_not_to_say' | null;
  battle_gender_preference: 'any' | 'female' | 'male';
  show_identity_in_battles: boolean;
  show_on_leaderboard: boolean;
  show_streak_publicly: boolean;
  show_badges_publicly: boolean;
  theme_preference: 'system' | 'light' | 'dark';
  notification_prefs: NotificationPrefs;
  onboarding_step: 'profile' | 'assessment' | 'done';
  account_status: 'active' | 'suspended';
}

export interface NotificationPrefs {
  daily_reminder: boolean;
  reminder_time: string;
  review_reminders: boolean;
  streak_reminders: boolean;
  battle_events: boolean;
  achievements: boolean;
  product_updates: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  skill: string;
  prompt: string;
  sentence: string | null;
  options: string[];
  difficulty: number;
  topic_id: string | null;
}

export interface AssessmentState {
  assessment_id: string;
  kind?: 'initial' | 'retake';
  finished: boolean;
  index?: number;
  total?: number;
  question?: Question;
  result?: AssessmentResult;
}

export interface AreaScore { key: string; label: string; accuracy: number }

export interface Recommendation {
  kind: 'quiz' | 'review' | 'battle' | 'topics' | 'assessment';
  title: string;
  description: string;
  types?: QuestionType[];
  topic_id?: string;
  mode?: string;
  priority?: number;
}

export interface AssessmentResult {
  assessment_id: string;
  kind: 'initial' | 'retake';
  score: number;
  correct: number;
  total: number;
  ability: number;
  estimated_level: Level;
  level: Level;
  strengths: AreaScore[];
  weaknesses: AreaScore[];
  recommendations: Recommendation[];
  completed_at: string;
  disclaimer: string;
}

export interface AssessmentStatus {
  has_completed: boolean;
  last_result: AssessmentResult | null;
  in_progress_id: string | null;
  can_start: boolean;
  next_available_at: string | null;
  question_count: number;
}

export interface Dashboard {
  profile: { display_name: string | null; username: string | null; avatar: string; daily_goal_xp: number; onboarding_step: string; ielts_target_band: number | null };
  proficiency: { level: Level | null; status: 'unassessed' | 'provisional' | 'confirmed'; ability: number | null; updated_at: string | null };
  xp: number;
  streak: { current: number; longest: number; active_today: boolean };
  today: { xp: number; goal: number; quizzes: number; battles: number; reviews: number; answered: number; correct: number };
  vocabulary: { saved: number; due: number; learned: number; mastered: number };
  recent_quizzes: { id: string; score: number; total: number; xp: number; kind: string; topic_id: string | null; at: string }[];
  battle: { rating: number; games: number; wins: number; losses: number; draws: number; win_rate: number } | null;
  active_battle_id: string | null;
  recommendations: Recommendation[];
  ielts: null;
  unread_notifications: number;
  plan: 'free' | 'premium';
}

export interface QuizStart { attempt_id: string; total: number; questions: Question[] }

export interface QuizAnswer {
  is_correct: boolean;
  correct_index: number;
  explanation: string | null;
  entry: { id: string; word: string; definition: string; example: string; saved: boolean } | null;
}

export interface QuizSummary {
  attempt_id: string;
  status: 'completed' | 'abandoned' | 'in_progress';
  total: number;
  correct: number;
  xp: number;
  streak: number;
  new_achievements: string[];
  missed: { prompt: string; sentence: string | null; your_answer: string | null; correct_answer: string; explanation: string | null; entry_id: string | null }[];
}

export interface Topic {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  is_premium: boolean;
  word_count: number;
  learned: number;
  levels: Level[];
}

export interface VocabEntry {
  id: string;
  word: string;
  phonetic: string | null;
  audio_url: string | null;
  part_of_speech: string;
  definition: string;
  example: string;
  usage_note: string | null;
  synonyms: string[];
  antonyms: string[];
  level: Level;
  topic_id: string;
  ielts_note: string | null;
}

export interface UserWord {
  id: string;
  entry_id: string | null;
  word: string;
  definition: string | null;
  example: string | null;
  context_sentence: string | null;
  source: string;
  status: 'learning' | 'reviewing' | 'mastered';
  interval_days: number;
  repetitions: number;
  due_at: string;
  created_at: string;
  phonetic?: string | null;
  part_of_speech?: string | null;
  synonyms?: string[] | null;
  level?: Level | null;
}

export interface BattleMode {
  id: string;
  name: string;
  description: string;
  types: QuestionType[];
  enabled: boolean;
  icon: string;
  phase?: number;
}

export interface BattleLobby {
  rating: {
    rating: number; peak: number; games: number; wins: number; losses: number; draws: number;
    win_rate: number; accuracy: number | null; current_win_streak: number; best_win_streak: number; provisional: boolean;
  };
  modes: BattleMode[];
  plan: 'free' | 'premium';
  battles_remaining_today: number | null;
  battles_limit: number | null;
  gender_preference_available: boolean;
  gender_preference: 'any' | 'female' | 'male';
  show_identity: boolean;
  assessed: boolean;
  recent_opponents: { alias: string; avatar: string; level: Level | null; result: string; at: string }[];
}

export interface MatchmakingResult {
  status: 'waiting' | 'matched' | 'in_battle';
  battle_id?: string;
  mode?: string;
  waited_seconds?: number;
  gender_preference?: string;
}

export interface BattlePlayer {
  alias: string;
  avatar: string;
  level: Level | null;
  rating: number;
  score: number;
  correct: number;
  ready: boolean;
  connected?: boolean;
}

export interface BattleState {
  server_now: string;
  battle: {
    id: string; mode: string; mode_name: string; status: 'pending' | 'active' | 'completed' | 'cancelled' | 'void';
    rated: boolean; question_count: number; question_time_ms: number; reveal_ms: number; current_index: number;
    version: number; end_reason: string | null; created_at: string; started_at: string | null; ended_at: string | null;
    ready_deadline: string;
  };
  me: BattlePlayer;
  opponent: BattlePlayer;
  question: (Question & { idx: number; opens_at: string; deadline_at: string; my_selected: number | null; answered: boolean; opponent_answered: boolean }) | null;
  next_question_at: string | null;
  reveal: {
    idx: number; prompt: string; sentence: string | null; options: string[]; correct_index: number; explanation: string | null;
    entry_id: string | null; my_selected: number | null; my_correct: boolean; my_points: number; my_response_ms: number | null;
    opponent_selected: number | null; opponent_correct: boolean; opponent_points: number; closed_at: string;
  } | null;
  result: {
    my_result: 'win' | 'loss' | 'draw' | 'void' | 'cancelled'; opponent_result: string;
    rating_before: number; rating_after: number; rating_delta: number; xp: number; rated: boolean; reason: string | null;
    questions: { idx: number; prompt: string; sentence: string | null; correct_answer: string; explanation: string | null; entry_id: string | null; my_answer: string | null; my_correct: boolean; my_points: number; opponent_correct: boolean }[] | null;
  } | null;
  submission?: { accepted: boolean; reason: string | null };
}

export interface BattleHistoryItem {
  battle_id: string; mode: string; status: string; result: string | null; rated: boolean; end_reason: string | null;
  my_score: number; opponent_score: number; my_correct: number; question_count: number;
  opponent_alias: string; opponent_avatar: string; opponent_level: Level | null;
  rating_delta: number; rating_after: number | null; xp: number; ended_at: string;
}

export interface LeaderboardEntry {
  rank: number; username: string; display_name: string | null; avatar: string; level: Level | null;
  value: number; wins: number; games: number; is_me: boolean;
}

export interface Leaderboard {
  period: 'daily' | 'weekly' | 'monthly' | 'global';
  since: string | null;
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  metric: 'rating' | 'rating_gained';
  participating: boolean;
}

export interface Achievement {
  code: string; title: string; description: string; icon: string; category: string;
  xp_reward: number; available: boolean; earned_at: string | null;
}

export interface AppNotification {
  id: string; kind: string; title: string; body: string | null; data: Record<string, unknown>; read_at: string | null; created_at: string;
}

export interface Entitlements {
  plan: 'free' | 'premium';
  limits: Record<string, number | boolean | string | null>;
  usage: Record<string, number>;
  subscription: { status: string; billing_period: string | null; provider: string; current_period_end: string | null; will_renew: boolean } | null;
}

export interface PlansConfig {
  free: Record<string, number | boolean | string | null>;
  premium: Record<string, number | boolean | string | null>;
}
