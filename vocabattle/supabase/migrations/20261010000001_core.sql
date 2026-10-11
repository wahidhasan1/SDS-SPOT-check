-- =============================================================================
-- Vocabattle — 0001 core
-- Identity, profiles, server-owned progress, configuration, roles, audit logs,
-- quotas/entitlements and shared helper functions.
--
-- Security model (applies to every migration):
--   * Every table has RLS enabled.
--   * Table privileges are an explicit allow-list (Supabase grants ALL to
--     anon/authenticated by default; we revoke and re-grant narrowly).
--   * Anything that decides correctness, scores, levels, ratings, XP, quotas
--     or entitlements runs in SECURITY DEFINER functions with an empty
--     search_path and fully qualified names.
--   * Internal helpers live in the `private` schema, which is not exposed by
--     the Data API.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;

-- -----------------------------------------------------------------------------
-- Configuration (centralised, product-owner editable; read-only for clients)
-- -----------------------------------------------------------------------------
create table public.app_config (
  key         text primary key,
  value       jsonb not null,
  description text,
  is_public   boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
alter table public.app_config enable row level security;
create policy app_config_read on public.app_config
  for select to authenticated using (is_public);

insert into public.app_config (key, value, description) values
('plans', '{
  "free": {
    "label": "Free",
    "battles_per_day": 10,
    "quizzes_per_day": null,
    "vocab_collection_max": 300,
    "ai_word_lookups_per_day": 15,
    "ocr_pages_per_day": 3,
    "page_translations_per_day": 2,
    "writing_feedback_per_day": 1,
    "gender_preference": false,
    "advanced_analytics": false
  },
  "premium": {
    "label": "Premium",
    "battles_per_day": 150,
    "quizzes_per_day": null,
    "vocab_collection_max": 10000,
    "ai_word_lookups_per_day": 300,
    "ocr_pages_per_day": 60,
    "page_translations_per_day": 40,
    "writing_feedback_per_day": 10,
    "gender_preference": true,
    "advanced_analytics": true
  }
}', 'Per-plan quotas (null = no limit) and feature flags. Premium battle limit is a fair-use ceiling.'),
('assessment', '{
  "question_count": 15,
  "start_difficulty": 3.0,
  "initial_step": 1.2,
  "step_decay": 0.8,
  "min_step": 0.35,
  "retake_cooldown_hours": 168,
  "max_level_change_per_retake": 1,
  "resume_window_minutes": 60
}', 'Adaptive assessment parameters and retake rules.'),
('battle', '{
  "question_count": 7,
  "question_time_ms": 15000,
  "reveal_ms": 4000,
  "start_countdown_ms": 3500,
  "ready_timeout_ms": 20000,
  "disconnect_timeout_ms": 30000,
  "max_duration_ms": 900000,
  "answer_grace_ms": 1500,
  "queue_stale_ms": 10000,
  "rated_pair_limit_per_day": 3,
  "min_human_response_ms": 350,
  "base_points": 100,
  "max_speed_bonus": 50,
  "initial_rating": 1000,
  "k_factor_provisional": 40,
  "k_factor": 24,
  "provisional_games": 15,
  "rating_floor": 100
}', 'Battle timing, scoring and rating rules. Server-authoritative.'),
('battle_modes', '[
  {"id":"vocab_duel","name":"Vocabulary Duel","description":"Pick the correct meaning of each word.","types":["meaning","context"],"enabled":true,"icon":"flash"},
  {"id":"syn_ant","name":"Synonym & Antonym","description":"Find the closest or opposite meaning under pressure.","types":["synonym","antonym"],"enabled":true,"icon":"swap-horizontal"},
  {"id":"sentence","name":"Sentence Challenge","description":"Choose the word that completes the sentence.","types":["fill_blank"],"enabled":true,"icon":"create"},
  {"id":"grammar","name":"Grammar Battle","description":"Tenses, articles, prepositions and agreement.","types":["grammar"],"enabled":true,"icon":"construct"},
  {"id":"ielts","name":"IELTS Challenge","description":"IELTS-style reading and vocabulary rounds.","types":["ielts"],"enabled":false,"icon":"school","phase":3}
]', 'Battle modes and the question types each one draws from.'),
('xp', '{
  "quiz_correct": 10,
  "quiz_correct_repeat": 2,
  "repeat_window_days": 7,
  "quiz_completion_bonus": 10,
  "battle_win": 30,
  "battle_draw": 20,
  "battle_loss": 10,
  "battle_correct": 3,
  "battle_daily_cap": 300,
  "review_correct": 4,
  "review_daily_cap": 150,
  "assessment_complete": 50
}', 'Experience-point rules. Repeated low-value activity earns progressively less.'),
('rate_limits', '{
  "matchmaking": {"max": 90, "window_seconds": 60},
  "report": {"max": 10, "window_seconds": 86400},
  "quiz_start": {"max": 40, "window_seconds": 3600},
  "assessment_start": {"max": 10, "window_seconds": 3600}
}', 'Per-user request rate limits for sensitive RPCs.');

-- -----------------------------------------------------------------------------
-- Profiles (user-editable presentation + preferences)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                        uuid primary key references auth.users (id) on delete cascade,
  username                  text check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  display_name              text check (char_length(btrim(display_name)) between 1 and 40),
  avatar                    text not null default '🦊' check (char_length(avatar) <= 16),
  interface_language        text not null default 'en' check (interface_language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  timezone                  text not null default 'UTC' check (char_length(timezone) <= 64),
  learning_goals            text[] not null default '{}' check (cardinality(learning_goals) <= 10),
  ielts_target_band         numeric(2,1) check (ielts_target_band between 4.0 and 9.0),
  ielts_exam_date           date,
  daily_goal_xp             integer not null default 50 check (daily_goal_xp between 10 and 1000),
  gender                    text check (gender in ('female','male','nonbinary','prefer_not_to_say')),
  battle_gender_preference  text not null default 'any' check (battle_gender_preference in ('any','female','male')),
  show_identity_in_battles  boolean not null default false,
  show_on_leaderboard       boolean not null default true,
  show_streak_publicly      boolean not null default true,
  show_badges_publicly      boolean not null default true,
  theme_preference          text not null default 'system' check (theme_preference in ('system','light','dark')),
  notification_prefs        jsonb not null default '{"daily_reminder":true,"reminder_time":"19:00","review_reminders":true,"streak_reminders":true,"battle_events":true,"achievements":true,"product_updates":false}',
  onboarding_step           text not null default 'profile' check (onboarding_step in ('profile','assessment','done')),
  account_status            text not null default 'active' check (account_status in ('active','suspended')),
  suspended_until           timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create unique index profiles_username_lower_idx on public.profiles (lower(username));
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- -----------------------------------------------------------------------------
-- Server-owned learning progress (never writable by clients)
-- -----------------------------------------------------------------------------
create table public.user_progress (
  user_id                 uuid primary key references auth.users (id) on delete cascade,
  proficiency_level       text check (proficiency_level in ('A1','A2','B1','B2','C1','C2')),
  proficiency_ability     numeric(4,2),
  proficiency_status      text not null default 'unassessed'
                            check (proficiency_status in ('unassessed','provisional','confirmed')),
  proficiency_updated_at  timestamptz,
  xp                      integer not null default 0 check (xp >= 0),
  current_streak          integer not null default 0,
  longest_streak          integer not null default 0,
  last_active_date        date,
  updated_at              timestamptz not null default now()
);
alter table public.user_progress enable row level security;
create policy user_progress_select_own on public.user_progress
  for select to authenticated using (user_id = auth.uid());

create table public.proficiency_history (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users (id) on delete cascade,
  level          text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  ability        numeric(4,2),
  status         text not null check (status in ('provisional','confirmed')),
  source         text not null check (source in ('initial_assessment','retake_assessment','level_check','admin')),
  assessment_id  uuid,
  created_at     timestamptz not null default now()
);
create index proficiency_history_user_idx on public.proficiency_history (user_id, created_at desc);
alter table public.proficiency_history enable row level security;
create policy proficiency_history_select_own on public.proficiency_history
  for select to authenticated using (user_id = auth.uid());

-- Day-level activity, used for daily goals, streaks and XP caps.
create table public.daily_activity (
  user_id        uuid not null references auth.users (id) on delete cascade,
  activity_date  date not null,
  xp             integer not null default 0,
  quizzes        integer not null default 0,
  battles        integer not null default 0,
  reviews        integer not null default 0,
  answered       integer not null default 0,
  correct        integer not null default 0,
  battle_xp      integer not null default 0,
  review_xp      integer not null default 0,
  primary key (user_id, activity_date)
);
alter table public.daily_activity enable row level security;
create policy daily_activity_select_own on public.daily_activity
  for select to authenticated using (user_id = auth.uid());

-- Generic activity log (recent scores, analytics, recommendations).
create table public.learning_activities (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users (id) on delete cascade,
  activity_type  text not null check (activity_type in ('quiz','battle','review','assessment','lesson','reading','ielts')),
  ref_id         uuid,
  score          integer,
  total          integer,
  xp             integer not null default 0,
  metadata       jsonb not null default '{}',
  created_at     timestamptz not null default now()
);
create index learning_activities_user_idx on public.learning_activities (user_id, created_at desc);
alter table public.learning_activities enable row level security;
create policy learning_activities_select_own on public.learning_activities
  for select to authenticated using (user_id = auth.uid());

-- Per-skill accuracy, e.g. 'type:synonym', 'topic:phrasal_verbs', 'grammar'.
create table public.user_skill_stats (
  user_id     uuid not null references auth.users (id) on delete cascade,
  skill_key   text not null,
  answered    integer not null default 0,
  correct     integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, skill_key)
);
alter table public.user_skill_stats enable row level security;
create policy user_skill_stats_select_own on public.user_skill_stats
  for select to authenticated using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Roles, administration, audit
-- -----------------------------------------------------------------------------
create table public.user_roles (
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('admin','moderator','content_editor')),
  granted_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;
create policy user_roles_select_own on public.user_roles
  for select to authenticated using (user_id = auth.uid());

create table public.admin_audit_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid references auth.users (id) on delete set null,
  action       text not null,
  target_type  text,
  target_id    text,
  details      jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);
