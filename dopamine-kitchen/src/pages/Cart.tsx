import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Bookmark, ChevronRight, Clock, ShoppingBag, TicketPercent, Trash2, TriangleAlert, X } from 'lucide-react'
import type { CartKind, CartLine } from '../data/types'
import { useCurrentArea, useStore, artFor } from '../store/store'
import { toast } from '../store/toast'
import { checkVoucher, foodDelivery, PLATFORM_FEE_FOOD, shopDeliveryMethods, subtotalOf } from '../lib/pricing'
import { cx, taka } from '../lib/format'
import { useTitle } from '../lib/hooks'
import { VoucherCard } from '../components/cards'
import { Badge, EmptyState, Img, Modal, QtyStepper, Tabs } from '../components/ui'

export function useBill(kind: CartKind, deliveryFeeOverride?: number) {
  const cart = useStore((s) => s.cart)
  const restaurants = useStore((s) => s.db.restaurants)
  const vouchers = useStore((s) => s.db.vouchers)
  const orders = useStore((s) => s.db.orders)
  const uid = useStore((s) => s.currentUserId)
  const code = useStore((s) => s.vouchersApplied[kind])
  const { areaId } = useCurrentArea()
  return useMemo(() => {
    const lines = cart.filter((l) => l.kind === kind)
    const subtotal = subtotalOf(lines)
    const restaurant = kind === 'food' && lines[0] ? restaurants.find((r) => r.id === lines[0].storeId) : undefined
    const fd = restaurant ? foodDelivery(restaurant, areaId) : null
    const deliveryFee = deliveryFeeOverride ?? (kind === 'food' ? fd?.fee ?? 0 : shopDeliveryMethods(subtotal)[0].fee)
    const platformFee = kind === 'food' && lines.length ? PLATFORM_FEE_FOOD : 0
    const v = code ? vouchers.find((x) => x.code === code) : undefined
    const check = v ? checkVoucher(v, kind, subtotal, deliveryFee, { now: Date.now(), isFirstOrder: !orders.some((o) => o.userId === uid && o.status !== 'cancelled') }) : null
    const discount = check?.ok ? check.discount : 0
    const total = Math.max(0, subtotal + deliveryFee + platformFee - discount)
    const belowMin = restaurant ? Math.max(0, restaurant.minOrder - subtotal) : 0
    return { lines, subtotal, deliveryFee, platformFee, discount, total, code, voucher: v, check, restaurant, eta: fd?.etaLabel ?? null, belowMin }
  }, [cart, kind, restaurants, vouchers, orders, uid, code, areaId, deliveryFeeOverride])
}

export default function Cart() {
  useTitle('Cart')
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const cart = useStore((s) => s.cart)
  const saved = useStore((s) => s.saved)
  const hasFood = cart.some((l) => l.kind === 'food')
  const hasShop = cart.some((l) => l.kind === 'shop')
  const requested = params.get('tab') as CartKind | null
  const tab: CartKind = requested && (requested === 'food' ? hasFood : hasShop) ? requested : hasFood ? 'food' : hasShop ? 'shop' : requested ?? 'food'

  if (!cart.length && !saved.length)
    return (
      <div className="mx-auto max-w-3xl px-4">
        <EmptyState emoji="🛒" title="Your cart is empty" body="Find something you're craving — the full checkout experience awaits, minus the bill." action={<><Link to="/food" className="btn btn-primary">Browse food</Link><Link to="/shop" className="btn btn-secondary">Go shopping</Link></>} />
      </div>
    )

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-fade-in">
      <h1 className="font-display text-3xl font-extrabold">Your cart</h1>
      {hasFood && hasShop && (
        <Tabs className="mt-4 max-w-md" value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} items={[
          { id: 'food', label: '🍔 Food', count: cart.filter((l) => l.kind === 'food').reduce((a, l) => a + l.qty, 0) },
          { id: 'shop', label: '🛍️ Shopping', count: cart.filter((l) => l.kind === 'shop').reduce((a, l) => a + l.qty, 0) },
        ]} />
      )}
      {hasFood && hasShop && <p className="mt-2 text-xs text-ink-500">Food and shopping are checked out separately, just like on real delivery apps.</p>}
      {cart.some((l) => l.kind === tab) ? <CartBody kind={tab} onCheckout={() => nav(`/checkout?kind=${tab}`)} /> : (
        <div className="card mt-6 p-6 text-center text-sm text-ink-500">No items in this cart.</div>
      )}
      {saved.length > 0 && <SavedForLater />}
    </div>
  )
}

