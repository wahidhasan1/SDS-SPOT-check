import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Bike, Check, ChevronDown, CreditCard, FlaskConical, MapPin, Plus, ShieldCheck, Store, TicketPercent, Truck, X, Zap } from 'lucide-react'
import type { CartKind, DeliveryMethod, PaymentMethodId, Voucher } from '../data/types'
import { artFor, useMe, useStore } from '../store/store'
import { useUI } from '../store/ui'
import { toast } from '../store/toast'
import { areaById } from '../data/areas'
import { checkVoucher, foodDeliveryMethods, shopDeliveryMethods, visibleTo, voucherHeadline } from '../lib/pricing'
import { cx, prettyPhone, taka } from '../lib/format'
import { useTitle } from '../lib/hooks'
import { LabelIcon, addressLine } from '../components/location'
import { DEMO_CARDS, PAYMENT_META, PaymentGateway, PaymentLogo, type GatewayResult } from '../components/PaymentGateway'
import { useBill } from './Cart'
import { Badge, Field, Img, Modal } from '../components/ui'
import { LogoMark } from '../components/Logo'

function Section({ n, title, children, action }: { n: number; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="card p-4 sm:p-5" aria-labelledby={`co-${n}`}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid size-7 place-items-center rounded-full bg-ink-900 text-[13px] font-bold text-white" aria-hidden>{n}</span>
        <h2 id={`co-${n}`} className="flex-1 text-lg font-extrabold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** One-page checkout: address, delivery option, voucher and payment, with a sticky total and a single action. */
export default function Checkout() {
  useTitle('Checkout')
  const [params] = useSearchParams()
  const kind: CartKind = params.get('kind') === 'shop' ? 'shop' : 'food'
  const nav = useNavigate()
  const me = useMe()!
  const allAddresses = useStore((s) => s.db.addresses)
  const addresses = allAddresses.filter((a) => a.userId === me.id)
  const selectedAddressId = useStore((s) => s.selectedAddressId)
  const vouchers = useStore((s) => s.db.vouchers)
  const orders = useStore((s) => s.db.orders)
  const applied = useStore((s) => s.vouchersApplied[kind])
  const applyVoucher = useStore((s) => s.applyVoucher)
  const removeVoucher = useStore((s) => s.removeVoucher)
  const placeOrder = useStore((s) => s.placeOrder)
  const openAddressForm = useUI((s) => s.openAddressForm)

  const [addressId, setAddressId] = useState<string>(() => addresses.find((a) => a.id === selectedAddressId)?.id ?? addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? '')
  const [deliveryId, setDeliveryId] = useState('standard')
  const [payment, setPayment] = useState<PaymentMethodId>(me.savedPayments[0]?.method ?? 'bkash')
  const [cardNumber, setCardNumber] = useState(me.savedPayments.some((p) => p.method === 'card') ? '4242 4242 4242 4242' : '')
  const [cardErr, setCardErr] = useState('')
  const [addrOpen, setAddrOpen] = useState(false)
  const [voucherOpen, setVoucherOpen] = useState(false)
  const [itemsOpen, setItemsOpen] = useState(false)
  const [gateway, setGateway] = useState(false)
  const [placing, setPlacing] = useState(false)

  const address = addresses.find((a) => a.id === addressId)
  const base = useBill(kind)
  const methods: DeliveryMethod[] = useMemo(
    () => (kind === 'food' ? (base.restaurant ? foodDeliveryMethods(base.restaurant, address?.areaId ?? 'banani') : []) : shopDeliveryMethods(base.subtotal)),
    [kind, base.restaurant, base.subtotal, address?.areaId],
  )
  const delivery = methods.find((m) => m.id === deliveryId) ?? methods[0]
  const bill = useBill(kind, delivery?.fee)

  // Voucher eligibility for this exact cart, best saving first.
  const isFirstOrder = !orders.some((o) => o.userId === me.id && o.status !== 'cancelled')
  const options = useMemo(() => {
    return vouchers
      .filter((v) => visibleTo(v, me.id) && v.active && !v.usedAt && v.expiresAt > Date.now() && (v.scope === 'all' || v.scope === kind || !!v.ownerId))
      .map((v) => ({ v, res: checkVoucher(v, kind, bill.subtotal, delivery?.fee ?? 0, { now: Date.now(), isFirstOrder, userId: me.id }) }))
      .sort((a, b) => (b.res.ok ? b.res.discount : -1) - (a.res.ok ? a.res.discount : -1) || Number(!!b.v.ownerId) - Number(!!a.v.ownerId))
  }, [vouchers, me.id, kind, bill.subtotal, delivery?.fee, isFirstOrder])
  const best = options.find((o) => o.res.ok)

  useEffect(() => {
    if (!addressId && addresses[0]) setAddressId(addresses[0].id)
  }, [addresses, addressId])

  if (!bill.lines.length && !placing) return <Navigate to="/cart" replace />
  if (bill.belowMin > 0 && !placing) return <Navigate to="/cart?tab=food" replace />

  const apply = (v: Voucher) => {
    const r = applyVoucher(kind, v.code, delivery?.fee ?? 0)
    if (r.ok) {
      toast('success', `${v.code} applied`)
      setVoucherOpen(false)
    } else toast('error', 'Voucher can’t be used', r.error)
  }

  const cardDigits = cardNumber.replace(/\s/g, '')
  const pay = () => {
    if (!address) {
      toast('warning', 'Add a delivery address first')
      if (addresses.length) setAddrOpen(true)
      else openAddressForm(undefined, (id) => setAddressId(id))
      return
    }
    if (payment === 'card' && !(cardDigits in DEMO_CARDS)) {
      setCardErr('Use one of the test cards below. Real cards are never accepted.')
      document.getElementById('co-4')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setGateway(true)
  }

  const onGateway = (r: GatewayResult) => {
    setGateway(false)
    if (!r.ok) {
      toast('error', 'Payment didn’t go through', 'Nothing was charged. Try another method.')
      return
    }
    setPlacing(true)
    const order = placeOrder({ kind, addressId, delivery: delivery!, payment, paymentRef: r.ref })
    nav(`/orders/${order.id}?placed=1`, { replace: true })
  }

  const itemCount = bill.lines.reduce((a, l) => a + l.qty, 0)
  const cta = payment === 'cod' ? `Place order · ${taka(bill.total)}` : `Pay ${taka(bill.total)}`

  return (
    <div className="min-h-dvh bg-ink-50">
      <div className="sticky top-0 z-30 border-b border-ink-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <button onClick={() => nav(-1)} className="icon-btn -ml-2" aria-label="Back to cart"><ArrowLeft className="size-5" /></button>
          <LogoMark size={28} />
          <div className="min-w-0 flex-1">
            <p className="font-extrabold leading-tight">Checkout</p>
            <p className="truncate text-xs text-ink-500">{kind === 'food' ? bill.restaurant?.name : 'Fashion & lifestyle'} · {itemCount} item{itemCount > 1 ? 's' : ''}</p>
          </div>
          <Badge tone="sun">Demo</Badge>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-5 pb-40 lg:grid-cols-[1fr_380px] lg:gap-6 lg:pb-10">
        <div className="space-y-4 min-w-0">
          <Section n={1} title="Deliver to" action={address && <button onClick={() => setAddrOpen(true)} className="text-sm font-bold text-brand-700">Change</button>}>
            {address ? (
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700"><LabelIcon label={address.label} className="size-5" /></span>
                <div className="min-w-0 text-sm">
                  <p className="font-bold">{address.label} · {address.recipient}</p>
                  <p className="text-ink-700">{addressLine(address)}, {areaById(address.areaId).city} {areaById(address.areaId).postcode}</p>
                  <p className="text-ink-500">{prettyPhone(address.phone)}{address.notes && ` · “${address.notes}”`}</p>
                </div>
              </div>
            ) : (
              <button onClick={() => openAddressForm(undefined, (id) => setAddressId(id))} className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-ink-200 p-4 font-bold text-brand-700 hover:bg-brand-50"><Plus className="size-5" /> Add a delivery address</button>
            )}
          </Section>

          <Section n={2} title="Delivery option">
            <div className="grid gap-2" role="radiogroup" aria-label="Delivery option">
              {methods.map((m) => (
                <label key={m.id} className={cx('flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition', deliveryId === m.id ? 'border-brand-600 bg-brand-50/60 ring-1 ring-brand-600' : 'border-ink-200 hover:border-ink-300')}>
                  <input type="radio" name="dm" className="sr-only" checked={deliveryId === m.id} onChange={() => setDeliveryId(m.id)} />
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white border border-ink-100">
                    {m.id === 'priority' || m.id === 'express' ? <Zap className="size-[18px] text-sun-700" /> : m.id === 'pickup' ? <Store className="size-[18px]" /> : kind === 'food' ? <Bike className="size-[18px] text-brand-700" /> : <Truck className="size-[18px] text-brand-700" />}
                  </span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{m.label}</span><span className="block text-xs text-ink-500">{m.description}</span></span>
                  <span className="text-sm font-bold">{m.fee ? taka(m.fee) : 'Free'}</span>
                  <span className={cx('grid size-5 shrink-0 place-items-center rounded-full border-2', deliveryId === m.id ? 'border-brand-600 bg-brand-600' : 'border-ink-300')}>{deliveryId === m.id && <Check className="size-3 text-white" />}</span>
                </label>
              ))}
            </div>
          </Section>

          <Section n={3} title="Voucher" action={<button onClick={() => setVoucherOpen(true)} className="text-sm font-bold text-brand-700">{applied ? 'Change' : 'See all'}</button>}>
            {applied && bill.check?.ok ? (
              <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3">
                <TicketPercent className="size-5 text-brand-700" />
                <div className="min-w-0 flex-1"><p className="font-mono font-bold">{applied}</p><p className="text-sm font-semibold text-brand-700">You save {taka(bill.discount)}</p></div>
                <button onClick={() => removeVoucher(kind)} className="btn btn-ghost btn-sm" aria-label="Remove voucher"><X className="size-4" /> Remove</button>
              </div>
            ) : applied && bill.check && !bill.check.ok ? (
              <div className="flex items-center gap-3 rounded-xl border border-sun-300 bg-sun-50 p-3 text-sm">
                <div className="min-w-0 flex-1"><p className="font-mono font-bold">{applied}</p><p className="text-ink-700">{bill.check.error}</p></div>
                <button onClick={() => removeVoucher(kind)} className="btn btn-ghost btn-sm">Remove</button>
              </div>
            ) : best ? (
              <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-sun-300 bg-sun-50 p-3">
                <TicketPercent className="size-5 text-sun-800" />
                <div className="min-w-0 flex-1 text-sm"><p className="font-bold">{best.v.ownerId ? 'Your voucher' : 'Best deal'}: <span className="font-mono">{best.v.code}</span></p><p className="text-ink-700">Saves {taka(best.res.ok ? best.res.discount : 0)} on this order</p></div>
                <button onClick={() => apply(best.v)} className="btn btn-dark btn-sm">Apply</button>
              </div>
            ) : (
              <p className="text-sm text-ink-500">No voucher fits this cart yet. <button onClick={() => setVoucherOpen(true)} className="font-bold text-brand-700">See why</button></p>
            )}
          </Section>

          <Section n={4} title="Payment">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment method">
              {(Object.keys(PAYMENT_META) as PaymentMethodId[]).map((m) => (
                <button key={m} role="radio" aria-checked={payment === m} onClick={() => { setPayment(m); setCardErr('') }} className={cx('flex items-center gap-2.5 rounded-xl border p-3 text-left transition', payment === m ? 'border-brand-600 bg-brand-50/60 ring-1 ring-brand-600' : 'border-ink-200 hover:border-ink-300')}>
                  <PaymentLogo method={m} size={34} />
                  <span className="min-w-0"><span className="block text-sm font-bold leading-tight">{PAYMENT_META[m].label}</span><span className="block text-[11px] text-ink-500">{me.savedPayments.find((p) => p.method === m)?.masked ?? PAYMENT_META[m].desc}</span></span>
                </button>
              ))}
            </div>
            {payment === 'card' && (
              <div className="mt-3">
                <Field label="Test card number" error={cardErr}>
                  <input inputMode="numeric" autoComplete="off" value={cardNumber} maxLength={19} onChange={(e) => { setCardErr(''); setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')) }} placeholder="4242 4242 4242 4242" className={cx('input font-mono', cardErr && 'input-error')} />
                </Field>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button onClick={() => { setCardNumber('4242 4242 4242 4242'); setCardErr('') }} className={cx('chip h-8', cardDigits === '4242424242424242' && 'chip-active')}><CreditCard className="size-3.5" /> Test: succeeds</button>
                  <button onClick={() => { setCardNumber('4000 0000 0000 0002'); setCardErr('') }} className={cx('chip h-8', cardDigits === '4000000000000002' && 'chip-active')}>Test: declined</button>
                </div>
                <p className="mt-2 text-xs text-ink-500">Card details are never stored. Expiry and CVC aren’t needed in the demo.</p>
              </div>
            )}
            {(payment === 'bkash' || payment === 'nagad') && <p className="mt-3 text-sm text-ink-500">You’ll confirm with a test wallet and PIN in the next step.</p>}
            {payment === 'cod' && <p className="mt-3 text-sm text-ink-500">Pay {taka(bill.total)} when the rider arrives. (The rider is imaginary.)</p>}
          </Section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-20 h-fit">
          <div className="card p-4 sm:p-5 text-sm">
            <button onClick={() => setItemsOpen(!itemsOpen)} className="flex w-full items-center justify-between font-extrabold text-base" aria-expanded={itemsOpen}>
              Order summary <span className="flex items-center gap-1 text-sm font-semibold text-ink-500">{itemCount} items <ChevronDown className={cx('size-4 transition', itemsOpen && 'rotate-180')} /></span>
            </button>
            {itemsOpen && (
              <div className="mt-3 space-y-2.5 animate-fade-in">
                {bill.lines.map((l) => (
                  <div key={l.key} className="flex items-center gap-3">
                    <Img src={l.image} alt="" art={artFor(l.refId, kind)} className="size-11 rounded-lg shrink-0" />
                    <div className="min-w-0 flex-1"><p className="font-semibold line-clamp-1">{l.qty}× {l.name}</p><p className="text-xs text-ink-500 line-clamp-1">{[l.size && `Size ${l.size}`, l.color, ...(l.optionLabels ?? [])].filter(Boolean).join(' · ')}</p></div>
                    <span className="font-semibold tabular-nums">{taka(l.unitPrice * l.qty)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 space-y-2 border-t border-ink-100 pt-3">
              <Row label="Subtotal" value={taka(bill.subtotal)} />
              <Row label={`Delivery${delivery ? ` (${delivery.label.toLowerCase()})` : ''}`} value={bill.deliveryFee ? taka(bill.deliveryFee) : 'Free'} />
              {kind === 'food' && <Row label="Platform fee" value={taka(bill.platformFee)} />}
              {bill.discount > 0 && <Row label={`Voucher ${applied}`} value={`−${taka(bill.discount)}`} good />}
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-ink-200 pt-3">
              <span className="font-extrabold text-base">Total</span>
              <span className="text-2xl font-extrabold tabular-nums">{taka(bill.total)}</span>
            </div>
            <p className="mt-1 text-xs text-ink-500">Arrives {kind === 'food' ? `in ${delivery ? `~${delivery.etaMinutes} min` : '~30 min'}` : delivery?.id === 'express' ? 'within 6 hours' : 'tomorrow'} · simulated</p>
          </div>
          <div className="hidden lg:block">
            <button onClick={pay} className="btn btn-primary btn-lg w-full">{cta}</button>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-ink-500"><ShieldCheck className="size-4" /> Demo payment. Nothing is charged.</p>
          </div>
        </aside>
      </div>

      <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white px-4 pt-3 pb-safe">
        <button onClick={pay} className="btn btn-primary btn-lg w-full">{cta}</button>
        <p className="py-2 flex items-center justify-center gap-1.5 text-xs text-ink-500"><FlaskConical className="size-3.5" /> Demo payment. Nothing is charged.</p>
      </div>

      <Modal open={addrOpen} onClose={() => setAddrOpen(false)} title="Deliver to">
        <div className="space-y-2" role="radiogroup">
          {addresses.map((a) => (
            <button key={a.id} role="radio" aria-checked={addressId === a.id} onClick={() => { setAddressId(a.id); setAddrOpen(false) }} className={cx('flex w-full items-start gap-3 rounded-xl border p-3 text-left', addressId === a.id ? 'border-brand-600 bg-brand-50/60' : 'border-ink-200 hover:border-ink-300')}>
              <LabelIcon label={a.label} className="mt-0.5 size-5 text-ink-700" />
              <span className="min-w-0 flex-1 text-sm"><span className="flex items-center gap-2 font-bold">{a.label}{a.isDefault && <Badge tone="brand">Default</Badge>}</span><span className="block text-ink-500">{addressLine(a)}</span></span>
              {addressId === a.id && <Check className="size-5 text-brand-600" />}
            </button>
          ))}
          <button onClick={() => { setAddrOpen(false); openAddressForm(undefined, (id) => setAddressId(id)) }} className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-ink-200 p-3 font-bold text-brand-700 hover:bg-brand-50"><MapPin className="size-5" /> Add a new address</button>
        </div>
      </Modal>

      <Modal open={voucherOpen} onClose={() => setVoucherOpen(false)} title="Vouchers for this order">
        <ManualCode onApply={(code) => { const r = applyVoucher(kind, code, delivery?.fee ?? 0); if (r.ok) { toast('success', `${code.toUpperCase()} applied`); setVoucherOpen(false) } return r.error }} />
        <div className="mt-4 space-y-2">
          {options.length === 0 && <p className="text-sm text-ink-500">You have no vouchers yet. <Link to="/offers" className="font-bold text-brand-700">See deals</Link></p>}
          {options.map(({ v, res }) => (
            <div key={v.code} className={cx('flex items-center gap-3 rounded-xl border p-3', res.ok ? 'border-ink-200' : 'border-ink-100 bg-ink-50')}>
              <span className={cx('grid size-11 shrink-0 place-items-center rounded-xl text-[11px] font-extrabold leading-tight text-center', res.ok ? 'bg-sun-400 text-ink-900' : 'bg-ink-200 text-ink-500')}>{voucherHeadline(v).replace(' OFF', '')}</span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-bold"><span className="font-mono">{v.code}</span> {v.ownerId && <Badge tone="sun">Yours</Badge>} {best?.v.code === v.code && <Badge tone="brand">Best</Badge>}</p>
                <p className={res.ok ? 'text-brand-700 font-semibold' : 'text-ink-500'}>{res.ok ? `Saves ${taka(res.discount)}` : res.error}</p>
              </div>
              {applied === v.code ? <Badge tone="brand">Applied</Badge> : <button disabled={!res.ok} onClick={() => apply(v)} className="btn btn-secondary btn-sm">Apply</button>}
            </div>
          ))}
        </div>
      </Modal>

      <PaymentGateway open={gateway} method={payment} amount={bill.total} cardNumber={cardDigits} onClose={() => setGateway(false)} onResult={onGateway} />
    </div>
  )
}

function ManualCode({ onApply }: { onApply: (code: string) => string | undefined }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) setErr(onApply(code.trim()) ?? '') }}>
      <label htmlFor="vc-code" className="label">Have a code?</label>
      <div className="flex gap-2">
        <input id="vc-code" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setErr('') }} placeholder="e.g. FOOD20" className={cx('input font-mono uppercase', err && 'input-error')} />
        <button className="btn btn-dark" disabled={!code.trim()}>Apply</button>
      </div>
      {err && <p className="mt-1.5 text-sm font-medium text-red-600" role="alert">{err}</p>}
    </form>
  )
}

const Row = ({ label, value, good }: { label: string; value: string; good?: boolean }) => (
  <div className="flex items-center justify-between gap-2"><span className="text-ink-500">{label}</span><span className={cx('font-semibold tabular-nums', good && 'text-brand-700')}>{value}</span></div>
)

