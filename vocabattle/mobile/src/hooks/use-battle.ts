import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import { toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { BattleState } from '@/lib/types';

const POLL_MS = 1000;
const TERMINAL = new Set(['completed', 'void', 'cancelled']);

/**
 * Live battle state. The server is authoritative; this hook only mirrors it.
 *  - Polls get_battle_state every second (this is also the presence heartbeat
 *    the server uses to detect disconnections).
 *  - Listens to Realtime updates of the battle row to refresh immediately.
 *  - Estimates the server clock offset so countdowns match the server.
 *  - Ignores responses that are older than the state already shown.
 */
export function useBattle(battleId: string) {
  const [state, setState] = useState<BattleState | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [failures, setFailures] = useState(0);
  const [offset, setOffset] = useState(0);
  const latest = useRef<BattleState | null>(null);
  const inFlight = useRef(false);

  const apply = useCallback((s: BattleState, sentAt: number) => {
    const received = Date.now();
    const serverMs = new Date(s.server_now).getTime();
    // Server time at receipt ≈ server_now + half the round trip.
    setOffset(Math.round(serverMs + (received - sentAt) / 2 - received));
    const prev = latest.current;
    if (prev && new Date(prev.server_now).getTime() > serverMs && prev.battle.version >= s.battle.version) return;
    latest.current = s;
    setState(s);
    setError(null);
    setFailures(0);
  }, []);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const sentAt = Date.now();
    try {
      apply(await api.getBattleState(battleId), sentAt);
    } catch (e) {
      setError(e);
      setFailures((f) => f + 1);
    } finally {
      inFlight.current = false;
    }
  }, [battleId, apply]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const id = setInterval(() => {
      if (latest.current && TERMINAL.has(latest.current.battle.status)) return;
      refresh();
    }, POLL_MS);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel(`battle-${battleId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'battles', filter: `id=eq.${battleId}` }, () => { refresh(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [battleId, refresh]);

  const submit = useCallback(async (index: number, choice: number) => {
    const sentAt = Date.now();
    const s = await api.submitBattleAnswer(battleId, index, choice);
    apply(s, sentAt);
    return s.submission;
  }, [battleId, apply]);

  const ready = useCallback(async () => {
    const sentAt = Date.now();
    apply(await api.setBattleReady(battleId), sentAt);
  }, [battleId, apply]);

  const forfeit = useCallback(async () => {
    const sentAt = Date.now();
    apply(await api.forfeitBattle(battleId), sentAt);
  }, [battleId, apply]);

  const offline = failures >= 3 && toAppError(error).kind === 'network';
  return { state, error, offline, offset, refresh, submit, ready, forfeit };
}
