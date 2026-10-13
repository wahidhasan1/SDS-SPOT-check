import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

export type RecState = 'idle' | 'recording' | 'stopped' | 'error';

/**
 * Records a spoken answer. Uses the device speech recogniser (Android/iOS) to produce a live transcript
 * and keep the audio file; if speech recognition is unavailable, falls back to plain audio recording
 * and the learner can type the transcript.
 */
export function useSpeechRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [state, setState] = useState<RecState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [mode, setMode] = useState<'speech' | 'audio'>('speech');
  const started = useRef(0);
  const tick = useRef<ReturnType<typeof setInterval>>(undefined);

  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results[0]?.transcript ?? '';
    if (e.isFinal) {
      setTranscript((t) => `${t} ${text}`.trim());
      setInterim('');
    } else setInterim(text);
  });
  useSpeechRecognitionEvent('audioend', (e) => {
    if (e.uri) setUri(e.uri);
  });
  useSpeechRecognitionEvent('error', (e) => {
    if (e.error !== 'no-speech' && e.error !== 'aborted') setError(`Speech recognition: ${e.message}`);
  });
  useSpeechRecognitionEvent('end', () => {
    clearInterval(tick.current);
    setState((s) => (s === 'recording' ? 'stopped' : s));
  });

  useEffect(() => () => clearInterval(tick.current), []);

  const start = useCallback(async () => {
    setError(null);
    setTranscript('');
    setInterim('');
    setUri(null);
    setSeconds(0);
    const useSpeech = ExpoSpeechRecognitionModule.isRecognitionAvailable();
    try {
      if (useSpeech) {
        const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!perm.granted) throw new Error('Microphone or speech recognition permission was denied. Enable it in system settings.');
        setMode('speech');
        ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: true, recordingOptions: { persist: true } });
      } else {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) throw new Error('Microphone permission was denied. Enable it in system settings.');
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        setMode('audio');
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
      started.current = Date.now();
      tick.current = setInterval(() => setSeconds(Math.floor((Date.now() - started.current) / 1000)), 250);
      setState('recording');
    } catch (e) {
      setState('error');
      setError((e as Error).message);
    }
  }, [recorder]);

  const stop = useCallback(async () => {
    clearInterval(tick.current);
    if (mode === 'speech') ExpoSpeechRecognitionModule.stop();
    else {
      await recorder.stop();
      setUri(recorder.uri);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    }
    setState('stopped');
  }, [mode, recorder]);

  const reset = useCallback(() => {
    setState('idle');
    setTranscript('');
    setInterim('');
    setUri(null);
    setSeconds(0);
    setError(null);
  }, []);

  return { state, transcript, interim, setTranscript, uri, error, seconds, mode, start, stop, reset };
}

/** Build the multipart body for /api/speaking/attempts (fields first, then the file). */
export function speakingForm(fields: Record<string, string | number | undefined>, uri: string | null) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) fd.append(k, String(v));
  if (uri) {
    const ext = uri.split('.').pop()?.toLowerCase() ?? 'm4a';
    const type = ext === 'wav' ? 'audio/wav' : ext === 'webm' ? 'audio/webm' : ext === '3gp' ? 'audio/3gpp' : 'audio/mp4';
    fd.append('audio', { uri, name: `answer.${ext}`, type } as unknown as Blob);
  }
  return fd;
}
