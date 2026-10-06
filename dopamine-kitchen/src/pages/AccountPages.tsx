import { useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Info, Pencil, Plus, Star, Trash2, RotateCcw, Globe, Gauge, Brain, Bell } from 'lucide-react'
import type { SimSpeed } from '../data/types'
import { useMe, useStore } from '../store/store'
import { useUI } from '../store/ui'
import { confirmDialog, toast } from '../store/toast'
import { areaById } from '../data/areas'
import { cx, normalizeBdPhone, prettyPhone } from '../lib/format'
import { useTitle } from '../lib/hooks'
import { LabelIcon, addressLine } from '../components/location'
import { PAYMENT_META, PaymentLogo, DEMO_WALLETS, DEMO_CARDS } from '../components/PaymentGateway'
import { Badge, EmptyState, Field, Modal, Toggle } from '../components/ui'

export default function AccountPages() {
  const { section } = useParams()
  switch (section) {
    case 'profile': return <Profile />
    case 'addresses': return <Addresses />
    case 'payments': return <Payments />
    case 'settings': return <SettingsPage />
    case 'vouchers': return <Navigate to="/offers" replace />
    default: return <Navigate to="/account" replace />
  }
}

function Shell({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  useTitle(title)
  const nav = useNavigate()
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => nav('/account')} className="icon-btn -ml-2" aria-label="Back to account"><ArrowLeft className="size-5" /></button>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold flex-1">{title}</h1>
        {action}
      </div>
      {children}
    </div>
  )
}

function Profile() {
  const me = useMe()!
  const update = useStore((s) => s.updateUser)
  const users = useStore((s) => s.db.users)
  const [f, setF] = useState({ name: me.name, phone: prettyPhone(me.phone).replace('+880 ', ''), email: me.email })
  const [err, setErr] = useState<Record<string, string>>({})
  const save = () => {
    const e: Record<string, string> = {}
    if (f.name.trim().length < 2) e.name = 'Please enter your name'
    const phone = normalizeBdPhone(f.phone)
    if (!phone) e.phone = 'Enter a valid Bangladeshi mobile number'
    else if (users.some((u) => u.phone === phone && u.id !== me.id)) e.phone = 'Another demo account uses this number'
    if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) e.email = 'Enter a valid email'
    setErr(e)
    if (Object.keys(e).length) return
    update({ name: f.name.trim(), phone: phone!, email: f.email.trim() })
    toast('success', 'Profile updated')
  }
  return (
    <Shell title="Profile">
      <div className="card p-5 space-y-4">
        <Field label="Full name" error={err.name}><input className={cx('input', err.name && 'input-error')} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Mobile number" error={err.phone} hint="Used for (simulated) OTP login and rider contact.">
          <div className="flex">
            <span className="inline-flex items-center rounded-l-xl border border-r-0 border-ink-200 bg-ink-50 px-3 text-sm font-semibold">🇧🇩 +880</span>
            <input className={cx('input rounded-l-none', err.phone && 'input-error')} inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </div>
        </Field>
        <Field label="Email (optional)" error={err.email}><input className={cx('input', err.email && 'input-error')} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@example.com" /></Field>
        <button className="btn btn-primary w-full sm:w-auto" onClick={save}>Save changes</button>
      </div>
      <p className="mt-4 flex items-start gap-2 text-xs text-ink-500"><Info className="size-4 shrink-0" /> Profile data is stored only in this browser for the demo. Please don't enter sensitive personal information.</p>
    </Shell>
  )
}

