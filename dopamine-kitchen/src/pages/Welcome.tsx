import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import type { Voucher } from '../data/types'
import { useMe, useStore } from '../store/store'
import { toast } from '../store/toast'
import { voucherDestination } from '../lib/pricing'
import { useTitle } from '../lib/hooks'
import { LuckyWheel, RewardResultModal } from '../components/LuckyWheel'
import { LogoMark } from '../components/Logo'

/** First-signup welcome: account confirmation, then the one-time Lucky Wheel. Also reachable from My vouchers until used. */
export default function Welcome() {
  useTitle('Welcome')
  const me = useMe()!
  const nav = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/'
  const spin = useStore((s) => s.spinWelcomeWheel)
  const alreadySpun = useStore((s) => s.db.rewardEvents.some((e) => e.userId === s.currentUserId && e.kind === 'welcome_spin'))
  const [result, setResult] = useState<{ voucher: Voucher; headline: string } | null>(null)
  const [open, setOpen] = useState(false)
  const [spunNow, setSpunNow] = useState(false)

  const later = () => {
    toast('info', 'Your spin will wait for you', 'Find it in Account → My vouchers.')
    nav(next, { replace: true })
  }

  return (
    <div className="min-h-dvh bg-ink-50">
      <div className="bg-brand-surface text-white">
        <div className="mx-auto max-w-xl px-4 pt-6 pb-24 text-center">
          <div className="flex items-center justify-between">
            <LogoMark size={34} />
            {!spunNow && !alreadySpun && <button onClick={later} className="text-sm font-bold text-white/80 hover:text-white">Maybe later</button>}
          </div>
          <span className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-bold"><CircleCheck className="size-4" /> Account created</span>
          <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">Welcome to pikk, {me.name.split(' ')[0]}!</h1>
          <p className="mx-auto mt-2 max-w-sm text-white/85">
            {alreadySpun && !spunNow ? 'You have already used your welcome spin. Your reward is waiting in My vouchers.' : 'Here’s a welcome gift. Spin once and win a real voucher for your first simulated order.'}
          </p>
        </div>
      </div>
      <div className="mx-auto -mt-16 max-w-xl px-4 pb-10">
        <div className="card p-6 sm:p-8">
          <LuckyWheel
            disabled={alreadySpun && !spunNow}
            onSpin={() => {
              const r = spin()
              if (!r) return null
              setSpunNow(true)
              setResult({ voucher: r.voucher, headline: r.headline })
              return r.segmentIndex
            }}
            onDone={() => setOpen(true)}
          />
          {(alreadySpun || spunNow) && (
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button className="btn btn-secondary btn-lg" onClick={() => nav('/account/vouchers')}>View my vouchers</button>
              <button className="btn btn-primary btn-lg" onClick={() => nav(next, { replace: true })}>Start exploring</button>
            </div>
          )}
          <p className="mt-6 text-center text-xs text-ink-500">One spin per new account. Vouchers are for simulated orders only and have no cash value.</p>
        </div>
      </div>
      <RewardResultModal
        open={open}
        voucher={result?.voucher ?? null}
        headline={result?.headline ?? ''}
        onClose={() => { setOpen(false); nav(next, { replace: true }) }}
        onUse={() => {
          setOpen(false)
          toast('success', `${result?.voucher.code} is ready`, 'We’ll suggest it at checkout once your cart qualifies.')
          nav(result ? voucherDestination(result.voucher) : '/', { replace: true })
        }}
      />
    </div>
  )
}
