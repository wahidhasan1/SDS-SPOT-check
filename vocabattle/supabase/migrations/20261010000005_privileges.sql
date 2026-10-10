-- =============================================================================
-- Vocabattle — 0005 privileges
-- Supabase grants ALL on public tables and EXECUTE on public functions to
-- anon/authenticated by default. Replace that with an explicit allow-list.
-- RLS still applies on top of every grant below.
--
-- CONVENTION for future migrations: add explicit grants for any new table, and
-- re-run the function grant block at the end of the migration.
-- =============================================================================

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Read access (rows still filtered by RLS policies).
grant select on
  public.app_config,
  public.profiles,
  public.user_progress,
  public.proficiency_history,
  public.daily_activity,
  public.learning_activities,
  public.user_skill_stats,
  public.user_roles,
  public.subscriptions,
  public.usage_counters,
  public.notifications,
  public.push_tokens,
  public.vocab_topics,
  public.vocabulary_entries,
  public.user_word_stats,
  public.achievements,
  public.user_achievements,
  public.assessments,
  public.assessment_responses,
  public.quiz_attempts,
  public.quiz_responses,
  public.user_vocabulary,
  public.battle_ratings,
  public.matchmaking_queue,
  public.battles,
  public.battle_results
to authenticated;

-- Users may edit presentation and preferences only — never level, XP,
-- streaks, onboarding state, account status or anything competitive.
grant update (
  username, display_name, avatar, interface_language, timezone, learning_goals,
  ielts_target_band, ielts_exam_date, daily_goal_xp, gender, battle_gender_preference,
  show_identity_in_battles, show_on_leaderboard, show_streak_publicly, show_badges_publicly,
  theme_preference, notification_prefs
) on public.profiles to authenticated;

grant update (read_at) on public.notifications to authenticated;
grant delete on public.notifications, public.user_vocabulary to authenticated;
grant insert, update, delete on public.push_tokens to authenticated;

-- Functions: nothing for anon; authenticated may call public RPCs (each one
-- authenticates and authorises internally).
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
-- Needed by the battles RLS policy, which is evaluated as the caller.
grant execute on function private.is_battle_participant(uuid) to authenticated;
