import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, Gift, Info } from 'lucide-react'
import type { Voucher } from '../data/types'
import { WHEEL_SEGMENTS, oddsPct } from '../lib/rewards'
import { cx, fmtDate, taka } from '../lib/format'
import { toast } from '../store/toast'
import { Confetti, Modal } from './ui'

const N = WHEEL_SEGMENTS.length
const SEG = 360 / N

function arc(i: number, r: number, c: number) {
  const a0 = ((i * SEG - 90) * Math.PI) / 180
  const a1 = (((i + 1) * SEG - 90) * Math.PI) / 180
  return `M ${c} ${c} L ${c + r * Math.cos(a0)} ${c + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${c + r * Math.cos(a1)} ${c + r * Math.sin(a1)} Z`
}

/**
 * Welcome Lucky Wheel. `onSpin` decides the outcome (server-side in a real product) and returns the
 * winning segment index; the wheel then animates to land exactly on it.
 */
export function LuckyWheel({ onSpin, onDone, disabled }: { onSpin: () => number | null; onDone: () => void; disabled?: boolean }) {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [showOdds, setShowOdds] = useState(false)
  const done = useRef(false)
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const duration = reduced ? 600 : 4200

  const spin = () => {
    if (spinning || disabled || done.current) return
    const idx = onSpin()
    if (idx === null) return
    done.current = true
    navigator.vibrate?.(12)
    const jitter = (Math.random() - 0.5) * SEG * 0.6
    const target = 360 * 6 + (360 - (idx * SEG + SEG / 2)) + jitter
    setSpinning(true)
    setRotation(target)
    setTimeout(() => {
      setSpinning(false)
      navigator.vibrate?.([20, 40, 20])
      onDone()
    }, duration + 150)
  }

  const C = 160, R = 150
  const labels = useMemo(
    () =>
      WHEEL_SEGMENTS.map((s, i) => {
        const mid = i * SEG + SEG / 2
        return { s, mid }
      }),
    [],
  )

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[min(84vw,340px)] aspect-square">
        {/* pointer */}
        <div className={cx('absolute left-1/2 -top-2 z-20 -translate-x-1/2 drop-shadow-md', spinning && 'animate-[wiggle_0.18s_ease-in-out_infinite]')} aria-hidden>
          <svg width="34" height="40" viewBox="0 0 34 40"><path d="M17 40 L2 8 A16 16 0 0 1 32 8 Z" fill="#121513" /><circle cx="17" cy="13" r="5" fill="#FFC233" /></svg>
        </div>
        <div className="absolute inset-0 rounded-full bg-ink-900 p-2.5 shadow-lift">
          <svg
            viewBox="0 0 320 320"
            className="size-full"
            style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? `transform ${duration}ms cubic-bezier(0.12, 0.7, 0.13, 1)` : undefined }}
            role="img"
            aria-label="Lucky wheel with eight rewards"
          >
            {labels.map(({ s, mid }, i) => (
              <g key={s.id}>
                <path d={arc(i, R, C)} fill={s.fill} stroke="#121513" strokeWidth="2" />
                <g transform={`rotate(${mid} ${C} ${C})`}>
                  <text x={C} y={C - R + 34} textAnchor="middle" fill={s.text} fontSize={s.label.length > 8 ? 11.5 : 15} fontWeight="800" fontFamily="Figtree, system-ui, sans-serif" letterSpacing="0.02em">
                    {s.label.includes(' ') && s.label.length > 8 ? (
                      <>
                        <tspan x={C} dy="0">{s.label.split(' ')[0]}</tspan>
                        <tspan x={C} dy="14">{s.label.split(' ').slice(1).join(' ')}</tspan>
                      </>
                    ) : s.label}
                  </text>
                  {s.mystery && <text x={C} y={C - R + 66} textAnchor="middle" fontSize="18" fill={s.text} fontWeight="800">?</text>}
                </g>
              </g>
            ))}
            {Array.from({ length: N }).map((_, i) => {
              const a = ((i * SEG - 90) * Math.PI) / 180
              return <circle key={i} cx={C + (R - 6) * Math.cos(a)} cy={C + (R - 6) * Math.sin(a)} r="3" fill="#FFC233" />
            })}
          </svg>
        </div>
        <button
          onClick={spin}
          disabled={spinning || disabled}
          className="absolute left-1/2 top-1/2 z-10 grid size-[30%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-sun-400 text-ink-900 font-extrabold text-xl tracking-wide shadow-lift ring-[6px] ring-ink-900 transition hover:bg-sun-300 active:scale-95 disabled:opacity-100 disabled:active:scale-100"
          aria-label="Spin the wheel"
        >
          {spinning ? <span className="text-sm">Spinning…</span> : 'SPIN'}
        </button>
      </div>
      <style>{'@keyframes wiggle{0%,100%{transform:translateX(-50%) rotate(0)}50%{transform:translateX(-50%) rotate(-7deg)}}'}</style>
      <button onClick={() => setShowOdds((v) => !v)} className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-ink-500 hover:text-ink-900" aria-expanded={showOdds}>
        <Info className="size-4" /> Every slice is a real reward · See the odds
      </button>
      {showOdds && (
        <ul className="mt-3 grid w-full max-w-sm grid-cols-2 gap-x-6 gap-y-1 rounded-2xl bg-ink-50 p-4 text-sm animate-fade-in">
          {WHEEL_SEGMENTS.map((s) => (
            <li key={s.id} className="flex justify-between gap-2"><span className="text-ink-700">{s.headline}</span><span className="font-bold tabular-nums">{oddsPct(s)}%</span></li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Shown when the wheel stops: clear, honest summary of the reward and how to use it. */
export function RewardResultModal({ open, voucher, headline, onClose, onUse }: { open: boolean; voucher: Voucher | null; headline: string; onClose: () => void; onUse: () => void }) {
  if (!voucher) return null
  const rules = [
    voucher.type === 'freeDelivery' ? 'Delivery fee waived' : voucher.type === 'flat' ? `${taka(voucher.value)} off your order` : `${voucher.value}% off${voucher.maxDiscount ? `, up to ${taka(voucher.maxDiscount)}` : ''}`,
    `Minimum order ${taka(voucher.minOrder)}`,
    `Valid on ${voucher.categoriesLabel.toLowerCase()}`,
    `Use once before ${fmtDate(voucher.expiresAt)}`,
  ]
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="relative -mx-5 -mt-2 overflow-hidden px-5 pt-2 text-center">
        <Confetti />
        <span className="relative mx-auto grid size-16 place-items-center rounded-full bg-sun-400 text-ink-900 animate-pop"><Gift className="size-8" /></span>
        <p className="relative mt-3 text-sm font-bold uppercase tracking-wide text-brand-700">You won</p>
        <p className="relative text-4xl font-extrabold tracking-tight animate-pop">{headline}</p>
        <p className="relative mt-1 text-[15px] text-ink-500">Your voucher has been added to your account.</p>
      </div>
      <div className="mt-5 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-lg font-extrabold tracking-wider">{voucher.code}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => { navigator.clipboard?.writeText(voucher.code).catch(() => undefined); toast('success', 'Code copied') }}><Copy className="size-4" /> Copy</button>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm text-ink-700">
          {rules.map((r) => <li key={r} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand-600" /> {r}</li>)}
        </ul>
      </div>
      <p className="mt-3 text-center text-xs text-ink-500">It applies automatically as a suggestion at checkout. Find it anytime in <Link to="/account/vouchers" onClick={onClose} className="font-bold text-brand-700">My vouchers</Link>.</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button className="btn btn-secondary btn-lg" onClick={onClose}>Continue exploring</button>
        <button className="btn btn-primary btn-lg" onClick={onUse}>Use voucher</button>
      </div>
    </Modal>
  )
}
