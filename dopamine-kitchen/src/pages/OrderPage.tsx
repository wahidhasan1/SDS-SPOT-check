import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Bike, Check, ChefHat, CircleCheck, Clock, FastForward, FlaskConical, Headphones, House, MessageCircle,
  Package, PartyPopper, Phone, PiggyBank, ReceiptText, RotateCcw, Star, Store, Truck, Warehouse, XCircle,
} from 'lucide-react'
import type { Order, OrderStage, SimSpeed } from '../data/types'
import { useStore, artFor } from '../store/store'
import { confirmDialog, toast } from '../store/toast'
import { STAGE_AT, STAGES, isActive, minutesLeft, progressOf, stageLabel } from '../lib/sim'
import { cx, fmtDateTime, fmtDuration, fmtTime, hashStr, maskPhone, rng, taka } from '../lib/format'
import { useNow, useTitle } from '../lib/hooks'
import { PAYMENT_META, PaymentLogo } from '../components/PaymentGateway'
import { useReorder } from '../components/reorder'
import { StatusBadge } from '../components/cards'
import { Avatar, Badge, EmptyState, Img, Stars } from '../components/ui'

export default function OrderPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const o = useStore((s) => s.db.orders.find((x) => x.id === id))
  const uid = useStore((s) => s.currentUserId)
  const me = useStore((s) => s.db.users.find((u) => u.id === s.currentUserId))
  useTitle(o ? `Order ${o.id}` : 'Order')
  useNow(1000)
  if (!o || (o.userId !== uid && me?.role !== 'admin'))
    return <div className="mx-auto max-w-3xl px-4"><EmptyState emoji="🧾" title="Order not found" body="This test order doesn't exist or belongs to another demo account." action={<Link to="/orders" className="btn btn-primary">My orders</Link>} /></div>
  const placed = params.get('placed') === '1'

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 animate-fade-in">
      <div className="flex items-center gap-2">
        <button onClick={() => nav('/orders')} className="icon-btn -ml-2" aria-label="Back to orders"><ArrowLeft className="size-5" /></button>
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl font-bold leading-tight">Order #{o.id}</h1>
          <p className="text-xs text-ink-500">{o.storeName} · {fmtDateTime(o.placedAt)}</p>
        </div>
        <div className="ml-auto flex items-center gap-2"><Badge tone="warning">Test order</Badge><StatusBadge order={o} /></div>
      </div>

      {placed && o.status !== 'cancelled' && (
        <div className="relative mt-4 overflow-hidden rounded-3xl bg-brand-gradient p-5 sm:p-6 text-white animate-pop">
          <Confetti />
          <div className="relative flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/20"><PartyPopper className="size-6" /></span>
            <div className="flex-1">
              <p className="font-display text-2xl font-extrabold">Test order placed!</p>
              <p className="text-white/85 text-sm">Order #{o.id} was confirmed by {o.storeName} (simulated). {taka(o.total)} was <b>not</b> charged. Sit back and track the journey.</p>
            </div>
            <button onClick={() => setParams({}, { replace: true })} className="text-white/70 hover:text-white text-sm">Dismiss</button>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5 min-w-0">
          {o.status === 'delivered' ? <DeliveredPanel o={o} /> : o.status === 'cancelled' ? <CancelledPanel o={o} /> : <LivePanel o={o} />}
          <Timeline o={o} />
        </div>
        <div className="space-y-5">
          {o.status !== 'cancelled' && <RiderCard o={o} />}
          <OrderDetails o={o} />
        </div>
      </div>
    </div>
  )
}