alter table public.admin_audit_logs enable row level security;
-- No client policies: read through admin RPCs only.

-- -----------------------------------------------------------------------------
-- Subscriptions, usage quotas, rate limits
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  plan                text not null default 'premium' check (plan in ('premium')),
  billing_period      text check (billing_period in ('monthly','annual')),
  status              text not null check (status in ('active','trialing','grace_period','canceled','expired','billing_issue')),
  provider            text not null check (provider in ('revenuecat','app_store','play_store','manual')),
  provider_reference  text,
  current_period_end  timestamptz,
  will_renew          boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (provider, provider_reference)
);
create index subscriptions_user_idx on public.subscriptions (user_id);
alter table public.subscriptions enable row level security;
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using (user_id = auth.uid());
-- Writes come only from the verified billing webhook (service role).

create table public.usage_counters (
  user_id     uuid not null references auth.users (id) on delete cascade,
  feature     text not null,
  period_key  date not null,
  used        integer not null default 0 check (used >= 0),
  primary key (user_id, feature, period_key)
);
alter table public.usage_counters enable row level security;
create policy usage_counters_select_own on public.usage_counters
  for select to authenticated using (user_id = auth.uid());

create table public.rate_limits (
  user_id       uuid not null references auth.users (id) on delete cascade,
  key           text not null,
  window_start  timestamptz not null,
  count         integer not null default 0,
  primary key (user_id, key)
);
alter table public.rate_limits enable row level security;

