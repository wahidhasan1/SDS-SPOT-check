-- =============================================================================
-- Vocabattle — 0003 battles
-- Anonymous real-time battles. The database is the single source of truth:
--   * matchmaking pairs players atomically (row locks + SKIP LOCKED);
--   * the battle is a state machine advanced lazily by every participant call
--     (pending → active → completed | cancelled | void);
--   * question timing, correctness, points, results, ratings and rewards are
--     computed only on the server; clients submit nothing but a choice index.
-- Clients learn about changes via Realtime on `battles.version` (and the
-- caller's own `matchmaking_queue` row) and fall back to polling.
-- =============================================================================

create table public.battle_ratings (
  user_id             uuid not null references auth.users (id) on delete cascade,
  mode                text not null default 'overall',
  rating              integer not null,
  peak_rating         integer not null,
  games               integer not null default 0,
  wins                integer not null default 0,
  losses              integer not null default 0,
  draws               integer not null default 0,
  current_win_streak  integer not null default 0,
  best_win_streak     integer not null default 0,
  answers_total       integer not null default 0,
  answers_correct     integer not null default 0,
  updated_at          timestamptz not null default now(),
  primary key (user_id, mode)
);
create index battle_ratings_rating_idx on public.battle_ratings (mode, rating desc);
alter table public.battle_ratings enable row level security;
create policy battle_ratings_select_own on public.battle_ratings
  for select to authenticated using (user_id = auth.uid());

create table public.matchmaking_queue (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  mode          text not null,
  rating        integer not null,
  level_num     smallint not null,
  gender        text,
  gender_pref   text not null default 'any',
  status        text not null default 'waiting' check (status in ('waiting','matched')),
  battle_id     uuid,
  enqueued_at   timestamptz not null default now(),
  last_poll_at  timestamptz not null default now()
);
create index matchmaking_queue_mode_idx on public.matchmaking_queue (mode, status, rating);
alter table public.matchmaking_queue enable row level security;
create policy matchmaking_queue_select_own on public.matchmaking_queue
  for select to authenticated using (user_id = auth.uid());

create table public.battles (
  id                uuid primary key default gen_random_uuid(),
  mode              text not null,
  status            text not null default 'pending' check (status in ('pending','active','completed','cancelled','void')),
  rated             boolean not null default true,
  question_count    integer not null,
  question_time_ms  integer not null,
  reveal_ms         integer not null,
  current_index     integer not null default -1,
  version           integer not null default 0,
  end_reason        text,
  created_at        timestamptz not null default now(),
  started_at        timestamptz,
  ended_at          timestamptz
);
create index battles_status_idx on public.battles (status, created_at);
alter table public.battles enable row level security;

create table public.battle_participants (
  battle_id             uuid not null references public.battles (id) on delete cascade,
  seat                  smallint not null check (seat in (1, 2)),
  user_id               uuid references auth.users (id) on delete set null,
  alias                 text not null,
  avatar                text not null,
  display_level         text,
  rating_before         integer not null,
  rating_after          integer,
  score                 integer not null default 0,
  correct_count         integer not null default 0,
  answered_count        integer not null default 0,
  ready_at              timestamptz,
  last_seen_at          timestamptz not null default now(),
  result                text check (result in ('win','loss','draw','void','cancelled')),
  xp_awarded            integer not null default 0,
  rewards_granted       boolean not null default false,
  fast_answer_count     integer not null default 0,
  primary key (battle_id, seat),
  unique (battle_id, user_id)
);
create index battle_participants_user_idx on public.battle_participants (user_id);
alter table public.battle_participants enable row level security;

create table public.battle_questions (
  battle_id    uuid not null references public.battles (id) on delete cascade,
  idx          integer not null,
  question_id  uuid not null references public.questions (id),
  opens_at     timestamptz,
  deadline_at  timestamptz,
  closed_at    timestamptz,
  primary key (battle_id, idx)
);
alter table public.battle_questions enable row level security;

create table public.battle_answers (
  battle_id       uuid not null references public.battles (id) on delete cascade,
  idx             integer not null,
  seat            smallint not null,
  user_id         uuid references auth.users (id) on delete set null,
  selected_index  smallint,
  is_correct      boolean not null,
  points          integer not null default 0,
  response_ms     integer not null,
  answered_at     timestamptz not null default now(),
  primary key (battle_id, idx, seat)   -- one answer per player per question
);
alter table public.battle_answers enable row level security;

-- Immutable per-player result ledger (history, leaderboards, analytics).
create table public.battle_results (
  battle_id      uuid not null references public.battles (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  mode           text not null,
  result         text not null check (result in ('win','loss','draw')),
  score          integer not null,
  rated          boolean not null,
  rating_delta   integer not null,
  rating_after   integer not null,
  xp             integer not null,
  created_at     timestamptz not null default now(),
  primary key (battle_id, user_id)
);
create index battle_results_created_idx on public.battle_results (created_at desc);
create index battle_results_user_idx on public.battle_results (user_id, created_at desc);
alter table public.battle_results enable row level security;
create policy battle_results_select_own on public.battle_results
  for select to authenticated using (user_id = auth.uid());

create table public.battle_integrity_flags (
  id          bigint generated always as identity primary key,
  battle_id   uuid references public.battles (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('fast_answers','pair_repeat','server_timeout','abandon_pattern')),
  details     jsonb not null default '{}',
  reviewed    boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.battle_integrity_flags enable row level security;

create table public.blocked_users (
  id          uuid primary key default gen_random_uuid(),
  blocker_id  uuid not null references auth.users (id) on delete cascade,
  blocked_id  uuid not null references auth.users (id) on delete cascade,
  label       text not null,
  battle_id   uuid references public.battles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocked_users enable row level security;

create table public.user_reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid references auth.users (id) on delete set null,
  reported_id      uuid references auth.users (id) on delete set null,
  battle_id        uuid references public.battles (id) on delete set null,
  reported_label   text,
  reason           text not null check (reason in ('cheating','offensive_name','harassment','spam','other')),
  details          text check (char_length(details) <= 1000),
  status           text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  resolution_note  text,
  resolved_by      uuid references auth.users (id) on delete set null,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index user_reports_status_idx on public.user_reports (status, created_at);
alter table public.user_reports enable row level security;

-- Participants may read their battle row (for Realtime change notifications).
create or replace function private.is_battle_participant(p_battle uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.battle_participants
                  where battle_id = p_battle and user_id = auth.uid())
$$;
create policy battles_select_participant on public.battles
  for select to authenticated using (private.is_battle_participant(id));

-- =============================================================================
-- Helpers
-- =============================================================================
create or replace function private.ensure_rating(p_user uuid)
returns public.battle_ratings language plpgsql security definer set search_path = '' as $$
declare r public.battle_ratings; init integer := private.cfg_int('battle', 'initial_rating');
begin
  insert into public.battle_ratings (user_id, mode, rating, peak_rating)
  values (p_user, 'overall', init, init) on conflict do nothing;
  select * into r from public.battle_ratings where user_id = p_user and mode = 'overall';
  return r;
end $$;

-- Temporary pseudonym such as "ShadowFox42" with a matching emoji.
create or replace function private.random_alias(p_avoid text default null)
returns text[] language plpgsql volatile set search_path = '' as $$
declare
  adjectives text[] := array['Shadow','Silent','Swift','Clever','Brave','Lucky','Mystic','Cosmic','Golden',
    'Crimson','Arctic','Thunder','Quiet','Bold','Witty','Nimble','Lexi','Word','Verb','Noble','Rapid','Bright','Calm','Sly'];
  animals text[][] := array[['Fox','🦊'],['Owl','🦉'],['Ninja','🥷'],['Storm','⛈️'],['Wolf','🐺'],['Tiger','🐯'],
    ['Panda','🐼'],['Falcon','🦅'],['Dolphin','🐬'],['Lion','🦁'],['Bear','🐻'],['Dragon','🐉'],['Otter','🦦'],
    ['Koala','🐨'],['Shark','🦈'],['Turtle','🐢'],['Penguin','🐧'],['Octopus','🐙'],['Badger','🦡'],['Comet','☄️'],
    ['Rocket','🚀'],['Phoenix','🔥'],['Whale','🐳'],['Lynx','🐈']];
  i integer; name text;
begin
  loop
    i := 1 + floor(random() * array_length(animals, 1))::int;
    name := adjectives[1 + floor(random() * array_length(adjectives, 1))::int] || animals[i][1]
            || lpad((floor(random() * 100))::int::text, 2, '0');
    exit when p_avoid is null or name <> p_avoid;
  end loop;
  return array[name, animals[i][2]];
end $$;

create or replace function private.mode_config(p_mode text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select m from jsonb_array_elements(private.config('battle_modes')) m where m ->> 'id' = p_mode
$$;

create or replace function private.battle_my_seat(p_battle uuid, p_user uuid)
returns smallint language sql stable security definer set search_path = '' as $$
  select seat from public.battle_participants where battle_id = p_battle and user_id = p_user
$$;

-- =============================================================================
-- Battle completion (single place where results, ratings and rewards happen)
-- =============================================================================
create or replace function private.end_battle(p_battle uuid, p_status text, p_reason text, p_forfeit_seat smallint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.battles;
  cfg jsonb := private.config('battle');
  xpc jsonb := private.config('xp');
  me public.battle_participants;
  opp public.battle_participants;
  r public.battle_ratings;
  opp_rating integer;
  res text; s numeric; e numeric; k integer; delta integer; new_rating integer;
  xp integer; granted integer;
  seat_no smallint;
begin
  select * into b from public.battles where id = p_battle for update;
  if b.status not in ('pending','active') then return; end if;   -- already finalised: never twice

  if p_status = 'void' then
    update public.battles set status = 'void', ended_at = now(), end_reason = p_reason, version = version + 1
     where id = b.id;
    update public.battle_participants set result = 'void', rewards_granted = true where battle_id = b.id;
    -- Nobody is penalised for a failed match: give the daily battle back.
    if b.status = 'active' then
      perform private.refund_quota(p.user_id, 'battles_per_day')
         from public.battle_participants p where p.battle_id = b.id and p.user_id is not null;
    end if;
    if p_reason in ('timeout','server_error') then
      insert into public.battle_integrity_flags (battle_id, kind, details)
      values (b.id, 'server_timeout', jsonb_build_object('reason', p_reason));
    end if;
    return;
  end if;

  for seat_no in 1..2 loop
    select * into me from public.battle_participants where battle_id = b.id and seat = seat_no for update;
    select * into opp from public.battle_participants where battle_id = b.id and seat <> seat_no;

    res := case
      when p_forfeit_seat is not null then case when p_forfeit_seat = seat_no then 'loss' else 'win' end
      when me.score > opp.score then 'win'
      when me.score < opp.score then 'loss'
      else 'draw' end;

    if me.user_id is null or me.rewards_granted then
      update public.battle_participants set result = res where battle_id = b.id and seat = seat_no;
      continue;
    end if;

    r := private.ensure_rating(me.user_id);
    select * into r from public.battle_ratings where user_id = me.user_id and mode = 'overall' for update;
    opp_rating := opp.rating_before;
    delta := 0;
    if b.rated then
      s := case res when 'win' then 1 when 'draw' then 0.5 else 0 end;
      e := 1 / (1 + power(10::numeric, (opp_rating - me.rating_before)::numeric / 400));
      k := case when r.games < (cfg ->> 'provisional_games')::int
                then (cfg ->> 'k_factor_provisional')::int else (cfg ->> 'k_factor')::int end;
      delta := round(k * (s - e));
    end if;
    new_rating := greatest((cfg ->> 'rating_floor')::int, r.rating + delta);
    delta := new_rating - r.rating;

    update public.battle_ratings set
      rating = new_rating,
      peak_rating = greatest(peak_rating, new_rating),
      games = games + 1,
      wins = wins + (res = 'win')::int,
      losses = losses + (res = 'loss')::int,
      draws = draws + (res = 'draw')::int,
      current_win_streak = case when res = 'win' then current_win_streak + 1 else 0 end,
      best_win_streak = greatest(best_win_streak, case when res = 'win' then current_win_streak + 1 else 0 end),
      answers_total = answers_total + me.answered_count,
      answers_correct = answers_correct + me.correct_count,
      updated_at = now()
    where user_id = me.user_id and mode = 'overall';

    -- XP only for players who actually took part; the result bonus needs a
    -- rated game and at least one correct answer (rewards accuracy, not presence).
    xp := 0;
    if me.answered_count > 0 then
      xp := me.correct_count * (xpc ->> 'battle_correct')::int;
      if b.rated and me.correct_count > 0 then
        xp := xp + case res when 'win' then (xpc ->> 'battle_win')::int
                            when 'draw' then (xpc ->> 'battle_draw')::int
                            else (xpc ->> 'battle_loss')::int end;
      end if;
      granted := private.record_activity(me.user_id, 'battle', xp, me.answered_count, me.correct_count);
    else
      granted := 0;
    end if;

    update public.battle_participants set
      result = res, rating_after = new_rating, xp_awarded = granted, rewards_granted = true
    where battle_id = b.id and seat = seat_no;

    insert into public.battle_results (battle_id, user_id, mode, result, score, rated, rating_delta, rating_after, xp)
    values (b.id, me.user_id, b.mode, res, me.score, b.rated, delta, new_rating, granted)
    on conflict do nothing;

    insert into public.learning_activities (user_id, activity_type, ref_id, score, total, xp, metadata)
    values (me.user_id, 'battle', b.id, me.correct_count, b.question_count, granted,
            jsonb_build_object('mode', b.mode, 'result', res, 'rating_delta', delta, 'reason', p_reason));

    if me.correct_count = b.question_count and p_forfeit_seat is null then
      perform private.award_achievement(me.user_id, 'sharp_shooter');
    end if;
    if me.fast_answer_count >= 3 then
      insert into public.battle_integrity_flags (battle_id, user_id, kind, details)
      values (b.id, me.user_id, 'fast_answers', jsonb_build_object('count', me.fast_answer_count));
    end if;
    perform private.check_achievements(me.user_id);
  end loop;

  update public.battles set status = 'completed', ended_at = now(), end_reason = p_reason, version = version + 1
   where id = b.id;
end $$;

-- =============================================================================
-- State machine. Called (under the battle row lock) by every battle RPC.
-- Catches up on any number of elapsed question windows.
-- =============================================================================
create or replace function private.advance_battle(p_battle uuid)
returns public.battles language plpgsql security definer set search_path = '' as $$
declare
  b public.battles;
  cfg jsonb := private.config('battle');
  q public.battle_questions;
  n_ready integer;
  n_answers integer;
  last_answer timestamptz;
  close_at timestamptz;
  stale smallint[];
  guard integer := 0;
begin
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'Battle not found.' using errcode = 'P0002'; end if;

  if b.status = 'pending' then
    select count(*) into n_ready from public.battle_participants where battle_id = b.id and ready_at is not null;
    if n_ready = 2 then
      perform private.consume_quota(p.user_id, 'battles_per_day')
         from public.battle_participants p where p.battle_id = b.id and p.user_id is not null;
      update public.battle_questions set
        opens_at = now() + make_interval(secs => (cfg ->> 'start_countdown_ms')::numeric / 1000),
        deadline_at = now() + make_interval(secs => ((cfg ->> 'start_countdown_ms')::numeric + b.question_time_ms) / 1000)
       where battle_id = b.id and idx = 0;
      update public.battle_participants set last_seen_at = now() where battle_id = b.id;
      update public.battles set status = 'active', started_at = now(), current_index = 0, version = version + 1
       where id = b.id returning * into b;
    elsif now() > b.created_at + make_interval(secs => (cfg ->> 'ready_timeout_ms')::numeric / 1000) then
      update public.battles set status = 'cancelled', ended_at = now(), end_reason = 'ready_timeout', version = version + 1
       where id = b.id returning * into b;
      update public.battle_participants set result = 'cancelled' where battle_id = b.id;
    end if;
    return b;
  end if;

  while b.status = 'active' and guard < 100 loop
    guard := guard + 1;

    if now() > b.started_at + make_interval(secs => (cfg ->> 'max_duration_ms')::numeric / 1000) then
      perform private.end_battle(b.id, 'void', 'timeout', null);
      exit;
    end if;

    select coalesce(array_agg(seat), '{}') into stale from public.battle_participants
     where battle_id = b.id
       and last_seen_at < now() - make_interval(secs => (cfg ->> 'disconnect_timeout_ms')::numeric / 1000);
    if cardinality(stale) = 2 then
      perform private.end_battle(b.id, 'void', 'both_disconnected', null);   -- nobody is penalised
      exit;
    elsif cardinality(stale) = 1 then
      perform private.end_battle(b.id, 'completed', 'opponent_disconnected', stale[1]);
      exit;
    end if;

    select * into q from public.battle_questions where battle_id = b.id and idx = b.current_index;
    if q.closed_at is not null then exit; end if;
    select count(*), max(answered_at) into n_answers, last_answer
      from public.battle_answers where battle_id = b.id and idx = q.idx;

    if n_answers >= 2 or now() > q.deadline_at + make_interval(secs => (cfg ->> 'answer_grace_ms')::numeric / 1000) then
      close_at := case when n_answers >= 2 then last_answer
                       else q.deadline_at + make_interval(secs => (cfg ->> 'answer_grace_ms')::numeric / 1000) end;
      update public.battle_questions set closed_at = close_at where battle_id = b.id and idx = q.idx;

      -- Scores become visible only when the question closes.
      update public.battle_participants p set
        score = p.score + a.points,
        correct_count = p.correct_count + a.is_correct::int,
        answered_count = p.answered_count + 1
      from public.battle_answers a
      where a.battle_id = b.id and a.idx = q.idx and a.seat = p.seat and p.battle_id = b.id;

      if q.idx >= b.question_count - 1 then
        perform private.end_battle(b.id, 'completed', 'finished', null);
        exit;
      end if;

      update public.battle_questions set
        opens_at = close_at + make_interval(secs => b.reveal_ms::numeric / 1000),
        deadline_at = close_at + make_interval(secs => (b.reveal_ms + b.question_time_ms)::numeric / 1000)
       where battle_id = b.id and idx = q.idx + 1;
      update public.battles set current_index = current_index + 1, version = version + 1
       where id = b.id returning * into b;
    else
      exit;
    end if;
  end loop;

  select * into b from public.battles where id = p_battle;
  return b;
end $$;

-- Client-safe view of the whole battle for one participant.
create or replace function private.battle_state(p_battle uuid, p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  b public.battles;
  me public.battle_participants;
  opp public.battle_participants;
  q public.battle_questions;
  qq public.questions;
  last_closed public.battle_questions;
  lq public.questions;
  my_ans public.battle_answers;
  opp_ans public.battle_answers;
  cfg jsonb := private.config('battle');
  question jsonb := null;
  reveal jsonb := null;
  result jsonb := null;
  mode jsonb;
begin
  select * into b from public.battles where id = p_battle;
  select * into me from public.battle_participants where battle_id = p_battle and user_id = p_user;
  select * into opp from public.battle_participants where battle_id = p_battle and seat <> me.seat;
  mode := private.mode_config(b.mode);

  if b.status = 'active' then
    select * into q from public.battle_questions where battle_id = b.id and idx = b.current_index;
    if q.opens_at <= now() and q.closed_at is null then
      select * into qq from public.questions where id = q.question_id;
      select * into my_ans from public.battle_answers where battle_id = b.id and idx = q.idx and seat = me.seat;
      question := private.question_public(qq) || jsonb_build_object(
        'idx', q.idx, 'opens_at', q.opens_at, 'deadline_at', q.deadline_at,
        'my_selected', my_ans.selected_index, 'answered', my_ans.battle_id is not null,
        'opponent_answered', exists (select 1 from public.battle_answers a
                                      where a.battle_id = b.id and a.idx = q.idx and a.seat = opp.seat));
    end if;
  end if;

  select * into last_closed from public.battle_questions
   where battle_id = b.id and closed_at is not null order by idx desc limit 1;
  if found then
    select * into lq from public.questions where id = last_closed.question_id;
    select * into my_ans from public.battle_answers where battle_id = b.id and idx = last_closed.idx and seat = me.seat;
    select * into opp_ans from public.battle_answers where battle_id = b.id and idx = last_closed.idx and seat = opp.seat;
    reveal := jsonb_build_object(
      'idx', last_closed.idx, 'prompt', lq.prompt, 'sentence', lq.sentence, 'options', lq.options,
      'correct_index', lq.correct_index, 'explanation', lq.explanation, 'entry_id', lq.entry_id,
      'my_selected', my_ans.selected_index, 'my_correct', coalesce(my_ans.is_correct, false),
      'my_points', coalesce(my_ans.points, 0), 'my_response_ms', my_ans.response_ms,
      'opponent_selected', opp_ans.selected_index, 'opponent_correct', coalesce(opp_ans.is_correct, false),
      'opponent_points', coalesce(opp_ans.points, 0), 'closed_at', last_closed.closed_at);
  end if;

  if b.status in ('completed','void','cancelled') then
    result := jsonb_build_object(
      'my_result', me.result, 'opponent_result', opp.result,
      'rating_before', me.rating_before, 'rating_after', coalesce(me.rating_after, me.rating_before),
      'rating_delta', coalesce(me.rating_after, me.rating_before) - me.rating_before,
      'xp', me.xp_awarded, 'rated', b.rated, 'reason', b.end_reason,
      'questions', (select jsonb_agg(jsonb_build_object(
          'idx', bq.idx, 'prompt', qx.prompt, 'sentence', qx.sentence,
          'correct_answer', qx.options ->> qx.correct_index::int, 'explanation', qx.explanation,
          'entry_id', qx.entry_id,
          'my_answer', qx.options ->> ma.selected_index::int, 'my_correct', coalesce(ma.is_correct, false),
          'my_points', coalesce(ma.points, 0),
          'opponent_correct', coalesce(oa.is_correct, false)) order by bq.idx)
        from public.battle_questions bq
        join public.questions qx on qx.id = bq.question_id
        left join public.battle_answers ma on ma.battle_id = bq.battle_id and ma.idx = bq.idx and ma.seat = me.seat
        left join public.battle_answers oa on oa.battle_id = bq.battle_id and oa.idx = bq.idx and oa.seat = opp.seat
       where bq.battle_id = b.id and bq.closed_at is not null));
  end if;

  return jsonb_build_object(
    'server_now', now(),
    'battle', jsonb_build_object(
      'id', b.id, 'mode', b.mode, 'mode_name', mode ->> 'name', 'status', b.status, 'rated', b.rated,
      'question_count', b.question_count, 'question_time_ms', b.question_time_ms, 'reveal_ms', b.reveal_ms,
      'current_index', b.current_index, 'version', b.version, 'end_reason', b.end_reason,
      'created_at', b.created_at, 'started_at', b.started_at, 'ended_at', b.ended_at,
      'ready_deadline', b.created_at + make_interval(secs => (cfg ->> 'ready_timeout_ms')::numeric / 1000)),
    'me', jsonb_build_object('alias', me.alias, 'avatar', me.avatar, 'level', me.display_level,
      'rating', me.rating_before, 'score', me.score, 'correct', me.correct_count, 'ready', me.ready_at is not null),
    'opponent', jsonb_build_object('alias', opp.alias, 'avatar', opp.avatar, 'level', opp.display_level,
      'rating', opp.rating_before, 'score', opp.score, 'correct', opp.correct_count, 'ready', opp.ready_at is not null,
      'connected', opp.last_seen_at > now() - interval '8 seconds'),
    'question', question,
    'next_question_at', case when b.status = 'active' and question is null and q.closed_at is null then q.opens_at end,
    'reveal', reveal,
    'result', result);
end $$;

-- =============================================================================
-- Public RPCs
-- =============================================================================
create or replace function public.get_battle_lobby()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  r public.battle_ratings := private.ensure_rating(uid);
  p public.profiles;
begin
  select * into p from public.profiles where id = uid;
  return jsonb_build_object(
    'rating', jsonb_build_object('rating', r.rating, 'peak', r.peak_rating, 'games', r.games, 'wins', r.wins,
       'losses', r.losses, 'draws', r.draws,
       'win_rate', case when r.games > 0 then round(r.wins * 100.0 / r.games) else 0 end,
       'accuracy', case when r.answers_total > 0 then round(r.answers_correct * 100.0 / r.answers_total) else null end,
       'current_win_streak', r.current_win_streak, 'best_win_streak', r.best_win_streak,
       'provisional', r.games < private.cfg_int('battle', 'provisional_games')),
    'modes', private.config('battle_modes'),
    'plan', private.user_plan(uid),
    'battles_remaining_today', private.quota_remaining(uid, 'battles_per_day'),
    'battles_limit', private.plan_limit(uid, 'battles_per_day'),
    'gender_preference_available', private.plan_flag(uid, 'gender_preference'),
    'gender_preference', p.battle_gender_preference,
    'show_identity', p.show_identity_in_battles,
    'assessed', exists (select 1 from public.user_progress where user_id = uid and proficiency_status <> 'unassessed'),
    'recent_opponents', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('alias', op.alias, 'avatar', op.avatar, 'level', op.display_level,
                                  'result', mine.result, 'at', b.ended_at) x
          from public.battle_participants mine
          join public.battles b on b.id = mine.battle_id and b.status = 'completed'
          join public.battle_participants op on op.battle_id = b.id and op.seat <> mine.seat
         where mine.user_id = uid order by b.ended_at desc limit 5) s), '[]'::jsonb));
end $$;

create or replace function public.get_active_battle()
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); bid uuid; b public.battles;
begin
  select bp.battle_id into bid from public.battle_participants bp join public.battles x on x.id = bp.battle_id
   where bp.user_id = uid and x.status in ('pending','active') order by x.created_at desc limit 1;
  if bid is null then return null; end if;
  b := private.advance_battle(bid);
  return case when b.status in ('pending','active') then b.id else null end;
end $$;

create or replace function public.join_matchmaking(p_mode text default 'vocab_duel')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  cfg jsonb := private.config('battle');
  mode jsonb := private.mode_config(p_mode);
  prof public.profiles;
  prog public.user_progress;
  r public.battle_ratings;
  me public.matchmaking_queue;
  opp public.matchmaking_queue;
  active_id uuid;
  pref text;
  wait_s numeric;
  rated boolean;
  b public.battles;
  d integer;
  qids uuid[];
  a1 text[]; a2 text[];
  op_prof public.profiles; op_prog public.user_progress;
begin
  perform private.require_active_account(uid);
  perform private.rate_limit(uid, 'matchmaking');
  if mode is null or not coalesce((mode ->> 'enabled')::boolean, false) then
    raise exception 'This battle mode is not available yet.' using errcode = '22023';
  end if;

  active_id := public.get_active_battle();
  if active_id is not null then
    delete from public.matchmaking_queue where user_id = uid;
    return jsonb_build_object('status', 'in_battle', 'battle_id', active_id);
  end if;

  select * into prog from public.user_progress where user_id = uid;
  if prog.proficiency_status = 'unassessed' then
    raise exception 'Complete your proficiency assessment before battling.' using errcode = 'P0001';
  end if;
  if coalesce(private.quota_remaining(uid, 'battles_per_day'), 1) <= 0 then
    raise exception 'You have used all of today''s battles on your plan.' using errcode = 'P0402';
  end if;

  select * into prof from public.profiles where id = uid;
  r := private.ensure_rating(uid);
  pref := case when private.plan_flag(uid, 'gender_preference') then prof.battle_gender_preference else 'any' end;

  -- Remove a stale 'matched' row whose battle is already over.
  delete from public.matchmaking_queue mq where mq.user_id = uid and mq.status = 'matched'
     and not exists (select 1 from public.battles x where x.id = mq.battle_id and x.status in ('pending','active'));

  insert into public.matchmaking_queue as mq (user_id, mode, rating, level_num, gender, gender_pref)
  values (uid, p_mode, r.rating, coalesce(private.level_num(prog.proficiency_level), 3), prof.gender, pref)
  on conflict (user_id) do update set
    enqueued_at = case when mq.mode <> excluded.mode then now() else mq.enqueued_at end,
    mode = excluded.mode, rating = excluded.rating, level_num = excluded.level_num,
    gender = excluded.gender, gender_pref = excluded.gender_pref, last_poll_at = now()
  where mq.status = 'waiting';

  select * into me from public.matchmaking_queue where user_id = uid for update;
  if me.status = 'matched' then
    return jsonb_build_object('status', 'in_battle', 'battle_id', me.battle_id);
  end if;

  -- Fair-match search: the window widens the longer either player has waited.
  select q.* into opp
    from public.matchmaking_queue q
   where q.user_id <> uid and q.status = 'waiting' and q.mode = p_mode
     and q.last_poll_at > now() - make_interval(secs => (cfg ->> 'queue_stale_ms')::numeric / 1000)
     and not exists (select 1 from public.blocked_users bu
                      where (bu.blocker_id = uid and bu.blocked_id = q.user_id)
                         or (bu.blocker_id = q.user_id and bu.blocked_id = uid))
     and (me.gender_pref = 'any' or q.gender = me.gender_pref)
     and (q.gender_pref = 'any' or me.gender = q.gender_pref)
     and abs(q.rating - me.rating) <= 150 + 15 * extract(epoch from now() - least(q.enqueued_at, me.enqueued_at))
     and abs(q.level_num - me.level_num) <= case
           when extract(epoch from now() - least(q.enqueued_at, me.enqueued_at)) >= 45 then 5
           when extract(epoch from now() - least(q.enqueued_at, me.enqueued_at)) >= 15 then 2
           else 1 end
   order by abs(q.level_num - me.level_num), abs(q.rating - me.rating), q.enqueued_at
   limit 1
   for update skip locked;

  wait_s := extract(epoch from now() - me.enqueued_at);
  if opp.user_id is null then
    return jsonb_build_object('status', 'waiting', 'mode', p_mode, 'waited_seconds', round(wait_s),
                              'gender_preference', pref);
  end if;

  -- Anti-farming: the same pair only plays a limited number of rated games per day.
  rated := (select count(*) from public.battles x
              join public.battle_participants p1 on p1.battle_id = x.id and p1.user_id = uid
              join public.battle_participants p2 on p2.battle_id = x.id and p2.user_id = opp.user_id
             where x.rated and x.status = 'completed' and x.created_at > now() - interval '24 hours')
           < (cfg ->> 'rated_pair_limit_per_day')::int;

  d := round((me.level_num + opp.level_num) / 2.0);
  select array_agg(id) into qids from (
    select id from (
      select distinct on (coalesce(q.entry_id, q.id)) q.id, q.difficulty,
             exists (select 1 from public.battle_answers ba
                      where ba.user_id in (uid, opp.user_id) and ba.answered_at > now() - interval '14 days'
                        and ba.battle_id in (select bq.battle_id from public.battle_questions bq where bq.question_id = q.id)) as seen,
             random() as rnd
        from public.questions q
       where q.is_active and q.use_in_battle
         and q.type in (select jsonb_array_elements_text(mode -> 'types'))
         and abs(q.difficulty - d) <= 2
       order by coalesce(q.entry_id, q.id), random()
    ) c order by c.seen, abs(c.difficulty - d), c.rnd
    limit (cfg ->> 'question_count')::int
  ) s;
  if qids is null or cardinality(qids) < (cfg ->> 'question_count')::int then
    raise exception 'Not enough questions are available for this mode.' using errcode = 'P0001';
  end if;

  insert into public.battles (mode, rated, question_count, question_time_ms, reveal_ms)
  values (p_mode, rated, (cfg ->> 'question_count')::int, (cfg ->> 'question_time_ms')::int, (cfg ->> 'reveal_ms')::int)
  returning * into b;

  insert into public.battle_questions (battle_id, idx, question_id)
  select b.id, t.ord - 1, t.qid from unnest(qids) with ordinality as t(qid, ord);

  select * into op_prof from public.profiles where id = opp.user_id;
  select * into op_prog from public.user_progress where user_id = opp.user_id;
  a1 := private.random_alias();
  a2 := private.random_alias(a1[1]);

  insert into public.battle_participants (battle_id, seat, user_id, alias, avatar, display_level, rating_before)
  values
    (b.id, 1, opp.user_id,
     case when op_prof.show_identity_in_battles and op_prof.username is not null then op_prof.username else a1[1] end,
     case when op_prof.show_identity_in_battles then op_prof.avatar else a1[2] end,
     op_prog.proficiency_level, opp.rating),
    (b.id, 2, uid,
     case when prof.show_identity_in_battles and prof.username is not null then prof.username else a2[1] end,
     case when prof.show_identity_in_battles then prof.avatar else a2[2] end,
     prog.proficiency_level, me.rating);

  if not rated then
    insert into public.battle_integrity_flags (battle_id, user_id, kind, details)
    values (b.id, uid, 'pair_repeat', jsonb_build_object('note', 'Unrated: pair rated-game limit reached'));
  end if;

  update public.matchmaking_queue set status = 'matched', battle_id = b.id where user_id in (uid, opp.user_id);
  return jsonb_build_object('status', 'matched', 'battle_id', b.id);
end $$;

create or replace function public.cancel_matchmaking()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); bid uuid;
begin
  delete from public.matchmaking_queue where user_id = uid and status = 'waiting';
  bid := public.get_active_battle();
  return jsonb_build_object('cancelled', bid is null, 'battle_id', bid);
end $$;

create or replace function public.get_battle_state(p_battle_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); v_seat smallint;
begin
  v_seat := private.battle_my_seat(p_battle_id, uid);
  if v_seat is null then raise exception 'Battle not found.' using errcode = 'P0002'; end if;
  -- Advance using the previous heartbeats (so a player who was away cannot
  -- return and claim a forfeit win), then record this heartbeat.
  perform private.advance_battle(p_battle_id);
  update public.battle_participants set last_seen_at = now()
   where battle_id = p_battle_id and user_id = uid;
  delete from public.matchmaking_queue where user_id = uid and status = 'matched';
  return private.battle_state(p_battle_id, uid);
end $$;

create or replace function public.set_battle_ready(p_battle_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); b public.battles;
begin
  if private.battle_my_seat(p_battle_id, uid) is null then
    raise exception 'Battle not found.' using errcode = 'P0002';
  end if;
  b := private.advance_battle(p_battle_id);
  if b.status = 'pending' then
    update public.battle_participants set ready_at = coalesce(ready_at, now()), last_seen_at = now()
     where battle_id = p_battle_id and user_id = uid;
    update public.battles set version = version + 1 where id = p_battle_id;
    perform private.advance_battle(p_battle_id);
  end if;
  return public.get_battle_state(p_battle_id);
end $$;

create or replace function public.submit_battle_answer(p_battle_id uuid, p_index integer, p_selected integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  cfg jsonb := private.config('battle');
  my_seat smallint := private.battle_my_seat(p_battle_id, uid);
  b public.battles;
  bq public.battle_questions;
  q public.questions;
  correct boolean;
  resp_ms integer;
  pts integer := 0;
  rejected text := null;
  inserted integer;
begin
  if my_seat is null then raise exception 'Battle not found.' using errcode = 'P0002'; end if;
  b := private.advance_battle(p_battle_id);

  if b.status <> 'active' then
    rejected := 'not_active';
  elsif p_index <> b.current_index then
    rejected := 'stale_question';
  else
    select * into bq from public.battle_questions where battle_id = b.id and idx = p_index;
    if now() < bq.opens_at then
      rejected := 'not_open';
    elsif bq.closed_at is not null
       or now() > bq.deadline_at + make_interval(secs => (cfg ->> 'answer_grace_ms')::numeric / 1000) then
      rejected := 'too_late';
    elsif p_selected is null or p_selected < 0 then
      rejected := 'invalid_choice';
    end if;
  end if;

  if rejected is null then
    select * into q from public.questions where id = bq.question_id;
    if p_selected >= jsonb_array_length(q.options) then
      rejected := 'invalid_choice';
    else
      correct := p_selected = q.correct_index;
      -- Elapsed time is measured by the server, never taken from the client.
      resp_ms := greatest(0, least(b.question_time_ms, (extract(epoch from (now() - bq.opens_at)) * 1000)::int));
      if correct then
        pts := (cfg ->> 'base_points')::int
             + round((cfg ->> 'max_speed_bonus')::int * (1 - resp_ms::numeric / b.question_time_ms));
      end if;
      insert into public.battle_answers (battle_id, idx, seat, user_id, selected_index, is_correct, points, response_ms)
      values (b.id, p_index, my_seat, uid, p_selected, correct, pts, resp_ms)
      on conflict do nothing;
      get diagnostics inserted = row_count;
      if inserted = 0 then
        rejected := 'duplicate';
      else
        perform private.record_answer(uid, q.id, correct);
        update public.battle_participants set
          last_seen_at = now(),
          fast_answer_count = fast_answer_count + (resp_ms < (cfg ->> 'min_human_response_ms')::int)::int
        where battle_id = b.id and seat = my_seat;
        update public.battles set version = version + 1 where id = b.id;
        perform private.advance_battle(b.id);
      end if;
    end if;
  end if;

  return private.battle_state(p_battle_id, uid) || jsonb_build_object('submission',
    jsonb_build_object('accepted', rejected is null, 'reason', rejected));
end $$;

create or replace function public.forfeit_battle(p_battle_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); my_seat smallint := private.battle_my_seat(p_battle_id, uid); b public.battles;
begin
  if my_seat is null then raise exception 'Battle not found.' using errcode = 'P0002'; end if;
  b := private.advance_battle(p_battle_id);
  if b.status = 'pending' then
    update public.battles set status = 'cancelled', ended_at = now(), end_reason = 'declined', version = version + 1
     where id = b.id;
    update public.battle_participants set result = 'cancelled' where battle_id = b.id;
  elsif b.status = 'active' then
    perform private.end_battle(b.id, 'completed', 'forfeit', my_seat);
  end if;
  return private.battle_state(p_battle_id, uid);
end $$;

create or replace function public.get_battle_history(p_limit integer default 20, p_before timestamptz default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by (x ->> 'ended_at') desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'battle_id', b.id, 'mode', b.mode, 'status', b.status, 'result', me.result, 'rated', b.rated,
      'end_reason', b.end_reason, 'my_score', me.score, 'opponent_score', op.score,
      'my_correct', me.correct_count, 'question_count', b.question_count,
      'opponent_alias', op.alias, 'opponent_avatar', op.avatar, 'opponent_level', op.display_level,
      'rating_delta', coalesce(me.rating_after, me.rating_before) - me.rating_before,
      'rating_after', me.rating_after, 'xp', me.xp_awarded, 'ended_at', b.ended_at) x
      from public.battle_participants me
      join public.battles b on b.id = me.battle_id
      join public.battle_participants op on op.battle_id = b.id and op.seat <> me.seat
     where me.user_id = auth.uid()
       and b.status in ('completed','void')
       and (p_before is null or b.ended_at < p_before)
     order by b.ended_at desc
     limit greatest(1, least(coalesce(p_limit, 20), 100))
  ) s
$$;

create or replace function public.get_leaderboard(p_period text default 'weekly', p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  since timestamptz;
  v_rows jsonb;
  v_mine jsonb;
  lim integer := greatest(1, least(coalesce(p_limit, 50), 100));
begin
  since := case p_period
    when 'daily' then date_trunc('day', now())
    when 'weekly' then date_trunc('week', now())
    when 'monthly' then date_trunc('month', now())
    when 'global' then null
    else null end;
  if p_period not in ('daily','weekly','monthly','global') then
    raise exception 'Unknown leaderboard period.' using errcode = '22023';
  end if;

  if p_period = 'global' then
    with ranked as (
      select r.user_id, r.rating as value, r.wins, r.games,
             rank() over (order by r.rating desc, r.wins desc) as rnk
        from public.battle_ratings r join public.profiles p on p.id = r.user_id
       where r.mode = 'overall' and r.games > 0 and p.show_on_leaderboard and p.username is not null
         and p.account_status = 'active')
    select jsonb_agg(private.leaderboard_row(x.user_id, x.rnk, x.value, x.wins, x.games, uid) order by x.rnk)
           filter (where x.rnk <= lim),
           max(case when x.user_id = uid then private.leaderboard_row(x.user_id, x.rnk, x.value, x.wins, x.games, uid)::text end)::jsonb
      into v_rows, v_mine from ranked x;
  else
    with agg as (
      select br.user_id, sum(br.rating_delta) as value, count(*) filter (where br.result = 'win') as wins, count(*) as games
        from public.battle_results br join public.profiles p on p.id = br.user_id
       where br.created_at >= since and br.rated and p.show_on_leaderboard and p.username is not null
         and p.account_status = 'active'
       group by br.user_id),
    ranked as (select a.*, rank() over (order by a.value desc, a.wins desc) as rnk from agg a)
    select jsonb_agg(private.leaderboard_row(x.user_id, x.rnk, x.value::int, x.wins::int, x.games::int, uid) order by x.rnk)
           filter (where x.rnk <= lim),
           max(case when x.user_id = uid then private.leaderboard_row(x.user_id, x.rnk, x.value::int, x.wins::int, x.games::int, uid)::text end)::jsonb
      into v_rows, v_mine from ranked x;
  end if;

  return jsonb_build_object('period', p_period, 'since', since, 'entries', coalesce(v_rows, '[]'::jsonb), 'me', v_mine,
    'metric', case when p_period = 'global' then 'rating' else 'rating_gained' end,
    'participating', (select show_on_leaderboard from public.profiles where id = uid));
end $$;

create or replace function private.leaderboard_row(p_user uuid, p_rank bigint, p_value integer, p_wins integer, p_games integer, p_viewer uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('rank', p_rank, 'username', p.username, 'display_name', p.display_name,
    'avatar', p.avatar, 'level', g.proficiency_level, 'value', p_value, 'wins', p_wins, 'games', p_games,
    'is_me', p_user = p_viewer)
  from public.profiles p left join public.user_progress g on g.user_id = p.id where p.id = p_user
$$;

create or replace function public.get_public_profile(p_username text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'username', p.username, 'display_name', p.display_name, 'avatar', p.avatar,
    'level', g.proficiency_level, 'level_status', g.proficiency_status,
    'rating', r.rating, 'battles', coalesce(r.games, 0),
    'win_rate', case when coalesce(r.games, 0) > 0 then round(r.wins * 100.0 / r.games) else 0 end,
    'streak', case when p.show_streak_publicly then private.effective_streak(p.id) end,
    'badges', case when p.show_badges_publicly then (
        select coalesce(jsonb_agg(jsonb_build_object('code', a.code, 'title', a.title, 'icon', a.icon) order by ua.earned_at), '[]'::jsonb)
          from public.user_achievements ua join public.achievements a on a.code = ua.achievement_code
         where ua.user_id = p.id) end)
  from public.profiles p
  left join public.user_progress g on g.user_id = p.id
  left join public.battle_ratings r on r.user_id = p.id and r.mode = 'overall'
  where lower(p.username) = lower(p_username) and p.account_status = 'active'
$$;

-- Reports and blocks reference the opponent through the battle, so the
-- reporter never needs (or learns) the opponent's account id.
create or replace function public.report_battle_opponent(p_battle_id uuid, p_reason text, p_details text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); my_seat smallint := private.battle_my_seat(p_battle_id, uid); opp public.battle_participants; rid uuid;
begin
  if my_seat is null then raise exception 'Battle not found.' using errcode = 'P0002'; end if;
  perform private.rate_limit(uid, 'report');
  select * into opp from public.battle_participants where battle_id = p_battle_id and seat <> my_seat;
  insert into public.user_reports (reporter_id, reported_id, battle_id, reported_label, reason, details)
  values (uid, opp.user_id, p_battle_id, opp.alias, p_reason, left(p_details, 1000)) returning id into rid;
  return jsonb_build_object('report_id', rid, 'status', 'open');
end $$;

create or replace function public.block_battle_opponent(p_battle_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); my_seat smallint := private.battle_my_seat(p_battle_id, uid); opp public.battle_participants;
begin
  if my_seat is null then raise exception 'Battle not found.' using errcode = 'P0002'; end if;
  select * into opp from public.battle_participants where battle_id = p_battle_id and seat <> my_seat;
  if opp.user_id is null then return jsonb_build_object('blocked', false); end if;
  insert into public.blocked_users (blocker_id, blocked_id, label, battle_id)
  values (uid, opp.user_id, opp.alias, p_battle_id) on conflict (blocker_id, blocked_id) do nothing;
  return jsonb_build_object('blocked', true, 'label', opp.alias);
end $$;

create or replace function public.get_blocked_users()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'label', label, 'created_at', created_at) order by created_at desc), '[]'::jsonb)
    from public.blocked_users where blocker_id = auth.uid()
$$;

create or replace function public.unblock_user(p_block_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.blocked_users where id = p_block_id and blocker_id = auth.uid()
$$;

-- Realtime: clients subscribe to their battle row and their own queue row.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.battles, public.matchmaking_queue, public.notifications;
  end if;
end $$;
