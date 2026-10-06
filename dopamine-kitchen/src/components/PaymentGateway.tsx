import { useEffect, useState } from 'react'
import { CircleCheck, CircleX, FlaskConical, Loader2, Lock, ShieldCheck } from 'lucide-react'
import type { PaymentMethodId } from '../data/types'
import { cx, taka } from '../lib/format'
import { Modal } from './ui'

// ===================== DEMO PAYMENT SYSTEM =====================
// Entirely simulated. It never contacts bKash, Nagad, a card network or any payment provider, and it
// only accepts the published test credentials below — anything that looks like a real wallet or card is
// rejected, so no real financial data is collected.

export const DEMO_WALLETS: Record<string, 'success' | 'insufficient'> = {
  '01700000000': 'success',
  '01800000000': 'success',
  '01700000001': 'insufficient',
  '01800000001': 'insufficient',
}
export const DEMO_PIN = '12345'

export const DEMO_CARDS: Record<string, { result: 'success' | 'declined' | 'insufficient'; brand: string }> = {
  '4242424242424242': { result: 'success', brand: 'Visa (test)' },
  '5555555555554444': { result: 'success', brand: 'Mastercard (test)' },
  '4000000000000002': { result: 'declined', brand: 'Visa (test)' },
  '4000000000009995': { result: 'insufficient', brand: 'Visa (test)' },
}

export const PAYMENT_META: Record<PaymentMethodId, { label: string; color: string; short: string; desc: string }> = {
  bkash: { label: 'bKash', color: '#D6246E', short: 'bK', desc: 'Demo wallet' },
  nagad: { label: 'Nagad', color: '#EC5B24', short: 'N', desc: 'Demo wallet' },
  card: { label: 'Card', color: '#121513', short: 'Card', desc: 'Test cards only' },
  cod: { label: 'Cash on delivery', color: '#0A7F57', short: '৳', desc: 'Pay the (imaginary) rider' },
}

export function PaymentLogo({ method, size = 40 }: { method: PaymentMethodId; size?: number }) {
  const m = PAYMENT_META[method]
  return (
    <span className="grid shrink-0 place-items-center rounded-xl font-extrabold text-white" style={{ width: size, height: size, background: m.color, fontSize: m.short.length > 2 ? size * 0.26 : size * 0.36 }} aria-hidden>
      {m.short}
    </span>
  )
}

export type GatewayResult = { ok: true; ref: string } | { ok: false; reason: string }
type Step = 'wallet' | 'processing' | 'success' | 'failed'

