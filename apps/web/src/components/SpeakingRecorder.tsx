import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { errorMessage, formatDuration, useInterval } from '../lib/hooks';

type Phase = 'idle' | 'preparing' | 'recording' | 'review' | 'analysing' | 'done';

function getRecognition(): any {
  const W = window as any;
  const C = W.SpeechRecognition || W.webkitSpeechRecognition;
  return C ? new C() : null;
}

export interface SpeakingResult {
  id: string;
  transcript: string;
  metrics: any;
  feedback: any;
  feedback_source: string;
  band_estimate: number | null;
}

/**
 * Records a spoken answer. Transcription uses, in order of preference:
 * 1) the browser's speech recognition (live, where supported),
 * 2) the server's speech-to-text provider (if configured),
 * 3) the learner typing what they said (clearly labelled).
 * Audio is never stored by the app.
 */
export function SpeakingRecorder({
  part,
  question,
  promptId,
  prepSeconds = 0,
  speakSeconds,
  serverStt,
  mockAttemptId,
  onResult,
}: {
  part: 1 | 2 | 3;
  question: string;
  promptId?: string;
  prepSeconds?: number;
  speakSeconds: number;
  serverStt: boolean;
  mockAttemptId?: string;
  onResult?: (r: SpeakingResult) => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [consent, setConsent] = useState(false);
  const [startAt, setStartAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [finalText, setFinalText] = useState('');
  const [interim, setInterim] = useState('');
  const [source, setSource] = useState<'web_speech' | 'server_stt' | 'typed'>('web_speech');
  const [duration, setDuration] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<SpeakingResult | null>(null);
  const recRef = useRef<any>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const supported = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  useInterval(() => setNow(Date.now()), phase === 'preparing' || phase === 'recording' ? 250 : null);

  const elapsed = Math.floor((now - startAt) / 1000);
  useEffect(() => {
    if (phase === 'preparing' && elapsed >= prepSeconds) void beginRecording();
    if (phase === 'recording' && elapsed >= speakSeconds) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, phase]);

  useEffect(() => () => cleanup(), []);

  const cleanup = () => {
    try { recRef.current?.abort?.(); } catch { /* ignore */ }
    try { if (mediaRef.current?.state === 'recording') mediaRef.current.stop(); } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = () => {
    setErr(null);
    setFinalText('');
    setInterim('');
    setResult(null);
    if (prepSeconds > 0) {
      setStartAt(Date.now());
      setNow(Date.now());
      setPhase('preparing');
    } else void beginRecording();
  };

  async function beginRecording() {
    setErr(null);
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErr('Microphone access is needed for speaking practice. Allow it in your browser settings, or type your answer instead.');
      setSource('typed');
      setPhase('review');
      return;
    }
    const rec = supported ? getRecognition() : null;
    if (rec) {
      setSource('web_speech');
      rec.lang = 'en-GB';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (ev: any) => {
        let fin = '';
        let int = '';
        for (let i = 0; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) fin += r[0].transcript + ' ';
          else int += r[0].transcript;
        }
        setFinalText(fin.trim());
        setInterim(int);
      };
      rec.onerror = (e: any) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setErr('Speech recognition is blocked in this browser. You can type what you said instead.');
        else if (e.error !== 'no-speech' && e.error !== 'aborted') setErr(`Speech recognition error (${e.error}). You can correct the transcript below.`);
      };
      rec.onend = () => {
        // Some browsers stop after silence; restart while we are still recording.
        if (recRef.current === rec && mediaRef.current?.state === 'recording') {
          try { rec.start(); } catch { /* ignore */ }
        }
      };
      recRef.current = rec;
      try { rec.start(); } catch { /* ignore */ }
    } else {
      setSource(serverStt ? 'server_stt' : 'typed');
    }
    chunks.current = [];
    try {
      const mr = new MediaRecorder(streamRef.current);
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.start();
      mediaRef.current = mr;
    } catch {
      mediaRef.current = null;
    }
    setStartAt(Date.now());
    setNow(Date.now());
    setPhase('recording');
  }

  function stop() {
    const secs = Math.max(1, Math.round((Date.now() - startAt) / 1000));
    setDuration(secs);
    const rec = recRef.current;
    recRef.current = null;
    try { rec?.stop(); } catch { /* ignore */ }
    const mr = mediaRef.current;
    const done = async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (source === 'server_stt' && chunks.current.length) {
        setPhase('analysing');
        try {
          const blob = new Blob(chunks.current, { type: mr?.mimeType || 'audio/webm' });
          const fd = new FormData();
          fd.append('file', blob, 'answer.webm');
          const r = await api.upload<{ text: string }>('/ielts/speaking/transcribe', fd);
          setFinalText(r.text);
        } catch (e) {
          setErr(errorMessage(e) + ' You can type your answer below.');
          setSource('typed');
        }
      }
      setPhase('review');
    };
    if (mr && mr.state === 'recording') {
      mr.onstop = () => void done();
      mr.stop();
    } else void done();
    setTimeout(() => setInterim(''), 300);
  }

  const analyse = async () => {
    const transcript = (finalText + ' ' + interim).trim();
    if (!transcript) {
      setErr('There is no transcript to analyse. Try again or type your answer.');
      return;
    }
    setPhase('analysing');
    setErr(null);
    try {
      const r = await api.post<SpeakingResult>('/ielts/speaking/analyse', {
        promptId,
        part,
        question,
        transcript,
        durationSec: duration || Math.max(5, Math.round(transcript.split(/\s+/).length / 2)),
        transcriptSource: source,
        consent: true,
        mockAttemptId,
      });
      setResult(r);
      setPhase('done');
      onResult?.(r);
    } catch (e) {
      setErr(errorMessage(e));
      setPhase('review');
    }
  };

  const limit = phase === 'preparing' ? prepSeconds : speakSeconds;
  return (
    <div className="stack">
      {phase === 'idle' && (
        <>
          <label className="row small" style={{ alignItems: 'flex-start' }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="speaking-consent" />
            <span>
              I agree to my spoken answer being transcribed{supported ? ' by my browser’s speech-recognition service (which may process audio on its provider’s servers)' : serverStt ? ' by the app’s speech-to-text provider' : ''}, and the transcript being analysed for feedback. The app does not store my audio.
            </span>
          </label>
          {!supported && !serverStt && <div className="alert info small">Live transcription isn't available in this browser (try Chrome, Edge or Safari). You can still practise aloud and then type what you said.</div>}
          <div className="row">
            <button className="btn" disabled={!consent} onClick={start} data-testid="speaking-start">{prepSeconds ? `Start ${prepSeconds}s preparation` : '🎙️ Start speaking'}</button>
            <button className="btn ghost" disabled={!consent} onClick={() => { setSource('typed'); setPhase('review'); }}>Type my answer instead</button>
          </div>
        </>
      )}
      {(phase === 'preparing' || phase === 'recording') && (
        <div className="card flat stack center">
          <div className="badge primary" style={{ alignSelf: 'center' }}>{phase === 'preparing' ? 'Preparation — make notes' : '● Recording'}</div>
          <div className={`call-timer ${limit - elapsed < 10 ? '' : ''}`}>{formatDuration(Math.max(0, limit - elapsed))}</div>
          {phase === 'recording' && <div className="small" style={{ minHeight: 40 }} aria-live="polite">{finalText} <span className="muted">{interim}</span></div>}
          <div className="row" style={{ justifyContent: 'center' }}>
            {phase === 'preparing' ? <button className="btn" onClick={() => void beginRecording()}>Start speaking now</button> : <button className="btn danger" onClick={stop} data-testid="speaking-stop">■ Stop</button>}
          </div>
        </div>
      )}
      {phase === 'review' && (
        <div className="stack">
          <label className="field">
            {source === 'typed' ? 'Type what you said' : 'Transcript (correct any recognition mistakes)'}
            <textarea className="input" rows={6} value={finalText} onChange={(e) => setFinalText(e.target.value)} data-testid="speaking-transcript" />
          </label>
          {source === 'typed' && (
            <label className="field" style={{ maxWidth: 260 }}>
              About how long did you speak? (seconds)
              <input className="input" type="number" min={5} max={600} value={duration || ''} onChange={(e) => setDuration(Number(e.target.value))} />
            </label>
          )}
          <div className="row">
            <button className="btn" onClick={analyse} data-testid="speaking-analyse">Get feedback</button>
            <button className="btn secondary" onClick={() => setPhase('idle')}>Try again</button>
          </div>
        </div>
      )}
      {phase === 'analysing' && <div className="row"><span className="spinner" /> Analysing…</div>}
      {err && <div className="alert warning">{err}</div>}
      {phase === 'done' && result && <SpeakingFeedbackView r={result} onAgain={() => setPhase('idle')} />}
    </div>
  );
}

export function SpeakingFeedbackView({ r, onAgain }: { r: SpeakingResult; onAgain?: () => void }) {
  const fb = r.feedback;
  const m = r.metrics;
  return (
    <div className="stack" data-testid="speaking-feedback">
      <div className="card flat"><b>Your transcript</b><p className="small" style={{ margin: 0 }}>{r.transcript}</p></div>
      {fb ? (
        <div className="card stack">
          <div className="row between"><h3 style={{ margin: 0 }}>Feedback</h3><span className="badge primary">Estimated band {r.band_estimate}</span></div>
          <p className="disclaimer">Unofficial estimate from the transcript only. Pronunciation was not assessed.</p>
          <p>{fb.summary}</p>
          <div className="grid cols-3 small">
            <div className="card flat">Fluency & coherence <b>{fb.bandEstimates.fluencyCoherence}</b></div>
            <div className="card flat">Lexical resource <b>{fb.bandEstimates.lexicalResource}</b></div>
            <div className="card flat">Grammar <b>{fb.bandEstimates.grammaticalRangeAccuracy}</b></div>
          </div>
          <p className="small">{fb.answerDevelopment}</p>
          <b>Focus on next</b><ol className="small">{fb.priorities.map((p: string) => <li key={p}>{p}</li>)}</ol>
          {fb.errors.length > 0 && <><b>Corrections</b>{fb.errors.map((e: any, i: number) => <div key={i} className="small"><s className="muted">{e.excerpt}</s> → <b>{e.correction}</b> — {e.explanation}</div>)}</>}
          {fb.betterExpressions.length > 0 && <><b>Useful expressions</b>{fb.betterExpressions.map((e: any, i: number) => <div key={i} className="small">“{e.original}” → <b>{e.suggestion}</b> <span className="muted">— {e.why}</span></div>)}</>}
        </div>
      ) : (
        <div className="alert info small">{m?.aiError ?? 'AI feedback unavailable.'}</div>
      )}
      {m && (
        <div className="card">
          <b>Transcript statistics</b>
          <div className="list">
            {m.checks.map((c: any) => (
              <div key={c.id} className="list-item small" style={{ alignItems: 'flex-start' }}>
                <span>{c.status === 'good' ? '✅' : c.status === 'warn' ? '⚠️' : 'ℹ️'}</span><div><b>{c.title}</b><div className="muted">{c.detail}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}
      {onAgain && <button className="btn secondary" onClick={onAgain}>Answer again</button>}
    </div>
  );
}
