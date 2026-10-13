import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CALL_MODES, CALL_TOPICS, REPORT_REASONS, type CallMode, type IceServer, type LevelPreference, type ServerMessage } from '@fluentpath/shared';
import { Badge, Button, Card, Chip, Empty, H2, Input, Notice, P, Row, Screen } from '../../src/components/ui';
import { api, errorMessage } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { realtime, useRealtimeStatus } from '../../src/lib/realtime';
import { useTheme } from '../../src/lib/theme';
import { useApi } from '../../src/lib/useApi';
import { AudioPeer, getMicrophone } from '../../src/lib/webrtc';
import type { MediaStream } from 'react-native-webrtc';

type Phase = 'setup' | 'searching' | 'matched' | 'connecting' | 'live' | 'ended';
interface HistoryItem { id: string; partnerAlias: string; partnerBlocked: boolean; mode: string; topic: string; status: string; endReason: string | null; durationSec: number | null; matchedAt: string }
type Match = Extract<ServerMessage, { type: 'call.matched' }>;

const END_REASONS: Record<string, string> = {
  ended: 'The call ended.', you_disconnected: 'You lost connection to the call.', partner_disconnected: 'Your partner disconnected.', connection_failed: 'The audio connection could not be established. One of you may be behind a restrictive network (a TURN relay server is needed for those networks).', reported: 'The call was ended after a report.', blocked: 'The call was ended.',
};

