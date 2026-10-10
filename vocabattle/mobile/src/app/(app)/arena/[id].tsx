import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { optionStates, QuestionCard } from '@/components/learning/question-card';
import {
  AnimatedNumber, Avatar, Badge, Banner, Button, Card, ErrorView, Icon, LevelBadge, LoadingView, ProgressBar, Row, Screen, SectionHeader, Text,
} from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useBattle } from '@/hooks/use-battle';
import { useNow } from '@/hooks/use-now';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import type { BattlePlayer, BattleState } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

const REASON_TEXT: Record<string, string> = {
  not_active: 'The battle is not running.', stale_question: 'That question has already closed.',
  not_open: 'The question is not open yet.', too_late: 'Time was up before your answer arrived.',
  duplicate: 'You already answered this question.', invalid_choice: 'That choice is not valid.',
};

/** Active battle + results. Everything shown here is mirrored from the server. */
export default function BattleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const battle = useBattle(id!);
  const s = battle.state;
  const qc = useQueryClient();
  const status = s?.battle.status;

  useEffect(() => {
    if (status && ['completed', 'void', 'cancelled'].includes(status)) {
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['battle-lobby'] });
      qc.invalidateQueries({ queryKey: ['active-battle'] });
    }
  }, [status, qc]);

  if (!s) {
    if (battle.error) return <Screen title="Battle" back><ErrorView error={battle.error} onRetry={battle.refresh} /></Screen>;
    return <LoadingView label="Connecting to the battle…" />;
  }
  if (s.battle.status === 'pending') return <ReadyCheck s={s} battle={battle} />;
  if (s.battle.status === 'active') return <LiveBattle s={s} battle={battle} />;
  return <Results s={s} />;
}

type BattleHook = ReturnType<typeof useBattle>;

function PlayerCard({ p, me }: { p: BattlePlayer; me?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.player, { backgroundColor: colors.surface, borderColor: me ? colors.primary : colors.border }]}>
      <Avatar emoji={p.avatar} size={64} ring={p.ready ? 'success' : undefined} />
      <Text variant="bodyStrong" numberOfLines={1}>{p.alias}{me ? ' (you)' : ''}</Text>
      <LevelBadge level={p.level} />
      <Text variant="small" color="textMuted">Rating {p.rating}</Text>
      <Badge label={p.ready ? 'Ready' : 'Waiting…'} tone={p.ready ? 'success' : 'muted'} icon={p.ready ? 'checkmark' : 'time'} />
    </View>
  );
}

function ReadyCheck({ s, battle }: { s: BattleState; battle: BattleHook }) {
  const now = useNow(250, battle.offset);
  const left = Math.max(0, Math.ceil((new Date(s.battle.ready_deadline).getTime() - now) / 1000));
  const ready = useMutation({ mutationFn: battle.ready });
  const decline = useMutation({ mutationFn: battle.forfeit });
  return (
    <Screen title="Match found!" subtitle={s.battle.mode_name} scroll
      footer={
        <>
          <Button testID="battle-ready" title={s.me.ready ? 'Waiting for opponent…' : "I'm ready"} icon="flash" size="lg"
            disabled={s.me.ready} loading={ready.isPending} onPress={() => { haptic.tap(); ready.mutate(); }} />
          <Button title="Decline" variant="ghost" loading={decline.isPending} onPress={() => decline.mutate()} />
        </>
      }>
      <Row gap={Spacing.md} style={{ alignItems: 'stretch' }}>
        <PlayerCard p={s.me} me />
        <View style={{ justifyContent: 'center' }}><Text variant="h1" color="primary">VS</Text></View>
        <PlayerCard p={s.opponent} />
      </Row>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="bodyStrong">{s.battle.question_count} questions · {Math.round(s.battle.question_time_ms / 1000)}s each</Text>
          <Badge label={s.battle.rated ? 'Rated' : 'Unrated'} tone={s.battle.rated ? 'primary' : 'muted'} />
        </Row>
        <Text variant="small" color="textMuted">Both of you get the same questions. Correct answers score 100 points plus a speed bonus.</Text>
        {!s.battle.rated ? <Text variant="small" color="warning">You have played this opponent several times today, so this match won’t change ratings.</Text> : null}
      </Card>
      <Text align="center" color="textMuted" accessibilityLiveRegion="polite">Starting when both players are ready · {left}s</Text>
      {ready.error ? <Banner tone="danger" message={errorMessage(ready.error)} /> : null}
    </Screen>
  );
}

