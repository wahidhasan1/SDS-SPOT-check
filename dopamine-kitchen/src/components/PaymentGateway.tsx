import { useEffect, useState } from 'react'
import { CircleCheck, CircleX, FlaskConical, Loader2, Lock, ShieldCheck } from 'lucide-react'
import type { PaymentMethodId } from '../data/types'
import { cx, taka } from '../lib/format'
import { Modal } from './ui'

// ===================== DEMO PAYMENT SYSTEM =====================
// This gateway is entirely simulated. It never contacts bKash, Nagad, a card network or any
// payment provider, and it only accepts the published test credentials below — anything that
// looks like a real wallet number or card is rejected so no real financial data is collected.

export const DEMO_WALLETS: Record<string, 'success' | 'insufficient'> = {
  '01700000000': 'success',
  '01800000000': 'success',
  '01700000001': 'insufficient',
  '01800000001': 'insufficient',
}
export const DEMO_OTP = '123456'
export const DEMO_PIN = '12345'

export const DEMO_CARDS: Record<string, { result: 'success' | 'declined' | 'insufficient'; brand: string }> = {
  '4242424242424242': { result: 'success', brand: 'Visa (test)' },
  '5555555555554444': { result: 'success', brand: 'Mastercard (test)' },
  '4000000000000002': { result: 'declined', brand: 'Visa (test)' },
  '4000000000009995': { result: 'insufficient', brand: 'Visa (test)' },
}

export const PAYMENT_META: Record<PaymentMethodId, { label: string; color: string; short: string; desc: string }> = {
  bkash: { label: 'bKash', color: '#D6246E', short: 'bK', desc: 'Demo mobile wallet flow' },
  nagad: { label: 'Nagad', color: '#EC5B24', short: 'N', desc: 'Demo mobile wallet flow' },
  card: { label: 'Credit / Debit card', color: '#1E3A8A', short: '💳', desc: 'Test cards only' },
  cod: { label: 'Cash on delivery', color: '#15803D', short: '৳', desc: 'Pay the imaginary rider' },
}

export function PaymentLogo({ method, size = 40 }: { method: PaymentMethodId; size?: number }) {
  const m = PAYMENT_META[method]
  return (
    <span className="grid shrink-0 place-items-center rounded-xl font-extrabold text-white" style={{ width: size, height: size, background: m.color, fontSize: size * 0.36 }}>
      {m.short}
    </span>
  )
}

export type GatewayResult = { ok: true; ref: string } | { ok: false; reason: string }

type Step = 'wallet' | 'otp' | 'pin' | 'card3ds' | 'processing' | 'success' | 'failed'