function CartBody({ kind, onCheckout }: { kind: CartKind; onCheckout: () => void }) {
  const bill = useBill(kind)
  const brands = useStore((s) => s.db.brands)
  const clearCart = useStore((s) => s.clearCart)
  const groups = useMemo(() => {
    const m = new Map<string, CartLine[]>()
    for (const l of bill.lines) m.set(l.storeId, [...(m.get(l.storeId) ?? []), l])
    return [...m.entries()]
  }, [bill.lines])

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        {groups.map(([storeId, lines]) => {
          const name = kind === 'food' ? bill.restaurant?.name : brands.find((b) => b.id === storeId)?.name
          return (
            <div key={storeId} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
                <Link to={kind === 'food' ? `/restaurant/${storeId}` : `/store/${storeId}`} className="flex items-center gap-2 font-bold hover:text-brand-700">
                  <ShoppingBag className="size-4" /> {name} <ChevronRight className="size-4" />
                </Link>
                {kind === 'food' && bill.eta && <span className="flex items-center gap-1 text-xs font-semibold text-ink-500"><Clock className="size-3.5" /> {bill.eta}</span>}
                {kind === 'shop' && <span className="text-xs font-semibold text-ink-500">Delivery within 1 day</span>}
              </div>
              <div className="divide-y divide-ink-100">{lines.map((l) => <LineRow key={l.key} l={l} />)}</div>
              {kind === 'food' && <Link to={`/restaurant/${storeId}`} className="block border-t border-ink-100 px-4 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50">+ Add more items</Link>}
            </div>
          )
        })}
        {bill.belowMin > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <TriangleAlert className="size-5 shrink-0" />
            <p>Minimum order for {bill.restaurant?.name} is {taka(bill.restaurant!.minOrder)}. Add <b>{taka(bill.belowMin)}</b> more to check out.</p>
          </div>
        )}
        <button className="btn btn-ghost btn-sm text-red-600" onClick={() => { clearCart(kind); toast('info', 'Cart cleared') }}><Trash2 className="size-4" /> Clear {kind === 'food' ? 'food' : 'shopping'} cart</button>
      </div>

      <div className="space-y-4 lg:sticky lg:top-24 h-fit">
        <VoucherBox kind={kind} deliveryFee={bill.deliveryFee} />
        <BillCard bill={bill} kind={kind} />
        <button disabled={bill.belowMin > 0} onClick={onCheckout} className="btn btn-primary btn-lg w-full">
          Proceed to checkout · {taka(bill.total)}
        </button>
        <p className="text-center text-xs text-ink-500">You won't be charged. Payments on the next steps are simulated.</p>
      </div>
    </div>
  )
}

function LineRow({ l }: { l: CartLine }) {
  const setQty = useStore((s) => s.setQty)
  const removeLine = useStore((s) => s.removeLine)
  const restoreLine = useStore((s) => s.restoreLine)
  const saveForLater = useStore((s) => s.saveForLater)
  const link = l.kind === 'food' ? `/restaurant/${l.storeId}?item=${l.refId}` : `/product/${l.refId}`
  return (
    <div className="flex gap-3 p-4 animate-fade-in">
      <Link to={link}><Img src={l.image} alt={l.name} art={artFor(l.refId, l.kind)} className="size-20 rounded-xl shrink-0" /></Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link to={link} className="font-semibold leading-snug hover:text-brand-700 line-clamp-2">{l.name}</Link>
          <p className="font-bold whitespace-nowrap">{taka(l.unitPrice * l.qty)}</p>
        </div>
        {(l.size || l.color) && <p className="text-xs text-ink-500 mt-0.5">{[l.size && `Size ${l.size}`, l.color].filter(Boolean).join(' · ')}</p>}
        {l.optionLabels?.length ? <p className="text-xs text-ink-500 mt-0.5 line-clamp-2">{l.optionLabels.join(', ')}</p> : null}
        <p className="text-xs text-ink-400 mt-0.5">{taka(l.unitPrice)} each</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <QtyStepper size="sm" value={l.qty} min={1} onChange={(v) => setQty(l.key, v)} />
          <button onClick={() => { saveForLater(l.key); toast('info', 'Saved for later') }} className="btn btn-ghost btn-sm"><Bookmark className="size-4" /> Save for later</button>
          <button onClick={() => { const r = removeLine(l.key); if (r) toast('info', `Removed ${l.name}`, undefined, { label: 'Undo', onClick: () => restoreLine(r) }) }} className="btn btn-ghost btn-sm text-red-600"><Trash2 className="size-4" /> Remove</button>
        </div>
      </div>
    </div>
  )
}

