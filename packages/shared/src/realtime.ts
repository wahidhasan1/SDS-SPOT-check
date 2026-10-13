export const CALL_MODES = [
  { id: 'general', label: 'General conversation', description: 'Relaxed everyday English on a topic of your choice.' },
  { id: 'ielts_speaking', label: 'IELTS speaking practice', description: 'Take turns asking each other IELTS Part 1–3 questions.' },
  { id: 'debate', label: 'Friendly debate', description: 'Each side argues one opinion on a statement.' },
] as const;
export type CallMode = (typeof CALL_MODES)[number]['id'];

export const CALL_TOPICS = [
  'any', 'daily life', 'travel', 'food', 'technology', 'education', 'work and careers', 'environment', 'health', 'movies and books', 'sports', 'culture',
] as const;
export type CallTopic = (typeof CALL_TOPICS)[number];

export type LevelPreference = 'similar' | 'any';

export const REPORT_REASONS = [
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'hate', label: 'Hate speech or discrimination' },
  { id: 'sexual', label: 'Sexual or inappropriate content' },
  { id: 'spam', label: 'Spam, advertising or scams' },
  { id: 'personal_info', label: 'Asked for or shared personal information' },
  { id: 'other', label: 'Something else' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['id'];

export interface IceServer { urls: string | string[]; username?: string; credential?: string }

/** Client -> server messages */
export type ClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'ping' }
  | { type: 'call.queue.join'; mode: CallMode; topic: CallTopic; level: LevelPreference }
  | { type: 'call.queue.leave' }
  | { type: 'call.accept'; callId: string }
  | { type: 'call.decline'; callId: string }
  | { type: 'call.signal'; callId: string; data: unknown }
  | { type: 'call.connected'; callId: string }
  | { type: 'call.mute'; callId: string; muted: boolean }
  | { type: 'call.end'; callId: string; reason?: string }
  | { type: 'call.rejoin'; callId: string }
  | { type: 'battle.queue.join'; kind: BattleKind }
  | { type: 'battle.queue.leave' }
  | { type: 'battle.answer'; battleId: string; index: number; choice: string }
  | { type: 'battle.forfeit'; battleId: string };

export type BattleKind = 'vocabulary' | 'grammar';

export interface BattleQuestionPublic { index: number; prompt: string; options: string[] }

/** Server -> client messages */
export type ServerMessage =
  | { type: 'ready'; userId: string }
  | { type: 'pong' }
  | { type: 'error'; code: string; message: string }
  | { type: 'call.queued'; position: number; waiting: number }
  | { type: 'call.queue.left' }
  | { type: 'call.matched'; callId: string; partnerAlias: string; partnerLevel: string | null; mode: CallMode; topic: string; prompt: string; expiresAt: number }
  | { type: 'call.start'; callId: string; role: 'offerer' | 'answerer'; iceServers: IceServer[]; partnerAlias: string }
  | { type: 'call.signal'; callId: string; data: unknown }
  | { type: 'call.partner_mute'; callId: string; muted: boolean }
  | { type: 'call.partner_status'; callId: string; status: 'connected' | 'reconnecting' }
  | { type: 'call.declined'; callId: string; byYou: boolean }
  | { type: 'call.ended'; callId: string; reason: string; durationSec: number }
  | { type: 'battle.queued'; kind: BattleKind }
  | { type: 'battle.queue.left' }
  | { type: 'battle.start'; battleId: string; kind: BattleKind; opponentAlias: string; questions: BattleQuestionPublic[]; secondsPerQuestion: number; startsAt: number }
  | { type: 'battle.answer_result'; battleId: string; index: number; correct: boolean; correctAnswer: string; points: number; score: number }
  | { type: 'battle.opponent_progress'; battleId: string; answered: number; score: number }
  | { type: 'battle.end'; battleId: string; results: { you: number; opponent: number; outcome: 'win' | 'loss' | 'draw'; reason: string } };
