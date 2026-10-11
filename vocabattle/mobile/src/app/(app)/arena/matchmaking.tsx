import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { Banner, Button, Icon, Screen, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { toAppError } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';

const POLL_MS = 2000;

/** Matchmaking: keeps the player in the queue (each call also widens the search) until paired. */
export default function Matchmaking() {
  const { mode = 'vocab_duel' } = useLocalSearchParams<{ mode?: string }>();
  const { colors } = useTheme();
  const { session } = useAuth();
  const [waited, setWaited] = useState(0);
  const [error, setError] = useState<ReturnType<typeof toAppError> | null>(null);
  const [preference, setPreference] = useState<string>('any');
  const done = useRef(false);
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const go = (battleId: string) => {
      if (done.current) return;
      done.current = true;
      haptic.success();
      router.replace(`/arena/${battleId}`);
    };
    const tick = async () => {
      if (done.current) return;
      try {
        const r = await api.joinMatchmaking(mode);
        if (r.battle_id && r.status !== 'waiting') return go(r.battle_id);
        setWaited(r.waited_seconds ?? 0);
        setPreference(r.gender_preference ?? 'any');
        setError(null);
      } catch (e) {
        const err = toAppError(e);
        setError(err);
        if (err.kind !== 'network' && err.kind !== 'rate_limit') return; // stop on business-rule errors
      }
      timer = setTimeout(tick, POLL_MS);
    };
    tick();

    // Realtime nudge: our own queue row flips to 'matched' when someone pairs with us.
    const channel = supabase
      .channel(`queue-${session?.user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matchmaking_queue', filter: `user_id=eq.${session?.user.id}` },
        (payload) => { const row = payload.new as { status?: string; battle_id?: string }; if (row.status === 'matched' && row.battle_id) go(row.battle_id); })
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
      if (!done.current) api.cancelMatchmaking().catch(() => {});
    };
  }, [mode, session?.user.id]);

  const cancel = async () => {
    try {
      const r = await api.cancelMatchmaking();
      if (r.battle_id) { done.current = true; router.replace(`/arena/${r.battle_id}`); return; }
    } catch { /* leaving anyway */ }
    done.current = true;
    router.back();
  };

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <Screen title="Finding an opponent" back={false} scroll={false}
      footer={<Button testID="matchmaking-cancel" title="Cancel" variant="secondary" size="lg" onPress={cancel} />}>
      <View style={styles.center}>
        <View style={styles.radar}>
          <Animated.View style={[styles.ring, { borderColor: colors.primary, transform: [{ scale }], opacity }]} />
          <View style={[styles.core, { backgroundColor: colors.primary }]}><Icon name="flash" size={40} rawColor="#fff" /></View>
        </View>
        <Text variant="h2" align="center" testID="matchmaking-status">{error && error.kind !== 'network' ? 'Matchmaking stopped' : 'Searching…'}</Text>
        <Text color="textMuted" align="center">
          {waited < 15 ? 'Looking for a learner at your level and rating.' : waited < 45 ? 'Widening the search to nearby levels…' : 'Still searching — any available opponent will do.'}
        </Text>
        <Text variant="h3" color="primary">{Math.floor(waited / 60)}:{String(waited % 60).padStart(2, '0')}</Text>
        {preference !== 'any' ? (
          <Banner tone="info" message={`Opponent preference: ${preference}. Matching depends on who is available, so it can take longer. You can switch to “anyone” in privacy settings.`} />
        ) : null}
        {error ? (
          <Banner tone={error.kind === 'network' ? 'warning' : 'danger'} message={error.message}>
            {error.kind === 'quota' ? <Button title="See Premium" variant="ghost" size="sm" style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} onPress={() => router.replace('/subscription')} /> : null}
          </Banner>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingBottom: Spacing.xxl },
  radar: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  ring: { position: 'absolute', width: 110, height: 110, borderRadius: Radius.pill, borderWidth: 3 },
  core: { width: 96, height: 96, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