-- -----------------------------------------------------------------------------
-- Notifications (in-app inbox) and push tokens
-- -----------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('achievement','assessment','battle','streak','review','subscription','system')),
  title       text not null,
  body        text,
  data        jsonb not null default '{}',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete_own on public.notifications
  for delete to authenticated using (user_id = auth.uid());

create table public.push_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  platform    text not null check (platform in ('ios','android','web')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
create policy push_tokens_own on public.push_tokens
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =============================================================================
-- Helper functions (private)
-- =============================================================================

create or replace function private.config(p_key text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select value from public.app_config where key = p_key
$$;

create or replace function private.cfg_int(p_section text, p_key text)
returns integer language sql stable security definer set search_path = '' as $$
  select (value ->> p_key)::integer from public.app_config where key = p_section
$$;

create or replace function private.require_user()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v uuid := auth.uid();
begin
  if v is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  return v;
end $$;

create or replace function private.has_role(p_user uuid, p_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = p_user and role in (p_role, 'admin'))
$$;

create or replace function private.require_role(p_role text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v uuid := private.require_user();
begin
  if not private.has_role(v, p_role) then
    raise exception 'Insufficient privileges' using errcode = '42501';
  end if;
  return v;
end $$;

create or replace function private.audit(p_action text, p_target_type text, p_target_id text, p_details jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.admin_audit_logs (actor_id, action, target_type, target_id, details)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb))
$$;

create or replace function private.level_num(p_level text)
returns smallint language sql immutable set search_path = '' as $$
  select case p_level when 'A1' then 1 when 'A2' then 2 when 'B1' then 3
                      when 'B2' then 4 when 'C1' then 5 when 'C2' then 6 end::smallint
$$;

create or replace function private.level_name(p_num integer)
returns text language sql immutable set search_path = '' as $$
  select (array['A1','A2','B1','B2','C1','C2'])[greatest(1, least(6, p_num))]
$$;

-- The user's local calendar date (streaks and daily goals follow the user's day).
create or replace function private.user_today(p_user uuid)
returns date language plpgsql stable security definer set search_path = '' as $$
declare tz text;
begin
  select timezone into tz from public.profiles where id = p_user;
  begin
    return (now() at time zone coalesce(tz, 'UTC'))::date;
  exception when others then
    return (now() at time zone 'UTC')::date;
  end;
end $$;

create or replace function private.user_plan(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case when exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user
      and s.status in ('active','trialing','grace_period')
      and (s.current_period_end is null or s.current_period_end > now())
  ) then 'premium' else 'free' end
$$;

-- Limit for a feature on the user's current plan; NULL means unlimited.
create or replace function private.plan_limit(p_user uuid, p_feature text)
returns integer language sql stable security definer set search_path = '' as $$
  select (private.config('plans') -> private.user_plan(p_user) ->> p_feature)::integer
$$;

create or replace function private.plan_flag(p_user uuid, p_flag text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((private.config('plans') -> private.user_plan(p_user) ->> p_flag)::boolean, false)
$$;

create or replace function private.quota_used(p_user uuid, p_feature text)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((select used from public.usage_counters
                   where user_id = p_user and feature = p_feature
                     and period_key = private.user_today(p_user)), 0)
$$;

-- Daily quota check. p_feature is the plan key, e.g. 'battles_per_day'.
create or replace function private.quota_remaining(p_user uuid, p_feature text)
returns integer language plpgsql stable security definer set search_path = '' as $$
declare lim integer := private.plan_limit(p_user, p_feature);
begin
  if lim is null then return null; end if;
  return greatest(0, lim - private.quota_used(p_user, p_feature));
end $$;

-- Atomically consumes quota. Returns false (and consumes nothing) when exhausted.
create or replace function private.consume_quota(p_user uuid, p_feature text, p_amount integer default 1)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  lim integer := private.plan_limit(p_user, p_feature);
  today date := private.user_today(p_user);
  new_used integer;
begin
  insert into public.usage_counters (user_id, feature, period_key, used)
  values (p_user, p_feature, today, 0)
  on conflict do nothing;

  update public.usage_counters
     set used = used + p_amount
   where user_id = p_user and feature = p_feature and period_key = today
     and (lim is null or used + p_amount <= lim)
  returning used into new_used;
  return new_used is not null;
end $$;

create or replace function private.refund_quota(p_user uuid, p_feature text, p_amount integer default 1)
returns void language sql security definer set search_path = '' as $$
  update public.usage_counters set used = greatest(0, used - p_amount)
   where user_id = p_user and feature = p_feature and period_key = private.user_today(p_user)
$$;

-- Fixed-window rate limiter. Raises when the limit for p_key is exceeded.
create or replace function private.rate_limit(p_user uuid, p_key text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  rule jsonb := private.config('rate_limits') -> p_key;
  max_count integer;
  window_s integer;
  r public.rate_limits;
begin
  if rule is null then return; end if;
  max_count := (rule ->> 'max')::integer;
  window_s := (rule ->> 'window_seconds')::integer;

  insert into public.rate_limits as rl (user_id, key, window_start, count)
  values (p_user, p_key, now(), 1)
  on conflict (user_id, key) do update
    set window_start = case when rl.window_start < now() - make_interval(secs => window_s)
                            then now() else rl.window_start end,
        count = case when rl.window_start < now() - make_interval(secs => window_s)
                     then 1 else rl.count + 1 end
  returning * into r;

  if r.count > max_count then
    raise exception 'Too many requests. Please slow down and try again shortly.' using errcode = 'P0429';
  end if;
end $$;

create or replace function private.notify(p_user uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, data)
  values (p_user, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb))
$$;

create or replace function private.require_active_account(p_user uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = p_user;
  if p.account_status = 'suspended' and (p.suspended_until is null or p.suspended_until > now()) then
    raise exception 'This account is suspended.' using errcode = '42501';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- New-user bootstrap
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name',
                                              new.raw_user_meta_data ->> 'full_name', '')), 40), ''))
  on conflict (id) do nothing;
  insert into public.user_progress (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- =============================================================================
-- Public RPCs: account & profile
-- =============================================================================

-- Onboarding step 1: validates and stores the profile, then unlocks the assessment.
create or replace function public.complete_profile_setup(
  p_display_name text,
  p_username text,
  p_interface_language text,
  p_learning_goals text[],
  p_daily_goal_xp integer,
  p_ielts_target_band numeric default null,
  p_ielts_exam_date date default null,
  p_timezone text default 'UTC'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  tz text := coalesce(nullif(p_timezone, ''), 'UTC');
begin
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'Username must be 3-20 letters, numbers or underscores.' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles where lower(username) = lower(p_username) and id <> uid) then
    raise exception 'That username is already taken.' using errcode = '23505';
  end if;
  -- Validate the timezone name; fall back to UTC instead of failing onboarding.
  begin
    perform now() at time zone tz;
  exception when others then
    tz := 'UTC';
  end;

  update public.profiles set
    display_name       = btrim(p_display_name),
    username           = p_username,
    interface_language = coalesce(nullif(p_interface_language, ''), 'en'),
    learning_goals     = coalesce(p_learning_goals, '{}'),
    daily_goal_xp      = coalesce(p_daily_goal_xp, 50),
    ielts_target_band  = p_ielts_target_band,
    ielts_exam_date    = p_ielts_exam_date,
    timezone           = tz,
    onboarding_step    = case when onboarding_step = 'profile' then 'assessment' else onboarding_step end
  where id = uid;

  return jsonb_build_object('onboarding_step',
    (select onboarding_step from public.profiles where id = uid));
end $$;

create or replace function public.is_username_available(p_username text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_username ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles
                     where lower(username) = lower(p_username) and id <> auth.uid())
$$;

-- Permanently deletes the caller's account. All user-owned rows cascade;
-- opponents keep anonymised battle history (participant user_id set null).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user();
begin
  delete from auth.users where id = uid;
end $$;

create or replace function public.get_my_entitlements()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  plan text := private.user_plan(uid);
  limits jsonb := private.config('plans') -> plan;
  sub public.subscriptions;
begin
  select * into sub from public.subscriptions
   where user_id = uid order by updated_at desc limit 1;
  return jsonb_build_object(
    'plan', plan,
    'limits', limits,
    'usage', coalesce((select jsonb_object_agg(feature, used) from public.usage_counters
                       where user_id = uid and period_key = private.user_today(uid)), '{}'::jsonb),
    'subscription', case when sub.id is null then null else jsonb_build_object(
        'status', sub.status, 'billing_period', sub.billing_period, 'provider', sub.provider,
        'current_period_end', sub.current_period_end, 'will_renew', sub.will_renew) end
  );
end $$;

create or replace function public.mark_all_notifications_read()
returns void language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null
$$;