/** Demo gateway: wallets confirm with a test number + PIN on one screen; cards and COD go straight to processing. */
export function PaymentGateway({ open, method, amount, cardNumber, onClose, onResult }: {
  open: boolean; method: PaymentMethodId; amount: number; cardNumber?: string
  onClose: () => void; onResult: (r: GatewayResult) => void
}) {
  const isWallet = method === 'bkash' || method === 'nagad'
  const initial: Step = isWallet ? 'wallet' : 'processing'
  const [step, setStep] = useState<Step>(initial)
  const [wallet, setWallet] = useState('01700000000')
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [failReason, setFailReason] = useState('')

  useEffect(() => {
    if (open) {
      setStep(initial)
      setPin('')
      setErr('')
      setFailReason('')
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const outcome = (): 'success' | string => {
    if (method === 'cod') return 'success'
    if (method === 'card') {
      const c = DEMO_CARDS[(cardNumber ?? '').replace(/\s/g, '')]
      if (!c) return 'This card is not a demo test card.'
      return c.result === 'success' ? 'success' : c.result === 'declined' ? 'The card was declined (simulated).' : 'The test card has insufficient funds (simulated).'
    }
    return DEMO_WALLETS[wallet] === 'success' ? 'success' : 'The test wallet has insufficient balance (simulated).'
  }

  useEffect(() => {
    if (step !== 'processing') return
    const t = setTimeout(() => {
      const o = outcome()
      if (o === 'success') setStep('success')
      else {
        setFailReason(o)
        setStep('failed')
      }
    }, 1300)
    return () => clearTimeout(t)
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step !== 'success') return
    const t = setTimeout(() => onResult({ ok: true, ref: `SIM-${method.toUpperCase()}-${Date.now().toString(36).toUpperCase().slice(-6)}` }), 900)
    return () => clearTimeout(t)
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const meta = PAYMENT_META[method]
  const busy = step === 'processing' || step === 'success'

  const confirmWallet = () => {
    const w = wallet.replace(/\D/g, '')
    if (!(w in DEMO_WALLETS)) return setErr('Only demo test numbers work here. Pick one below — never enter a real account.')
    if (pin !== DEMO_PIN) return setErr('Wrong PIN. The demo PIN is 12345.')
    setWallet(w)
    setErr('')
    setStep('processing')
  }

  return (
    <Modal open={open} onClose={onClose} size="sm" hideClose={busy}>
      <div className="-mx-5 -mt-2 mb-4 flex items-center justify-between px-5 py-3 text-white" style={{ background: meta.color }}>
        <span className="flex items-center gap-2 font-bold"><Lock className="size-4" /> {meta.label} · Demo payment</span>
        <span className="font-extrabold tabular-nums">{taka(amount)}</span>
      </div>

      {step === 'wallet' && (
        <form onSubmit={(e) => { e.preventDefault(); confirmWallet() }} noValidate>
          <label htmlFor="gw-wallet" className="label">Test wallet number</label>
          <input id="gw-wallet" inputMode="numeric" maxLength={11} value={wallet} onChange={(e) => { setWallet(e.target.value.replace(/\D/g, '')); setErr('') }} className="input font-mono text-lg tracking-wider" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setWallet(method === 'nagad' ? '01800000000' : '01700000000')} className={cx('chip h-8', DEMO_WALLETS[wallet] === 'success' && 'chip-active')}>Test: succeeds</button>
            <button type="button" onClick={() => setWallet(method === 'nagad' ? '01800000001' : '01700000001')} className={cx('chip h-8', DEMO_WALLETS[wallet] === 'insufficient' && 'chip-active')}>Test: low balance</button>
          </div>
          <label htmlFor="gw-pin" className="label mt-4">PIN <span className="font-normal text-ink-500">(demo PIN is 12345)</span></label>
          <input id="gw-pin" autoFocus type="password" inputMode="numeric" maxLength={5} value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setErr('') }} placeholder="•••••" className={cx('input text-center font-mono text-2xl tracking-[0.5em]', err && 'input-error')} aria-invalid={!!err} />
          {err && <p className="mt-2 text-sm font-medium text-red-600" role="alert">{err}</p>}
          <button className="btn btn-lg mt-5 w-full text-white" style={{ background: meta.color }} disabled={pin.length < 5}>Pay {taka(amount)}</button>
        </form>
      )}

      {step === 'processing' && (
        <div className="py-8 text-center" role="status">
          <Loader2 className="mx-auto size-12 animate-spin text-ink-700" />
          <p className="mt-4 font-bold">{method === 'cod' ? 'Placing your order…' : 'Confirming payment…'}</p>
          <p className="text-sm text-ink-500">Simulated — nothing is charged.</p>
        </div>
      )}

      {step === 'success' && (
        <div className="py-8 text-center animate-pop" role="status">
          <CircleCheck className="mx-auto size-16 text-brand-600" />
          <p className="mt-3 text-xl font-extrabold">{method === 'cod' ? 'Order placed' : 'Payment successful'}</p>
          <p className="text-sm text-ink-500">{taka(amount)} was not actually charged.</p>
        </div>
      )}

      {step === 'failed' && (
        <div className="py-6 text-center animate-pop" role="alert">
          <CircleX className="mx-auto size-16 text-red-500" />
          <p className="mt-3 text-xl font-extrabold">Payment didn’t go through</p>
          <p className="text-sm text-ink-500">{failReason} Nothing was charged.</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button className="btn btn-secondary" onClick={() => onResult({ ok: false, reason: failReason })}>Change payment method</button>
            <button className="btn btn-primary" onClick={() => { setPin(''); setStep(initial) }}>Try again</button>
          </div>
        </div>
      )}

      <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-ink-500"><FlaskConical className="size-3.5" /> Not connected to {isWallet ? meta.label : 'any card network'} <ShieldCheck className="ml-2 size-3.5" /> pikk Demo Pay</p>
    </Modal>
  )
}
