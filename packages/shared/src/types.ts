import type { BattleType, CefrLevel, LearningGoal, PracticeMode, TestType } from './config';

export interface PlanLimits {
  callsPerDay: number | null; // null = unlimited
  maxCallMinutes: number;
  premiumTopics: boolean;
  ieltsSpeakingMode: boolean;
  matchingPreferences: boolean;
  priorityMatching: boolean;
  aiWritingFeedbackPerDay: number | null;
  aiReadingScansPerDay: number | null;
  wordLookupsPerDay: number | null;
  translationsPerDay: number | null;
  mockTestsPerMonth: number | null;
  speakingAnalysesPerDay: number | null;
  rankedBattlesPerDay: number | null;
  advancedReports: boolean;
}

export interface Entitlements {
  plan: 'free' | 'premium';
  planName: string;
  source: 'default' | 'stripe' | 'app_store' | 'play_store' | 'revenuecat' | 'admin_grant';
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired' | 'none';
  currentPeriodEnd: string | null;
  limits: PlanLimits;
  usageToday: {
    calls: number;
    aiWritingFeedback: number;
    aiReadingScans: number;
    wordLookups: number;
    translations: number;
    speakingAnalyses: number;
    rankedBattles: number;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  anonName: string;
  avatar: string;
  role: 'user' | 'admin';
  cefrLevel: CefrLevel | null;
  levelAssessedAt: string | null;
  goals: LearningGoal[];
  testType: TestType;
  targetBand: number | null;
  interests: string[];
  nativeLanguage: string | null;
  translationLanguage: string | null;
  onboardingCompleted: boolean;
  privacy: {
    showLevelToPartners: boolean;
    showOnLeaderboard: boolean;
  };
  notificationPrefs: {
    dailyReminder: boolean;
    reminderHour: number; // local hour 0-23
    vocabReview: boolean;
    battleInvites: boolean;
    streaks: boolean;
  };
  timezone: string;
  birthYear: number | null;
  streakDays: number;
  battleRating: number;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface PartnerInfo {
  anonName: string;
  avatar: string;
  level: CefrLevel | null;
}

export interface CallInfo {
  id: string;
  mode: PracticeMode;
  topicId: string;
  topicLabel: string;
  role: 'offerer' | 'answerer';
  partner: PartnerInfo;
  iceServers: IceServer[];
  maxDurationSec: number;
  prompts: string[];
  ielts?: IeltsCallScript;
  matchedAt: string;
}

export interface IeltsCallScript {
  part1: { topic: string; questions: string[] };
  part2: { cueCard: string; bullets: string[]; prepSeconds: number; speakSeconds: number };
  part3: { questions: string[] };
}

export interface IeltsCallStep {
  part: 1 | 2 | 3;
  index: number;
  phase: 'asking' | 'preparing' | 'speaking' | 'done';
  startedAt: number;
  candidate: 'offerer' | 'answerer';
}

export interface CallHistoryItem {
  id: string;
  mode: PracticeMode;
  topicLabel: string;
  status: 'completed' | 'short' | 'failed' | 'cancelled';
  endReason: string | null;
  startedAt: string;
  connectedAt: string | null;
  durationSec: number;
  partner: { anonName: string; avatar: string } | null;
  myFeedback: { rating: number; comment: string | null } | null;
  partnerFeedbackRating: number | null;
}

export type ClientMessage =
  | { t: 'auth'; token: string }
  | { t: 'ping' }
  | { t: 'match.join'; mode: PracticeMode; topicId: string; levelPreference?: 'similar' | 'any' | 'higher' }
  | { t: 'match.cancel' }
  | { t: 'call.signal'; callId: string; data: unknown }
  | { t: 'call.media'; callId: string; state: 'connected' | 'disconnected' | 'failed' }
  | { t: 'call.mute'; callId: string; muted: boolean }
  | { t: 'call.end'; callId: string; reason?: string }
  | { t: 'call.ielts'; callId: string; step: IeltsCallStep }
  | { t: 'battle.join'; battleType: BattleType; ranked: boolean }
  | { t: 'battle.cancel' }
  | { t: 'battle.answer'; battleId: string; index: number; answer: string }
  | { t: 'battle.leave'; battleId: string };

export interface BattleQuestionPublic {
  index: number;
  kind: 'mcq' | 'text';
  prompt: string;
  hint?: string;
  options?: string[];
}

export interface BattleScore {
  me: number;
  opponent: number | null;
}

export type ServerMessage =
  | { t: 'auth.ok'; userId: string }
  | { t: 'auth.error'; message: string }
  | { t: 'pong' }
  | { t: 'error'; code: string; message: string }
  | {
      t: 'match.status';
      status: 'queued' | 'cancelled' | 'idle';
      queuedAt?: string;
      waitingCount?: number;
      levelRange?: number;
      message?: string;
    }
  | { t: 'match.found'; call: CallInfo }
  | { t: 'call.signal'; callId: string; data: unknown }
  | { t: 'call.partner_state'; callId: string; state: 'connected' | 'reconnecting' | 'disconnected' | 'online' }
  | { t: 'call.partner_mute'; callId: string; muted: boolean }
  | { t: 'call.connected'; callId: string; connectedAt: string }
  | { t: 'call.warning'; callId: string; secondsLeft: number }
  | { t: 'call.ielts'; callId: string; step: IeltsCallStep }
  | {
      t: 'call.ended';
      callId: string;
      reason: string;
      durationSec: number;
      status: CallHistoryItem['status'];
    }
  | { t: 'call.resume'; call: CallInfo; connectedAt: string | null; partnerMuted: boolean }
  | { t: 'battle.status'; status: 'queued' | 'cancelled'; message?: string }
  | {
      t: 'battle.start';
      battleId: string;
      battleType: BattleType;
      ranked: boolean;
      questionCount: number;
      secondsPerQuestion: number;
      opponent: { anonName: string; avatar: string; rating: number | null } | null;
    }
  | { t: 'battle.question'; battleId: string; question: BattleQuestionPublic; deadline: number; serverNow: number }
  | { t: 'battle.opponent_answered'; battleId: string; index: number }
  | {
      t: 'battle.reveal';
      battleId: string;
      index: number;
      correctAnswer: string;
      explanation?: string;
      you: { answer: string | null; correct: boolean; points: number };
      opponent: { answered: boolean; correct: boolean; points: number } | null;
      scores: BattleScore;
    }
  | {
      t: 'battle.end';
      battleId: string;
      result: 'win' | 'loss' | 'draw' | 'practice';
      reason: 'completed' | 'opponent_left' | 'you_left';
      scores: BattleScore;
      ratingBefore: number | null;
      ratingAfter: number | null;
    };

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
