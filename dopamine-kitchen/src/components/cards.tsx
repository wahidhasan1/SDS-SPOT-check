import { Link, useNavigate } from 'react-router-dom'
import { Bike, Clock, Copy, Heart, Plus, Tag, TicketPercent, Truck, Check, ChevronRight } from 'lucide-react'
import type { Brand, Favorites, MenuItem, Order, Product, Restaurant, Voucher } from '../data/types'
import { useCurrentArea, useFavorites, useStore, artFor } from '../store/store'
import { foodDelivery, voucherHeadline } from '../lib/pricing'
import { cx, discounted, fmtDateTime, taka } from '../lib/format'
import { stageLabel, statusTone } from '../lib/sim'
import { Badge, Img, Price, Rating, StoreLogo } from './ui'
import { toast } from '../store/toast'

export function FavButton({ type, id, className, size = 'md' }: { type: keyof Favorites; id: string; className?: string; size?: 'sm' | 'md' }) {
  const fav = useFavorites()
  const toggle = useStore((s) => s.toggleFavorite)
  const on = fav[type].includes(id)
  return (
    <button
      type="button"
      aria-label={on ? 'Remove from favourites' : 'Add to favourites'}
      aria-pressed={on}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const added = toggle(type, id)
        toast(added ? 'success' : 'info', added ? 'Saved to favourites' : 'Removed from favourites')
      }}
      className={cx('grid place-items-center rounded-full bg-white/95 backdrop-blur shadow-card transition active:scale-90 hover:scale-105', size === 'sm' ? 'size-8' : 'size-10', className)}
    >
      <Heart className={cx(size === 'sm' ? 'size-4' : 'size-[18px]', on ? 'fill-red-500 text-red-500 animate-pop' : 'text-ink-700')} />
    </button>
  )
}

export function RestaurantCard({ r, compact }: { r: Restaurant; compact?: boolean }) {
  const { areaId } = useCurrentArea()
  const d = foodDelivery(r, areaId)
  return (
    <Link to={`/restaurant/${r.id}`} className={cx('group card card-hover overflow-hidden block', compact && 'w-[78vw] max-w-[300px] shrink-0 snap-start')}>
      <div className="relative">
        <Img src={r.cover} alt={r.name} art={r.categories[0]} className="aspect-[16/9]" imgClassName="group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
        {r.offer && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-lg bg-sun-400 px-2 py-1 text-[11px] font-bold text-ink-900 shadow">
            <Tag className="size-3" /> {r.offer.label}
          </span>
        )}
        <FavButton type="restaurants" id={r.id} size="sm" className="absolute right-3 top-3" />
        {!r.isOpen && (
          <div className="absolute inset-0 grid place-items-center bg-ink-900/55 backdrop-grayscale">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ink-900">Closed · opens {r.opensAt ?? 'later'}</span>
          </div>
        )}
        <span className="absolute left-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-bold shadow">
          <Clock className="size-3.5 text-brand-600" /> {d.etaLabel}
        </span>
      </div>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-[15px] leading-snug line-clamp-1">{r.name}</h3>
          <Rating value={r.rating} count={r.reviewCount} />
        </div>
        <p className="mt-0.5 text-[13px] text-ink-500 line-clamp-1">
          {'৳'.repeat(r.priceLevel)}<span className="text-ink-300">{'৳'.repeat(3 - r.priceLevel)}</span> · {r.cuisines.join(', ')}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-500">
          <span className="inline-flex items-center gap-1"><Bike className="size-3.5" /> {taka(d.fee)}</span>
          <span>{d.km} km</span>
          <span>Min. {taka(r.minOrder)}</span>
          {r.tags.includes('Free delivery') && <Badge tone="success">Free delivery</Badge>}
          {r.tags.includes('New') && <Badge tone="info">New</Badge>}
        </div>
      </div>
    </Link>
  )
}

