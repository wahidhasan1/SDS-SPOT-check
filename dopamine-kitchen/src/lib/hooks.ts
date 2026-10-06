import { useEffect, useState } from 'react'

/** Simulates network latency so skeleton loaders are visible, like a real API-backed app. */
export function useSimLoad(deps: unknown[] = [], ms = 550) {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), ms + Math.random() * 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return loading
}

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Dopamine Kitchen` : 'Dopamine Kitchen — Feed the craving. Skip the delivery.'
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