function Scoreboard({ s }: { s: BattleState }) {
  const { colors } = useTheme();
  const idx = s.battle.current_index;
  return (
    <View style={[styles.scoreboard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Row style={{ flex: 1 }} gap={Spacing.sm}>
        <Avatar emoji={s.me.avatar} size={36} ring="primary" />
        <View style={{ flex: 1 }}>
          <Text variant="tiny" color="textMuted" numberOfLines={1}>YOU</Text>
          <AnimatedNumber value={s.me.score} variant="h3" />
        </View>
      </Row>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text variant="tiny" color="textMuted" testID="battle-qindex">Q {Math.min(idx + 1, s.battle.question_count)}/{s.battle.question_count}</Text>
        <Row gap={3}>
          {Array.from({ length: s.battle.question_count }, (_, i) => (
            <View key={i} style={[styles.pip, { backgroundColor: i < idx ? colors.primary : i === idx ? colors.warning : colors.surfaceAlt }]} />
          ))}
        </Row>
      </View>
      <Row style={{ flex: 1, justifyContent: 'flex-end' }} gap={Spacing.sm}>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text variant="tiny" color="textMuted" numberOfLines={1}>{s.opponent.alias.toUpperCase()}</Text>
          <AnimatedNumber value={s.opponent.score} variant="h3" />
        </View>
        <View>
          <Avatar emoji={s.opponent.avatar} size={36} />
          <View style={[styles.presence, { backgroundColor: s.opponent.connected ? colors.success : colors.textFaint, borderColor: colors.surface }]} />
        </View>
      </Row>
    </View>
  );
}

function LiveBattle({ s, battle }: { s: BattleState; battle: BattleHook }) {
  const now = useNow(100, battle.offset);
  const [pick, setPick] = useState<{ idx: number; choice: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lastReveal = useRef<number | null>(null);
  const forfeit = useMutation({ mutationFn: battle.forfeit });
  const q = s.question;

  useEffect(() => {
    if (s.reveal && s.reveal.idx !== lastReveal.current) {
      lastReveal.current = s.reveal.idx;
      if (s.reveal.my_correct) haptic.success(); else haptic.error();
    }
  }, [s.reveal]);

  const answer = async (choice: number) => {
    if (!q || q.answered || pick?.idx === q.idx) return;
    setPick({ idx: q.idx, choice });
    setNotice(null);
    try {
      const sub = await battle.submit(q.idx, choice);
      if (sub && !sub.accepted) setNotice(REASON_TEXT[sub.reason ?? ''] ?? 'Answer not accepted.');
    } catch (e) {
      setPick(null);
      setNotice(errorMessage(e));
    }
  };

  const confirmForfeit = () => {
    if (Platform.OS === 'web') { forfeit.mutate(); return; }
    Alert.alert('Leave the battle?', 'Leaving counts as a loss.', [{ text: 'Stay', style: 'cancel' }, { text: 'Forfeit', style: 'destructive', onPress: () => forfeit.mutate() }]);
  };

  let body;
  if (q) {
    const deadline = new Date(q.deadline_at).getTime();
    const opens = new Date(q.opens_at).getTime();
    const remaining = Math.max(0, deadline - now);
    const selected = q.my_selected ?? (pick?.idx === q.idx ? pick.choice : null);
    const locked = q.answered || pick?.idx === q.idx;
    body = (
      <>
        <View style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="smallStrong" color={remaining < 4000 ? 'danger' : 'textMuted'} testID="battle-timer">⏱ {Math.ceil(remaining / 1000)}s</Text>
            <Badge label={q.opponent_answered ? 'Opponent locked in' : 'Opponent thinking…'} tone={q.opponent_answered ? 'warning' : 'muted'} icon={q.opponent_answered ? 'lock-closed' : 'ellipsis-horizontal'} />
          </Row>
          <ProgressBar value={remaining / Math.max(1, deadline - opens)} tone={remaining < 4000 ? 'danger' : 'primary'} height={6} />
        </View>
        <QuestionCard
          key={q.id}
          question={q}
          states={optionStates(q.options.length, { selected, reveal: false })}
          onSelect={answer}
          disabled={locked || remaining <= 0}
        />
        {locked ? <Banner tone="info" icon="lock-closed" message="Answer locked in. The correct answer is revealed when both players answer or time runs out." /> : null}
        {remaining <= 0 && !locked ? <Banner tone="warning" message="Time's up!" /> : null}
      </>
    );
  } else if (s.reveal && s.reveal.idx === s.battle.current_index - 1) {
    const r = s.reveal;
    const nextIn = s.next_question_at ? Math.max(0, Math.ceil((new Date(s.next_question_at).getTime() - now) / 1000)) : 0;
    body = (
      <>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="h3" color={r.my_correct ? 'success' : 'danger'} testID="battle-reveal">{r.my_correct ? `Correct! +${r.my_points}` : r.my_selected === null ? 'No answer' : 'Not quite'}</Text>
          <Badge label={r.opponent_correct ? `Opponent +${r.opponent_points}` : 'Opponent missed'} tone={r.opponent_correct ? 'warning' : 'muted'} />
        </Row>
        <QuestionCard question={{ prompt: r.prompt, sentence: r.sentence, options: r.options, type: 'meaning' }} showType={false}
          states={optionStates(r.options.length, { selected: r.my_selected, correct: r.correct_index, reveal: true })} onSelect={() => {}} disabled />
        {r.explanation ? <Text variant="small" color="textMuted">{r.explanation}</Text> : null}
        <Text align="center" color="textMuted">Next question in {nextIn}s</Text>
      </>
    );
  } else {
    const startIn = s.next_question_at ? Math.max(0, Math.ceil((new Date(s.next_question_at).getTime() - now) / 1000)) : 0;
    body = (
      <View style={{ alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl }}>
        <Text variant="h2">Get ready…</Text>
        <Text variant="display" color="primary" style={{ fontSize: 64, lineHeight: 72 }}>{startIn || 'GO'}</Text>
        <Text color="textMuted">{s.battle.mode_name} · {s.battle.question_count} questions</Text>
      </View>
    );
  }

  return (
    <Screen title={s.battle.mode_name} right={<Button title="Forfeit" variant="ghost" size="sm" loading={forfeit.isPending} onPress={confirmForfeit} testID="battle-forfeit" />}>
      {battle.offline ? <Banner tone="warning" icon="cloud-offline" message="Connection lost — reconnecting. Stay on this screen; you have 30 seconds before the match is decided." /> : null}
      <Scoreboard s={s} />
      {!s.opponent.connected ? <Banner tone="warning" message={`${s.opponent.alias} seems to be disconnected. If they don't return within 30 seconds, you win.`} /> : null}
      {notice ? <Banner tone="warning" message={notice} /> : null}
      {body}
    </Screen>
  );
}

function Results({ s }: { s: BattleState }) {
  const r = s.result;
  const qc = useQueryClient();
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [blocked, setBlocked] = useState(false);
  const save = useMutation({ mutationFn: (entryId: string) => api.saveWord(entryId, 'battle'), onSuccess: (_, e) => { setSaved((x) => new Set(x).add(e)); qc.invalidateQueries({ queryKey: ['saved-words'] }); } });
  const block = useMutation({ mutationFn: () => api.blockOpponent(s.battle.id), onSuccess: () => setBlocked(true) });
  const again = () => router.replace({ pathname: '/arena/matchmaking', params: { mode: s.battle.mode } });

  if (s.battle.status === 'cancelled') {
    return (
      <Screen title="Match cancelled" back footer={<><Button title="Find another opponent" icon="flash" size="lg" onPress={again} testID="battle-again" /><Button title="Back to lobby" variant="ghost" onPress={() => router.replace('/battle')} /></>}>
        <Banner tone="info" message={s.battle.end_reason === 'ready_timeout' ? 'Your opponent did not get ready in time. No battle was used from your daily allowance.' : 'The match was declined before it started.'} />
      </Screen>
    );
  }

  const outcome = s.battle.status === 'void' ? 'void' : r?.my_result ?? 'draw';
  const headline = { win: 'Victory!', loss: 'Defeat', draw: 'Draw', void: 'Match voided', cancelled: 'Cancelled' }[outcome];
  const tone = outcome === 'win' ? 'success' : outcome === 'loss' ? 'danger' : 'info';

  return (
    <Screen title="Battle results" footer={
      <>
        <Button testID="battle-again" title="Play again" icon="flash" size="lg" onPress={again} />
        <Button title="Back to lobby" variant="ghost" onPress={() => router.replace('/battle')} />
      </>
    }>
      <Card tone={tone} style={{ alignItems: 'center', paddingVertical: Spacing.xl }}>
        <Text variant="display" testID="battle-outcome">{headline}</Text>
        <Row gap={Spacing.xl}>
          <View style={{ alignItems: 'center' }}><Avatar emoji={s.me.avatar} /><Text variant="h2">{s.me.score}</Text><Text variant="tiny" color="textMuted">YOU · {s.me.correct}/{s.battle.question_count}</Text></View>
          <Text variant="h2" color="textMuted">–</Text>
          <View style={{ alignItems: 'center' }}><Avatar emoji={s.opponent.avatar} /><Text variant="h2">{s.opponent.score}</Text><Text variant="tiny" color="textMuted">{s.opponent.alias.toUpperCase()} · {s.opponent.correct}/{s.battle.question_count}</Text></View>
        </Row>
        {outcome === 'void' ? (
          <Text align="center" color="textMuted">{s.battle.end_reason === 'both_disconnected' ? 'Both players lost connection.' : 'The match could not be completed.'} No rating change, and the battle was not counted against your daily allowance.</Text>
        ) : (
          <Row gap={Spacing.lg}>
            <View style={{ alignItems: 'center' }}>
              <AnimatedNumber value={r?.rating_after ?? s.me.rating} variant="h2" />
              <Text variant="small" color={(r?.rating_delta ?? 0) >= 0 ? 'success' : 'danger'} testID="battle-rating-delta">
                {(r?.rating_delta ?? 0) >= 0 ? '+' : ''}{r?.rating_delta ?? 0} rating{r?.rated ? '' : ' (unrated)'}
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}><AnimatedNumber value={r?.xp ?? 0} prefix="+" variant="h2" color="primary" /><Text variant="small" color="textMuted">XP</Text></View>
          </Row>
        )}
        {s.battle.end_reason === 'opponent_disconnected' ? <Text variant="small" color="textMuted">{outcome === 'win' ? 'Your opponent disconnected.' : 'You were disconnected for too long.'}</Text> : null}
        {s.battle.end_reason === 'forfeit' ? <Text variant="small" color="textMuted">{outcome === 'win' ? 'Your opponent left the battle.' : 'You left the battle.'}</Text> : null}
      </Card>

      {r?.questions?.length ? (
        <>
          <SectionHeader title="Question review" />
          {r.questions.map((q) => (
            <Card key={q.idx}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text variant="smallStrong" style={{ flex: 1 }}>{q.sentence ?? q.prompt}</Text>
                <Icon name={q.my_correct ? 'checkmark-circle' : 'close-circle'} color={q.my_correct ? 'success' : 'danger'} />
              </Row>
              <Text variant="small" color="success">Answer: {q.correct_answer}</Text>
              {!q.my_correct ? <Text variant="small" color="danger">You: {q.my_answer ?? 'no answer'}</Text> : null}
              {q.explanation ? <Text variant="small" color="textMuted">{q.explanation}</Text> : null}
              {q.entry_id ? (
                <Button title={saved.has(q.entry_id) ? 'Saved' : 'Save word'} icon={saved.has(q.entry_id) ? 'bookmark' : 'bookmark-outline'} variant="ghost" size="sm"
                  disabled={saved.has(q.entry_id)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} onPress={() => save.mutate(q.entry_id!)} />
              ) : null}
            </Card>
          ))}
        </>
      ) : null}

      <SectionHeader title="Opponent" />
      <Card>
        <Row gap={Spacing.md}>
          <Avatar emoji={s.opponent.avatar} size={36} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>{s.opponent.alias}</Text>
          <Button title="Report" variant="secondary" size="sm" icon="flag" onPress={() => router.push({ pathname: '/report', params: { battle: s.battle.id, alias: s.opponent.alias } })} />
          <Button title={blocked ? 'Blocked' : 'Block'} variant="danger" size="sm" icon="ban" disabled={blocked} loading={block.isPending} onPress={() => block.mutate()} />
        </Row>
        {blocked ? <Text variant="small" color="textMuted">You won’t be matched with this player again. Manage blocks in Privacy settings.</Text> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  player: { flex: 1, alignItems: 'center', gap: 6, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1.5 },
  scoreboard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  pip: { width: 8, height: 8, borderRadius: 4 },
  presence: { position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
});