function Addresses() {
  const me = useMe()!
  const addresses = useStore((s) => s.db.addresses).filter((a) => a.userId === me.id)
  const del = useStore((s) => s.deleteAddress)
  const setDefault = useStore((s) => s.setDefaultAddress)
  const open = useUI((s) => s.openAddressForm)
  return (
    <Shell title="Saved addresses" action={<button className="btn btn-primary btn-sm" onClick={() => open()}><Plus className="size-4" /> Add</button>}>
      {addresses.length === 0 ? <EmptyState emoji="🏠" title="No saved addresses" body="Save Home, Office and other places for faster (simulated) checkout." action={<button className="btn btn-primary" onClick={() => open()}>Add address</button>} /> : (
        <div className="space-y-3">
          {addresses.map((a) => (
            <div key={a.id} className="card p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink-50"><LabelIcon label={a.label} className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-bold">{a.label}{a.isDefault && <Badge tone="brand">Default</Badge>}</p>
                  <p className="text-sm text-ink-700">{addressLine(a)}, {areaById(a.areaId).city} {areaById(a.areaId).postcode}</p>
                  <p className="text-xs text-ink-500">{a.recipient} · {prettyPhone(a.phone)}{a.floor ? ` · ${a.floor}` : ''}</p>
                  {a.notes && <p className="text-xs italic text-ink-500">“{a.notes}”</p>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn btn-secondary btn-sm" onClick={() => open(a)}><Pencil className="size-4" /> Edit</button>
                {!a.isDefault && <button className="btn btn-ghost btn-sm" onClick={() => { setDefault(a.id); toast('success', `${a.label} is now your default address`) }}><Star className="size-4" /> Set as default</button>}
                <button className="btn btn-ghost btn-sm text-red-600" onClick={async () => { if (await confirmDialog({ title: 'Delete this address?', body: addressLine(a), confirmLabel: 'Delete', tone: 'danger' })) { del(a.id); toast('info', 'Address deleted') } }}><Trash2 className="size-4" /> Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  )
}

function Payments() {
  const me = useMe()!
  const add = useStore((s) => s.addSavedPayment)
  const remove = useStore((s) => s.removeSavedPayment)
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<'bkash' | 'nagad' | 'card'>('bkash')
  const [value, setValue] = useState('')
  const [err, setErr] = useState('')
  const submit = () => {
    const v = value.replace(/\s/g, '')
    if (method === 'card') {
      if (!(v in DEMO_CARDS)) return setErr('Only demo test cards can be saved (e.g. 4242 4242 4242 4242).')
      add({ method, label: DEMO_CARDS[v].brand, masked: `•••• ${v.slice(-4)}` })
    } else {
      if (!(v in DEMO_WALLETS)) return setErr('Only demo wallet numbers can be saved (e.g. 01700000000).')
      add({ method, label: `${PAYMENT_META[method].label} (test wallet)`, masked: `${v.slice(0, 5)}-${v.slice(5)}` })
    }
    toast('success', 'Demo payment method saved')
    setOpen(false)
    setValue('')
    setErr('')
  }
  return (
    <Shell title="Payment methods" action={<button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Plus className="size-4" /> Add</button>}>
      <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
        <Info className="size-5 shrink-0" /> Only demo test credentials can be saved. Real wallets and cards are rejected and never stored.
      </div>
      <div className="space-y-3">
        <div className="card flex items-center gap-3 p-4"><PaymentLogo method="cod" /><div className="flex-1"><p className="font-bold">Cash on delivery</p><p className="text-xs text-ink-500">Always available (simulated)</p></div></div>
        {me.savedPayments.map((p) => (
          <div key={p.id} className="card flex items-center gap-3 p-4">
            <PaymentLogo method={p.method} />
            <div className="flex-1"><p className="font-bold">{p.label}</p><p className="text-xs text-ink-500 font-mono">{p.masked}</p></div>
            <Badge tone="warning">Test</Badge>
            <button className="icon-btn text-red-600" aria-label="Remove payment method" onClick={async () => { if (await confirmDialog({ title: 'Remove this payment method?', confirmLabel: 'Remove', tone: 'danger' })) remove(p.id) }}><Trash2 className="size-4" /></button>
          </div>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Add demo payment method" size="sm" footer={<button className="btn btn-primary w-full" onClick={submit}>Save</button>}>
        <div className="flex gap-2 mb-4">
          {(['bkash', 'nagad', 'card'] as const).map((m) => <button key={m} onClick={() => { setMethod(m); setErr('') }} className={cx('chip flex-1 justify-center', method === m && 'chip-active')}>{PAYMENT_META[m].label.split(' ')[0]}</button>)}
        </div>
        <Field label={method === 'card' ? 'Test card number' : 'Test wallet number'} error={err} hint={method === 'card' ? 'Try 4242 4242 4242 4242' : 'Try 01700000000'}>
          <input className={cx('input font-mono', err && 'input-error')} inputMode="numeric" value={value} onChange={(e) => { setValue(e.target.value); setErr('') }} />
        </Field>
      </Modal>
    </Shell>
  )
}

function SettingsPage() {
  const settings = useStore((s) => s.settings)
  const update = useStore((s) => s.updateSettings)
  const reset = useStore((s) => s.resetDemo)
  const nav = useNavigate()
  return (
    <Shell title="Settings">
      <div className="card divide-y divide-ink-100">
        <Row icon={<Globe className="size-5" />} title="Language" sub="Bangla support is in beta — navigation and key headings are translated.">
          <select className="input h-9 w-auto" value={settings.lang} onChange={(e) => { update({ lang: e.target.value as 'en' | 'bn' }); toast('success', e.target.value === 'bn' ? 'ভাষা: বাংলা (বেটা)' : 'Language: English') }}>
            <option value="en">English</option>
            <option value="bn">বাংলা (beta)</option>
          </select>
        </Row>
        <Row icon={<Gauge className="size-5" />} title="Simulation speed" sub="Real-time: food ≈ 30 min, shopping ≈ 1 day. Speed it up to explore faster.">
          <div className="flex rounded-xl bg-ink-100 p-0.5">
            {([1, 10, 60] as SimSpeed[]).map((s) => <button key={s} onClick={() => update({ simSpeed: s })} className={cx('h-8 rounded-lg px-3 text-xs font-bold', settings.simSpeed === s ? 'bg-white shadow-sm text-brand-700' : 'text-ink-500')}>{s === 1 ? '1×' : `${s}×`}</button>)}
          </div>
        </Row>
        <Row icon={<Brain className="size-5" />} title="Craving check-ins" sub="Ask how strong the craving is before ordering and after delivery.">
          <Toggle checked={settings.mindfulCheckIn} onChange={(v) => update({ mindfulCheckIn: v })} label="Craving check-ins" />
        </Row>
        <Row icon={<Bell className="size-5" />} title="Order notifications" sub="Confirmation, preparation, pickup and delivery updates.">
          <Toggle checked={settings.notifyOrders} onChange={(v) => update({ notifyOrders: v })} label="Order notifications" />
        </Row>
        <Row icon={<Bell className="size-5" />} title="Promotions & vouchers" sub="Show promotional notifications.">
          <Toggle checked={settings.notifyPromos} onChange={(v) => update({ notifyPromos: v })} label="Promotional notifications" />
        </Row>
      </div>
      <div className="mt-4 card p-4">
        <p className="font-bold">Reset demo data</p>
        <p className="text-sm text-ink-500">Restore all restaurants, products, users and orders to the original seed. Your cart and favourites will be cleared.</p>
        <button className="btn btn-danger btn-sm mt-3" onClick={async () => { if (await confirmDialog({ title: 'Reset all demo data?', body: 'This cannot be undone.', confirmLabel: 'Reset', tone: 'danger' })) { reset(); toast('success', 'Demo data reset'); nav('/') } }}><RotateCcw className="size-4" /> Reset everything</button>
      </div>
      <div className="mt-4 rounded-2xl bg-ink-900 p-5 text-sm text-white/80">
        <p className="font-bold text-white">About Dopamine Kitchen</p>
        <p className="mt-1">Version 1.0 (prototype). A craving-reduction simulation: every restaurant, brand, rider, payment and delivery is fictional. Data is stored locally in your browser. <Link to="/help" className="font-semibold text-coral-300">Learn more</Link></p>
      </div>
    </Shell>
  )
}

const Row = ({ icon, title, sub, children }: { icon: ReactNode; title: string; sub: string; children: ReactNode }) => (
  <div className="flex flex-wrap items-center gap-4 p-4">
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-50 text-ink-700">{icon}</span>
    <div className="min-w-[180px] flex-1"><p className="font-semibold">{title}</p><p className="text-xs text-ink-500">{sub}</p></div>
    {children}
  </div>
)