export function VoucherBox({ kind, deliveryFee }: { kind: CartKind; deliveryFee: number }) {
  const code = useStore((s) => s.vouchersApplied[kind])
  const applyVoucher = useStore((s) => s.applyVoucher)
  const removeVoucher = useStore((s) => s.removeVoucher)
  const vouchers = useStore((s) => s.db.vouchers)
  const [input, setInput] = useState('')
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(false)
  const bill = useBill(kind, deliveryFee)
  const available = vouchers.filter((v) => v.active && v.expiresAt > Date.now() && (v.scope === 'all' || v.scope === kind))
  const apply = (c: string) => {
    const res = applyVoucher(kind, c, deliveryFee)
    if (res.ok) {
      setErr('')
      setInput('')
      setOpen(false)
      toast('success', `Voucher ${c.toUpperCase()} applied 🎉`)
    } else {
      setErr(res.error ?? 'Invalid voucher')
      if (open) toast('error', 'Voucher not applicable', res.error)
    }
  }
  return (
    <div className="card p-4">
      <p className="font-bold flex items-center gap-2"><TicketPercent className="size-5 text-brand-600" /> Vouchers</p>
      {code ? (
        <div className={cx('mt-3 flex items-center gap-3 rounded-xl border p-3', bill.check?.ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50')}>
          <div className="flex-1 min-w-0">
            <p className="font-mono font-bold">{code}</p>
            <p className={cx('text-xs', bill.check?.ok ? 'text-emerald-700' : 'text-amber-800')}>
              {bill.check?.ok ? `You save ${taka(bill.discount)}` : bill.check && !bill.check.ok ? bill.check.error : ''}
            </p>
          </div>
          <button onClick={() => removeVoucher(kind)} className="icon-btn size-8" aria-label="Remove voucher"><X className="size-4" /></button>
        </div>
      ) : (
        <>
          <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) apply(input) }} className="mt-3 flex gap-2">
            <input value={input} onChange={(e) => { setInput(e.target.value.toUpperCase()); setErr('') }} placeholder="Enter code e.g. FOOD20" className={cx('input h-10 font-mono uppercase', err && 'input-error')} />
            <button className="btn btn-soft h-10">Apply</button>
          </form>
          {err && <p className="mt-1.5 text-xs font-medium text-red-600">{err}</p>}
        </>
      )}
      <button onClick={() => setOpen(true)} className="mt-2 text-sm font-semibold text-brand-700 hover:underline">See {available.length} available vouchers</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Available vouchers">
        <div className="space-y-3">
          {available.map((v) => <VoucherCard key={v.code} v={v} applied={code === v.code} onApply={() => apply(v.code)} />)}
        </div>
      </Modal>
    </div>
  )
}

export function BillCard({ bill, kind, deliveryLabel }: { bill: ReturnType<typeof useBill>; kind: CartKind; deliveryLabel?: string }) {
  return (
    <div className="card p-4 text-sm">
      <p className="font-bold text-base mb-3">Bill details</p>
      <div className="space-y-2">
        <Row label={`Subtotal (${bill.lines.reduce((a, l) => a + l.qty, 0)} items)`} value={taka(bill.subtotal)} />
        <Row label={deliveryLabel ?? 'Delivery fee'} value={bill.deliveryFee === 0 ? 'Free' : taka(bill.deliveryFee)} />
        {kind === 'food' && <Row label="Platform fee" value={taka(bill.platformFee)} />}
        {bill.discount > 0 && <Row label={<>Discount <Badge tone="success">{bill.code}</Badge></>} value={`−${taka(bill.discount)}`} green />}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-dashed border-ink-200 pt-3">
        <span className="font-bold text-base">Total</span>
        <span className="font-display text-xl font-extrabold">{taka(bill.total)}</span>
      </div>
      <p className="mt-1 text-xs text-ink-500">{kind === 'food' ? `Estimated delivery: ${bill.eta ?? '~30 min'} (simulated)` : 'Estimated delivery: within 1 day (simulated)'}</p>
    </div>
  )
}

const Row = ({ label, value, green }: { label: ReactNode; value: string; green?: boolean }) => (
  <div className="flex items-center justify-between gap-2"><span className="text-ink-500 flex items-center gap-1.5">{label}</span><span className={cx('font-semibold', green && 'text-emerald-600')}>{value}</span></div>
)

function SavedForLater() {
  const saved = useStore((s) => s.saved)
  const moveToCart = useStore((s) => s.moveToCart)
  const removeSaved = useStore((s) => s.removeSaved)
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-bold mb-3 flex items-center gap-2"><Bookmark className="size-5" /> Saved for later ({saved.length})</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {saved.map((l) => (
          <div key={l.key} className="card flex gap-3 p-3">
            <Img src={l.image} alt={l.name} art={artFor(l.refId, l.kind)} className="size-16 rounded-xl shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold line-clamp-1">{l.name}</p>
              <p className="text-xs text-ink-500">{taka(l.unitPrice)} · Qty {l.qty}{l.size ? ` · ${l.size}` : ''}</p>
              <div className="mt-1.5 flex gap-1">
                <button className="btn btn-soft btn-sm h-8" onClick={() => { const r = moveToCart(l.key); if (r.ok) toast('success', 'Moved to cart'); else toast('warning', "Couldn't move to cart", r.reason) }}>Move to cart</button>
                <button className="btn btn-ghost btn-sm h-8" onClick={() => removeSaved(l.key)} aria-label="Remove saved item"><Trash2 className="size-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
