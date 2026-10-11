-- =============================================================================
-- Vocabattle — 0002 learning
-- Content bank (vocabulary + questions), adaptive proficiency assessment,
-- vocabulary quizzes, saved vocabulary with spaced repetition, XP/streaks,
-- achievements and the personalised dashboard.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Content
-- -----------------------------------------------------------------------------
create table public.vocab_topics (
  id           text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  name         text not null,
  description  text,
  icon         text not null default 'book',
  sort_order   integer not null default 0,
  is_premium   boolean not null default false
);
alter table public.vocab_topics enable row level security;
create policy vocab_topics_read on public.vocab_topics for select to authenticated using (true);

create table public.vocabulary_entries (
  id              uuid primary key default gen_random_uuid(),
  word            text not null,
  phonetic        text,
  audio_url       text,
  part_of_speech  text not null,
  definition      text not null,
  example         text not null,
  usage_note      text,
  synonyms        text[] not null default '{}',
  antonyms        text[] not null default '{}',
  level           text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  difficulty      smallint generated always as (
                    case level when 'A1' then 1 when 'A2' then 2 when 'B1' then 3
                               when 'B2' then 4 when 'C1' then 5 else 6 end) stored,
  topic_id        text not null references public.vocab_topics (id),
  ielts_note      text,
  is_active       boolean not null default true,
  content_source  text not null default 'original',
  created_at      timestamptz not null default now()
);
create unique index vocabulary_entries_word_pos_idx on public.vocabulary_entries (lower(word), part_of_speech);
create index vocabulary_entries_topic_idx on public.vocabulary_entries (topic_id, difficulty);
alter table public.vocabulary_entries enable row level security;
create policy vocabulary_entries_read on public.vocabulary_entries
  for select to authenticated using (is_active);

-- Shared question bank. Never directly readable by clients: correct answers are
-- only revealed by server functions after an answer is locked in.
create table public.questions (
  id                 uuid primary key default gen_random_uuid(),
  type               text not null check (type in ('meaning','synonym','antonym','fill_blank','context','grammar','ielts')),
  skill              text not null default 'vocabulary' check (skill in ('vocabulary','grammar','reading','listening')),
  prompt             text not null,
  sentence           text,
  options            jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  correct_index      smallint not null,
  explanation        text,
  difficulty         smallint not null check (difficulty between 1 and 6),
  topic_id           text references public.vocab_topics (id),
  grammar_topic      text,
  entry_id           uuid references public.vocabulary_entries (id) on delete cascade,
  use_in_assessment  boolean not null default true,
  use_in_quiz        boolean not null default true,
  use_in_battle      boolean not null default true,
  is_active          boolean not null default true,
  content_source     text not null default 'original',
  created_at         timestamptz not null default now(),
  check (correct_index >= 0 and correct_index < jsonb_array_length(options))
);
create index questions_type_difficulty_idx on public.questions (type, difficulty) where is_active;
create index questions_topic_idx on public.questions (topic_id) where is_active;
alter table public.questions enable row level security;
-- (no client policies)

-- Client-safe projection of a question.
create or replace function private.question_public(q public.questions)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', q.id, 'type', q.type, 'skill', q.skill, 'prompt', q.prompt,
    'sentence', q.sentence, 'options', q.options, 'difficulty', q.difficulty,
    'topic_id', q.topic_id)
$$;

-- -----------------------------------------------------------------------------
-- Per-word mastery + skill stats
-- -----------------------------------------------------------------------------
create table public.user_word_stats (
  user_id       uuid not null references auth.users (id) on delete cascade,
  entry_id      uuid not null references public.vocabulary_entries (id) on delete cascade,
  correct       integer not null default 0,
  wrong         integer not null default 0,
  last_seen_at  timestamptz not null default now(),
  primary key (user_id, entry_id)
);
alter table public.user_word_stats enable row level security;
create policy user_word_stats_select_own on public.user_word_stats
  for select to authenticated using (user_id = auth.uid());

