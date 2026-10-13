import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Ban, Flag, Mic, MicOff, Phone, PhoneOff, Shield, Users, Wifi, WifiOff } from 'lucide-react';
import { CALL_MODES, CALL_TOPICS, type CallMode, type IceServer, type ServerMessage } from '@fluentpath/shared';
import { Alert, Badge, Button, Card, CardHeader, ChoiceChip, EmptyState, PageHeader, Select, Spinner, Tabs, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useMe } from '../../lib/auth';
import { formatDateTime, formatDuration } from '../../lib/format';
import { realtime, useRealtimeStatus } from '../../lib/realtime';
import { useApi } from '../../lib/useApi';
import { AudioPeer, getMicrophone, type PeerState } from '../../lib/webrtc';
import { ReportDialog } from './ReportDialog';

type Phase = 'setup' | 'searching' | 'matched' | 'connecting' | 'live' | 'ended';
interface Match { callId: string; partnerAlias: string; partnerLevel: string | null; mode: CallMode; topic: string; prompt: string; expiresAt: number }
interface CallHistoryItem { id: string; partnerAlias: string; partnerBlocked: boolean; mode: string; topic: string; status: string; endReason: string | null; durationSec: number; matchedAt: string }

const END_REASONS: Record<string, string> = {
  hung_up: 'The call has ended.',
  partner_disconnected: 'Your partner lost their connection and did not come back.',
  you_disconnected: 'You were disconnected for too long, so the call ended.',
  connection_failed: 'The audio connection could not be established. This can happen on networks that block direct connections (a TURN relay server is needed).',
  not_accepted: 'The match expired because it was not accepted in time.',
  blocked: 'The call ended because a participant blocked the other.',
  reported: 'The call ended because a report was submitted.',
  not_found: 'This call is no longer active.',
};
const STORAGE_KEY = 'fp-active-call';