export default function Speak() {
  const { me, refresh } = useAuth();
  const t = useTheme();
  const status = useRealtimeStatus();
  const [tab, setTab] = useState<'call' | 'history'>('call');
  const [mode, setMode] = useState<CallMode>('general');
  const [topic, setTopic] = useState<string>('any');
  const [level, setLevel] = useState<LevelPreference>('similar');
  const [phase, setPhase] = useState<Phase>('setup');
  const [match, setMatch] = useState<Match | null>(null);
  const [alias, setAlias] = useState('');
  const [muted, setMuted] = useState(false);
  const [partnerMuted, setPartnerMuted] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState<{ callId: string; reason: string; durationSec: number; alias: string } | null>(null);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [reportFor, setReportFor] = useState<{ callId: string; alias: string } | null>(null);
  const history = useApi<{ calls: HistoryItem[] }>(tab === 'history' ? '/api/calls/history' : null, [tab]);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const matchRef = useRef(match);
  matchRef.current = match;
  const aliasRef = useRef(alias);
  aliasRef.current = alias;
  const callId = useRef<string | null>(null);
  const mic = useRef<MediaStream | null>(null);
  const peer = useRef<AudioPeer | null>(null);
  const failTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const lastGen = useRef(realtime.generation);

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(i); }, []);

  const stopMic = useCallback(() => {
    mic.current?.getTracks().forEach((x) => x.stop());
    mic.current = null;
  }, []);
  const teardown = useCallback(() => {
    clearTimeout(failTimer.current);
    peer.current?.close();
    peer.current = null;
  }, []);
  const finish = useCallback((id: string, reason: string, durationSec: number) => {
    teardown();
    stopMic();
    callId.current = null;
    setEnded({ callId: id, reason, durationSec, alias: aliasRef.current });
    setPhase('ended');
    setMuted(false);
    setPartnerMuted(false);
    setReconnecting(false);
    setConnectedAt(null);
    refresh().catch(() => {});
  }, [teardown, stopMic, refresh]);

  const startPeer = useCallback((id: string, role: 'offerer' | 'answerer', ice: IceServer[]) => {
    teardown();
    if (!mic.current) return;
    const p = new AudioPeer(ice, mic.current, role, (data) => realtime.send({ type: 'call.signal', callId: id, data }), (s) => {
      if (s === 'connected') {
        clearTimeout(failTimer.current);
        setPhase('live');
        setConnectedAt((c) => c ?? Date.now());
        realtime.send({ type: 'call.connected', callId: id });
      }
      if (s === 'failed' || s === 'disconnected') {
        if (s === 'failed') p.restart();
        clearTimeout(failTimer.current);
        failTimer.current = setTimeout(() => { if (p.pc.connectionState !== 'connected') realtime.send({ type: 'call.end', callId: id, reason: 'connection_failed' }); }, 15_000);
      }
    });
    p.setMuted(mutedRef.current);
    peer.current = p;
    failTimer.current = setTimeout(() => { if (p.pc.connectionState !== 'connected') realtime.send({ type: 'call.end', callId: id, reason: 'connection_failed' }); }, 25_000);
  }, [teardown]);

  useEffect(() => realtime.subscribe(async (m) => {
    switch (m.type) {
      case 'call.queued':
        if (phaseRef.current !== 'searching' && phaseRef.current !== 'matched') setPhase('searching');
        break;
      case 'call.queue.left':
        setPhase('setup');
        stopMic();
        break;
      case 'call.matched':
        setMatch(m);
        setAlias(m.partnerAlias);
        setNote(null);
        setPhase('matched');
        break;
      case 'call.declined':
        if (m.byYou) { setPhase('setup'); stopMic(); } else { setNote('Your match did not accept. Looking for someone else…'); setPhase('searching'); }
        setMatch(null);
        break;
      case 'call.start':
        callId.current = m.callId;
        setAlias(m.partnerAlias);
        setPhase((p) => (p === 'live' ? 'live' : 'connecting'));
        startPeer(m.callId, m.role, m.iceServers);
        break;
      case 'call.signal':
        if (m.callId === callId.current) await peer.current?.handleSignal(m.data as never).catch(() => {});
        break;
      case 'call.partner_mute':
        setPartnerMuted(m.muted);
        break;
      case 'call.partner_status':
        setReconnecting(m.status === 'reconnecting');
        break;
      case 'call.ended':
        if (callId.current === m.callId || matchRef.current?.callId === m.callId || phaseRef.current === 'connecting') finish(m.callId, m.reason, m.durationSec);
        break;
      case 'error':
        setError(m.message);
        if (['limit_reached', 'calls_disabled', 'already_in_call', 'already_queued', 'account_inactive'].includes(m.code)) { setPhase('setup'); stopMic(); }
        break;
    }
  }), [finish, startPeer, stopMic]);

  // Rejoin an active call after the socket reconnects (e.g. network change).
  useEffect(() => {
    if (status !== 'open' || realtime.generation === lastGen.current) return;
    lastGen.current = realtime.generation;
    if (callId.current && mic.current) {
      setPhase('connecting');
      realtime.send({ type: 'call.rejoin', callId: callId.current });
    }
  }, [status]);

  // Leaving the tab while searching cancels the search; an active call keeps running.
  useFocusEffect(useCallback(() => () => {
    if (phaseRef.current === 'searching') realtime.send({ type: 'call.queue.leave' });
    if (phaseRef.current === 'matched' && matchRef.current) realtime.send({ type: 'call.decline', callId: matchRef.current.callId });
  }, []));
  useEffect(() => () => { if (callId.current) realtime.send({ type: 'call.end', callId: callId.current }); teardown(); stopMic(); }, [teardown, stopMic]);

  const find = async () => {
    setError(null);
    setEnded(null);
    setNote(null);
    if (status !== 'open') return setError('Not connected to the server yet. Please wait a moment.');
    try {
      mic.current ??= await getMicrophone();
    } catch {
      return setError('Microphone access is needed for voice calls. Allow it in system settings.');
    }
    setPhase('searching');
    realtime.send({ type: 'call.queue.join', mode, topic: topic as never, level });
  };
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    peer.current?.setMuted(next);
    if (callId.current) realtime.send({ type: 'call.mute', callId: callId.current, muted: next });
  };
  const block = (id: string) => Alert.alert('Block this user?', 'You will not be matched with them again.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Block', style: 'destructive', onPress: async () => { try { await api.post(`/api/calls/${id}/block`); history.reload(); Alert.alert('Blocked', 'You will not be matched with this user again.'); } catch (e) { Alert.alert('Error', errorMessage(e)); } } }]);

  if (!me) return null;
  const callsLeft = me.limits.voice_call == null ? null : Math.max(0, me.limits.voice_call - (me.usage.voice_call ?? 0));
  const elapsed = connectedAt ? Math.floor((now - connectedAt) / 1000) : 0;
  const acceptLeft = match ? Math.max(0, Math.ceil((match.expiresAt - now) / 1000)) : 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (reportFor) return <ReportForm target={reportFor} onDone={() => { setReportFor(null); history.reload(); }} />;

  return (
    <Screen onRefresh={tab === 'history' ? history.reload : undefined}>
      <Row>
        <Badge text={status === 'open' ? 'Connected' : status === 'connecting' ? 'Connecting…' : 'Offline — reconnecting'} tone={status === 'open' ? 'green' : 'amber'} />
        {callsLeft != null && <Badge text={`${callsLeft} free calls left today`} tone="slate" />}
      </Row>
      <Row><Chip label="Find a partner" selected={tab === 'call'} onPress={() => setTab('call')} /><Chip label="Call history" selected={tab === 'history'} onPress={() => setTab('history')} /></Row>
      {error && <Notice tone="error" text={error} />}
      {tab === 'history' ? (
        history.data?.calls.length === 0 ? <Empty title="No calls yet" /> : history.data?.calls.map((c) => (
          <Card key={c.id}>
            <Row><Text style={{ color: t.text, fontWeight: '700', flex: 1 }}>{c.partnerAlias}</Text><Badge text={c.status} tone="slate" /></Row>
            <P muted>{new Date(c.matchedAt).toLocaleString()} · {c.mode.replace('_', ' ')} · {c.topic}{c.durationSec ? ` · ${fmt(c.durationSec)}` : ''}</P>
            <Row>
              {!c.partnerBlocked ? <Button small variant="secondary" title="Block" onPress={() => block(c.id)} /> : <Badge text="Blocked" tone="red" />}
              <Button small variant="secondary" title="Report" onPress={() => setReportFor({ callId: c.id, alias: c.partnerAlias })} />
            </Row>
          </Card>
        ))
      ) : phase === 'setup' || phase === 'ended' ? (
        <>
          {ended && (
            <Card>
              <H2>Call with {ended.alias} ended</H2>
              <P>{END_REASONS[ended.reason] ?? 'The call ended.'}{ended.durationSec ? ` Duration ${fmt(ended.durationSec)}.` : ''}</P>
              <Row><Button small variant="secondary" title="Block" onPress={() => block(ended.callId)} /><Button small variant="secondary" title="Report" onPress={() => setReportFor({ callId: ended.callId, alias: ended.alias })} /></Row>
            </Card>
          )}
          <Notice text="You appear under a random name. Never share personal details. You can block or report anyone." />
          {!me.settings.allowCalls && <Notice tone="warning" text="Voice calls are turned off in your settings." />}
          <H2>Mode</H2>
          <Row>{CALL_MODES.map((m) => <Chip key={m.id} label={m.label} selected={mode === m.id} onPress={() => setMode(m.id)} />)}</Row>
          <H2>Topic</H2>
          <Row>{CALL_TOPICS.map((x) => <Chip key={x} label={x} selected={topic === x} onPress={() => setTopic(x)} />)}</Row>
          <H2>Partner level</H2>
          <Row><Chip label="Similar to mine" selected={level === 'similar'} onPress={() => setLevel('similar')} /><Chip label="Any level" selected={level === 'any'} onPress={() => setLevel('any')} /></Row>
          <Button title="Find a partner" onPress={find} disabled={status !== 'open' || !me.settings.allowCalls || callsLeft === 0} />
        </>
      ) : phase === 'searching' ? (
        <Card>
          <H2>Looking for a partner…</H2>
          {note && <P muted>{note}</P>}
          <Button variant="secondary" title="Cancel" onPress={() => realtime.send({ type: 'call.queue.leave' })} />
        </Card>
      ) : phase === 'matched' && match ? (
        <Card>
          <H2>Match found: {match.partnerAlias}</H2>
          <P muted>{CALL_MODES.find((m) => m.id === match.mode)?.label} · {match.topic}{match.partnerLevel ? ` · level ${match.partnerLevel}` : ''}</P>
          <P>{match.prompt}</P>
          <Row>
            <Button variant="secondary" title="Skip" onPress={() => realtime.send({ type: 'call.decline', callId: match.callId })} />
            <Button variant="success" title={`Accept (${acceptLeft}s)`} onPress={() => realtime.send({ type: 'call.accept', callId: match.callId })} />
          </Row>
        </Card>
      ) : (
        <Card>
          <H2>{phase === 'live' ? `In call with ${alias}` : `Connecting to ${alias}…`}</H2>
          {phase === 'live' && <Text style={{ color: t.text, fontSize: 32, fontWeight: '800' }}>{fmt(elapsed)}</Text>}
          {match?.prompt && <P muted>{match.prompt}</P>}
          {partnerMuted && <Badge text="Partner is muted" tone="amber" />}
          {reconnecting && <Badge text="Partner is reconnecting…" tone="amber" />}
          <Row>
            <Button variant="secondary" title={muted ? 'Unmute' : 'Mute'} onPress={toggleMute} />
            <Button variant="danger" title="End call" onPress={() => callId.current && realtime.send({ type: 'call.end', callId: callId.current })} />
          </Row>
          {callId.current && <Button small variant="ghost" title="Report this user" onPress={() => setReportFor({ callId: callId.current!, alias })} />}
        </Card>
      )}
    </Screen>
  );
}

function ReportForm({ target, onDone }: { target: { callId: string; alias: string }; onDone: () => void }) {
  const [reason, setReason] = useState<string>('harassment');
  const [details, setDetails] = useState('');
  const [block, setBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    setBusy(true);
    try {
      await api.post(`/api/calls/${target.callId}/report`, { reason, details: details.trim(), block });
      Alert.alert('Report sent', 'Thank you. Our moderators will review it.');
      onDone();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <H2>Report {target.alias}</H2>
      <Row>{REPORT_REASONS.map((r) => <Chip key={r.id} label={r.label} selected={reason === r.id} onPress={() => setReason(r.id)} />)}</Row>
      <Input label="Details (optional)" value={details} onChangeText={setDetails} multiline maxLength={1000} />
      <Chip label={block ? '✓ Also block this user' : 'Also block this user'} selected={block} onPress={() => setBlock(!block)} />
      {err && <Notice tone="error" text={err} />}
      <Button title="Send report" loading={busy} onPress={send} />
      <Button variant="secondary" title="Cancel" onPress={onDone} />
    </Screen>
  );
}