export function ProductCard({ p, brand, className }: { p: Product; brand?: Brand; className?: string }) {
  const price = discounted(p.price, p.discountPct)
  return (
    <Link to={`/product/${p.id}`} className={cx('group card card-hover overflow-hidden block', className)}>
      <div className="relative">
        <Img src={p.images[0]} alt={p.name} art={p.category} className="aspect-[4/5]" imgClassName="group-hover:scale-105 transition-transform duration-500" />
        {p.discountPct > 0 && <span className="absolute left-2.5 top-2.5 rounded-lg bg-sun-400 px-2 py-0.5 text-[11px] font-extrabold text-ink-900">-{p.discountPct}%</span>}
        <FavButton type="products" id={p.id} size="sm" className="absolute right-2.5 top-2.5" />
        {p.stock === 0 ? (
          <span className="absolute inset-x-2.5 bottom-2.5 rounded-lg bg-ink-900/85 py-1 text-center text-[11px] font-bold text-white">Out of stock</span>
        ) : p.stock <= 5 ? (
          <span className="absolute inset-x-2.5 bottom-2.5 rounded-lg bg-amber-500/95 py-1 text-center text-[11px] font-bold text-white">Only {p.stock} left</span>
        ) : p.tags[0] ? (
          <Badge tone="dark" className="absolute left-2.5 bottom-2.5">{p.tags[0]}</Badge>
        ) : null}
      </div>
      <div className="p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400 line-clamp-1">{brand?.name}</p>
        <h3 className="mt-0.5 text-[14px] font-semibold leading-snug line-clamp-2 min-h-[2.5em]">{p.name}</h3>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <Price value={price} original={p.discountPct ? p.price : undefined} size="sm" />
        </div>
        <div className="mt-1 flex items-center justify-between text-[12px] text-ink-500">
          <Rating value={p.rating} count={p.reviewCount} />
          <span className="inline-flex items-center gap-1"><Truck className="size-3.5" /> 1 day</span>
        </div>
      </div>
    </Link>
  )
}

export function DishCard({ m, restaurant }: { m: MenuItem; restaurant?: Restaurant }) {
  return (
    <Link to={`/restaurant/${m.restaurantId}?item=${m.id}`} className="group card card-hover overflow-hidden w-[44vw] max-w-[200px] shrink-0 snap-start">
      <div className="relative">
        <Img src={m.image} alt={m.name} art={m.category} className="aspect-square" imgClassName="group-hover:scale-105 transition-transform duration-500" />
        <span className="absolute bottom-2 right-2 grid size-8 place-items-center rounded-full bg-white text-brand-700 shadow-card"><Plus className="size-4" /></span>
      </div>
      <div className="p-2.5">
        <h4 className="text-[13px] font-semibold leading-snug line-clamp-2 min-h-[2.5em]">{m.name}</h4>
        <p className="text-[11px] text-ink-500 line-clamp-1">{restaurant?.name}</p>
        <Price value={m.price} original={m.originalPrice} size="sm" className="mt-1" />
      </div>
    </Link>
  )
}

export function BrandChip({ b }: { b: Brand }) {
  return (
    <Link to={`/store/${b.id}`} className="card card-hover flex items-center gap-3 p-3 w-[64vw] max-w-[240px] shrink-0 snap-start">
      <StoreLogo initials={b.initials} bg={b.logoBg} size={44} className="ring-0" />
      <div className="min-w-0">
        <p className="font-bold text-sm line-clamp-1">{b.name}</p>
        <p className="text-[12px] text-ink-500 line-clamp-1">{b.tagline}</p>
      </div>
    </Link>
  )
}

