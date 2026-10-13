import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

/** Countdown to a server deadline. serverTime corrects for clock differences between client and server. */
export function useCountdown(deadline: string | number | null | undefined, serverTime?: number) {
  const offset = useRef(serverTime ? serverTime - Date.now() : 0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (serverTime) offset.current = serverTime - Date.now();
  }, [serverTime]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  if (!deadline) return null;
  return Math.max(0, Math.floor((new Date(deadline).getTime() - (now + offset.current)) / 1000));
}

export function TimerBadge({ seconds }: { seconds: number | null }) {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const low = seconds < 120;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-sm font-semibold ${low ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`} role="timer" aria-live={low ? 'polite' : 'off'}>
      <Clock className="h-4 w-4" />
      {m}:{String(s).padStart(2, '0')}
    </span>
  );
}

/** Simple elapsed-time counter (for untimed practice). */
export function useElapsed() {
  const start = useRef(Date.now());
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.floor((Date.now() - start.current) / 1000);
}
