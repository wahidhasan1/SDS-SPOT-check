"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Captions, CircleStop, Mic, RotateCcw, Send, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea, Label, FieldHint } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { formatClock } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { useMicrophone } from "./use-microphone";
import { useSpeechRecognition } from "./use-speech-recognition";
import { LevelMeter } from "./level-meter";

export interface SpokenAnswerValue {
  text: string;
  recordedSeconds: number;
  transcriptSource: "browser_speech" | "stt_provider" | "typed" | null;
  hasRecording: boolean;
}

/**
 * Records an answer with MediaRecorder, plays it back, and turns it into text
 * using (1) browser captions, (2) the server STT provider when configured and
 * the user chooses to send it, or (3) the user's own typing.
 * Recordings stay in the browser unless explicitly sent for transcription.
 */
export function SpokenAnswer({
  maxSeconds,
  sttConfigured,
  onChange,
  onRecordingStart,
  onRecordingStop,
  disabled,
  autoFocusRecord,
}: {
  maxSeconds: number;
  sttConfigured: boolean;
  onChange: (v: SpokenAnswerValue) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: (seconds: number) => void;
  disabled?: boolean;
  autoFocusRecord?: boolean;
}) {
  const mic = useMicrophone();
  const [phase, setPhase] = useState<"idle" | "recording" | "recorded">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [text, setText] = useState("");
  const [source, setSource] = useState<SpokenAnswerValue["transcriptSource"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captionLines = useRef<string[]>([]);
  const recordedSecondsRef = useRef(0);
  const [recordedSeconds, setRecordedSeconds] = useState(0);

  const speech = useSpeechRecognition((line) => {
    captionLines.current.push(line);
    const joined = captionLines.current.join(" ");
    setText(joined);
    setSource("browser_speech");
  });

  const emit = useCallback(
    (patch: Partial<SpokenAnswerValue> = {}) => {
      onChange({
        text,
        recordedSeconds: recordedSecondsRef.current,
        transcriptSource: source,
        hasRecording: Boolean(blob),
        ...patch,
      });
    },
    [onChange, text, source, blob],
  );

  useEffect(() => {
    emit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, source, blob]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    speech.stop();
  }, [speech]);

  useEffect(() => {
    if (phase === "recording" && elapsed >= maxSeconds) stopRecording();
  }, [elapsed, maxSeconds, phase, stopRecording]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );

  async function startRecording() {
    setError(null);
    if (typeof MediaRecorder === "undefined") {
      setError("Recording isn't supported in this browser. Type your answer below instead.");
      return;
    }
    const stream = await mic.start();
    if (!stream) return;
    try {
      chunksRef.current = [];
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported?.(m));
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const seconds = Math.min(maxSeconds, Math.round((Date.now() - startedRef.current) / 100) / 10);
        recordedSecondsRef.current = seconds;
        setRecordedSeconds(seconds);
        const b = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setBlob(b);
        setAudioUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(b);
        });
        setPhase("recorded");
        mic.stop();
        onRecordingStop?.(seconds);
      };
      captionLines.current = [];
      setText("");
      setSource(null);
      setBlob(null);
      rec.start(250);
      startedRef.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((Date.now() - startedRef.current) / 1000), 200);
      setPhase("recording");
      if (captionsOn && speech.supported) speech.start();
      onRecordingStart?.();
    } catch {
      setError("The recording could not start. Type your answer below instead.");
      mic.stop();
    }
  }

  function retry() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setBlob(null);
    setText("");
    setSource(null);
    recordedSecondsRef.current = 0;
    setPhase("idle");
    setElapsed(0);
  }

  async function transcribeOnServer() {
    if (!blob) return;
    setTranscribing(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("audio", blob, blob.type.includes("mp4") ? "answer.mp4" : "answer.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Transcription failed.");
      setText(data.text);
      setSource("stt_provider");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  }

  const remaining = Math.max(0, maxSeconds - elapsed);

  return (
    <div className="space-y-4">
      <div className={cn("rounded-2xl border p-4 sm:p-5", phase === "recording" ? "border-danger-100 bg-danger-50/60" : "border-line bg-surface-muted/40")}>
        {phase === "idle" && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <Button size="lg" onClick={startRecording} disabled={disabled || mic.state === "requesting"} loading={mic.state === "requesting"} autoFocus={autoFocusRecord}>
              <Mic className="h-5 w-5" /> Start recording
            </Button>
            <p className="text-xs text-muted">Up to {maxSeconds} seconds. Your browser will ask for microphone permission. The recording stays on this device.</p>
            {speech.supported ? (
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input type="checkbox" checked={captionsOn} onChange={(e) => setCaptionsOn(e.target.checked)} className="h-4 w-4 accent-brand-600" />
                <Captions className="h-4 w-4" /> Transcribe with browser captions
              </label>
            ) : (
              <p className="text-xs text-muted">Live captions aren&apos;t available in this browser; you can type what you said after recording.</p>
            )}
          </div>
        )}

        {phase === "recording" && (
          <div className="flex flex-col items-center gap-3 py-2 text-center" aria-live="polite">
            <div className="flex items-center gap-2 text-sm font-bold text-danger-700">
              <span className="relative flex h-3 w-3">
                <span className="absolute inset-0 animate-ping-slow rounded-full bg-danger-500" />
                <span className="relative h-3 w-3 rounded-full bg-danger-600" />
              </span>
              Recording
            </div>
            <p className="font-mono text-4xl font-extrabold tabular-nums" aria-label={`${Math.ceil(remaining)} seconds remaining`}>
              {formatClock(remaining)}
            </p>
            <LevelMeter level={mic.level} bars={16} />
            <p className="min-h-5 text-sm text-ink-soft italic">{speech.interim || (captionsOn && speech.supported ? "Listening…" : "")}</p>
            <Button variant="danger" onClick={stopRecording}>
              <CircleStop className="h-5 w-5" /> Stop recording
            </Button>
          </div>
        )}

        {phase === "recorded" && audioUrl && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Your recording · {recordedSeconds.toFixed(1)}s</p>
              <Button variant="ghost" size="sm" onClick={retry} disabled={disabled}>
                <RotateCcw className="h-4 w-4" /> Record again
              </Button>
            </div>
            <audio controls src={audioUrl} className="w-full" />
          </div>
        )}
      </div>

      {(error || mic.error || speech.error) && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger-700">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error || mic.error || speech.error}
        </p>
      )}

      {(phase === "recorded" || mic.state === "denied" || mic.state === "unavailable" || error) && (
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="spoken-text" className="mb-0">
              What you said
            </Label>
            {source === "browser_speech" && <Badge tone="info">From browser captions — check for errors</Badge>}
            {source === "stt_provider" && <Badge tone="success">Transcribed on the server</Badge>}
            {source === "typed" && <Badge tone="neutral">Typed by you</Badge>}
          </div>
          <Textarea
            id="spoken-text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSource(e.target.value ? (source === null ? "typed" : source) : null);
            }}
            placeholder={phase === "recorded" ? "Type what you said so it can be analyzed (feedback is based on this text)." : "Type your answer here."}
            disabled={disabled}
          />
          <FieldHint>Feedback is based on this text. Pronunciation is not assessed from text.</FieldHint>
          {phase === "recorded" && sttConfigured && blob && (
            <Button variant="outline" size="sm" className="mt-2" onClick={transcribeOnServer} loading={transcribing} disabled={disabled}>
              <Send className="h-4 w-4" /> Send recording for transcription
            </Button>
          )}
          {phase === "recorded" && sttConfigured && (
            <p className="mt-1 text-xs text-muted">Sending uploads this recording to the configured speech-to-text service. Pantora doesn&apos;t store the audio.</p>
          )}
        </div>
      )}
    </div>
  );
}
