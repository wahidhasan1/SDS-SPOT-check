import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CallSession, type CallSnapshot, type PracticeMode, type ServerMessage } from '@app/shared';
import { realtime } from './api';
import { useAuth } from './auth';

export type MatchPhase = 'idle' | 'checking_mic' | 'queued' | 'found';

interface MatchInfo {
  queuedAt: number | null;
  waitingCount: number | null;
  levelRange: number | null;
  message: string | null;
  mode: PracticeMode;
  topicId: string;
}

interface CallCtx {
  phase: MatchPhase;
  match: MatchInfo;
  session: CallSession | null;
  snapshot: CallSnapshot | null;
  audioBlocked: boolean;
  startMatching: (mode: PracticeMode, topicId: string, levelPreference?: 'similar' | 'any' | 'higher') => Promise<void>;
  cancelMatching: () => void;
  enableAudio: () => void;
  clearSession: () => void;
}

const Ctx = createContext<CallCtx | null>(null);

async function micCheck(): Promise<string | null> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'This browser cannot access a microphone. Use a recent version of Chrome, Edge, Firefox or Safari over HTTPS.';
  }
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    return null;
  } catch (e: any) {
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
      return 'Microphone access is blocked. Click the lock icon in the address bar, allow the microphone, then try again.';
    }
    if (e?.name === 'NotFoundError') return 'No microphone was found. Connect a microphone or headset and try again.';
    return 'Your microphone could not be started. Close other apps that may be using it and try again.';
  }
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [phase, setPhase] = useState<MatchPhase>('idle');
  const [match, setMatch] = useState<MatchInfo>({ queuedAt: null, waitingCount: null, levelRange: null, message: null, mode: 'free_talk', topicId: 'random' });
  const [session, setSession] = useState<CallSession | null>(null);
  const [snapshot, setSnapshot] = useState<CallSnapshot | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const sessionRef = useRef<CallSession | null>(null);
  sessionRef.current = session;

  const playRemote = useCallback((stream: MediaStream) => {
    const el = audioRef.current;
    if (!el) return;
    el.srcObject = stream;
    el.play().then(
      () => setAudioBlocked(false),
      () => setAudioBlocked(true), // browser autoplay policy: needs a user gesture
    );
  }, []);

  const createSession = useCallback(
    (info: any) => {
      const s = new CallSession(info, realtime, {
        createPeerConnection: (cfg) => new RTCPeerConnection({ iceServers: cfg.iceServers as RTCIceServer[] }),
        getUserMedia: () =>
          navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: false,
          }),
        onRemoteStream: playRemote,
      });
      s.subscribe(setSnapshot);
      setSession(s);
      (window as any).__activeCall = s; // exposed for automated audio verification tests
      void s.start();
      return s;
    },
    [playRemote],
  );

  useEffect(() => {
    if (!user) return;
    const off = realtime.on((m: ServerMessage) => {
      switch (m.t) {
        case 'match.status':
          if (m.status === 'queued') {
            setPhase((p) => (p === 'found' ? p : 'queued'));
            setMatch((x) => ({
              ...x,
              queuedAt: m.queuedAt ? Date.parse(m.queuedAt) : x.queuedAt,
              waitingCount: m.waitingCount ?? x.waitingCount,
              levelRange: m.levelRange ?? x.levelRange,
              message: null,
            }));
          } else {
            setPhase((p) => (p === 'found' ? p : 'idle'));
            if (m.message) setMatch((x) => ({ ...x, message: m.message! }));
          }
          break;
        case 'match.found':
          setPhase('found');
          createSession(m.call);
          navigate('/speaking/call');
          break;
        case 'call.resume': {
          const cur = sessionRef.current;
          if (cur && cur.info.id === m.call.id) cur.applyResume(m.connectedAt, m.partnerMuted);
          else realtime.send({ t: 'call.end', callId: m.call.id, reason: 'client_reset' });
          break;
        }
      }
    });
    return () => {
      off();
    };
  }, [user, createSession, navigate]);

  // Leaving the page during a call ends it cleanly instead of leaving the partner waiting.
  useEffect(() => {
    const onHide = () => {
      const s = sessionRef.current;
      if (s && (s.snapshot.state === 'connected' || s.snapshot.state === 'connecting' || s.snapshot.state === 'reconnecting')) s.hangUp();
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  const startMatching: CallCtx['startMatching'] = async (mode, topicId, levelPreference) => {
    setMatch({ queuedAt: null, waitingCount: null, levelRange: null, message: null, mode, topicId });
    setPhase('checking_mic');
    const err = await micCheck();
    if (err) {
      setPhase('idle');
      setMatch((x) => ({ ...x, message: err }));
      return;
    }
    setPhase('queued');
    setMatch((x) => ({ ...x, queuedAt: Date.now() }));
    realtime.send({ t: 'match.join', mode, topicId, levelPreference });
  };

  const cancelMatching = () => {
    realtime.send({ t: 'match.cancel' });
    setPhase('idle');
    setMatch((x) => ({ ...x, message: 'Matching cancelled.' }));
  };

  const enableAudio = () => {
    audioRef.current?.play().then(() => setAudioBlocked(false), () => setAudioBlocked(true));
  };

  const clearSession = () => {
    session?.dispose();
    setSession(null);
    setSnapshot(null);
    setPhase('idle');
    (window as any).__activeCall = null;
    if (audioRef.current) audioRef.current.srcObject = null;
  };

  return (
    <Ctx.Provider value={{ phase, match, session, snapshot, audioBlocked, startMatching, cancelMatching, enableAudio, clearSession }}>
      <audio ref={audioRef} autoPlay playsInline data-testid="remote-audio" />
      {children}
    </Ctx.Provider>
  );
}

export function useCall() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCall outside provider');
  return c;
}