export function PaymentGateway({ open, method, amount, cardNumber, onClose, onResult }: {
  open: boolean; method: PaymentMethodId; amount: number; cardNumber?: string
  onClose: () => void; onResult: (r: GatewayResult) => void
}) {
  const initial: Step = method === 'cod' ? 'processing' : method === 'card' ? 'card3ds' : 'wallet'
  const [step, setStep] = useState<Step>(initial)
  const [wallet, setWallet] = useState('')
  const [otp, setOtp] = useState('')
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [failReason, setFailReason] = useState('')

  useEffect(() => {
    if (open) {
      setStep(initial)
      setWallet(''); setOtp(''); setPin(''); setErr(''); setFailReason('')
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const outcome = (): 'success' | string => {
    if (method === 'cod') return 'success'
    if (method === 'card') {
      const c = DEMO_CARDS[(cardNumber ?? '').replace(/\s/g, '')]
      if (!c) return 'Card not recognised by the demo gateway.'
      return c.result === 'success' ? 'success' : c.result === 'declined' ? 'Card declined by the (simulated) issuing bank.' : 'Insufficient funds on the test card.'
    }
    return DEMO_WALLETS[wallet] === 'success' ? 'success' : 'Insufficient balance in the test wallet.'
  }

  // Processing → result
  useEffect(() => {
    if (step !== 'processing') return
    const t = setTimeout(() => {
      const o = outcome()
      if (o === 'success') setStep('success')
      else {
        setFailReason(o)
        setStep('failed')
      }
    }, method === 'cod' ? 1200 : 2200)
    return () => clearTimeout(t)
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Success → hand back to checkout
  useEffect(() => {
    if (step !== 'success') return
    const t = setTimeout(() => onResult({ ok: true, ref: `SIM-${method.toUpperCase()}-${Date.now().toString(36).toUpperCase().slice(-6)}` }), 1300)
    return () => clearTimeout(t)
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const meta = PAYMENT_META[method]
  const isWallet = method === 'bkash' || method === 'nagad'
  const busy = step === 'processing' || step === 'success'

  return (
    <Modal open={open} onClose={onClose} size="sm" hideClose={busy}>
      <div className="-mx-5 -mt-2 mb-4 flex items-center justify-between px-5 py-3 text-white" style={{ background: meta.color }}>
        <div className="flex items-center gap-2 font-bold"><Lock className="size-4" /> {meta.label} · Demo Payment</div>
        <span className="text-sm font-bold">{taka(amount)}</span>
      </div>
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <FlaskConical className="size-4 shrink-0" />
        <span>Simulated gateway — not connected to {isWallet ? meta.label : 'any card network'}. No money moves. Only the test credentials shown below are accepted.</span>
      </div>

      {step === 'wallet' && (
        <form onSubmit={(e) => { e.preventDefault(); const w = wallet.replace(/\D/g, ''); if (!(w in DEMO_WALLETS)) return setErr('Only demo wallet numbers are accepted (e.g. 01700000000). Never enter a real account.'); setWallet(w); setErr(''); setStep('otp') }}>
          <label className="label">Your {meta.label} test wallet number</label>
          <input autoFocus inputMode="numeric" maxLength={11} value={wallet} onChange={(e) => setWallet(e.target.value.replace(/\D/g, ''))} placeholder="01700000000" className={cx('input font-mono text-lg tracking-wider', err && 'input-error')} />
          {err && <p className="mt-1.5 text-xs font-medium text-red-600">{err}</p>}
          <TestHint lines={['01700000000 / 01800000000 → success', '01700000001 / 01800000001 → insufficient balance']} />
          <button className="btn w-full mt-4 text-white" style={{ background: meta.color }}>Continue</button>
        </form>
      )}

      {(step === 'otp' || step === 'card3ds') && (
        <form onSubmit={(e) => { e.preventDefault(); if (otp !== DEMO_OTP) return setErr('Incorrect verification code. The demo code is 123456.'); setErr(''); setStep(step === 'otp' ? 'pin' : 'processing') }}>
          <p className="text-sm text-ink-700">{step === 'otp' ? <>A verification code was “sent” to <b className="font-mono">{wallet}</b>.</> : <>3-D Secure check for card ending <b className="font-mono">{(cardNumber ?? '').slice(-4)}</b>.</>}</p>
          <label className="label mt-3">Verification code (OTP)</label>
          <input autoFocus inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="••••••" className={cx('input text-center font-mono text-2xl tracking-[0.5em]', err && 'input-error')} />
          {err && <p className="mt-1.5 text-xs font-medium text-red-600">{err}</p>}
          <TestHint lines={['Demo OTP: 123456']} />
          <button className="btn w-full mt-4 text-white" style={{ background: meta.color }}>Verify</button>
        </form>
      )}

      {step === 'pin' && (
        <form onSubmit={(e) => { e.preventDefault(); if (pin !== DEMO_PIN) return setErr('Wrong PIN. The demo PIN is 12345.'); setErr(''); setStep('processing') }}>
          <label className="label">Enter your {meta.label} PIN</label>
          <input autoFocus type="password" inputMode="numeric" maxLength={5} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="•••••" className={cx('input text-center font-mono text-2xl tracking-[0.5em]', err && 'input-error')} />
          {err && <p className="mt-1.5 text-xs font-medium text-red-600">{err}</p>}
          <TestHint lines={['Demo PIN: 12345 (never enter your real PIN anywhere but the official app)']} />
          <button className="btn w-full mt-4 text-white" style={{ background: meta.color }}>Confirm payment of {taka(amount)}</button>
        </form>
      )}

      {step === 'processing' && (
        <div className="py-8 text-center">
          <Loader2 className="mx-auto size-12 animate-spin" style={{ color: meta.color }} />
          <p className="mt-4 font-bold">{method === 'cod' ? 'Placing your test order…' : 'Processing simulated payment…'}</p>
          <p className="text-sm text-ink-500">Please don't close this window (it's fine, really — it's a demo).</p>
        </div>
      )}

      {step === 'success' && (
        <div className="py-8 text-center animate-pop">
          <CircleCheck className="mx-auto size-16 text-emerald-500" />
          <p className="mt-3 font-display text-xl font-bold">{method === 'cod' ? 'Order placed' : 'Payment successful'}</p>
          <p className="text-sm text-ink-500">Simulated · {taka(amount)} was not actually charged.</p>
        </div>
      )}

      {step === 'failed' && (
        <div className="py-6 text-center animate-pop">
          <CircleX className="mx-auto size-16 text-red-500" />
          <p className="mt-3 font-display text-xl font-bold">Payment failed</p>
          <p className="text-sm text-ink-500">{failReason}</p>
          <p className="mt-1 text-xs text-ink-400">(This failure was simulated on purpose by the test credentials.)</p>
          <div className="mt-5 flex gap-2">
            <button className="btn btn-secondary flex-1" onClick={() => { onResult({ ok: false, reason: failReason }) }}>Change method</button>
            <button className="btn btn-primary flex-1" onClick={() => { setOtp(''); setPin(''); setStep(initial) }}>Try again</button>
          </div>
        </div>
      )}

      <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-ink-400"><ShieldCheck className="size-3.5" /> Dopamine Kitchen Demo Pay · no real transactions</p>
    </Modal>
  )
}

function TestHint({ lines }: { lines: string[] }) {
  return (
    <div className="mt-3 rounded-xl bg-ink-50 p-3 text-xs text-ink-600">
      <p className="font-bold text-ink-700 mb-1">Test credentials</p>
      {lines.map((l) => <p key={l} className="font-mono">{l}</p>)}
    </div>
  )
}