-- Records the learning signal from any answered question (quiz, battle, assessment).
create or replace function private.record_answer(p_user uuid, p_question uuid, p_correct boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare q public.questions;
begin
  select * into q from public.questions where id = p_question;
  if not found then return; end if;

  insert into public.user_skill_stats as s (user_id, skill_key, answered, correct)
  values (p_user, 'type:' || q.type, 1, p_correct::int)
  on conflict (user_id, skill_key) do update
    set answered = s.answered + 1, correct = s.correct + p_correct::int, updated_at = now();

  if q.topic_id is not null then
    insert into public.user_skill_stats as s (user_id, skill_key, answered, correct)
    values (p_user, 'topic:' || q.topic_id, 1, p_correct::int)
    on conflict (user_id, skill_key) do update
      set answered = s.answered + 1, correct = s.correct + p_correct::int, updated_at = now();
  end if;

  if q.entry_id is not null then
    insert into public.user_word_stats as w (user_id, entry_id, correct, wrong)
    values (p_user, q.entry_id, p_correct::int, (not p_correct)::int)
    on conflict (user_id, entry_id) do update
      set correct = w.correct + p_correct::int, wrong = w.wrong + (not p_correct)::int,
          last_seen_at = now();
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Achievements
-- -----------------------------------------------------------------------------
create table public.achievements (
  code         text primary key,
  title        text not null,
  description  text not null,
  icon         text not null default 'trophy',
  category     text not null check (category in ('battle','learning','streak','reading','ielts','assessment')),
  xp_reward    integer not null default 0,
  sort_order   integer not null default 0,
  available    boolean not null default true
);
alter table public.achievements enable row level security;
create policy achievements_read on public.achievements for select to authenticated using (true);

create table public.user_achievements (
  user_id           uuid not null references auth.users (id) on delete cascade,
  achievement_code  text not null references public.achievements (code) on delete cascade,
  earned_at         timestamptz not null default now(),
  primary key (user_id, achievement_code)
);
alter table public.user_achievements enable row level security;
create policy user_achievements_select_own on public.user_achievements
  for select to authenticated using (user_id = auth.uid());

insert into public.achievements (code, title, description, icon, category, xp_reward, sort_order, available) values
('level_unlocked',      'Level Unlocked',        'Complete your first proficiency assessment.',              'ribbon',        'assessment', 25,  1, true),
('first_victory',       'First Victory',         'Win your first anonymous battle.',                         'trophy',        'battle',     25,  2, true),
('ten_battle_champion', 'Ten-Battle Champion',   'Win ten battles.',                                         'medal',         'battle',     75,  3, true),
('battle_veteran',      'Battle Veteran',        'Complete fifty battles.',                                  'shield',        'battle',     100, 4, true),
('sharp_shooter',       'Sharp Shooter',         'Answer every question correctly in a battle.',             'locate',        'battle',     40,  5, true),
('vocabulary_explorer', 'Vocabulary Explorer',   'Learn 50 words (answered correctly at least twice).',      'compass',       'learning',   60,  6, true),
('word_collector',      'Word Collector',        'Save 25 words to your vocabulary collection.',             'bookmarks',     'learning',   30,  7, true),
('perfect_quiz',        'Perfect Score',         'Score 100% on a quiz of at least ten questions.',          'star',          'learning',   30,  8, true),
('grammar_specialist',  'Grammar Specialist',    'Answer 50 grammar questions correctly with 80% accuracy.', 'construct',     'learning',   75,  9, true),
('seven_day_streak',    'Seven-Day Learning Streak', 'Learn something seven days in a row.',                 'flame',         'streak',     50, 10, true),
('consistent_learner',  'Consistent Learner',    'Keep a thirty-day learning streak.',                       'calendar',      'streak',     150, 11, true),
('reading_enthusiast',  'Reading Enthusiast',    'Read ten pages with the AI reading assistant.',            'book',          'reading',    50, 12, false),
('ielts_challenger',    'IELTS Challenger',      'Complete your first IELTS practice test.',                 'school',        'ielts',      50, 13, false);

create or replace function private.award_achievement(p_user uuid, p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare a public.achievements;
begin
  select * into a from public.achievements where code = p_code and available;
  if not found then return false; end if;
  insert into public.user_achievements (user_id, achievement_code) values (p_user, p_code)
  on conflict do nothing;
  if not found then return false; end if;
  update public.user_progress set xp = xp + a.xp_reward, updated_at = now() where user_id = p_user;
  perform private.notify(p_user, 'achievement', 'Achievement unlocked: ' || a.title, a.description,
                         jsonb_build_object('code', a.code, 'xp', a.xp_reward));
  return true;
end $$;

-- Evaluates every server-verifiable achievement for a user. Idempotent.
create or replace function private.check_achievements(p_user uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare
  earned text[] := '{}';
  prog public.user_progress;
  wins integer := 0; games integer := 0;
  learned integer; saved integer;
  g_answered integer; g_correct integer;
begin
  select * into prog from public.user_progress where user_id = p_user;
  select coalesce(sum(br.wins), 0), coalesce(sum(br.games), 0) into wins, games
    from public.battle_ratings br where br.user_id = p_user and br.mode = 'overall';
  select count(*) into learned from public.user_word_stats
   where user_id = p_user and correct >= 2 and correct > wrong;
  select count(*) into saved from public.user_vocabulary where user_id = p_user;
  select coalesce(answered, 0), coalesce(correct, 0) into g_answered, g_correct
    from public.user_skill_stats where user_id = p_user and skill_key = 'type:grammar';

  if prog.proficiency_status <> 'unassessed' and private.award_achievement(p_user, 'level_unlocked') then earned := array_append(earned, 'level_unlocked'); end if;
  if wins >= 1   and private.award_achievement(p_user, 'first_victory') then earned := array_append(earned, 'first_victory'); end if;
  if wins >= 10  and private.award_achievement(p_user, 'ten_battle_champion') then earned := array_append(earned, 'ten_battle_champion'); end if;
  if games >= 50 and private.award_achievement(p_user, 'battle_veteran') then earned := array_append(earned, 'battle_veteran'); end if;
  if learned >= 50 and private.award_achievement(p_user, 'vocabulary_explorer') then earned := array_append(earned, 'vocabulary_explorer'); end if;
  if saved >= 25 and private.award_achievement(p_user, 'word_collector') then earned := array_append(earned, 'word_collector'); end if;
  if coalesce(g_correct,0) >= 50 and g_correct::numeric / greatest(g_answered,1) >= 0.8
     and private.award_achievement(p_user, 'grammar_specialist') then earned := array_append(earned, 'grammar_specialist'); end if;
  if prog.current_streak >= 7  and private.award_achievement(p_user, 'seven_day_streak') then earned := array_append(earned, 'seven_day_streak'); end if;
  if prog.current_streak >= 30 and private.award_achievement(p_user, 'consistent_learner') then earned := array_append(earned, 'consistent_learner'); end if;
  return earned;
end $$;

-- -----------------------------------------------------------------------------
-- XP, daily activity and streaks
-- -----------------------------------------------------------------------------
-- p_kind: 'quiz' | 'battle' | 'review' | 'assessment'. Applies daily caps for
-- battle and review XP so repetitive low-value activity cannot dominate.
-- Returns the XP actually granted.
create or replace function private.record_activity(
  p_user uuid, p_kind text, p_xp integer, p_answered integer default 0, p_correct integer default 0
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  today date := private.user_today(p_user);
  xpc jsonb := private.config('xp');
  da public.daily_activity;
  granted integer := greatest(coalesce(p_xp, 0), 0);
  prog public.user_progress;
  new_streak integer;
begin
  insert into public.daily_activity (user_id, activity_date) values (p_user, today)
  on conflict do nothing;
  select * into da from public.daily_activity
   where user_id = p_user and activity_date = today for update;

  if p_kind = 'battle' then
    granted := least(granted, greatest(0, (xpc ->> 'battle_daily_cap')::int - da.battle_xp));
  elsif p_kind = 'review' then
    granted := least(granted, greatest(0, (xpc ->> 'review_daily_cap')::int - da.review_xp));
  end if;

  update public.daily_activity set
    xp        = xp + granted,
    quizzes   = quizzes + (p_kind = 'quiz')::int,
    battles   = battles + (p_kind = 'battle')::int,
    reviews   = reviews + (p_kind = 'review')::int,
    answered  = answered + coalesce(p_answered, 0),
    correct   = correct + coalesce(p_correct, 0),
    battle_xp = battle_xp + case when p_kind = 'battle' then granted else 0 end,
    review_xp = review_xp + case when p_kind = 'review' then granted else 0 end
  where user_id = p_user and activity_date = today;

  select * into prog from public.user_progress where user_id = p_user for update;
  if prog.last_active_date = today then
    new_streak := prog.current_streak;
  elsif prog.last_active_date = today - 1 then
    new_streak := prog.current_streak + 1;
  else
    new_streak := 1;
  end if;

  update public.user_progress set
    xp = xp + granted,
    current_streak = new_streak,
    longest_streak = greatest(longest_streak, new_streak),
    last_active_date = today,
    updated_at = now()
  where user_id = p_user;

  return granted;
end $$;

-- Streak as the user sees it today (a missed day resets it to zero).
create or replace function private.effective_streak(p_user uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select case when p.last_active_date >= private.user_today(p_user) - 1 then p.current_streak else 0 end
    from public.user_progress p where p.user_id = p_user
$$;

-- -----------------------------------------------------------------------------
-- Proficiency assessments
-- -----------------------------------------------------------------------------
create table public.assessments (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  kind                 text not null check (kind in ('initial','retake')),
  status               text not null default 'in_progress' check (status in ('in_progress','completed','abandoned')),
  question_count       integer not null,
  ability              numeric(5,3) not null,
  step                 numeric(5,3) not null,
  answered_count       integer not null default 0,
  correct_count        integer not null default 0,
  current_question_id  uuid references public.questions (id) on delete set null,
  current_served_at    timestamptz,
  score                integer,
  estimated_level      text,
  awarded_level        text,
  strengths            jsonb,
  weaknesses           jsonb,
  recommendations      jsonb,
  started_at           timestamptz not null default now(),
  completed_at         timestamptz
);
create index assessments_user_idx on public.assessments (user_id, started_at desc);
alter table public.assessments enable row level security;
create policy assessments_select_own on public.assessments
  for select to authenticated using (user_id = auth.uid());

create table public.assessment_responses (
  id              bigint generated always as identity primary key,
  assessment_id   uuid not null references public.assessments (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  question_index  integer not null,
  question_id     uuid not null references public.questions (id) on delete cascade,
  entry_id        uuid,
  question_type   text not null,
  difficulty      smallint not null,
  selected_index  smallint,
  is_correct      boolean not null,
  response_ms     integer,
  ability_after   numeric(5,3) not null,
  created_at      timestamptz not null default now(),
  unique (assessment_id, question_index)
);
create index assessment_responses_user_q_idx on public.assessment_responses (user_id, question_id);
alter table public.assessment_responses enable row level security;
create policy assessment_responses_select_own on public.assessment_responses
  for select to authenticated using (user_id = auth.uid());

-- Picks the next adaptive question: target difficulty and a rotating type,
-- never the same word twice in one assessment, and preferring questions the
-- user has never seen in any earlier assessment (anti-memorisation).
create or replace function private.pick_assessment_question(p_assessment uuid, p_user uuid, p_difficulty integer, p_index integer)
returns public.questions language plpgsql volatile security definer set search_path = '' as $$
declare
  types text[] := array['meaning','fill_blank','synonym','context','antonym'];
  want_type text := types[(p_index % array_length(types, 1)) + 1];
  q public.questions;
  pass integer;
begin
  for pass in 1..4 loop
    select qq.* into q
      from public.questions qq
     where qq.is_active and qq.use_in_assessment and qq.skill = 'vocabulary'
       and (pass > 1 or qq.type = want_type)
       and (case when pass <= 2 then qq.difficulty = p_difficulty
                 when pass = 3 then abs(qq.difficulty - p_difficulty) <= 1
                 else true end)
       and not exists (select 1 from public.assessment_responses r
                        where r.assessment_id = p_assessment
                          and (r.question_id = qq.id or (qq.entry_id is not null and r.entry_id = qq.entry_id)))
     order by exists (select 1 from public.assessment_responses r2
                       where r2.user_id = p_user and r2.question_id = qq.id),
              abs(qq.difficulty - p_difficulty),
              random()
     limit 1;
    if found then return q; end if;
  end loop;
  raise exception 'The question bank has no remaining assessment questions.' using errcode = 'P0001';
end $$;

create or replace function private.assessment_payload(a public.assessments)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q public.questions;
begin
  if a.status = 'completed' then
    return jsonb_build_object('assessment_id', a.id, 'finished', true, 'result', private.assessment_result(a));
  end if;
  select * into q from public.questions where id = a.current_question_id;
  return jsonb_build_object(
    'assessment_id', a.id, 'kind', a.kind, 'finished', false,
    'index', a.answered_count, 'total', a.question_count,
    'question', private.question_public(q));
end $$;

create or replace function private.assessment_result(a public.assessments)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'assessment_id', a.id, 'kind', a.kind,
    'score', a.score, 'correct', a.correct_count, 'total', a.question_count,
    'ability', a.ability, 'estimated_level', a.estimated_level, 'level', a.awarded_level,
    'strengths', coalesce(a.strengths, '[]'::jsonb), 'weaknesses', coalesce(a.weaknesses, '[]'::jsonb),
    'recommendations', coalesce(a.recommendations, '[]'::jsonb),
    'completed_at', a.completed_at,
    'disclaimer', 'This is an estimate based on a short vocabulary assessment. It is not an official IELTS score or a certified CEFR result.')
$$;

create or replace function public.get_assessment_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  last_done public.assessments;
  in_prog public.assessments;
  cooldown integer := private.cfg_int('assessment', 'retake_cooldown_hours');
  next_at timestamptz;
begin
  select * into last_done from public.assessments
   where user_id = uid and status = 'completed' order by completed_at desc limit 1;
  select * into in_prog from public.assessments
   where user_id = uid and status = 'in_progress'
     and started_at > now() - make_interval(mins => private.cfg_int('assessment', 'resume_window_minutes'))
   order by started_at desc limit 1;
  if last_done.id is not null then
    next_at := last_done.completed_at + make_interval(hours => cooldown);
  end if;
  return jsonb_build_object(
    'has_completed', last_done.id is not null,
    'last_result', case when last_done.id is null then null else private.assessment_result(last_done) end,
    'in_progress_id', in_prog.id,
    'can_start', in_prog.id is not null or next_at is null or next_at <= now(),
    'next_available_at', next_at,
    'question_count', private.cfg_int('assessment', 'question_count'));
end $$;

create or replace function public.start_assessment()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  cfg jsonb := private.config('assessment');
  a public.assessments;
  last_done public.assessments;
  q public.questions;
  start_d integer;
begin
  perform private.require_active_account(uid);
  if (select onboarding_step from public.profiles where id = uid) = 'profile' then
    raise exception 'Complete your profile before starting the assessment.' using errcode = 'P0001';
  end if;

  -- Resume an in-progress assessment rather than letting users restart for easier questions.
  select * into a from public.assessments
   where user_id = uid and status = 'in_progress'
     and started_at > now() - make_interval(mins => (cfg ->> 'resume_window_minutes')::int)
   order by started_at desc limit 1;
  if found then
    return private.assessment_payload(a);
  end if;
  update public.assessments set status = 'abandoned' where user_id = uid and status = 'in_progress';

  perform private.rate_limit(uid, 'assessment_start');

  select * into last_done from public.assessments
   where user_id = uid and status = 'completed' order by completed_at desc limit 1;
  if found and last_done.completed_at + make_interval(hours => (cfg ->> 'retake_cooldown_hours')::int) > now() then
    raise exception 'You can retake the assessment after %.',
      to_char(last_done.completed_at + make_interval(hours => (cfg ->> 'retake_cooldown_hours')::int), 'YYYY-MM-DD HH24:MI "UTC"')
      using errcode = 'P0001';
  end if;

  insert into public.assessments (user_id, kind, question_count, ability, step)
  values (uid, case when last_done.id is null then 'initial' else 'retake' end,
          (cfg ->> 'question_count')::int, (cfg ->> 'start_difficulty')::numeric, (cfg ->> 'initial_step')::numeric)
  returning * into a;

  start_d := greatest(1, least(6, round(a.ability)::int));
  q := private.pick_assessment_question(a.id, uid, start_d, 0);
  update public.assessments set current_question_id = q.id, current_served_at = now()
   where id = a.id returning * into a;
  return private.assessment_payload(a);
end $$;

create or replace function private.finish_assessment(p_assessment uuid)
returns public.assessments language plpgsql security definer set search_path = '' as $$
declare
  a public.assessments;
  cfg jsonb := private.config('assessment');
  labels jsonb := '{"meaning":"Word meanings","synonym":"Synonyms","antonym":"Antonyms","fill_blank":"Vocabulary in sentences","context":"Meaning in context"}';
  overall numeric;
  v_strengths jsonb := '[]'; v_weaknesses jsonb := '[]'; v_recs jsonb := '[]';
  r record;
  est integer; awarded integer; prev_level text; prev_num integer;
  max_change integer := (cfg ->> 'max_level_change_per_retake')::int;
begin
  select * into a from public.assessments where id = p_assessment for update;
  overall := a.correct_count::numeric / greatest(a.answered_count, 1);

  for r in
    select question_type, count(*) as n, avg(is_correct::int) as acc
      from public.assessment_responses where assessment_id = a.id
     group by question_type order by avg(is_correct::int) desc
  loop
    if r.n >= 2 and (r.acc >= 0.75 or r.acc >= overall + 0.15) then
      v_strengths := v_strengths || jsonb_build_object('key', r.question_type, 'label', labels ->> r.question_type, 'accuracy', round(r.acc * 100));
    elsif r.n >= 2 and (r.acc <= 0.4 or r.acc <= overall - 0.15) then
      v_weaknesses := v_weaknesses || jsonb_build_object('key', r.question_type, 'label', labels ->> r.question_type, 'accuracy', round(r.acc * 100));
    end if;
  end loop;
  -- Always give at least one strength/area to work on when the data allows it.
  if jsonb_array_length(v_strengths) = 0 then
    select jsonb_build_array(jsonb_build_object('key', question_type, 'label', labels ->> question_type, 'accuracy', round(avg(is_correct::int) * 100)))
      into v_strengths from public.assessment_responses where assessment_id = a.id
     group by question_type having avg(is_correct::int) > 0 order by avg(is_correct::int) desc, count(*) desc limit 1;
  end if;
  if jsonb_array_length(coalesce(v_weaknesses, '[]')) = 0 then
    select jsonb_build_array(jsonb_build_object('key', question_type, 'label', labels ->> question_type, 'accuracy', round(avg(is_correct::int) * 100)))
      into v_weaknesses from public.assessment_responses where assessment_id = a.id
     group by question_type having avg(is_correct::int) < 1 order by avg(is_correct::int), count(*) desc limit 1;
  end if;
  v_strengths := coalesce(v_strengths, '[]'); v_weaknesses := coalesce(v_weaknesses, '[]');

  est := greatest(1, least(6, round(a.ability)::int));
  select proficiency_level into prev_level from public.user_progress where user_id = a.user_id;
  prev_num := private.level_num(prev_level);
  awarded := case when a.kind = 'retake' and prev_num is not null
                  then greatest(prev_num - max_change, least(prev_num + max_change, est))
                  else est end;

  for r in select value from jsonb_array_elements(v_weaknesses) loop
    v_recs := v_recs || jsonb_build_object('kind', 'quiz', 'types', jsonb_build_array(r.value ->> 'key'),
      'title', 'Practise ' || lower(r.value ->> 'label'),
      'description', 'Targeted questions to strengthen your weakest area.');
  end loop;
  v_recs := v_recs
    || jsonb_build_object('kind', 'topics', 'title', 'Explore ' || private.level_name(awarded) || ' vocabulary',
                          'description', 'Word lists matched to your estimated level.')
    || jsonb_build_object('kind', 'battle', 'mode', 'vocab_duel', 'title', 'Try your first Vocabulary Duel',
                          'description', 'Compete with a learner at a similar level.');

  update public.assessments set
    status = 'completed', completed_at = now(), current_question_id = null,
    score = round(overall * 100), estimated_level = private.level_name(est),
    awarded_level = private.level_name(awarded),
    strengths = v_strengths, weaknesses = v_weaknesses, recommendations = v_recs
  where id = a.id returning * into a;

  update public.user_progress set
    proficiency_level = a.awarded_level,
    proficiency_ability = round(a.ability, 2),
    -- Vocabulary alone never confirms overall proficiency; confirmation requires
    -- multi-skill assessments (Phase 3).
    proficiency_status = case when proficiency_status = 'confirmed' then 'confirmed' else 'provisional' end,
    proficiency_updated_at = now(), updated_at = now()
  where user_id = a.user_id;

  insert into public.proficiency_history (user_id, level, ability, status, source, assessment_id)
  values (a.user_id, a.awarded_level, round(a.ability, 2), 'provisional',
          case when a.kind = 'initial' then 'initial_assessment' else 'retake_assessment' end, a.id);

  update public.profiles set onboarding_step = 'done' where id = a.user_id;

  insert into public.learning_activities (user_id, activity_type, ref_id, score, total, xp, metadata)
  values (a.user_id, 'assessment', a.id, a.correct_count, a.question_count,
          case when a.kind = 'initial' then (private.config('xp') ->> 'assessment_complete')::int else 0 end,
          jsonb_build_object('level', a.awarded_level));
  perform private.record_activity(a.user_id, 'assessment',
    case when a.kind = 'initial' then (private.config('xp') ->> 'assessment_complete')::int else 0 end);
  perform private.notify(a.user_id, 'assessment', 'Assessment complete',
    'Your provisional level is ' || a.awarded_level || '.', jsonb_build_object('assessment_id', a.id));
  perform private.check_achievements(a.user_id);
  return a;
end $$;

create or replace function public.submit_assessment_answer(p_assessment_id uuid, p_question_id uuid, p_selected integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  cfg jsonb := private.config('assessment');
  a public.assessments;
  q public.questions;
  correct boolean;
  new_ability numeric;
  next_q public.questions;
begin
  select * into a from public.assessments where id = p_assessment_id and user_id = uid for update;
  if not found then raise exception 'Assessment not found.' using errcode = 'P0002'; end if;
  if a.status <> 'in_progress' then return private.assessment_payload(a); end if;
  -- Stale or duplicate submission (e.g. a retried request): return current state.
  if a.current_question_id is distinct from p_question_id then
    return private.assessment_payload(a);
  end if;

  select * into q from public.questions where id = a.current_question_id;
  correct := p_selected is not null and p_selected = q.correct_index;
  new_ability := greatest(0.5, least(6.5, a.ability + case when correct then a.step else -a.step end));

  insert into public.assessment_responses
    (assessment_id, user_id, question_index, question_id, entry_id, question_type, difficulty,
     selected_index, is_correct, response_ms, ability_after)
  values (a.id, uid, a.answered_count, q.id, q.entry_id, q.type, q.difficulty, p_selected, correct,
          (extract(epoch from (now() - a.current_served_at)) * 1000)::int, new_ability);
  perform private.record_answer(uid, q.id, correct);

  update public.assessments set
    ability = new_ability,
    step = greatest((cfg ->> 'min_step')::numeric, a.step * (cfg ->> 'step_decay')::numeric),
    answered_count = a.answered_count + 1,
    correct_count = a.correct_count + correct::int
  where id = a.id returning * into a;

  if a.answered_count >= a.question_count then
    a := private.finish_assessment(a.id);
    return private.assessment_payload(a);
  end if;

  next_q := private.pick_assessment_question(a.id, uid, greatest(1, least(6, round(a.ability)::int)), a.answered_count);
  update public.assessments set current_question_id = next_q.id, current_served_at = now()
   where id = a.id returning * into a;
  return private.assessment_payload(a);
end $$;

create or replace function public.get_assessment_result(p_assessment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare a public.assessments;
begin
  select * into a from public.assessments where id = p_assessment_id and user_id = auth.uid();
  if not found or a.status <> 'completed' then
    raise exception 'Assessment result not available.' using errcode = 'P0002';
  end if;
  return private.assessment_result(a);
end $$;

-- -----------------------------------------------------------------------------
-- Quizzes (practice). Questions are served without answers; each answer is
-- checked server-side and XP is granted once, on completion.
-- -----------------------------------------------------------------------------
create table public.quiz_attempts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  kind           text not null check (kind in ('topic','practice','daily','battle_practice','weak_area')),
  topic_id       text references public.vocab_topics (id) on delete set null,
  types          text[],
  question_ids   uuid[] not null,
  status         text not null default 'in_progress' check (status in ('in_progress','completed','abandoned')),
  total          integer not null,
  correct_count  integer not null default 0,
  xp_awarded     integer not null default 0,
  started_at     timestamptz not null default now(),
  completed_at   timestamptz
);
create index quiz_attempts_user_idx on public.quiz_attempts (user_id, started_at desc);
alter table public.quiz_attempts enable row level security;
create policy quiz_attempts_select_own on public.quiz_attempts
  for select to authenticated using (user_id = auth.uid());

create table public.quiz_responses (
  id              bigint generated always as identity primary key,
  attempt_id      uuid not null references public.quiz_attempts (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  question_index  integer not null,
  question_id     uuid not null references public.questions (id) on delete cascade,
  selected_index  smallint,
  is_correct      boolean not null,
  xp              integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (attempt_id, question_index)
);
create index quiz_responses_user_q_idx on public.quiz_responses (user_id, question_id, created_at desc);
alter table public.quiz_responses enable row level security;
create policy quiz_responses_select_own on public.quiz_responses
  for select to authenticated using (user_id = auth.uid());

create or replace function public.start_quiz(
  p_kind text default 'practice',
  p_topic_id text default null,
  p_types text[] default null,
  p_count integer default 10
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  lvl integer;
  n integer := greatest(3, least(coalesce(p_count, 10), 20));
  ids uuid[];
  att public.quiz_attempts;
  types text[] := coalesce(nullif(p_types, '{}'), array['meaning','synonym','antonym','fill_blank','context']);
begin
  perform private.require_active_account(uid);
  perform private.rate_limit(uid, 'quiz_start');
  if p_kind not in ('topic','practice','daily','battle_practice','weak_area') then
    raise exception 'Unknown quiz kind.' using errcode = '22023';
  end if;
  if p_topic_id is not null and exists (select 1 from public.vocab_topics where id = p_topic_id and is_premium)
     and private.user_plan(uid) <> 'premium' then
    raise exception 'This topic is part of Premium.' using errcode = 'P0402';
  end if;
  select coalesce(private.level_num(proficiency_level), 3) into lvl from public.user_progress where user_id = uid;

  -- One question per word, near the learner's level; unseen or previously
  -- missed questions first, recently-correct ones last.
  select array_agg(id) into ids from (
    select id from (
      select distinct on (coalesce(q.entry_id, q.id)) q.id, q.difficulty,
             (select bool_or(r.is_correct) from public.quiz_responses r
               where r.user_id = uid and r.question_id = q.id
                 and r.created_at > now() - interval '7 days') as recently_correct,
             random() as rnd
        from public.questions q
       where q.is_active and q.use_in_quiz
         and q.type = any(types)
         and (p_topic_id is null or q.topic_id = p_topic_id)
         and (p_topic_id is not null or abs(q.difficulty - lvl) <= 1)
       order by coalesce(q.entry_id, q.id), random()
    ) c
    order by coalesce(c.recently_correct, false), abs(c.difficulty - lvl), c.rnd
    limit n
  ) picked;

  if ids is null or cardinality(ids) = 0 then
    raise exception 'No questions are available for this selection yet.' using errcode = 'P0002';
  end if;

  insert into public.quiz_attempts (user_id, kind, topic_id, types, question_ids, total)
  values (uid, p_kind, p_topic_id, types, ids, cardinality(ids)) returning * into att;

  return jsonb_build_object(
    'attempt_id', att.id, 'total', att.total,
    'questions', (select jsonb_agg(private.question_public(q) order by t.ord)
                    from unnest(ids) with ordinality as t(qid, ord)
                    join public.questions q on q.id = t.qid));
end $$;

create or replace function public.answer_quiz_question(p_attempt_id uuid, p_index integer, p_selected integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  att public.quiz_attempts;
  q public.questions;
  existing public.quiz_responses;
  correct boolean;
  repeat_correct boolean;
  xpc jsonb := private.config('xp');
  xp integer := 0;
  e public.vocabulary_entries;
begin
  select * into att from public.quiz_attempts where id = p_attempt_id and user_id = uid for update;
  if not found then raise exception 'Quiz not found.' using errcode = 'P0002'; end if;
  if p_index < 0 or p_index >= att.total then raise exception 'Invalid question index.' using errcode = '22023'; end if;
  select * into q from public.questions where id = att.question_ids[p_index + 1];

  select * into existing from public.quiz_responses where attempt_id = att.id and question_index = p_index;
  if found then
    correct := existing.is_correct;  -- idempotent retry: never re-scores or re-awards
  elsif att.status <> 'in_progress' then
    raise exception 'This quiz is already finished.' using errcode = 'P0001';
  else
    correct := p_selected is not null and p_selected = q.correct_index;
    if correct then
      select exists (select 1 from public.quiz_responses r
                      where r.user_id = uid and r.question_id = q.id and r.is_correct
                        and r.attempt_id <> att.id
                        and r.created_at > now() - make_interval(days => (xpc ->> 'repeat_window_days')::int))
        into repeat_correct;
      xp := case when repeat_correct then (xpc ->> 'quiz_correct_repeat')::int else (xpc ->> 'quiz_correct')::int end;
    end if;
    insert into public.quiz_responses (attempt_id, user_id, question_index, question_id, selected_index, is_correct, xp)
    values (att.id, uid, p_index, q.id, p_selected, correct, xp);
    update public.quiz_attempts set correct_count = correct_count + correct::int where id = att.id;
    perform private.record_answer(uid, q.id, correct);
  end if;

  select * into e from public.vocabulary_entries where id = q.entry_id;
  return jsonb_build_object(
    'is_correct', correct, 'correct_index', q.correct_index, 'explanation', q.explanation,
    'entry', case when e.id is null then null else jsonb_build_object(
      'id', e.id, 'word', e.word, 'definition', e.definition, 'example', e.example,
      'saved', exists (select 1 from public.user_vocabulary uv where uv.user_id = uid and uv.entry_id = e.id)) end);
end $$;

create or replace function public.finish_quiz(p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  att public.quiz_attempts;
  v_answered integer;
  v_xp integer;
  granted integer;
  new_achievements text[] := '{}';
begin
  select * into att from public.quiz_attempts where id = p_attempt_id and user_id = uid for update;
  if not found then raise exception 'Quiz not found.' using errcode = 'P0002'; end if;

  if att.status = 'in_progress' then
    select count(*), coalesce(sum(r.xp), 0) into v_answered, v_xp from public.quiz_responses r where r.attempt_id = att.id;
    if v_answered = 0 then
      update public.quiz_attempts set status = 'abandoned', completed_at = now() where id = att.id;
      return jsonb_build_object('attempt_id', att.id, 'status', 'abandoned');
    end if;
    if v_answered = att.total then
      v_xp := v_xp + (private.config('xp') ->> 'quiz_completion_bonus')::int;
    end if;
    granted := private.record_activity(uid, 'quiz', v_xp, v_answered, att.correct_count);
    update public.quiz_attempts set status = 'completed', completed_at = now(), xp_awarded = granted
     where id = att.id returning * into att;
    insert into public.learning_activities (user_id, activity_type, ref_id, score, total, xp, metadata)
    values (uid, 'quiz', att.id, att.correct_count, att.total, granted,
            jsonb_build_object('kind', att.kind, 'topic_id', att.topic_id, 'types', att.types));
    if att.total >= 10 and att.correct_count = att.total then
      if private.award_achievement(uid, 'perfect_quiz') then new_achievements := array_append(new_achievements, 'perfect_quiz'); end if;
    end if;
    new_achievements := new_achievements || private.check_achievements(uid);
  end if;

  return jsonb_build_object(
    'attempt_id', att.id, 'status', att.status, 'total', att.total,
    'correct', att.correct_count, 'xp', att.xp_awarded,
    'streak', private.effective_streak(uid),
    'new_achievements', to_jsonb(new_achievements),
    'missed', coalesce((select jsonb_agg(jsonb_build_object(
                 'prompt', q.prompt, 'sentence', q.sentence,
                 'your_answer', q.options ->> r.selected_index::int,
                 'correct_answer', q.options ->> q.correct_index::int,
                 'explanation', q.explanation, 'entry_id', q.entry_id) order by r.question_index)
               from public.quiz_responses r join public.questions q on q.id = r.question_id
              where r.attempt_id = att.id and not r.is_correct), '[]'::jsonb));
end $$;

-- -----------------------------------------------------------------------------
-- Saved vocabulary + spaced repetition (SM-2 variant)
-- -----------------------------------------------------------------------------
create table public.user_vocabulary (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  entry_id          uuid references public.vocabulary_entries (id) on delete set null,
  word              text not null check (char_length(word) between 1 and 80),
  definition        text check (char_length(definition) <= 1000),
  example           text check (char_length(example) <= 1000),
  context_sentence  text check (char_length(context_sentence) <= 1000),
  source            text not null default 'library' check (source in ('library','quiz','battle','assessment','reading','manual')),
  status            text not null default 'learning' check (status in ('learning','reviewing','mastered')),
  ease              numeric(4,2) not null default 2.5,
  interval_days     integer not null default 0,
  repetitions       integer not null default 0,
  lapses            integer not null default 0,
  due_at            timestamptz not null default now(),
  last_reviewed_at  timestamptz,
  created_at        timestamptz not null default now()
);
create unique index user_vocabulary_entry_idx on public.user_vocabulary (user_id, entry_id) where entry_id is not null;
create unique index user_vocabulary_word_idx on public.user_vocabulary (user_id, lower(word));
create index user_vocabulary_due_idx on public.user_vocabulary (user_id, due_at);
alter table public.user_vocabulary enable row level security;
create policy user_vocabulary_select_own on public.user_vocabulary
  for select to authenticated using (user_id = auth.uid());
create policy user_vocabulary_delete_own on public.user_vocabulary
  for delete to authenticated using (user_id = auth.uid());

create or replace function private.check_collection_limit(p_user uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
declare lim integer := private.plan_limit(p_user, 'vocab_collection_max');
begin
  if lim is not null and (select count(*) from public.user_vocabulary where user_id = p_user) >= lim then
    raise exception 'Your vocabulary collection is full (% words). Upgrade to Premium for a larger collection.', lim
      using errcode = 'P0402';
  end if;
end $$;

create or replace function public.save_word(p_entry_id uuid, p_source text default 'library')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  e public.vocabulary_entries;
  v public.user_vocabulary;
begin
  select * into e from public.vocabulary_entries where id = p_entry_id and is_active;
  if not found then raise exception 'Word not found.' using errcode = 'P0002'; end if;
  select * into v from public.user_vocabulary where user_id = uid and (entry_id = e.id or lower(word) = lower(e.word));
  if found then return to_jsonb(v); end if;
  perform private.check_collection_limit(uid);
  insert into public.user_vocabulary (user_id, entry_id, word, definition, example, source)
  values (uid, e.id, e.word, e.definition, e.example,
          case when p_source in ('library','quiz','battle','assessment','reading','manual') then p_source else 'library' end)
  returning * into v;
  perform private.check_achievements(uid);
  return to_jsonb(v);
end $$;

-- Used by the reading assistant (Phase 2) and manual entry.
create or replace function public.save_custom_word(p_word text, p_definition text, p_example text default null,
                                                   p_context text default null, p_source text default 'manual')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  w text := btrim(p_word);
  v public.user_vocabulary;
  e public.vocabulary_entries;
begin
  if w is null or char_length(w) not between 1 and 80 then
    raise exception 'Invalid word.' using errcode = '22023';
  end if;
  select * into v from public.user_vocabulary where user_id = uid and lower(word) = lower(w);
  if found then return to_jsonb(v); end if;
  perform private.check_collection_limit(uid);
  select * into e from public.vocabulary_entries where lower(word) = lower(w) and is_active limit 1;
  insert into public.user_vocabulary (user_id, entry_id, word, definition, example, context_sentence, source)
  values (uid, e.id, w, left(coalesce(p_definition, e.definition), 1000), left(coalesce(p_example, e.example), 1000),
          left(p_context, 1000),
          case when p_source in ('reading','manual','battle','quiz') then p_source else 'manual' end)
  returning * into v;
  perform private.check_achievements(uid);
  return to_jsonb(v);
end $$;

create or replace function public.get_review_queue(p_limit integer default 20)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(v) || jsonb_build_object(
           'phonetic', e.phonetic, 'part_of_speech', e.part_of_speech,
           'synonyms', e.synonyms, 'level', e.level) order by v.due_at), '[]'::jsonb)
    from (select * from public.user_vocabulary
           where user_id = auth.uid() and due_at <= now()
           order by due_at limit greatest(1, least(coalesce(p_limit, 20), 100))) v
    left join public.vocabulary_entries e on e.id = v.entry_id
$$;

-- p_grade: 'again' | 'hard' | 'good' | 'easy'
create or replace function public.review_word(p_id uuid, p_grade text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  v public.user_vocabulary;
  q integer;
  new_ease numeric; new_interval integer; new_reps integer; new_lapses integer;
  due timestamptz;
  xp integer := 0;
begin
  select * into v from public.user_vocabulary where id = p_id and user_id = uid for update;
  if not found then raise exception 'Word not found.' using errcode = 'P0002'; end if;
  -- Ignore double-taps: a card reviewed in the last 5 seconds is not re-graded.
  if v.last_reviewed_at is not null and v.last_reviewed_at > now() - interval '5 seconds' then
    return jsonb_build_object('word', to_jsonb(v), 'xp', 0);
  end if;
  q := case p_grade when 'again' then 1 when 'hard' then 3 when 'good' then 4 when 'easy' then 5 end;
  if q is null then raise exception 'Invalid grade.' using errcode = '22023'; end if;

  new_ease := greatest(1.3, v.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  new_lapses := v.lapses;
  if q < 3 then
    new_reps := 0; new_interval := 0; new_lapses := v.lapses + 1;
    due := now() + interval '10 minutes';
  else
    new_reps := v.repetitions + 1;
    new_interval := case
      when new_reps = 1 then case when q = 5 then 3 else 1 end
      when new_reps = 2 then case when q = 3 then 4 else 6 end
      else greatest(v.interval_days + 1, round(v.interval_days * new_ease * case when q = 3 then 0.8 when q = 5 then 1.3 else 1 end)::int)
    end;
    due := now() + make_interval(days => new_interval);
    xp := (private.config('xp') ->> 'review_correct')::int;
  end if;

  update public.user_vocabulary set
    ease = new_ease, interval_days = new_interval, repetitions = new_reps, lapses = new_lapses,
    due_at = due, last_reviewed_at = now(),
    status = case when new_interval >= 21 then 'mastered' when new_reps >= 1 then 'reviewing' else 'learning' end
  where id = v.id returning * into v;

  if v.entry_id is not null then
    insert into public.user_word_stats as w (user_id, entry_id, correct, wrong)
    values (uid, v.entry_id, (q >= 3)::int, (q < 3)::int)
    on conflict (user_id, entry_id) do update
      set correct = w.correct + (q >= 3)::int, wrong = w.wrong + (q < 3)::int, last_seen_at = now();
  end if;
  xp := private.record_activity(uid, 'review', xp, 1, (q >= 3)::int);
  perform private.check_achievements(uid);
  return jsonb_build_object('word', to_jsonb(v), 'xp', xp);
end $$;

-- -----------------------------------------------------------------------------
-- Topics overview + recommendations + dashboard
-- -----------------------------------------------------------------------------
create or replace function public.get_vocab_topics()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'name', t.name, 'description', t.description, 'icon', t.icon,
           'is_premium', t.is_premium,
           'word_count', (select count(*) from public.vocabulary_entries e where e.topic_id = t.id and e.is_active),
           'learned', (select count(*) from public.user_word_stats w
                         join public.vocabulary_entries e on e.id = w.entry_id
                        where w.user_id = auth.uid() and e.topic_id = t.id and w.correct >= 2 and w.correct > w.wrong),
           'levels', (select jsonb_agg(distinct e.level order by e.level) from public.vocabulary_entries e
                       where e.topic_id = t.id and e.is_active)
         ) order by t.sort_order), '[]'::jsonb)
    from public.vocab_topics t
$$;

create or replace function private.compute_recommendations(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  recs jsonb := '[]';
  due integer;
  weak record;
  today public.daily_activity;
  goal integer;
  labels jsonb := '{"type:meaning":"word meanings","type:synonym":"synonyms","type:antonym":"antonyms","type:fill_blank":"vocabulary in sentences","type:context":"contextual meaning","type:grammar":"grammar"}';
  topic_name text;
begin
  select count(*) into due from public.user_vocabulary where user_id = p_user and due_at <= now();
  if due > 0 then
    recs := recs || jsonb_build_object('kind', 'review', 'title', 'Review ' || due || ' due word' || case when due = 1 then '' else 's' end,
      'description', 'Spaced repetition keeps new words from fading.', 'priority', 1);
  end if;

  for weak in
    select skill_key, answered, correct, correct::numeric / answered as acc
      from public.user_skill_stats
     where user_id = p_user and answered >= 5 and correct::numeric / answered < 0.65
     order by correct::numeric / answered limit 2
  loop
    if weak.skill_key like 'topic:%' then
      select name into topic_name from public.vocab_topics where id = substr(weak.skill_key, 7);
      recs := recs || jsonb_build_object('kind', 'quiz', 'topic_id', substr(weak.skill_key, 7),
        'title', 'Practise ' || coalesce(topic_name, 'this topic'),
        'description', 'Your accuracy here is ' || round(weak.acc * 100) || '%. A focused quiz will help.', 'priority', 2);
    elsif labels ? weak.skill_key then
      recs := recs || jsonb_build_object('kind', 'quiz', 'types', jsonb_build_array(substr(weak.skill_key, 6)),
        'title', 'Strengthen ' || (labels ->> weak.skill_key),
        'description', 'Your accuracy here is ' || round(weak.acc * 100) || '%. A focused quiz will help.', 'priority', 2);
    end if;
  end loop;

  select * into today from public.daily_activity where user_id = p_user and activity_date = private.user_today(p_user);
  select daily_goal_xp into goal from public.profiles where id = p_user;
  if coalesce(today.xp, 0) < goal then
    recs := recs || jsonb_build_object('kind', 'quiz', 'title', 'Daily vocabulary quiz',
      'description', (goal - coalesce(today.xp, 0)) || ' XP left to reach today''s goal.', 'priority', 3);
  end if;
  if coalesce(today.battles, 0) = 0 then
    recs := recs || jsonb_build_object('kind', 'battle', 'mode', 'vocab_duel', 'title', 'Win a Vocabulary Duel',
      'description', 'Test your words against a learner at your level.', 'priority', 4);
  end if;
  return recs;
end $$;

create or replace function public.get_dashboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  p public.profiles;
  prog public.user_progress;
  today public.daily_activity;
  br jsonb := null;
  active_battle uuid := null;
begin
  select * into p from public.profiles where id = uid;
  select * into prog from public.user_progress where user_id = uid;
  select * into today from public.daily_activity where user_id = uid and activity_date = private.user_today(uid);
  select jsonb_build_object('rating', r.rating, 'games', r.games, 'wins', r.wins, 'losses', r.losses,
           'draws', r.draws, 'win_rate', case when r.games > 0 then round(r.wins * 100.0 / r.games) else 0 end)
    into br from public.battle_ratings r where r.user_id = uid and r.mode = 'overall';
  select b.id into active_battle from public.battles b
    join public.battle_participants bp on bp.battle_id = b.id
   where bp.user_id = uid and b.status in ('pending','active') order by b.created_at desc limit 1;

  return jsonb_build_object(
    'profile', jsonb_build_object('display_name', p.display_name, 'username', p.username, 'avatar', p.avatar,
                                  'daily_goal_xp', p.daily_goal_xp, 'onboarding_step', p.onboarding_step,
                                  'ielts_target_band', p.ielts_target_band),
    'proficiency', jsonb_build_object('level', prog.proficiency_level, 'status', prog.proficiency_status,
                                      'ability', prog.proficiency_ability, 'updated_at', prog.proficiency_updated_at),
    'xp', prog.xp,
    'streak', jsonb_build_object('current', coalesce(private.effective_streak(uid), 0), 'longest', prog.longest_streak,
                                 'active_today', prog.last_active_date = private.user_today(uid)),
    'today', jsonb_build_object('xp', coalesce(today.xp, 0), 'goal', p.daily_goal_xp, 'quizzes', coalesce(today.quizzes, 0),
                                'battles', coalesce(today.battles, 0), 'reviews', coalesce(today.reviews, 0),
                                'answered', coalesce(today.answered, 0), 'correct', coalesce(today.correct, 0)),
    'vocabulary', jsonb_build_object(
        'saved', (select count(*) from public.user_vocabulary where user_id = uid),
        'due', (select count(*) from public.user_vocabulary where user_id = uid and due_at <= now()),
        'learned', (select count(*) from public.user_word_stats where user_id = uid and correct >= 2 and correct > wrong),
        'mastered', (select count(*) from public.user_vocabulary where user_id = uid and status = 'mastered')),
    'recent_quizzes', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('id', ref_id, 'score', score, 'total', total, 'xp', xp,
                                  'kind', metadata ->> 'kind', 'topic_id', metadata ->> 'topic_id', 'at', created_at) x
          from public.learning_activities where user_id = uid and activity_type = 'quiz'
         order by created_at desc limit 5) s), '[]'::jsonb),
    'battle', br,
    'active_battle_id', active_battle,
    'recommendations', private.compute_recommendations(uid),
    'ielts', null,
    'unread_notifications', (select count(*) from public.notifications where user_id = uid and read_at is null),
    'plan', private.user_plan(uid));
end $$;

create or replace function public.get_my_achievements()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', a.code, 'title', a.title, 'description', a.description, 'icon', a.icon,
           'category', a.category, 'xp_reward', a.xp_reward, 'available', a.available,
           'earned_at', ua.earned_at) order by a.sort_order), '[]'::jsonb)
    from public.achievements a
    left join public.user_achievements ua on ua.achievement_code = a.code and ua.user_id = auth.uid()
$$;