function LivePanel({ o }: { o: Order }) {
  const speed = useStore((s) => s.settings.simSpeed)
  const updateSettings = useStore((s) => s.updateSettings)
  const advance = useStore((s) => s.advanceOrder)
  const cancel = useStore((s) => s.cancelOrder)
  const p = progressOf(o)
  const left = minutesLeft(o)
  const realLeft = left / speed
  const label = stageLabel(o.kind, o.status)
  const canCancel = o.status === 'confirmed' || o.status === 'preparing'
  return (
    <div className="card overflow-hidden">
      <MapSim o={o} />
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brand-600">{o.kind === 'food' ? 'Food delivery' : 'Parcel delivery'} · simulated</p>
            <p className="font-display text-2xl font-extrabold">{label.title}</p>
            <p className="text-sm text-ink-500">{label.detail}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-500">Estimated arrival</p>
            <p className="font-display text-2xl font-extrabold text-brand-700">{fmtTime(Date.now() + realLeft * 60000)}</p>
            <p className="text-xs font-semibold text-ink-500">in {fmtDuration(realLeft)}{speed > 1 && ` (${speed}× speed)`}</p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-100">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-coral-500 transition-all duration-1000" style={{ width: `${Math.max(3, p * 100)}%` }} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink-500">Simulation speed</span>
          <div className="flex rounded-xl bg-ink-100 p-0.5">
            {([1, 10, 60] as SimSpeed[]).map((s) => (
              <button key={s} onClick={() => { updateSettings({ simSpeed: s }); toast('info', `Simulation speed ${s}×`, s === 1 ? 'Real-time: food ≈ 30 min, shopping ≈ 1 day.' : undefined) }} className={cx('h-8 rounded-lg px-3 text-xs font-bold', speed === s ? 'bg-white shadow-sm text-brand-700' : 'text-ink-500')}>
                {s === 1 ? 'Real-time' : `${s}×`}
              </button>
            ))}
          </div>
          <button onClick={() => advance(o.id)} className="btn btn-soft btn-sm"><FastForward className="size-4" /> Skip to next stage</button>
          {canCancel && (
            <button onClick={async () => { if (await confirmDialog({ title: 'Cancel this test order?', body: 'Nothing was charged, so there is nothing to refund. You can always place another simulated order.', confirmLabel: 'Cancel order', tone: 'danger' })) cancel(o.id) }} className="btn btn-ghost btn-sm text-red-600 ml-auto">
              <XCircle className="size-4" /> Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function DeliveredPanel({ o }: { o: Order }) {
  const patch = useStore((s) => s.patchOrder)
  const reorder = useReorder()
  const mindful = useStore((s) => s.settings.mindfulCheckIn)
  const [after, setAfter] = useState(o.cravingAfter ?? 0)
  return (
    <div className="card overflow-hidden">
      <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white">
        <Confetti />
        <CircleCheck className="relative size-12" />
        <p className="relative mt-3 font-display text-2xl sm:text-3xl font-extrabold">Simulation Complete</p>
        <p className="relative text-lg font-semibold text-white/95">No real product was delivered.</p>
        <p className="relative mt-1 text-sm text-white/80">Your “{o.items[0]?.name}” journey finished {o.stageTimes.delivered ? `at ${fmtTime(o.stageTimes.delivered)}` : ''}. You rode the craving from browse to doorstep — without spending a taka.</p>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div className="rounded-2xl bg-ink-900 p-4 text-white">
          <PiggyBank className="size-6 text-coral-300" />
          <p className="mt-2 text-xs text-white/70">Money not spent</p>
          <p className="font-display text-3xl font-extrabold">{taka(o.total)}</p>
        </div>
        {mindful && (
          <div className="rounded-2xl bg-brand-50 p-4">
            <p className="font-bold text-sm">Craving check-in 🧠</p>
            <p className="text-xs text-ink-500">How strong is the craving now?{o.cravingBefore ? ` (Before: ${o.cravingBefore}/5)` : ''}</p>
            <div className="mt-2"><Stars value={after} onChange={(v) => { setAfter(v); patch(o.id, { cravingAfter: v }); toast('success', !o.cravingBefore ? `Craving logged at ${v}/5` : v < o.cravingBefore ? 'Nice — the craving eased off 🎉' : 'Logged. Cravings come in waves; this one will pass too.') }} size={26} /></div>
          </div>
        )}
        <div className="rounded-2xl border border-ink-100 p-4">
          <p className="font-bold text-sm">Rate the experience</p>
          <div className="mt-2"><Stars value={o.rating ?? 0} onChange={(v) => { patch(o.id, { rating: v }); toast('success', 'Thanks for rating your simulated order') }} size={26} /></div>
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={() => reorder(o)} className="btn btn-primary"><RotateCcw className="size-4" /> Reorder (simulate again)</button>
          <Link to="/" className="btn btn-secondary">Back to home</Link>
        </div>
      </div>
    </div>
  )
}

function CancelledPanel({ o }: { o: Order }) {
  const reorder = useReorder()
  return (
    <div className="card p-6 text-center">
      <XCircle className="mx-auto size-12 text-red-500" />
      <p className="mt-2 font-display text-2xl font-bold">Order cancelled</p>
      <p className="text-sm text-ink-500">This test order was cancelled{o.cancelledAt ? ` at ${fmtDateTime(o.cancelledAt)}` : ''}. No money was charged and nothing needs refunding.</p>
      <div className="mt-4 flex justify-center gap-2">
        <button onClick={() => reorder(o)} className="btn btn-primary"><RotateCcw className="size-4" /> Reorder</button>
        <Link to="/help" className="btn btn-secondary">Get help</Link>
      </div>
    </div>
  )
}

const ICONS: Record<OrderStage, typeof Check> = { confirmed: ReceiptText, preparing: ChefHat, picked_up: Package, on_the_way: Bike, delivered: House }

function Timeline({ o }: { o: Order }) {
  const curIdx = o.status === 'cancelled' ? 0 : STAGES.indexOf(o.status)
  return (
    <div className="card p-5">
      <p className="font-bold mb-4">Order timeline</p>
      <ol className="relative">
        {STAGES.map((s, i) => {
          const done = o.status !== 'cancelled' && i <= curIdx
          const current = o.status !== 'cancelled' && i === curIdx && s !== 'delivered'
          const Icon = o.kind === 'shop' && s === 'preparing' ? Package : o.kind === 'shop' && s === 'on_the_way' ? Truck : ICONS[s]
          const lbl = stageLabel(o.kind, s)
          const t = o.stageTimes[s]
          const expected = o.placedAt + (STAGE_AT[s] * o.etaMinutes * 60000)
          return (
            <li key={s} className="relative flex gap-4 pb-6 last:pb-0">
              {i < STAGES.length - 1 && <span className={cx('absolute left-[17px] top-9 bottom-0 w-0.5', i < curIdx && o.status !== 'cancelled' ? 'bg-brand-500' : 'bg-ink-200')} />}
              <span className={cx('relative z-10 grid size-9 shrink-0 place-items-center rounded-full transition', done ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-400', current && 'ring-4 ring-brand-100')}>
                {current && <span className="absolute inset-0 rounded-full bg-brand-500 animate-ping-slow opacity-40" />}
                <Icon className="relative size-[18px]" />
              </span>
              <div className="pt-1.5 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cx('font-semibold', !done && 'text-ink-400')}>{lbl.title}</p>
                  <span className="text-xs text-ink-500">{t ? fmtTime(t) : o.status === 'cancelled' ? '—' : `~${fmtTime(expected)}`}</span>
                </div>
                {done && <p className="text-xs text-ink-500">{lbl.detail}</p>}
              </div>
            </li>
          )
        })}
        {o.status === 'cancelled' && (
          <li className="mt-2 flex items-center gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-700"><XCircle className="size-5" /> Cancelled {o.cancelledAt && `at ${fmtTime(o.cancelledAt)}`}</li>
        )}
      </ol>
    </div>
  )
}

function RiderCard({ o }: { o: Order }) {
  const assigned = o.status !== 'confirmed'
  const r = o.rider
  return (
    <div className="card p-5">
      <p className="font-bold mb-3">{o.kind === 'food' ? 'Your rider' : 'Your courier'}</p>
      {!assigned ? (
        <div className="flex items-center gap-3 text-sm text-ink-500">
          <span className="relative grid size-12 place-items-center rounded-full bg-ink-100"><Bike className="size-5 animate-pulse" /></span>
          Assigning a {o.kind === 'food' ? 'rider' : 'courier'} near {o.storeName}…
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Avatar name={r.name} color="#6D28D9" size={48} />
            <div className="min-w-0 flex-1">
              <p className="font-bold">{r.name} <span className="text-xs font-medium text-amber-700">(fictional)</span></p>
              <p className="text-xs text-ink-500">{r.vehicle} · {r.plate}</p>
              <p className="text-xs text-ink-500 flex items-center gap-1"><Star className="size-3 fill-amber-400 text-amber-400" /> {r.rating} · {r.trips.toLocaleString()} trips</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => toast('info', `Calling ${maskPhone(r.phone)}…`, 'Simulated call — no phone call is made.')} className="btn btn-secondary btn-sm"><Phone className="size-4" /> Call</button>
            <Link to={`/help/chat?order=${o.id}`} className="btn btn-secondary btn-sm"><MessageCircle className="size-4" /> Chat</Link>
          </div>
        </>
      )}
    </div>
  )
}

function OrderDetails({ o }: { o: Order }) {
  const reorder = useReorder()
  return (
    <div className="card p-5 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-bold">Order details</p>
        <Link to={o.kind === 'food' ? `/restaurant/${o.storeId}` : `/store/${o.storeId}`} className="flex items-center gap-1 text-xs font-semibold text-brand-700"><Store className="size-3.5" /> {o.storeName}</Link>
      </div>
      <div className="mt-3 space-y-2.5">
        {o.items.map((i, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <Img src={i.image} alt={i.name} art={artFor(i.refId, o.kind)} className="size-11 rounded-lg shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold line-clamp-1">{i.qty}× {i.name}</p>
              <p className="text-xs text-ink-500 line-clamp-1">{[i.size && `Size ${i.size}`, i.color, ...(i.optionLabels ?? [])].filter(Boolean).join(' · ')}</p>
            </div>
            <span className="font-semibold">{taka(i.unitPrice * i.qty)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-1.5 border-t border-dashed border-ink-200 pt-3">
        <div className="flex justify-between"><span className="text-ink-500">Subtotal</span><span>{taka(o.subtotal)}</span></div>
        <div className="flex justify-between"><span className="text-ink-500">Delivery ({o.delivery.label})</span><span>{o.deliveryFee ? taka(o.deliveryFee) : 'Free'}</span></div>
        {o.platformFee > 0 && <div className="flex justify-between"><span className="text-ink-500">Platform fee</span><span>{taka(o.platformFee)}</span></div>}
        {o.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Voucher {o.voucherCode}</span><span>−{taka(o.discount)}</span></div>}
        <div className="flex justify-between pt-1 text-base font-bold"><span>Total</span><span>{taka(o.total)}</span></div>
        <p className="text-xs text-amber-700 flex items-center gap-1"><FlaskConical className="size-3.5" /> Simulated — nothing was charged</p>
      </div>
      <div className="mt-4 space-y-3 border-t border-ink-100 pt-4">
        <div className="flex gap-3"><House className="size-4 text-ink-400 mt-0.5 shrink-0" /><div><p className="font-semibold">{o.address.label} · {o.address.recipient}</p><p className="text-xs text-ink-500">{o.address.line}</p></div></div>
        <div className="flex gap-3 items-center"><PaymentLogo method={o.paymentMethod} size={22} /><div><p className="font-semibold">{PAYMENT_META[o.paymentMethod].label} (demo)</p><p className="text-xs text-ink-500 font-mono">Ref {o.paymentRef}</p></div></div>
        <div className="flex gap-3"><Clock className="size-4 text-ink-400 mt-0.5 shrink-0" /><p className="text-xs text-ink-500">Target delivery time {fmtDuration(o.etaMinutes)} · placed {fmtDateTime(o.placedAt)}</p></div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link to={`/help/chat?order=${o.id}`} className="btn btn-secondary btn-sm"><Headphones className="size-4" /> Get help</Link>
        <button onClick={() => reorder(o)} disabled={isActive(o)} className="btn btn-soft btn-sm"><RotateCcw className="size-4" /> Reorder</button>
      </div>
    </div>
  )
}

// ---------- Simulated map ----------
type Pt = [number, number]
function along(path: Pt[], t: number): Pt {
  const segs = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]))
  const total = segs.reduce((a, b) => a + b, 0)
  let d = Math.max(0, Math.min(1, t)) * total
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i]) {
      const f = segs[i] ? d / segs[i] : 0
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * f, path[i][1] + (path[i + 1][1] - path[i][1]) * f]
    }
    d -= segs[i]
  }
  return path[path.length - 1]
}

function MapSim({ o }: { o: Order }) {
  const { start, store, home, leg1, leg2, blocks } = useMemo(() => {
    const r = rng(hashStr(o.id))
    const W = 600, H = 300
    const snap = (v: number) => Math.round(v / 50) * 50
    const store: Pt = [snap(80 + r() * 120), snap(70 + r() * 160)]
    const home: Pt = [snap(400 + r() * 130), snap(60 + r() * 180)]
    const start: Pt = [snap(store[0] + 50 + r() * 50), snap(Math.min(H - 30, store[1] + 100))]
    const mid = snap((store[0] + home[0]) / 2 + (r() - 0.5) * 60)
    const leg1: Pt[] = [start, [start[0], store[1]], store]
    const leg2: Pt[] = [store, [mid, store[1]], [mid, home[1]], home]
    const blocks = Array.from({ length: 14 }, () => [Math.floor(r() * 12) * 50 + 6, Math.floor(r() * 6) * 50 + 6, r() > 0.7] as [number, number, boolean])
    return { start, store, home, leg1, leg2, blocks, W }
  }, [o.id])
  const p = progressOf(o)
  const pickAt = STAGE_AT.picked_up
  const rider = o.status === 'confirmed' ? start : p < pickAt ? along(leg1, (p - STAGE_AT.preparing) / (pickAt - STAGE_AT.preparing)) : along(leg2, (p - STAGE_AT.on_the_way + 0.02) / (1 - STAGE_AT.on_the_way + 0.02))
  const line = (pts: Pt[]) => pts.map((q) => q.join(',')).join(' ')
  const Vehicle = o.kind === 'food' ? Bike : Truck
  return (
    <div className="relative h-56 sm:h-72 map-grid overflow-hidden">
      <svg viewBox="0 0 600 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        {blocks.map(([x, y, park], i) => <rect key={i} x={x} y={y} width="38" height="38" rx="6" fill={park ? '#cfe8c6' : '#e2e4dc'} />)}
        <path d="M0 260 C 150 230, 260 290, 600 250" stroke="#bfdcf2" strokeWidth="22" fill="none" />
        <polyline points={line(leg1)} fill="none" stroke="#c4b5fd" strokeWidth="5" strokeDasharray="2 9" strokeLinecap="round" />
        <polyline points={line(leg2)} fill="none" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
      </svg>
      <Pin x={store[0]} y={store[1]} color="#ff5a36" icon={o.kind === 'food' ? <Store className="size-4" /> : <Warehouse className="size-4" />} label={o.kind === 'food' ? o.storeName : 'Warehouse'} />
      <Pin x={home[0]} y={home[1]} color="#17121f" icon={<House className="size-4" />} label={o.address.label} />
      {o.status !== 'delivered' && (
        <div className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ease-linear" style={{ left: `${(rider[0] / 600) * 100}%`, top: `${(rider[1] / 300) * 100}%` }}>
          <span className="absolute inset-0 -m-2 rounded-full bg-brand-500/30 animate-ping-slow" />
          <span className="relative grid size-10 place-items-center rounded-full bg-brand-600 text-white shadow-glow ring-4 ring-white"><Vehicle className="size-5" /></span>
        </div>
      )}
      <span className="absolute left-3 top-3 badge bg-white/90 text-ink-700 shadow-sm"><FlaskConical className="size-3" /> Simulated map</span>
    </div>
  )
}

function Pin({ x, y, color, icon, label }: { x: number; y: number; color: string; icon: ReactNode; label: string }) {
  return (
    <div className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center" style={{ left: `${(x / 600) * 100}%`, top: `${(y / 300) * 100}%` }}>
      <span className="mb-1 max-w-[120px] truncate rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold shadow">{label}</span>
      <span className="grid size-8 place-items-center rounded-full text-white shadow-lift ring-2 ring-white" style={{ background: color }}>{icon}</span>
      <span className="h-2 w-0.5" style={{ background: color }} />
    </div>
  )
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 24 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 8) * 0.15, color: ['#fde68a', '#fff', '#fca5a5', '#c4b5fd', '#6ee7b7'][i % 5], rot: (i * 47) % 360 })), [])
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`@keyframes dk-fall{0%{transform:translateY(-20px) rotate(0)}100%{transform:translateY(260px) rotate(540deg);opacity:0}}`}</style>
      {pieces.map((p, i) => <span key={i} className="absolute top-0 h-2.5 w-1.5 rounded-sm" style={{ left: `${p.left}%`, background: p.color, transform: `rotate(${p.rot}deg)`, animation: `dk-fall 2.4s ${p.delay}s ease-in forwards` }} />)}
    </div>
  )
}