export default function Speak() {
  const me = useMe();
  const toast = useToast();
  const status = useRealtimeStatus();
  const [tab, setTab] = useState<'call' | 'history'>('call');
  const [phase, setPhase] = useState<Phase>('setup');
  const [mode, setMode] = useState<CallMode>('general');
  const [topic, setTopic] = useState<string>('any');
  const [level, setLevel] = useState<'similar' | 'any'>('any');
  const [queueInfo, setQueueInfo] = useState<{ position: number; waiting: number } | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [partnerAlias, setPartnerAlias] = useState('');
  const [peerState, setPeerState] = useState<PeerState>('new');
  const [muted, setMuted] = useState(false);
  const [partnerMuted, setPartnerMuted] = useState(false);
  const [partnerReconnecting, setPartnerReconnecting] = useState(false);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [ended, setEnded] = useState<{ callId: string; reason: string; durationSec: number; alias: string } | null>(null);
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const [reportFor, setReportFor] = useState<{ callId: string; alias: string } | null>(null);
  const [searchingNote, setSearchingNote] = useState<string | null>(null);
  const history = useApi<{ calls: CallHistoryItem[] }>(tab === 'history' || phase === 'ended' ? '/api/calls/history' : null, [tab, phase]);
  const stats = useApi<{ calls: { waiting: number; byMode: Record<string, number>; activeCalls: number } }>('/api/realtime/status', [phase]);

  const micRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<AudioPeer | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const callIdRef = useRef<string | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const failTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastGen = useRef(realtime.generation);
  // Read once at first render: a call that was active before a page reload.
  const restoreId = useRef<string | null>(sessionStorage.getItem(STORAGE_KEY));
  const partnerAliasRef = useRef('');
  partnerAliasRef.current = partnerAlias;
  const matchRef = useRef<Match | null>(null);
  matchRef.current = match;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const stopMic = useCallback(() => {
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
  }, []);

  const teardown = useCallback(() => {
    clearTimeout(failTimer.current);
    peerRef.current?.close();
    peerRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
  }, []);

  const finish = useCallback(
    (callId: string, reason: string, durationSec: number) => {
      teardown();
      stopMic();
      sessionStorage.removeItem(STORAGE_KEY);
      callIdRef.current = null;
      setEnded({ callId, reason, durationSec, alias: partnerAliasRef.current });
      setPhase('ended');
      setMuted(false);
      setPartnerMuted(false);
      setPartnerReconnecting(false);
      setConnectedAt(null);
    },
    [teardown, stopMic],
  );
  const startPeer = useCallback(
    (callId: string, role: 'offerer' | 'answerer', iceServers: IceServer[]) => {
      teardown();
      if (!micRef.current) return;
      const peer = new AudioPeer(
        iceServers,
        micRef.current,
        role,
        (data) => realtime.send({ type: 'call.signal', callId, data }),
        (s) => {
          setPeerState(s);
          if (s === 'connected') {
            clearTimeout(failTimer.current);
            setPhase('live');
            setConnectedAt((c) => c ?? Date.now());
            realtime.send({ type: 'call.connected', callId });
          }
          if (s === 'failed' || s === 'disconnected') {
            if (s === 'failed') peer.restart();
            clearTimeout(failTimer.current);
            failTimer.current = setTimeout(() => {
              if (peer.pc.connectionState !== 'connected') realtime.send({ type: 'call.end', callId, reason: 'connection_failed' });
            }, 15_000);
          }
        },
      );
      peer.setMuted(muted);
      peerRef.current = peer;
      if (audioRef.current) {
        audioRef.current.srcObject = peer.remoteStream;
        audioRef.current.play().catch(() => {});
      }
      // Give up if no connection within 25 seconds.
      failTimer.current = setTimeout(() => {
        if (peer.pc.connectionState !== 'connected') realtime.send({ type: 'call.end', callId, reason: 'connection_failed' });
      }, 25_000);
    },
    [teardown, muted],
  );

  const onMessage = useCallback(
    async (m: ServerMessage) => {
      switch (m.type) {
        case 'call.queued':
          setQueueInfo({ position: m.position, waiting: m.waiting });
          if (phaseRef.current !== 'searching' && phaseRef.current !== 'matched') setPhase('searching');
          break;
        case 'call.queue.left':
          setPhase('setup');
          stopMic();
          break;
        case 'call.matched':
          setMatch(m);
          setPartnerAlias(m.partnerAlias);
          setAccepted(false);
          setSearchingNote(null);
          setPhase('matched');
          try {
            new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=').play().catch(() => {});
          } catch {
            /* ignore */
          }
          break;
        case 'call.declined':
          if (m.byYou) {
            setPhase('setup');
            stopMic();
          } else {
            setSearchingNote('Your match did not accept. Looking for someone else…');
            setPhase('searching');
          }
          setMatch(null);
          break;
        case 'call.start':
          callIdRef.current = m.callId;
          sessionStorage.setItem(STORAGE_KEY, m.callId);
          setPartnerAlias(m.partnerAlias);
          setPhase((p) => (p === 'live' ? 'live' : 'connecting'));
          startPeer(m.callId, m.role, m.iceServers);
          break;
        case 'call.signal':
          if (m.callId === callIdRef.current) await peerRef.current?.handleSignal(m.data as never).catch(() => {});
          break;
        case 'call.partner_mute':
          setPartnerMuted(m.muted);
          break;
        case 'call.partner_status':
          setPartnerReconnecting(m.status === 'reconnecting');
          break;
        case 'call.ended':
          if (callIdRef.current === m.callId || matchRef.current?.callId === m.callId || sessionStorage.getItem(STORAGE_KEY) === m.callId || phaseRef.current === 'connecting') finish(m.callId, m.reason, m.durationSec);
          break;
        case 'error':
          setError({ code: m.code, message: m.message });
          if (['limit_reached', 'calls_disabled', 'already_in_call', 'already_queued', 'account_inactive'].includes(m.code)) {
            setPhase('setup');
            stopMic();
          }
          break;
      }
    },
    [finish, startPeer, stopMic],
  );

  useEffect(() => realtime.subscribe(onMessage), [onMessage]);

  // After a socket reconnect (or page reload during a call), rejoin the active call.
  useEffect(() => {
    if (status !== 'open') return;
    const stored = restoreId.current;
    if (realtime.generation !== lastGen.current || (stored && !callIdRef.current)) {
      lastGen.current = realtime.generation;
      const id = callIdRef.current ?? stored;
      restoreId.current = null;
      if (id) {
        (async () => {
          try {
            micRef.current ??= await getMicrophone();
            setPhase('connecting');
            realtime.send({ type: 'call.rejoin', callId: id });
          } catch (e) {
            setError({ message: (e as Error).message });
          }
        })();
      }
    }
  }, [status]);

  // Warn before leaving the page during a call, and clean up on unmount.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (phaseRef.current === 'live' || phaseRef.current === 'connecting') e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      if (phaseRef.current === 'searching') realtime.send({ type: 'call.queue.leave' });
      if (phaseRef.current === 'matched' && matchRef.current) realtime.send({ type: 'call.decline', callId: matchRef.current.callId });
      if (callIdRef.current) realtime.send({ type: 'call.end', callId: callIdRef.current });
      sessionStorage.removeItem(STORAGE_KEY);
      teardown();
      stopMic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const findPartner = async () => {
    setError(null);
    setEnded(null);
    setSearchingNote(null);
    if (status !== 'open') return setError({ message: 'Not connected to the server yet. Please wait a moment and try again.' });
    try {
      micRef.current ??= await getMicrophone();
    } catch (e) {
      return setError({ message: (e as Error).message });
    }
    setQueueInfo(null);
    setPhase('searching');
    realtime.send({ type: 'call.queue.join', mode, topic: topic as never, level });
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    peerRef.current?.setMuted(next);
    if (callIdRef.current) realtime.send({ type: 'call.mute', callId: callIdRef.current, muted: next });
  };

  const block = async (callId: string) => {
    try {
      await api.post(`/api/calls/${callId}/block`);
      toast('User blocked. You will not be matched with them again.');
      history.reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const elapsed = connectedAt ? Math.floor((now - connectedAt) / 1000) : 0;
  const acceptLeft = match ? Math.max(0, Math.ceil((match.expiresAt - now) / 1000)) : 0;
  const modeInfo = CALL_MODES.find((m) => m.id === (match?.mode ?? mode));
  const callsLeft = me.limits.voice_call == null ? null : Math.max(0, me.limits.voice_call - (me.usage.voice_call ?? 0));

  return (
    <div>
      <PageHeader eyebrow="Speak & play" title="Voice practice" description="Talk with another English learner in real time. You both appear under random names — no profiles, emails or numbers are shared." />
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className={`inline-flex items-center gap-1.5 ${status === 'open' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700'}`}>{status === 'open' ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}{status === 'open' ? 'Connected' : status === 'connecting' ? 'Connecting…' : 'Offline — reconnecting'}</span>
        {stats.data && <span className="muted inline-flex items-center gap-1.5"><Users className="h-4 w-4" /> {stats.data.calls.waiting} waiting · {stats.data.calls.activeCalls} calls in progress</span>}
        {callsLeft != null && <Badge>{callsLeft} free calls left today</Badge>}
      </div>
      <Tabs tabs={[{ id: 'call', label: 'Find a partner' }, { id: 'history', label: 'Call history' }]} value={tab} onChange={setTab} />
      <audio ref={audioRef} autoPlay data-remote-audio />

      {tab === 'history' ? (
        <CallHistory items={history.data?.calls ?? null} onBlock={block} onReport={(c) => setReportFor({ callId: c.id, alias: c.partnerAlias })} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {error && (
              <Alert tone="error" className="mb-4" action={error.code === 'limit_reached' ? <Link to="/premium" className="text-sm font-semibold underline">Upgrade</Link> : undefined}>
                {error.message}
              </Alert>
            )}

            {phase === 'setup' && (
              <Card className="p-6">
                <h2 className="font-semibold">How do you want to practise?</h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {CALL_MODES.map((m) => (
                    <ChoiceChip key={m.id} selected={mode === m.id} onClick={() => setMode(m.id)}>
                      <strong className="block">{m.label}</strong>
                      <span className="muted text-xs">{m.description}</span>
                    </ChoiceChip>
                  ))}
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Select label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
                    {CALL_TOPICS.map((t) => <option key={t} value={t}>{t === 'any' ? 'Any topic' : t[0].toUpperCase() + t.slice(1)}</option>)}
                  </Select>
                  <Select label="Partner level" value={level} onChange={(e) => setLevel(e.target.value as 'similar' | 'any')} hint={me.profile.cefrLevel ? `Your estimated level: ${me.profile.cefrLevel}` : 'Take the assessment to match by level'}>
                    <option value="any">Any level (faster)</option>
                    <option value="similar">Similar level to mine</option>
                  </Select>
                </div>
                <Button size="lg" className="mt-6" icon={<Phone className="h-5 w-5" />} onClick={findPartner} disabled={status !== 'open'}>Find a partner</Button>
                <p className="muted mt-2 text-xs">We will ask for microphone access. Use headphones to avoid echo.</p>
              </Card>
            )}

            {phase === 'searching' && (
              <Card className="flex flex-col items-center p-10 text-center">
                <Spinner className="h-10 w-10 text-brand-600" />
                <h2 className="mt-4 text-lg font-semibold">Looking for a partner…</h2>
                <p className="muted mt-1 text-sm">{searchingNote ?? `${modeInfo?.label} · ${topic === 'any' ? 'any topic' : topic}`}</p>
                {queueInfo && <p className="muted mt-1 text-sm">{queueInfo.waiting > 1 ? `${queueInfo.waiting} learners are waiting for this mode.` : 'You are first in line — the next learner who joins will be matched with you.'}</p>}
                <Button variant="secondary" className="mt-6" onClick={() => realtime.send({ type: 'call.queue.leave' })}>Cancel</Button>
              </Card>
            )}

            {phase === 'matched' && match && (
              <Card className="p-8 text-center">
                <Badge tone="green">Partner found</Badge>
                <h2 className="mt-3 text-2xl font-bold">{match.partnerAlias}</h2>
                <p className="muted mt-1 text-sm">{match.partnerLevel ? `Estimated level ${match.partnerLevel} · ` : ''}{modeInfo?.label} · {match.topic === 'any' ? 'any topic' : match.topic}</p>
                <blockquote className="mx-auto mt-4 max-w-md rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">💬 {match.prompt}</blockquote>
                {accepted ? (
                  <p className="mt-6 flex items-center justify-center gap-2 text-sm"><Spinner className="h-4 w-4" /> Waiting for {match.partnerAlias} to accept… ({acceptLeft}s)</p>
                ) : (
                  <div className="mt-6 flex justify-center gap-3">
                    <Button variant="secondary" onClick={() => realtime.send({ type: 'call.decline', callId: match.callId })}>Skip</Button>
                    <Button variant="success" icon={<Phone className="h-4 w-4" />} onClick={() => { setAccepted(true); realtime.send({ type: 'call.accept', callId: match.callId }); }}>Accept ({acceptLeft}s)</Button>
                  </div>
                )}
              </Card>
            )}

            {(phase === 'connecting' || phase === 'live') && (
              <Card className="p-8 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-3xl font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">{partnerAlias.slice(0, 1)}</div>
                <h2 className="mt-3 text-2xl font-bold">{partnerAlias}</h2>
                {phase === 'connecting' ? (
                  <p className="muted mt-1 flex items-center justify-center gap-2 text-sm"><Spinner className="h-4 w-4" /> Connecting audio… ({peerState})</p>
                ) : (
                  <p className="mt-1 font-mono text-lg" aria-live="off">{formatDuration(elapsed)}</p>
                )}
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {partnerMuted && <Badge tone="amber"><MicOff className="h-3 w-3" /> Partner muted</Badge>}
                  {partnerReconnecting && <Badge tone="amber">Partner reconnecting…</Badge>}
                  {peerState === 'disconnected' && <Badge tone="amber">Connection unstable…</Badge>}
                  {muted && <Badge tone="red">You are muted</Badge>}
                </div>
                {match?.prompt && <blockquote className="mx-auto mt-4 max-w-md rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">💬 {match.prompt}</blockquote>}
                <div className="mt-6 flex justify-center gap-3">
                  <Button variant={muted ? 'danger' : 'secondary'} size="lg" onClick={toggleMute} icon={muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />} aria-pressed={muted}>{muted ? 'Unmute' : 'Mute'}</Button>
                  <Button variant="danger" size="lg" onClick={() => callIdRef.current && realtime.send({ type: 'call.end', callId: callIdRef.current })} icon={<PhoneOff className="h-5 w-5" />}>End call</Button>
                </div>
                <div className="mt-4 flex justify-center gap-4 text-sm">
                  <button className="muted inline-flex items-center gap-1 hover:text-red-600" onClick={() => callIdRef.current && setReportFor({ callId: callIdRef.current, alias: partnerAlias })}><Flag className="h-4 w-4" /> Report</button>
                  <button className="muted inline-flex items-center gap-1 hover:text-red-600" onClick={() => callIdRef.current && block(callIdRef.current)}><Ban className="h-4 w-4" /> Block &amp; leave</button>
                </div>
              </Card>
            )}

            {phase === 'ended' && ended && (
              <Card className="p-8 text-center">
                <h2 className="text-xl font-bold">Call ended</h2>
                <p className="muted mt-1">{END_REASONS[ended.reason] ?? 'The call has ended.'}</p>
                {ended.durationSec > 0 && <p className="mt-2">You spoke with <strong>{ended.alias}</strong> for <strong>{formatDuration(ended.durationSec)}</strong>. Great practice!</p>}
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Button icon={<Phone className="h-4 w-4" />} onClick={findPartner}>Find another partner</Button>
                  <Button variant="secondary" onClick={() => setPhase('setup')}>Change settings</Button>
                </div>
                <div className="mt-4 flex justify-center gap-4 text-sm">
                  <button className="muted inline-flex items-center gap-1 hover:text-red-600" onClick={() => setReportFor({ callId: ended.callId, alias: ended.alias })}><Flag className="h-4 w-4" /> Report this user</button>
                  <button className="muted inline-flex items-center gap-1 hover:text-red-600" onClick={() => block(ended.callId)}><Ban className="h-4 w-4" /> Block this user</button>
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Stay safe" icon={<Shield className="h-5 w-5" />} />
              <ul className="list-disc space-y-1.5 p-5 pl-9 text-sm">
                <li>Your partner only sees a random name{me.settings.showLevelInCalls ? ' and your estimated level' : ''}.</li>
                <li>Never share your full name, address, phone number or social media.</li>
                <li>If someone is rude or makes you uncomfortable, end the call and report or block them.</li>
                <li>Calls are not recorded. Audio goes directly between devices.</li>
              </ul>
              <div className="border-t border-slate-100 px-5 py-3 text-xs dark:border-slate-800"><Link to="/settings#privacy" className="text-brand-700 hover:underline dark:text-brand-300">Privacy settings and blocked users</Link></div>
            </Card>
            <Card>
              <CardHeader title="Conversation tips" />
              <ul className="list-disc space-y-1.5 p-5 pl-9 text-sm">
                <li>Start with a greeting and the topic suggestion.</li>
                <li>Ask open questions: “What do you think about…?”, “Why?”</li>
                <li>If you don’t understand: “Sorry, could you say that again?”</li>
                <li>Give each other time to finish sentences — everyone is learning.</li>
              </ul>
            </Card>
          </div>
        </div>
      )}
      <ReportDialog target={reportFor} onClose={() => setReportFor(null)} onDone={() => history.reload()} kind="call" />
    </div>
  );
}

function CallHistory({ items, onBlock, onReport }: { items: CallHistoryItem[] | null; onBlock: (id: string) => void; onReport: (c: CallHistoryItem) => void }) {
  if (!items) return <div className="flex justify-center p-8"><Spinner className="h-6 w-6 text-brand-600" /></div>;
  if (!items.length) return <EmptyState icon={<Phone className="h-6 w-6" />} title="No calls yet" description="Your voice practice calls will appear here." />;
  return (
    <div className="card divide-y divide-slate-100 dark:divide-slate-800">
      {items.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="font-medium">{c.partnerAlias} {c.partnerBlocked && <Badge tone="red">Blocked</Badge>}</div>
            <div className="muted text-xs">{CALL_MODES.find((m) => m.id === c.mode)?.label} · {c.topic} · {formatDateTime(c.matchedAt)}</div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="muted">{c.durationSec > 0 ? formatDuration(c.durationSec) : c.status === 'declined' || c.status === 'expired' ? 'Not connected' : c.status}</span>
            {(c.status === 'ended' || c.durationSec > 0) && (
              <>
                <button className="text-xs text-slate-500 hover:text-red-600" onClick={() => onReport(c)}>Report</button>
                {!c.partnerBlocked && <button className="text-xs text-slate-500 hover:text-red-600" onClick={() => onBlock(c.id)}>Block</button>}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
