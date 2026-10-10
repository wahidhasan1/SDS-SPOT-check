-- =============================================================================
-- Vocabattle — 0004 administration & moderation
-- Role-based (user_roles), every mutating action is written to
-- admin_audit_logs. Admin RPCs never return passwords, tokens or emails.
-- The administrative UI itself is Phase 4; these RPCs are its API.
-- =============================================================================

create or replace function public.admin_get_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_role('moderator');
  return jsonb_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_assessed', (select count(*) from public.user_progress where proficiency_status <> 'unassessed'),
    'active_today', (select count(*) from public.daily_activity where activity_date = (now() at time zone 'UTC')::date),
    'battles_today', (select count(*) from public.battles where created_at > date_trunc('day', now())),
    'battles_live', (select count(*) from public.battles where status in ('pending','active')),
    'battles_void_7d', (select count(*) from public.battles where status = 'void' and created_at > now() - interval '7 days'),
    'queue_waiting', (select count(*) from public.matchmaking_queue where status = 'waiting'),
    'open_reports', (select count(*) from public.user_reports where status in ('open','reviewing')),
    'unreviewed_flags', (select count(*) from public.battle_integrity_flags where not reviewed),
    'premium_users', (select count(distinct user_id) from public.subscriptions
                       where status in ('active','trialing','grace_period')
                         and (current_period_end is null or current_period_end > now())),
    'usage_today', coalesce((select jsonb_object_agg(feature, total) from (
        select feature, sum(used) total from public.usage_counters
         where period_key = (now() at time zone 'UTC')::date group by feature) u), '{}'::jsonb));
end $$;

create or replace function public.admin_list_reports(p_status text default 'open', p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_role('moderator');
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'reason', r.reason, 'details', r.details, 'status', r.status,
      'reported_label', r.reported_label, 'reported_username', rp.username, 'reported_user_id', r.reported_id,
      'reporter_username', ep.username, 'battle_id', r.battle_id,
      'reports_against_user', (select count(*) from public.user_reports x where x.reported_id = r.reported_id),
      'created_at', r.created_at, 'resolution_note', r.resolution_note) order by r.created_at)
    from public.user_reports r
    left join public.profiles rp on rp.id = r.reported_id
    left join public.profiles ep on ep.id = r.reporter_id
   where p_status is null or r.status = p_status
   limit greatest(1, least(p_limit, 200))), '[]'::jsonb);
end $$;

create or replace function public.admin_update_report(p_report_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_role('moderator');
begin
  update public.user_reports set status = p_status, resolution_note = p_note,
         resolved_by = case when p_status in ('resolved','dismissed') then actor end,
         resolved_at = case when p_status in ('resolved','dismissed') then now() end
   where id = p_report_id;
  if not found then raise exception 'Report not found.' using errcode = 'P0002'; end if;
  perform private.audit('report.update', 'user_report', p_report_id::text,
                        jsonb_build_object('status', p_status, 'note', p_note));
end $$;

create or replace function public.admin_suspend_user(p_user_id uuid, p_until timestamptz, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_role('moderator');
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'A suspension reason is required.' using errcode = '22023';
  end if;
  update public.profiles set account_status = 'suspended', suspended_until = p_until where id = p_user_id;
  if not found then raise exception 'User not found.' using errcode = 'P0002'; end if;
  delete from public.matchmaking_queue where user_id = p_user_id;
  perform private.audit('user.suspend', 'user', p_user_id::text,
                        jsonb_build_object('until', p_until, 'reason', p_reason));
end $$;

create or replace function public.admin_unsuspend_user(p_user_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_role('moderator');
  update public.profiles set account_status = 'active', suspended_until = null where id = p_user_id;
  perform private.audit('user.unsuspend', 'user', p_user_id::text, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_void_battle(p_battle_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_role('moderator');
  perform private.end_battle(p_battle_id, 'void', 'admin', null);
  perform private.audit('battle.void', 'battle', p_battle_id::text, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_list_battle_issues(p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_role('moderator');
  return jsonb_build_object(
    'flags', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'battle_id', f.battle_id, 'user_id', f.user_id,
        'username', p.username, 'kind', f.kind, 'details', f.details, 'reviewed', f.reviewed, 'created_at', f.created_at)
        order by f.created_at desc)
      from (select * from public.battle_integrity_flags order by created_at desc limit greatest(1, least(p_limit, 200))) f
      left join public.profiles p on p.id = f.user_id), '[]'::jsonb),
    'failed_battles', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'mode', b.mode, 'status', b.status,
        'end_reason', b.end_reason, 'created_at', b.created_at) order by b.created_at desc)
      from (select * from public.battles where status in ('void','cancelled')
             order by created_at desc limit greatest(1, least(p_limit, 200))) b), '[]'::jsonb));
end $$;

