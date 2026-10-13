import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { router } from 'expo-router';
import { CallSession, type CallSnapshot, type PracticeMode, type ServerMessage } from '@app/shared';
import { realtime } from './api';
import { useAuth } from './auth';
import { createWebRtcDeps, ensureMicPermission, webrtcSupported } from './webrtc';

interface MatchInfo {
  queuedAt: number | null;
  waitingCount: number | null;
  levelRange: number | null;
  message: string | null;
}

interface Ctx {
  phase: 'idle' | 'queued' | 'found';
  match: MatchInfo;
  session: CallSession | null;
  snapshot: CallSnapshot | null;
  start: (mode: PracticeMode, topicId: string) => Promise<void>;
  cancel: () => void;
  clear: () => void;
}

const CallCtx = createContext<Ctx | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Ctx['phase']>('idle');
  const [match, setMatch] = useState<MatchInfo>({ queuedAt: null, waitingCount: null, levelRange: null, message: null });
  const [session, setSession] = useState<CallSession | null>(null);
  const [snapshot, setSnapshot] = useState<CallSnapshot | null>(null);
  const ref = useRef<CallSession | null>(null);
  ref.current = session;

  const createSession = useCallback((info: any) => {
    const s = new CallSession(info, realtime, createWebRtcDeps());
    s.subscribe(setSnapshot);
    setSession(s);
    void s.start();
    router.push('/call');
  }, []);

  useEffect(() => {
    if (!user) return;
    const off = realtime.on((m: ServerMessage) => {
      if (m.t === 'match.status') {
        if (m.status === 'queued') {
          setPhase((p) => (p === 'found' ? p : 'queued'));
          setMatch((x) => ({ ...x, queuedAt: m.queuedAt ? Date.parse(m.queuedAt) : x.queuedAt, waitingCount: m.waitingCount ?? x.waitingCount, levelRange: m.levelRange ?? x.levelRange, message: null }));
        } else {
          setPhase((p) => (p === 'found' ? p : 'idle'));
          if (m.message) setMatch((x) => ({ ...x, message: m.message! }));
        }
      } else if (m.t === 'match.found') {
        setPhase('found');
        createSession(m.call);
      } else if (m.t === 'call.resume') {
        const cur = ref.current;
        if (cur && cur.info.id === m.call.id) cur.applyResume(m.connectedAt, m.partnerMuted);
        else realtime.send({ t: 'call.end', callId: m.call.id, reason: 'client_reset' });
      }
    });
    return () => void off();
  }, [user, createSession]);

  // App lifecycle: reconnect the socket when returning to the foreground. Audio keeps
  // flowing in the background on iOS (voip/audio background modes) and Android.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && user) realtime.connect();
      if (state === 'background' && phase === 'queued') {
        // Don't keep someone waiting for a person who has left the app.
        realtime.send({ t: 'match.cancel' });
        setPhase('idle');
      }
    });
    return () => sub.remove();
  }, [user, phase]);

  const start = async (mode: PracticeMode, topicId: string) => {
    if (!webrtcSupported) {
      setMatch((x) => ({ ...x, message: 'Live calls are not supported on this device.' }));
      return;
    }
    const micError = await ensureMicPermission();
    if (micError) {
      setMatch((x) => ({ ...x, message: micError }));
      return;
    }
    setMatch({ queuedAt: Date.now(), waitingCount: null, levelRange: null, message: null });
    setPhase('queued');
    realtime.send({ t: 'match.join', mode, topicId });
  };
  const cancel = () => {
    realtime.send({ t: 'match.cancel' });
    setPhase('idle');
  };
  const clear = () => {
    session?.dispose();
    setSession(null);
    setSnapshot(null);
    setPhase('idle');
  };
  return <CallCtx.Provider value={{ phase, match, session, snapshot, start, cancel, clear }}>{children}</CallCtx.Provider>;
}

export function useCall() {
  const c = useContext(CallCtx);
  if (!c) throw new Error('useCall outside provider');
  return c;
}

export const isWeb = Platform.OS === 'web';
