import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Gift, Tag } from 'lucide-react'
import { useStore } from '../store/store'
import { toast } from '../store/toast'
import { foodDelivery, shopDeliveryMethods, subtotalOf } from '../lib/pricing'
import { useCurrentArea } from '../store/store'
import { cx } from '../lib/format'
import { useTitle } from '../lib/hooks'
import { RestaurantCard, VoucherCard } from '../components/cards'
import { DemoTag, SectionHeader, Tabs } from '../components/ui'

export default function Offers() {
  useTitle('Offers & vouchers')
  const nav = useNavigate()
  const vouchers = useStore((s) => s.db.vouchers)
  const restaurants = useStore((s) => s.db.restaurants)
  const cart = useStore((s) => s.cart)
  const applied = useStore((s) => s.vouchersApplied)
  const applyVoucher = useStore((s) => s.applyVoucher)
  const { areaId } = useCurrentArea()
  const [tab, setTab] = useState<'all' | 'food' | 'shop'>('all')
  const [code, setCode] = useState('')
  const now = Date.now()
  const live = vouchers.filter((v) => v.active && v.expiresAt > now && (tab === 'all' || v.scope === tab || v.scope === 'all'))
  const expired = vouchers.filter((v) => !v.active || v.expiresAt <= now)

  const apply = (c: string, scope: 'all' | 'food' | 'shop') => {
    const hasFood = cart.some((l) => l.kind === 'food')
    const hasShop = cart.some((l) => l.kind === 'shop')
    const kind = scope === 'food' ? 'food' : scope === 'shop' ? 'shop' : hasFood ? 'food' : 'shop'
    if ((kind === 'food' && !hasFood) || (kind === 'shop' && !hasShop)) {
      toast('info', `Saved ${c} for later`, `Add ${kind === 'food' ? 'food' : 'shopping'} items to your cart, then apply it at checkout.`)
      return
    }
    const lines = cart.filter((l) => l.kind === kind)
    const fee = kind === 'food' ? (() => { const r = restaurants.find((x) => x.id === lines[0].storeId); return r ? foodDelivery(r, areaId).fee : 0 })() : shopDeliveryMethods(subtotalOf(lines))[0].fee
    const res = applyVoucher(kind, c, fee)
    if (res.ok) toast('success', `${c} applied to your ${kind === 'food' ? 'food' : 'shopping'} cart`, undefined, { label: 'View cart', onClick: () => nav(`/cart?tab=${kind}`) })
    else toast('error', `Couldn't apply ${c}`, res.error)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl bg-brand-gradient p-6 sm:p-10 text-white">
        <Gift className="absolute -right-4 -bottom-6 size-40 text-white/10" />
        <DemoTag label="Demo vouchers" />
        <h1 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold">Offers & vouchers</h1>
        <p className="mt-2 max-w-lg text-white/85">Stack up savings on money you were never going to spend. Apply any code at checkout.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) apply(code.trim().toUpperCase(), vouchers.find((v) => v.code === code.trim().toUpperCase())?.scope ?? 'all') }} className="mt-5 flex max-w-md gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter voucher code" className="input h-12 font-mono uppercase text-ink-900" />
          <button className="btn btn-lg bg-white text-brand-700 hover:bg-brand-50">Apply</button>
        </form>
      </div>

      <Tabs className="mt-6 max-w-sm" value={tab} onChange={setTab} items={[{ id: 'all', label: 'All' }, { id: 'food', label: 'Food' }, { id: 'shop', label: 'Shopping' }]} />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {live.map((v) => <VoucherCard key={v.code} v={v} applied={Object.values(applied).includes(v.code)} onApply={() => apply(v.code, v.scope)} />)}
      </div>

      {tab !== 'shop' && (
        <section className="mt-10">
          <SectionHeader title="Restaurant deals" subtitle="Offers running at demo restaurants" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {restaurants.filter((r) => r.offer).map((r) => <RestaurantCard key={r.id} r={r} />)}
          </div>
        </section>
      )}

      {expired.length > 0 && (
        <section className={cx('mt-10')}>
          <SectionHeader title="Expired & inactive" subtitle="Kept here so you can see how expired vouchers behave." />
          <div className="grid gap-3 md:grid-cols-2">{expired.map((v) => <VoucherCard key={v.code} v={v} />)}</div>
        </section>
      )}
      <p className="mt-8 flex items-center gap-2 text-xs text-ink-500"><Tag className="size-4" /> Vouchers are part of the simulation and have no cash value. <Link to="/help" className="font-semibold text-brand-700">Learn more</Link></p>
    </div>
  )
}
