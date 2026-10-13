import { useMemo, useState } from 'react'
import { Briefcase, Check, Crosshair, House, Loader2, MapPin, Pencil, Plus, Search, Star } from 'lucide-react'
import type { Address, AddressLabel } from '../data/types'
import { AREAS, areaById } from '../data/areas'
import { useCurrentArea, useMe, useStore } from '../store/store'
import { useUI } from '../store/ui'
import { toast } from '../store/toast'
import { cx, normalizeBdPhone, prettyPhone } from '../lib/format'
import { Badge, Field, Modal } from './ui'

export const addressLine = (a: Address) => {
  const area = areaById(a.areaId)
  return [a.house, a.road, a.block, area.name].filter(Boolean).join(', ')
}

export const LabelIcon = ({ label, className }: { label: AddressLabel; className?: string }) =>
  label === 'Home' ? <House className={className} /> : label === 'Office' ? <Briefcase className={className} /> : <MapPin className={className} />

export function LocationModal() {
  const open = useUI((s) => s.locationOpen)
  const setOpen = useUI((s) => s.setLocationOpen)
  const openForm = useUI((s) => s.openAddressForm)
  const me = useMe()
  const addresses = useStore((s) => s.db.addresses).filter((a) => a.userId === me?.id)
  const selected = useStore((s) => s.selectedAddressId)
  const select = useStore((s) => s.selectAddress)
  const setGuestArea = useStore((s) => s.setGuestArea)
  const { areaId } = useCurrentArea()
  const [q, setQ] = useState('')
  const [detecting, setDetecting] = useState(false)

  const areas = useMemo(() => AREAS.filter((a) => `${a.name} ${a.city} ${a.postcode}`.toLowerCase().includes(q.toLowerCase())), [q])

  const detect = () => {
    setDetecting(true)
    setTimeout(() => {
      const options = AREAS.filter((a) => a.available)
      const a = options[Math.floor(Math.random() * options.length)]
      setGuestArea(a.id)
      setDetecting(false)
      setOpen(false)
      toast('success', `Location set to ${a.name}`, 'Simulated GPS — your real location was not accessed.')
    }, 1400)
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Choose delivery location">
      <button onClick={detect} disabled={detecting} className="w-full flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-3.5 text-left hover:bg-brand-100 transition">
        <span className="grid size-10 place-items-center rounded-full bg-white text-brand-600 shadow-sm">
          {detecting ? <Loader2 className="size-5 animate-spin" /> : <Crosshair className="size-5" />}
        </span>
        <span className="flex-1">
          <span className="block font-semibold text-brand-800">{detecting ? 'Detecting location…' : 'Use my current location'}</span>
          <span className="block text-xs text-brand-700/80">Simulated — no real GPS access</span>
        </span>
      </button>

      {me && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold">Saved addresses</p>
            <button className="btn btn-ghost btn-sm text-brand-700" onClick={() => openForm(undefined, (id) => { select(id); setOpen(false) })}>
              <Plus className="size-4" /> Add new
            </button>
          </div>
          <div className="space-y-2">
            {addresses.length === 0 && <p className="text-sm text-ink-500 rounded-xl bg-ink-50 p-3">No saved addresses yet.</p>}
            {addresses.map((a) => (
              <div key={a.id} className={cx('flex items-center gap-3 rounded-2xl border p-3 transition', selected === a.id ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-100' : 'border-ink-200 hover:border-ink-300')}>
                <button className="flex flex-1 items-center gap-3 text-left min-w-0" onClick={() => { select(a.id); setOpen(false); toast('success', `Delivering to ${a.label}`, addressLine(a)) }}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white border border-ink-100"><LabelIcon label={a.label} className="size-[18px] text-ink-700" /></span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-semibold text-sm">{a.label}{a.isDefault && <Badge tone="brand">Default</Badge>}</span>
                    <span className="block text-xs text-ink-500 truncate">{addressLine(a)}</span>
                  </span>
                </button>
                {selected === a.id && <Check className="size-5 text-brand-600" />}
                <button className="icon-btn size-8" aria-label="Edit address" onClick={() => openForm(a)}><Pencil className="size-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <p className="text-sm font-bold mb-2">Or pick an area</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input className="input pl-9" placeholder="Search area, e.g. Dhanmondi, 1213" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-ink-100 divide-y divide-ink-100">
          {areas.length === 0 && <p className="p-4 text-sm text-ink-500">No areas match “{q}”. We currently serve Dhaka.</p>}
          {areas.map((a) => (
            <button
              key={a.id}
              disabled={!a.available}
              onClick={() => { setGuestArea(a.id); setOpen(false); toast('success', `Location set to ${a.name}`) }}
              className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-ink-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <MapPin className="size-4 text-ink-400" />
              <span className="flex-1 text-sm"><span className="font-semibold">{a.name}</span> <span className="text-ink-500">· {a.city} {a.postcode}</span></span>
              {!a.available ? <Badge tone="neutral">Coming soon</Badge> : !selected && areaId === a.id ? <Check className="size-4 text-brand-600" /> : null}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

type Form = { label: AddressLabel; recipient: string; phone: string; areaId: string; house: string; road: string; block: string; floor: string; notes: string; isDefault: boolean }

export function AddressFormModal() {
  const { open, editing, onSaved } = useUI((s) => s.addressForm)
  const close = useUI((s) => s.closeAddressForm)
  if (!open) return null
  return <AddressFormInner key={editing?.id ?? 'new'} editing={editing} onSaved={onSaved} close={close} />
}

function AddressFormInner({ editing, onSaved, close }: { editing?: Address; onSaved?: (id: string) => void; close: () => void }) {
  const me = useMe()
  const save = useStore((s) => s.saveAddress)
  const { areaId } = useCurrentArea()
  const [f, setF] = useState<Form>(() => ({
    label: editing?.label ?? 'Home', recipient: editing?.recipient ?? me?.name ?? '', phone: editing ? prettyPhone(editing.phone) : me ? prettyPhone(me.phone) : '',
    areaId: editing?.areaId ?? areaId, house: editing?.house ?? '', road: editing?.road ?? '', block: editing?.block ?? '', floor: editing?.floor ?? '', notes: editing?.notes ?? '', isDefault: editing?.isDefault ?? false,
  }))
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }))

  const submit = () => {
    const e: typeof errors = {}
    if (!f.recipient.trim()) e.recipient = 'Recipient name is required'
    const phone = normalizeBdPhone(f.phone)
    if (!phone) e.phone = 'Enter a valid Bangladeshi mobile number (e.g. 01712-345678)'
    if (!f.house.trim()) e.house = 'House / building is required'
    if (!f.road.trim()) e.road = 'Road / street is required'
    setErrors(e)
    if (Object.keys(e).length) return
    const id = save({ id: editing?.id, label: f.label, recipient: f.recipient.trim(), phone: phone!, areaId: f.areaId, house: f.house.trim(), road: f.road.trim(), block: f.block.trim() || undefined, floor: f.floor.trim() || undefined, notes: f.notes.trim() || undefined, isDefault: f.isDefault })
    toast('success', editing ? 'Address updated' : 'Address saved')
    onSaved?.(id)
    close()
  }

  return (
    <Modal open onClose={close} title={editing ? 'Edit address' : 'Add a new address'} footer={<button className="btn btn-primary w-full" onClick={submit}>Save address</button>}>
      {!me && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Log in to save addresses.</p>}
      <div className="mb-4 flex gap-2">
        {(['Home', 'Office', 'Other'] as AddressLabel[]).map((l) => (
          <button key={l} type="button" onClick={() => set('label', l)} className={cx('chip flex-1 justify-center', f.label === l && 'chip-active')}>
            <LabelIcon label={l} className="size-4" /> {l}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Area" className="col-span-2">
          <select className="input" value={f.areaId} onChange={(e) => set('areaId', e.target.value)}>
            {AREAS.filter((a) => a.available).map((a) => <option key={a.id} value={a.id}>{a.name}, {a.city} {a.postcode}</option>)}
          </select>
        </Field>
        <Field label="House / building / flat" error={errors.house} className="col-span-2">
          <input className={cx('input', errors.house && 'input-error')} placeholder="House 24, Flat 5B" value={f.house} onChange={(e) => set('house', e.target.value)} />
        </Field>
        <Field label="Road / street" error={errors.road}>
          <input className={cx('input', errors.road && 'input-error')} placeholder="Road 11" value={f.road} onChange={(e) => set('road', e.target.value)} />
        </Field>
        <Field label="Block / sector (optional)">
          <input className="input" placeholder="Block F" value={f.block} onChange={(e) => set('block', e.target.value)} />
        </Field>
        <Field label="Floor (optional)">
          <input className="input" placeholder="5th floor" value={f.floor} onChange={(e) => set('floor', e.target.value)} />
        </Field>
        <Field label="Recipient name" error={errors.recipient}>
          <input className={cx('input', errors.recipient && 'input-error')} value={f.recipient} onChange={(e) => set('recipient', e.target.value)} />
        </Field>
        <Field label="Phone number" error={errors.phone} className="col-span-2">
          <div className="flex">
            <span className="inline-flex items-center rounded-l-xl border border-r-0 border-ink-200 bg-ink-50 px-3 text-sm font-semibold text-ink-700">🇧🇩 +880</span>
            <input className={cx('input rounded-l-none', errors.phone && 'input-error')} inputMode="tel" placeholder="1712-345678" value={f.phone.replace(/^\+880\s?/, '')} onChange={(e) => set('phone', e.target.value)} />
          </div>
        </Field>
        <Field label="Note to rider (optional)" className="col-span-2">
          <textarea className="input h-20 py-2.5 resize-none" placeholder="e.g. Call when you reach the gate" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
      <label className="mt-4 flex items-center gap-2.5 text-sm font-medium">
        <input type="checkbox" className="size-4 accent-brand-600" checked={f.isDefault} onChange={(e) => set('isDefault', e.target.checked)} />
        <Star className="size-4 text-amber-500" /> Set as default address
      </label>
    </Modal>
  )
}
