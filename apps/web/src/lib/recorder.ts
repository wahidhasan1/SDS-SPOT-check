import { useCallback, useEffect, useRef, useState } from 'react';

/* Minimal typings for the Web Speech API (not in lib.dom for all TS versions). */
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SRConstructor = new () => SpeechRecognitionLike;

export function speechRecognitionCtor(): SRConstructor | null {
  const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function pickMime() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const t of types) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t)) return t;
  return '';
}

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'stopped' | 'error';

/**
 * Records microphone audio with MediaRecorder and, where the browser supports it, transcribes speech
 * live with the Web Speech API (Chrome, Edge, Safari). Transcription quality depends on the browser.
 */
export function useRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [finalText, setFinalText] = useState('');
  const [interim, setInterim] = useState('');
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const srRef = useRef<SpeechRecognitionLike | null>(null);
  const startedAt = useRef(0);
  const tick = useRef<ReturnType<typeof setInterval>>(undefined);
  const recording = useRef(false);
  const recognitionSupported = Boolean(speechRecognitionCtor());

  const cleanup = useCallback(() => {
    clearInterval(tick.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recording.current = false;
    try {
      srRef.current?.abort();
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    setBlob(null);
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
    setFinalText('');
    setInterim('');
    setSeconds(0);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setState('error');
      setError('Audio recording is not supported in this browser. Please use a recent version of Chrome, Edge, Safari or Firefox.');
      return;
    }
    setState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        const b = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
        setBlob(b);
        setUrl(URL.createObjectURL(b));
        setState('stopped');
        cleanup();
      };
      recRef.current = rec;
      rec.start(1000);
      startedAt.current = Date.now();
      recording.current = true;
      tick.current = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 250);
      setState('recording');
      const SR = speechRecognitionCtor();
      if (SR) {
        const sr = new SR();
        sr.continuous = true;
        sr.interimResults = true;
        sr.lang = 'en-US';
        sr.onresult = (e) => {
          let fin = '';
          let inter = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) fin += r[0].transcript + ' ';
            else inter += r[0].transcript;
          }
          if (fin) setFinalText((t) => (t + ' ' + fin).replace(/\s+/g, ' ').trim());
          setInterim(inter);
        };
        sr.onerror = (e) => {
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError('Speech recognition is blocked in this browser, so no transcript will be produced. Your recording still works.');
        };
        // Chrome ends recognition after pauses; restart while still recording.
        sr.onend = () => {
          if (recording.current) {
            try {
              sr.start();
            } catch {
              /* ignore */
            }
          }
        };
        srRef.current = sr;
        try {
          sr.start();
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      cleanup();
      setState('error');
      const name = (err as DOMException).name;
      setError(
        name === 'NotAllowedError'
          ? 'Microphone access was denied. Allow microphone access in your browser’s site settings and try again.'
          : name === 'NotFoundError'
            ? 'No microphone was found. Connect a microphone and try again.'
            : 'Could not start recording. Check that no other app is using your microphone.',
      );
    }
  }, [cleanup, url]);

  const stop = useCallback(() => {
    recording.current = false;
    try {
      srRef.current?.stop();
    } catch {
      /* ignore */
    }
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
    setInterim('');
  }, []);

  const reset = useCallback(() => {
    cleanup();
    if (url) URL.revokeObjectURL(url);
    setBlob(null);
    setUrl(null);
    setSeconds(0);
    setFinalText('');
    setInterim('');
    setState('idle');
    setError(null);
  }, [cleanup, url]);

  return { state, error, blob, url, seconds, transcript: finalText, interim, setTranscript: setFinalText, recognitionSupported, start, stop, reset };
}
