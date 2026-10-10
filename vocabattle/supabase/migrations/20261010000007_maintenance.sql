-- =============================================================================
-- Vocabattle — 0007 maintenance
-- Battles advance lazily when a participant calls the API. If *both* players
-- vanish, nobody calls, so this sweep finalises such battles (voiding them
-- without penalties) and clears stale matchmaking rows. Schedule it every
-- minute with pg_cron (done automatically below when the extension exists).
-- =============================================================================

create or replace function private.run_maintenance()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  b record;
  advanced integer := 0;
  removed integer;
begin
  for b in
    select id from public.battles
     where status in ('pending', 'active') and created_at < now() - interval '1 minute'
     order by created_at
     limit 500
  loop
    perform private.advance_battle(b.id);
    advanced := advanced + 1;
  end loop;

  delete from public.matchmaking_queue
   where (status = 'waiting' and last_poll_at < now() - interval '2 minutes')
      or (status = 'matched' and not exists (select 1 from public.battles x
                                              where x.id = battle_id and x.status in ('pending', 'active')));
  get diagnostics removed = row_count;

  delete from public.rate_limits where window_start < now() - interval '2 days';
  return jsonb_build_object('battles_checked', advanced, 'queue_rows_removed', removed);
end $$;

revoke all on function private.run_maintenance() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('vocabattle-maintenance', '* * * * *', 'select private.run_maintenance()');
  else
    raise notice 'pg_cron not installed: schedule private.run_maintenance() every minute (see docs/SETUP.md).';
  end if;
end $$;
