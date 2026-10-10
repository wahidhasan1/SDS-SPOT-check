// Typed wrappers around the Vocabattle RPCs. All competitive and learning
// logic runs on the server; the client only sends choices and preferences.
import { toAppError } from './errors';
import { supabase } from './supabase';
import type {
  Achievement, AppNotification, AssessmentResult, AssessmentState, AssessmentStatus, BattleHistoryItem, BattleLobby,
  BattleState, Dashboard, Entitlements, Leaderboard, MatchmakingResult, PlansConfig, Profile, QuestionType, QuizAnswer,
  QuizStart, QuizSummary, Topic, UserWord, VocabEntry,
} from './types';

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args ?? {});
  if (error) throw toAppError(error);
  return data as T;
}

async function query<T>(promise: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw toAppError(error);
  return data as T;
}

export const api = {
  // ------------------------------------------------------------ profile
  getProfile: (userId: string) =>
    query<Profile>(supabase.from('profiles').select('*').eq('id', userId).single()),
  updateProfile: (userId: string, patch: Partial<Profile>) =>
    query<Profile>(supabase.from('profiles').update(patch).eq('id', userId).select('*').single()),
  completeProfileSetup: (p: {
    displayName: string; username: string; language: string; goals: string[]; dailyGoalXp: number;
    ieltsBand: number | null; ieltsDate: string | null; timezone: string;
  }) => rpc<{ onboarding_step: string }>('complete_profile_setup', {
    p_display_name: p.displayName, p_username: p.username, p_interface_language: p.language,
    p_learning_goals: p.goals, p_daily_goal_xp: p.dailyGoalXp, p_ielts_target_band: p.ieltsBand,
    p_ielts_exam_date: p.ieltsDate, p_timezone: p.timezone,
  }),
  isUsernameAvailable: (username: string) => rpc<boolean>('is_username_available', { p_username: username }),
  deleteMyAccount: () => rpc<void>('delete_my_account'),
  getEntitlements: () => rpc<Entitlements>('get_my_entitlements'),
  getPlansConfig: async () => {
    const row = await query<{ value: PlansConfig }>(supabase.from('app_config').select('value').eq('key', 'plans').single());
    return row.value;
  },
  getMyRoles: () => rpc<string[]>('get_my_roles'),

  // ------------------------------------------------------------ dashboard & progress
  getDashboard: () => rpc<Dashboard>('get_dashboard'),
  getAchievements: () => rpc<Achievement[]>('get_my_achievements'),

  // ------------------------------------------------------------ assessment
  getAssessmentStatus: () => rpc<AssessmentStatus>('get_assessment_status'),
  startAssessment: () => rpc<AssessmentState>('start_assessment'),
  submitAssessmentAnswer: (assessmentId: string, questionId: string, selected: number) =>
    rpc<AssessmentState>('submit_assessment_answer', { p_assessment_id: assessmentId, p_question_id: questionId, p_selected: selected }),
  getAssessmentResult: (assessmentId: string) => rpc<AssessmentResult>('get_assessment_result', { p_assessment_id: assessmentId }),

  // ------------------------------------------------------------ vocabulary & quizzes
  getTopics: () => rpc<Topic[]>('get_vocab_topics'),
  getTopicWords: (topicId: string) =>
    query<VocabEntry[]>(supabase.from('vocabulary_entries').select('*').eq('topic_id', topicId).order('difficulty').order('word')),
  getWord: (id: string) => query<VocabEntry>(supabase.from('vocabulary_entries').select('*').eq('id', id).single()),
  startQuiz: (opts: { kind?: string; topicId?: string | null; types?: QuestionType[] | null; count?: number }) =>
    rpc<QuizStart>('start_quiz', {
      p_kind: opts.kind ?? 'practice', p_topic_id: opts.topicId ?? null, p_types: opts.types ?? null, p_count: opts.count ?? 10,
    }),
  answerQuiz: (attemptId: string, index: number, selected: number) =>
    rpc<QuizAnswer>('answer_quiz_question', { p_attempt_id: attemptId, p_index: index, p_selected: selected }),
  finishQuiz: (attemptId: string) => rpc<QuizSummary>('finish_quiz', { p_attempt_id: attemptId }),

  getSavedWords: () =>
    query<UserWord[]>(supabase.from('user_vocabulary').select('*').order('created_at', { ascending: false })),
  isWordSaved: async (entryId: string) => {
    const rows = await query<{ id: string }[]>(supabase.from('user_vocabulary').select('id').eq('entry_id', entryId));
    return rows.length > 0 ? rows[0].id : null;
  },
  saveWord: (entryId: string, source = 'library') => rpc<UserWord>('save_word', { p_entry_id: entryId, p_source: source }),
  saveCustomWord: (word: string, definition: string, context: string) =>
    rpc<UserWord>('save_custom_word', { p_word: word.trim(), p_definition: definition.trim(), p_context: context.trim() || null, p_source: 'reading' }),
  removeWord: (id: string) => query(supabase.from('user_vocabulary').delete().eq('id', id)),
  getReviewQueue: (limit = 20) => rpc<UserWord[]>('get_review_queue', { p_limit: limit }),
  reviewWord: (id: string, grade: 'again' | 'hard' | 'good' | 'easy') =>
    rpc<{ word: UserWord; xp: number }>('review_word', { p_id: id, p_grade: grade }),

  // ------------------------------------------------------------ battles
  getBattleLobby: () => rpc<BattleLobby>('get_battle_lobby'),
  getActiveBattle: () => rpc<string | null>('get_active_battle'),
  joinMatchmaking: (mode: string) => rpc<MatchmakingResult>('join_matchmaking', { p_mode: mode }),
  cancelMatchmaking: () => rpc<{ cancelled: boolean; battle_id: string | null }>('cancel_matchmaking'),
  getBattleState: (id: string) => rpc<BattleState>('get_battle_state', { p_battle_id: id }),
  setBattleReady: (id: string) => rpc<BattleState>('set_battle_ready', { p_battle_id: id }),
  submitBattleAnswer: (id: string, index: number, selected: number) =>
    rpc<BattleState>('submit_battle_answer', { p_battle_id: id, p_index: index, p_selected: selected }),
  forfeitBattle: (id: string) => rpc<BattleState>('forfeit_battle', { p_battle_id: id }),
  getBattleHistory: (limit = 30) => rpc<BattleHistoryItem[]>('get_battle_history', { p_limit: limit }),
  getLeaderboard: (period: Leaderboard['period']) => rpc<Leaderboard>('get_leaderboard', { p_period: period, p_limit: 50 }),
  reportOpponent: (battleId: string, reason: string, details: string) =>
    rpc<{ report_id: string }>('report_battle_opponent', { p_battle_id: battleId, p_reason: reason, p_details: details }),
  blockOpponent: (battleId: string) => rpc<{ blocked: boolean; label?: string }>('block_battle_opponent', { p_battle_id: battleId }),
  getBlockedUsers: () => rpc<{ id: string; label: string; created_at: string }[]>('get_blocked_users'),
  unblockUser: (blockId: string) => rpc<void>('unblock_user', { p_block_id: blockId }),

  // ------------------------------------------------------------ notifications
  getNotifications: () =>
    query<AppNotification[]>(supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50)),
  markAllNotificationsRead: () => rpc<void>('mark_all_notifications_read'),
  deleteNotification: (id: string) => query(supabase.from('notifications').delete().eq('id', id)),

  // ------------------------------------------------------------ admin (role-gated on the server)
  adminOverview: () => rpc<Record<string, unknown>>('admin_get_overview'),
  adminReports: (status: string | null) => rpc<Record<string, unknown>[]>('admin_list_reports', { p_status: status, p_limit: 50 }),
  adminUpdateReport: (id: string, status: string, note: string) =>
    rpc<void>('admin_update_report', { p_report_id: id, p_status: status, p_note: note }),
  adminBattleIssues: () => rpc<{ flags: Record<string, unknown>[]; failed_battles: Record<string, unknown>[] }>('admin_list_battle_issues', { p_limit: 30 }),
};
