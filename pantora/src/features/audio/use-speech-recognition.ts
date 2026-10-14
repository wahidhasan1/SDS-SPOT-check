"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typings for the Web Speech API (not in TypeScript's DOM lib).
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechRecognitionSupported() {
  return getCtor() !== null;
}

/**
 * Live captions using the browser's built-in speech recognition. In Chrome this
 * sends audio to the browser vendor's speech service, which the UI discloses.
 */
export function useSpeechRecognition(onFinal?: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection must run in the browser
    setSupported(speechRecognitionSupported());
  }, []);

  const stop = useCallback(() => {
    wantRef.current = false;
    recRef.current?.stop();
    setListening(false);
    setInterim("");
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setError("Live captions aren't supported in this browser. Try Chrome or Edge, or type notes instead.");
      return false;
    }
    wantRef.current = true;
    setError(null);
    recRef.current?.abort();
    const rec = new Ctor();
    recRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript.trim();
        if (r.isFinal) {
          if (text) onFinalRef.current?.(text);
        } else interimText += ` ${text}`;
      }
      setInterim(interimText.trim());
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      // Any other error is treated as fatal so we never show captions as "on" when they aren't working.
      wantRef.current = false;
      setListening(false);
      setInterim("");
      const messages: Record<string, string> = {
        "not-allowed": "Captions need microphone permission.",
        "service-not-allowed": "Your browser blocked its speech service, so captions are off.",
        "audio-capture": "Captions couldn't access the microphone, so they are off.",
        network: "Captions need an internet connection to your browser's speech service, so they are off.",
      };
      setError(messages[e.error] ?? `Captions stopped (${e.error}).`);
    };
    rec.onend = () => {
      // Browsers stop recognition after silence; restart while captions are on.
      if (wantRef.current) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      } else setListening(false);
    };
    try {
      rec.start();
      setListening(true);
      return true;
    } catch {
      setListening(true);
      return true;
    }
  }, []);

  useEffect(
    () => () => {
      wantRef.current = false;
      recRef.current?.abort();
    },
    [],
  );

  return { supported, listening, interim, error, start, stop };
}
