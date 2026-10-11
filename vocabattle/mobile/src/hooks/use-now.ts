import { useEffect, useState } from 'react';

/** Re-renders every `intervalMs` and returns the (offset-corrected) current time in ms. */
export function useNow(intervalMs = 200, offsetMs = 0, active = true) {
  const [now, setNow] = useState(() => Date.now() + offsetMs);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now() + offsetMs), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, offsetMs, active]);
  return now;
}
