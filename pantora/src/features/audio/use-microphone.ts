"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MicState = "idle" | "requesting" | "ready" | "denied" | "unavailable" | "error";

/**
 * Opens the microphone (only after an explicit user action), exposes a live
 * input level, and supports mute. Audio never leaves the browser through this hook.
 */
export function useMicrophone() {
  const [state, setState] = useState<MicState>("idle");
  const [muted, setMutedState] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setLevel(0);
    setState((s) => (s === "ready" ? "idle" : s));
  }, []);

  const start = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current) return streamRef.current;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      setError("This browser doesn't support microphone access (it needs a secure https or localhost connection).");
      return null;
    }
    setState("requesting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      stream.getAudioTracks().forEach((t) =>
        t.addEventListener("ended", () => {
          setState("error");
          setError("Your microphone was disconnected.");
        }),
      );
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        ctxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const v of data) sum += ((v - 128) / 128) ** 2;
          setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        /* level meter is optional */
      }
      setState("ready");
      return stream;
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setState("denied");
        setError("Microphone access was blocked. Allow it in your browser's site settings to use voice features.");
      } else if (name === "NotFoundError") {
        setState("unavailable");
        setError("No microphone was found on this device.");
      } else {
        setState("error");
        setError("The microphone could not be started.");
      }
      return null;
    }
  }, []);

  const setMuted = useCallback((value: boolean) => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !value));
    setMutedState(value);
  }, []);

  useEffect(() => stop, [stop]);

  return { state, muted, setMuted, level: muted ? 0 : level, error, start, stop, stream: streamRef };
}