create or replace function public.admin_set_config(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_role('admin'); old jsonb;
begin
  select value into old from public.app_config where key = p_key;
  if not found then raise exception 'Unknown configuration key.' using errcode = 'P0002'; end if;
  if jsonb_typeof(p_value) <> jsonb_typeof(old) then
    raise exception 'Configuration value has the wrong shape.' using errcode = '22023';
  end if;
  update public.app_config set value = p_value, updated_at = now(), updated_by = actor where key = p_key;
  perform private.audit('config.set', 'app_config', p_key, jsonb_build_object('old', old, 'new', p_value));
end $$;

create or replace function public.admin_set_role(p_user_id uuid, p_role text, p_granted boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_role('admin');
begin
  if p_granted then
    insert into public.user_roles (user_id, role, granted_by) values (p_user_id, p_role, actor) on conflict do nothing;
  else
    delete from public.user_roles where user_id = p_user_id and role = p_role;
  end if;
  perform private.audit(case when p_granted then 'role.grant' else 'role.revoke' end, 'user', p_user_id::text,
                        jsonb_build_object('role', p_role));
end $$;

create or replace function public.admin_upsert_vocabulary_entry(p_entry jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare eid uuid;
begin
  perform private.require_role('content_editor');
  insert into public.vocabulary_entries (id, word, phonetic, part_of_speech, definition, example, usage_note,
                                          synonyms, antonyms, level, topic_id, ielts_note, is_active)
  values (coalesce((p_entry ->> 'id')::uuid, gen_random_uuid()), p_entry ->> 'word', p_entry ->> 'phonetic',
          p_entry ->> 'part_of_speech', p_entry ->> 'definition', p_entry ->> 'example', p_entry ->> 'usage_note',
          coalesce(array(select jsonb_array_elements_text(p_entry -> 'synonyms')), '{}'),
          coalesce(array(select jsonb_array_elements_text(p_entry -> 'antonyms')), '{}'),
          p_entry ->> 'level', p_entry ->> 'topic_id', p_entry ->> 'ielts_note',
          coalesce((p_entry ->> 'is_active')::boolean, true))
  on conflict (id) do update set word = excluded.word, phonetic = excluded.phonetic,
    part_of_speech = excluded.part_of_speech, definition = excluded.definition, example = excluded.example,
    usage_note = excluded.usage_note, synonyms = excluded.synonyms, antonyms = excluded.antonyms,
    level = excluded.level, topic_id = excluded.topic_id, ielts_note = excluded.ielts_note, is_active = excluded.is_active
  returning id into eid;
  perform private.audit('content.vocabulary.upsert', 'vocabulary_entry', eid::text, p_entry);
  return eid;
end $$;

create or replace function public.admin_upsert_question(p_question jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare qid uuid;
begin
  perform private.require_role('content_editor');
  insert into public.questions (id, type, skill, prompt, sentence, options, correct_index, explanation, difficulty,
                                topic_id, grammar_topic, entry_id, use_in_assessment, use_in_quiz, use_in_battle, is_active)
  values (coalesce((p_question ->> 'id')::uuid, gen_random_uuid()), p_question ->> 'type',
          coalesce(p_question ->> 'skill', 'vocabulary'), p_question ->> 'prompt', p_question ->> 'sentence',
          p_question -> 'options', (p_question ->> 'correct_index')::smallint, p_question ->> 'explanation',
          (p_question ->> 'difficulty')::smallint, p_question ->> 'topic_id', p_question ->> 'grammar_topic',
          (p_question ->> 'entry_id')::uuid,
          coalesce((p_question ->> 'use_in_assessment')::boolean, true), coalesce((p_question ->> 'use_in_quiz')::boolean, true),
          coalesce((p_question ->> 'use_in_battle')::boolean, true), coalesce((p_question ->> 'is_active')::boolean, true))
  on conflict (id) do update set type = excluded.type, skill = excluded.skill, prompt = excluded.prompt,
    sentence = excluded.sentence, options = excluded.options, correct_index = excluded.correct_index,
    explanation = excluded.explanation, difficulty = excluded.difficulty, topic_id = excluded.topic_id,
    grammar_topic = excluded.grammar_topic, entry_id = excluded.entry_id,
    use_in_assessment = excluded.use_in_assessment, use_in_quiz = excluded.use_in_quiz,
    use_in_battle = excluded.use_in_battle, is_active = excluded.is_active
  returning id into qid;
  perform private.audit('content.question.upsert', 'question', qid::text, p_question);
  return qid;
end $$;

create or replace function public.admin_get_audit_log(p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_role('admin');
  return coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'actor', p.username, 'action', l.action,
      'target_type', l.target_type, 'target_id', l.target_id, 'details', l.details, 'created_at', l.created_at)
      order by l.id desc)
    from (select * from public.admin_audit_logs order by id desc limit greatest(1, least(p_limit, 500))) l
    left join public.profiles p on p.id = l.actor_id), '[]'::jsonb);
end $$;

create or replace function public.get_my_roles()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(role order by role), '{}') from public.user_roles where user_id = auth.uid()
$$;
