import { useEffect, useState } from 'react'

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · pikk` : 'pikk — Pick anything. Pay nothing.'
  }, [title])
}

/** Re-render every `ms` (for live countdowns). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}