export function VoucherCard({ v, onApply, applied, compact, actionLabel = 'Apply' }: { v: Voucher; onApply?: () => void; applied?: boolean; compact?: boolean; actionLabel?: string }) {
  const expired = v.expiresAt < Date.now() || !v.active || !!v.usedAt
  const daysLeft = Math.ceil((v.expiresAt - Date.now()) / 864e5)
  const accent = v.type === 'freeDelivery' ? 'bg-sun-400 text-ink-900' : v.scope === 'shop' ? 'bg-ink-900 text-white' : 'bg-brand-600 text-white'
  return (
    <div className={cx('relative flex overflow-hidden rounded-2xl bg-white border border-ink-100 shadow-card', expired && 'opacity-60 grayscale', compact && 'w-[82vw] max-w-[330px] shrink-0 snap-start')}>
      <div className={cx('relative flex w-28 shrink-0 flex-col items-center justify-center p-3 text-center', accent)}>
        <TicketPercent className="size-5 opacity-80" />
        <span className="mt-1 font-display text-lg font-extrabold leading-tight">{voucherHeadline(v)}</span>
        {v.maxDiscount && <span className="text-[10px] font-semibold opacity-85">up to ৳{v.maxDiscount}</span>}
        <span className="absolute -right-2.5 top-1/2 size-5 -translate-y-1/2 rounded-full bg-ink-50" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-3.5 border-l-2 border-dashed border-ink-200">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold text-[14px] leading-snug">{v.title}</p>
          {v.ownerId && <Badge tone="sun" className="shrink-0">{v.source === 'welcome_spin' ? 'Welcome spin' : 'Yours'}</Badge>}
        </div>
        <p className="mt-0.5 text-[12px] text-ink-500 line-clamp-2">{v.description}</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-500">
          <span>Min. order {taka(v.minOrder)}</span>
          <span>{v.categoriesLabel}</span>
          <span className={cx(!expired && daysLeft <= 2 && 'font-bold text-sun-600')}>
            {v.usedAt ? `Used${v.usedOnOrder ? ` on ${v.usedOnOrder}` : ''}` : expired ? (v.active ? 'Expired' : 'Inactive') : daysLeft <= 1 ? 'Expires today' : `Valid for ${daysLeft} more days`}
          </span>
          {v.firstOrderOnly && <span className="font-semibold text-brand-700">First order only</span>}
        </div>
        <div className="mt-auto pt-2.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(v.code).catch(() => undefined)
              toast('success', `Code ${v.code} copied`)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-brand-300 bg-brand-50 px-2 py-1 font-mono text-[12px] font-bold text-brand-700"
          >
            {v.code} <Copy className="size-3" />
          </button>
          {onApply && !expired && (
            <button type="button" onClick={onApply} disabled={applied} className={cx('btn btn-sm', applied ? 'btn-soft' : 'btn-primary')}>
              {applied ? (<><Check className="size-4" /> Applied</>) : actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function StatusBadge({ order }: { order: Order }) {
  const tone = statusTone(order.status) as 'success' | 'danger' | 'info' | 'brand'
  return <Badge tone={tone}>{stageLabel(order.kind, order.status).title}</Badge>
}

export function OrderCard({ o, onReorder }: { o: Order; onReorder?: () => void }) {
  const nav = useNavigate()
  const count = o.items.reduce((s, i) => s + i.qty, 0)
  return (
    <div className="card p-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <Img src={o.items[0]?.image} alt={o.items[0]?.name ?? o.storeName} art={o.items[0] ? artFor(o.items[0].refId, o.kind) : 'restaurant'} className="size-16 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold leading-snug line-clamp-1">{o.storeName}</p>
              <p className="text-[12px] text-ink-500">
                {o.id} · {fmtDateTime(o.placedAt)}
              </p>
            </div>
            <StatusBadge order={o} />
          </div>
          <p className="mt-1.5 text-[13px] text-ink-700 line-clamp-1">
            {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[13px]">
            <span className="font-bold">{taka(o.total)}</span>
            <span className="text-ink-400">·</span>
            <span className="text-ink-500">{count} item{count > 1 ? 's' : ''}</span>
            <Badge tone="warning" className="ml-auto">Test order</Badge>
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button className="btn btn-secondary btn-sm flex-1" onClick={() => nav(`/orders/${o.id}`)}>
          {o.status === 'delivered' || o.status === 'cancelled' ? 'View details' : 'Track order'} <ChevronRight className="size-4" />
        </button>
        {onReorder && (
          <button className="btn btn-soft btn-sm flex-1" onClick={onReorder}>
            Reorder
          </button>
        )}
      </div>
    </div>
  )
}
