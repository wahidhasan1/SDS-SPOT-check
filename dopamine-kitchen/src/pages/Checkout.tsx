import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Bike, Check, ChevronRight, CreditCard, FlaskConical, MapPin, Pencil, Plus, ShieldCheck, Store, Truck, Zap } from 'lucide-react'
import type { CartKind, DeliveryMethod, PaymentMethodId } from '../data/types'
import { useMe, useStore, artFor } from '../store/store'
import { useUI } from '../store/ui'
import { toast } from '../store/toast'
import { areaById } from '../data/areas'
import { foodDeliveryMethods, shopDeliveryMethods } from '../lib/pricing'
import { cx, prettyPhone, taka } from '../lib/format'
import { useTitle } from '../lib/hooks'
import { LabelIcon, addressLine } from '../components/location'
import { DEMO_CARDS, PAYMENT_META, PaymentGateway, PaymentLogo, type GatewayResult } from '../components/PaymentGateway'
import { BillCard, VoucherBox, useBill } from './Cart'
import { Badge, Field, Img, Stars } from '../components/ui'
import { LogoMark } from '../components/Logo'

const STEPS = ['Address', 'Delivery', 'Payment', 'Review'] as const

export default function Checkout() {
  useTitle('Checkout')
  const [params] = useSearchParams()
  const kind: CartKind = params.get('kind') === 'shop' ? 'shop' : 'food'
  const nav = useNavigate()
  const me = useMe()
  const addresses = useStore((s) => s.db.addresses).filter((a) => a.userId === me?.id)
  const selectedAddressId = useStore((s) => s.selectedAddressId)
  const settings = useStore((s) => s.settings)
  const placeOrder = useStore((s) => s.placeOrder)
  const openAddressForm = useUI((s) => s.openAddressForm)
  const [step, setStep] = useState(0)
  const [addressId, setAddressId] = useState<string>(() => addresses.find((a) => a.id === selectedAddressId)?.id ?? addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? '')
  const [deliveryId, setDeliveryId] = useState('standard')
  const [payment, setPayment] = useState<PaymentMethodId>(me?.savedPayments[0]?.method ?? 'bkash')
  const [card, setCard] = useState({ number: '', name: '', exp: '', cvc: '' })
  const [cardErr, setCardErr] = useState<Record<string, string>>({})
  const [useSavedCard, setUseSavedCard] = useState(!!me?.savedPayments.some((p) => p.method === 'card'))
  const [ack, setAck] = useState(false)
  const [craving, setCraving] = useState(0)
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

  useEffect(() => {
    if (!addressId && addresses[0]) setAddressId(addresses[0].id)
  }, [addresses, addressId])

  if (!bill.lines.length && !placing) return <Navigate to="/cart" replace />
  if (bill.belowMin > 0 && !placing) return <Navigate to="/cart?tab=food" replace />

  const cardNumber = useSavedCard ? '4242424242424242' : card.number.replace(/\s/g, '')

  const validateCard = () => {
    if (useSavedCard) return true
    const e: Record<string, string> = {}
    if (!(cardNumber in DEMO_CARDS)) e.number = 'Use a demo test card, e.g. 4242 4242 4242 4242. Real cards are not accepted.'
    if (!card.name.trim()) e.name = 'Name on card is required'
    const m = /^(\d{2})\/(\d{2})$/.exec(card.exp)
    if (!m || +m[1] < 1 || +m[1] > 12 || new Date(2000 + +m[2], +m[1]) < new Date()) e.exp = 'Enter a future expiry (MM/YY)'
    if (!/^\d{3}$/.test(card.cvc)) e.cvc = '3 digits'
    setCardErr(e)
    return !Object.keys(e).length
  }

  const next = () => {
    if (step === 0) {
      if (!address) return toast('warning', 'Add a delivery address first')
      if (!areaById(address.areaId).available) return toast('error', 'We don’t deliver there yet')
    }
    if (step === 2 && payment === 'card' && !validateCard()) return
    setStep((s) => Math.min(3, s + 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onGateway = (r: GatewayResult) => {
    setGateway(false)
    if (!r.ok) {
      setStep(2)
      toast('error', 'Payment failed (simulated)', 'Choose another method or try again.')
      return
    }
    setPlacing(true)
    const order = placeOrder({ kind, addressId, delivery: delivery!, payment, paymentRef: r.ref, cravingBefore: craving || undefined })
    nav(`/orders/${order.id}?placed=1`, { replace: true })
  }

  return (
    <div className="min-h-dvh bg-ink-50">
      {/* Focused checkout header */}
      <div className="sticky top-0 z-30 border-b border-ink-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <button onClick={() => (step ? setStep(step - 1) : nav(-1))} className="icon-btn -ml-2" aria-label="Back"><ArrowLeft className="size-5" /></button>
          <LogoMark size={28} />
          <p className="font-display font-bold">Checkout · {kind === 'food' ? bill.restaurant?.name : 'Shopping'}</p>
          <Badge tone="warning" className="ml-auto hidden sm:inline-flex">Test order</Badge>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-3">
          <ol className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <li key={s} className="flex flex-1 items-center gap-2">
                <button disabled={i > step} onClick={() => setStep(i)} className={cx('flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap', i <= step ? 'text-brand-700' : 'text-ink-400')}>
                  <span className={cx('grid size-6 place-items-center rounded-full text-[11px] font-bold transition', i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-600' : 'bg-ink-100 text-ink-400')}>
                    {i < step ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className="hidden sm:inline">{s}</span>
                </button>
                {i < STEPS.length - 1 && <span className={cx('h-0.5 flex-1 rounded-full', i < step ? 'bg-brand-600' : 'bg-ink-200')} />}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 pb-32 lg:grid-cols-[1fr_380px] lg:pb-10">
        <div className="animate-fade-in" key={step}>
          {step === 0 && (
            <section>
              <h2 className="font-display text-2xl font-bold">Where should we (not) deliver?</h2>
              <p className="text-sm text-ink-500">Choose a saved address or add a new one.</p>
              <div className="mt-4 space-y-3">
                {addresses.map((a) => (
                  <label key={a.id} className={cx('card flex cursor-pointer items-start gap-3 p-4 transition', addressId === a.id ? 'border-brand-500 ring-2 ring-brand-100' : 'hover:border-ink-300')}>
                    <input type="radio" name="addr" checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-1 size-[18px] accent-brand-600" />
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink-50"><LabelIcon label={a.label} className="size-5 text-ink-700" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-bold">{a.label}{a.isDefault && <Badge tone="brand">Default</Badge>}</span>
                      <span className="block text-sm text-ink-700">{addressLine(a)}, {areaById(a.areaId).city} {areaById(a.areaId).postcode}</span>
                      <span className="block text-xs text-ink-500 mt-0.5">{a.recipient} · {prettyPhone(a.phone)}{a.floor && ` · ${a.floor}`}</span>
                      {a.notes && <span className="block text-xs text-ink-500 mt-0.5 italic">“{a.notes}”</span>}
                    </span>
                    <button type="button" onClick={(e) => { e.preventDefault(); openAddressForm(a) }} className="icon-btn size-8" aria-label="Edit address"><Pencil className="size-4" /></button>
                  </label>
                ))}
                <button onClick={() => openAddressForm(undefined, (id) => setAddressId(id))} className="card flex w-full items-center gap-3 border-dashed p-4 text-left font-semibold text-brand-700 hover:bg-brand-50">
                  <span className="grid size-10 place-items-center rounded-full bg-brand-50"><Plus className="size-5" /></span> Add a new address
                </button>
              </div>
            </section>
          )}

          {step === 1 && (
            <section>
              <h2 className="font-display text-2xl font-bold">Delivery method</h2>
              <p className="text-sm text-ink-500">{kind === 'food' ? 'Target simulated delivery: about 30 minutes.' : 'Target simulated delivery: within 1 day.'}</p>
              <div className="mt-4 space-y-3">
                {methods.map((m) => (
                  <label key={m.id} className={cx('card flex cursor-pointer items-center gap-3 p-4 transition', deliveryId === m.id ? 'border-brand-500 ring-2 ring-brand-100' : 'hover:border-ink-300')}>
                    <input type="radio" name="dm" checked={deliveryId === m.id} onChange={() => setDeliveryId(m.id)} className="size-[18px] accent-brand-600" />
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink-50">
                      {m.id === 'priority' || m.id === 'express' ? <Zap className="size-5 text-coral-500" /> : m.id === 'pickup' ? <Store className="size-5 text-ink-700" /> : kind === 'food' ? <Bike className="size-5 text-brand-600" /> : <Truck className="size-5 text-brand-600" />}
                    </span>
                    <span className="flex-1">
                      <span className="block font-bold">{m.label}</span>
                      <span className="block text-sm text-ink-500">{m.description}</span>
                    </span>
                    <span className="font-bold">{m.fee ? taka(m.fee) : 'Free'}</span>
                  </label>
                ))}
              </div>
              <div className="mt-4 card p-4 flex items-start gap-3">
                <MapPin className="size-5 text-coral-500 shrink-0" />
                <div className="text-sm"><p className="font-semibold">Delivering to {address?.label}</p><p className="text-ink-500">{address && addressLine(address)}</p></div>
                <button className="ml-auto text-sm font-semibold text-brand-700" onClick={() => setStep(0)}>Change</button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <h2 className="font-display text-2xl font-bold">Payment method</h2>
              <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
                <FlaskConical className="size-5 shrink-0" />
                <p><b>Demo Payment.</b> Nothing here connects to bKash, Nagad or a card network. Use the test credentials shown — real account numbers and cards are rejected.</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(Object.keys(PAYMENT_META) as PaymentMethodId[]).map((m) => {
                  const saved = me?.savedPayments.find((p) => p.method === m)
                  return (
                    <button key={m} onClick={() => setPayment(m)} className={cx('card flex items-center gap-3 p-4 text-left transition', payment === m ? 'border-brand-500 ring-2 ring-brand-100' : 'hover:border-ink-300')}>
                      <PaymentLogo method={m} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{PAYMENT_META[m].label}</span>
                        <span className="block text-xs text-ink-500">{saved ? `Saved · ${saved.masked}` : PAYMENT_META[m].desc}</span>
                      </span>
                      <span className={cx('grid size-5 place-items-center rounded-full border-2', payment === m ? 'border-brand-600 bg-brand-600' : 'border-ink-300')}>{payment === m && <Check className="size-3 text-white" />}</span>
                    </button>
                  )
                })}
              </div>

              {payment === 'card' && (
                <div className="mt-4 card p-4">
                  {me?.savedPayments.some((p) => p.method === 'card') && (
                    <div className="mb-4 flex gap-2">
                      <button onClick={() => setUseSavedCard(true)} className={cx('chip flex-1 justify-center', useSavedCard && 'chip-active')}><CreditCard className="size-4" /> Saved •••• 4242</button>
                      <button onClick={() => setUseSavedCard(false)} className={cx('chip flex-1 justify-center', !useSavedCard && 'chip-active')}>New test card</button>
                    </div>
                  )}
                  {!useSavedCard && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Card number" error={cardErr.number} className="col-span-2">
                        <input inputMode="numeric" autoComplete="off" value={card.number} maxLength={19} onChange={(e) => setCard({ ...card, number: e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ') })} placeholder="4242 4242 4242 4242" className={cx('input font-mono', cardErr.number && 'input-error')} />
                      </Field>
                      <Field label="Name on card" error={cardErr.name} className="col-span-2">
                        <input autoComplete="off" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} placeholder="TEST USER" className={cx('input uppercase', cardErr.name && 'input-error')} />
                      </Field>
                      <Field label="Expiry" error={cardErr.exp}>
                        <input inputMode="numeric" autoComplete="off" value={card.exp} maxLength={5} onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 4); setCard({ ...card, exp: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }) }} placeholder="12/29" className={cx('input font-mono', cardErr.exp && 'input-error')} />
                      </Field>
                      <Field label="CVC" error={cardErr.cvc}>
                        <input inputMode="numeric" autoComplete="off" value={card.cvc} maxLength={3} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '') })} placeholder="123" className={cx('input font-mono', cardErr.cvc && 'input-error')} />
                      </Field>
                    </div>
                  )}
                  <div className="mt-3 rounded-xl bg-ink-50 p-3 text-xs text-ink-600">
                    <p className="font-bold text-ink-700 mb-1">Test cards</p>
                    <p className="font-mono">4242 4242 4242 4242 → success</p>
                    <p className="font-mono">5555 5555 5555 4444 → success</p>
                    <p className="font-mono">4000 0000 0000 0002 → declined</p>
                    <p className="font-mono">4000 0000 0000 9995 → insufficient funds</p>
                    <p className="mt-1">Any future expiry · any 3-digit CVC · 3-D Secure OTP 123456. Card details are never stored.</p>
                  </div>
                </div>
              )}
              {(payment === 'bkash' || payment === 'nagad') && (
                <p className="mt-4 rounded-xl bg-ink-100 p-3 text-sm text-ink-700">You'll confirm with a test wallet number, OTP and PIN in the demo {PAYMENT_META[payment].label} window when you place the order.</p>
              )}
              {payment === 'cod' && <p className="mt-4 rounded-xl bg-ink-100 p-3 text-sm text-ink-700">Pay {taka(bill.total)} in cash when the (imaginary) rider arrives. Spoiler: they won't.</p>}
            </section>
          )}

          {step === 3 && (
            <section>
              <h2 className="font-display text-2xl font-bold">Review your test order</h2>
              <div className="mt-4 card divide-y divide-ink-100">
                <ReviewRow icon={<MapPin className="size-5 text-coral-500" />} title={`Deliver to ${address?.label}`} body={address ? `${addressLine(address)} · ${address.recipient}, ${prettyPhone(address.phone)}` : ''} onEdit={() => setStep(0)} />
                <ReviewRow icon={kind === 'food' ? <Bike className="size-5 text-brand-600" /> : <Truck className="size-5 text-brand-600" />} title={delivery?.label ?? ''} body={delivery?.description ?? ''} onEdit={() => setStep(1)} />
                <ReviewRow icon={<PaymentLogo method={payment} size={28} />} title={PAYMENT_META[payment].label} body={payment === 'card' ? `${DEMO_CARDS[cardNumber]?.brand ?? 'Card'} •••• ${cardNumber.slice(-4)}` : payment === 'cod' ? 'Cash on delivery (simulated)' : 'Demo wallet — confirm on next screen'} onEdit={() => setStep(2)} />
              </div>
              <div className="mt-4 card p-4">
                <p className="font-bold mb-2">{bill.lines.reduce((a, l) => a + l.qty, 0)} items</p>
                <div className="space-y-2.5">
                  {bill.lines.map((l) => (
                    <div key={l.key} className="flex items-center gap-3">
                      <Img src={l.image} alt={l.name} art={artFor(l.refId, kind)} className="size-12 rounded-lg shrink-0" />
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-semibold line-clamp-1">{l.qty}× {l.name}</p>
                        <p className="text-xs text-ink-500 line-clamp-1">{[l.size && `Size ${l.size}`, l.color, ...(l.optionLabels ?? [])].filter(Boolean).join(' · ')}</p>
                      </div>
                      <span className="text-sm font-semibold">{taka(l.unitPrice * l.qty)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {settings.mindfulCheckIn && (
                <div className="mt-4 card p-4 bg-gradient-to-br from-white to-brand-50">
                  <p className="font-bold">Craving check-in 🧠 <span className="text-xs font-normal text-ink-500">(optional)</span></p>
                  <p className="text-sm text-ink-500">How strong is the craving right now? We'll ask again after “delivery”.</p>
                  <div className="mt-2"><Stars value={craving} onChange={setCraving} size={28} /></div>
                </div>
              )}
              <label className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 cursor-pointer">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 size-[18px] accent-brand-600" />
                <span>I understand this is a <b>simulated test order</b>. No payment will be charged, no restaurant or store will receive it, and nothing will be delivered.</span>
              </label>
            </section>
          )}
        </div>

        {/* Summary */}
        <aside className="space-y-4 lg:sticky lg:top-32 h-fit">
          {step >= 2 && <VoucherBox kind={kind} deliveryFee={delivery?.fee ?? 0} />}
          <BillCard bill={bill} kind={kind} deliveryLabel={delivery ? `Delivery (${delivery.label.toLowerCase()})` : undefined} />
          <div className="hidden lg:block">
            <CTA step={step} total={bill.total} ack={ack} onNext={next} onPlace={() => setGateway(true)} />
          </div>
          <p className="flex items-center justify-center gap-1.5 text-xs text-ink-500"><ShieldCheck className="size-4" /> Secured by Demo Pay · nothing is charged</p>
        </aside>
      </div>

      <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white p-3 pb-safe">
        <CTA step={step} total={bill.total} ack={ack} onNext={next} onPlace={() => setGateway(true)} />
      </div>

      <PaymentGateway open={gateway} method={payment} amount={bill.total} cardNumber={cardNumber} onClose={() => setGateway(false)} onResult={onGateway} />
    </div>
  )
}

function CTA({ step, total, ack, onNext, onPlace }: { step: number; total: number; ack: boolean; onNext: () => void; onPlace: () => void }) {
  if (step < 3)
    return <button onClick={onNext} className="btn btn-primary btn-lg w-full">Continue to {STEPS[step + 1].toLowerCase()} <ChevronRight className="size-5" /></button>
  return (
    <button onClick={onPlace} disabled={!ack} className="btn btn-accent btn-lg w-full" title={!ack ? 'Tick the simulation acknowledgement first' : undefined}>
      Place test order · {taka(total)}
    </button>
  )
}

function ReviewRow({ icon, title, body, onEdit }: { icon: ReactNode; title: string; body: string; onEdit: () => void }) {
  return (
    <div className="flex items-start gap-3 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink-50">{icon}</span>
      <div className="min-w-0 flex-1 text-sm"><p className="font-bold">{title}</p><p className="text-ink-500">{body}</p></div>
      <button onClick={onEdit} className="text-sm font-semibold text-brand-700">Edit</button>
    </div>
  )
}

