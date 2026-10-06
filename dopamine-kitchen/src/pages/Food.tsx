import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowUpDown, Check, Clock, SlidersHorizontal, Star, Tag, Bike, DoorOpen } from 'lucide-react'
import { useCurrentArea, useStore } from '../store/store'
import { FOOD_CATEGORIES } from '../data/restaurants'
import { pick } from '../data/images'
import { areaById } from '../data/areas'
import { foodDelivery } from '../lib/pricing'
import { useSimLoad, useTitle } from '../lib/hooks'
import { cx } from '../lib/format'
import { RestaurantCard } from '../components/cards'
import { EmptyState, FilterGroup, GridSkeleton, HScroll, Img, Modal } from '../components/ui'

type Sort = 'relevance' | 'rating' | 'time' | 'distance' | 'price_low' | 'price_high'
const SORTS: { id: Sort; label: string }[] = [
  { id: 'relevance', label: 'Recommended' },
  { id: 'rating', label: 'Top rated' },
  { id: 'time', label: 'Fastest delivery' },
  { id: 'distance', label: 'Nearest' },
  { id: 'price_low', label: 'Price: low to high' },
  { id: 'price_high', label: 'Price: high to low' },
]

interface Filters {
  rating: number
  maxTime: number
  price: number[]
  offers: boolean
  freeDelivery: boolean
  openNow: boolean
}
const EMPTY: Filters = { rating: 0, maxTime: 0, price: [], offers: false, freeDelivery: false, openNow: false }

export default function Food() {
  const [params, setParams] = useSearchParams()
  const cat = params.get('cat') ?? ''
  const sort = (params.get('sort') as Sort) || 'relevance'
  const restaurants = useStore((s) => s.db.restaurants)
  const menu = useStore((s) => s.db.menu)
  const { areaId } = useCurrentArea()
  const [f, setF] = useState<Filters>(EMPTY)
  const [draft, setDraft] = useState<Filters>(EMPTY)
  const [sheet, setSheet] = useState<'filters' | 'sort' | null>(null)
  const loading = useSimLoad([cat])
  const catLabel = FOOD_CATEGORIES.find((c) => c.id === cat)?.label
  useTitle(catLabel ? `${catLabel} delivery` : 'Restaurants')

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v)
    else p.delete(k)
    setParams(p, { replace: true })
  }

  const list = useMemo(() => {
    const rows = restaurants
      .filter((r) => !cat || r.categories.includes(cat as never) || menu.some((m) => m.restaurantId === r.id && m.category === cat))
      .map((r) => ({ r, d: foodDelivery(r, areaId) }))
      .filter(({ r, d }) =>
        (!f.rating || r.rating >= f.rating) &&
        (!f.maxTime || d.eta <= f.maxTime) &&
        (!f.price.length || f.price.includes(r.priceLevel)) &&
        (!f.offers || !!r.offer) &&
        (!f.freeDelivery || r.tags.includes('Free delivery') || r.offer?.voucherCode === 'FREEDEL') &&
        (!f.openNow || r.isOpen),
      )
    const by: Record<Sort, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
      relevance: (a, b) => Number(b.r.isOpen) - Number(a.r.isOpen) || b.r.rating * 10 - b.d.km - (a.r.rating * 10 - a.d.km),
      rating: (a, b) => b.r.rating - a.r.rating,
      time: (a, b) => a.d.eta - b.d.eta,
      distance: (a, b) => a.d.km - b.d.km,
      price_low: (a, b) => a.r.priceLevel - b.r.priceLevel,
      price_high: (a, b) => b.r.priceLevel - a.r.priceLevel,
    }
    return rows.sort(by[sort]).map((x) => x.r)
  }, [restaurants, menu, cat, f, sort, areaId])

  const activeCount = (f.rating ? 1 : 0) + (f.maxTime ? 1 : 0) + (f.price.length ? 1 : 0) + Number(f.offers) + Number(f.freeDelivery) + Number(f.openNow)
  const quick = (k: keyof Filters, on: Filters[keyof Filters], off: Filters[keyof Filters]) => setF((p) => ({ ...p, [k]: p[k] === on ? off : on }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">{catLabel ? `${catLabel} near you` : 'Restaurants near you'}</h1>
          <p className="text-sm text-ink-500 mt-1">Delivering to {areaById(areaId).name} · simulated ETAs around 30 minutes</p>
        </div>
      </div>

      {/* Cuisine chips */}
      <HScroll className="mt-5" itemClass="gap-3">
        <button onClick={() => setParam('cat', '')} className={cx('flex w-[72px] shrink-0 flex-col items-center gap-1.5 snap-start')}>
          <span className={cx('grid size-16 place-items-center rounded-2xl text-2xl transition', !cat ? 'bg-brand-600 text-white shadow-glow' : 'bg-white border border-ink-200')}>🍽️</span>
          <span className={cx('text-xs font-semibold', !cat && 'text-brand-700')}>All</span>
        </button>
        {FOOD_CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setParam('cat', c.id === cat ? '' : c.id)} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 snap-start">
            <Img src={pick(c.pool, c.idx)} alt={c.label} art={c.id} className={cx('size-16 rounded-2xl transition', cat === c.id ? 'ring-[3px] ring-brand-600 ring-offset-2' : '')} />
            <span className={cx('text-xs font-semibold', cat === c.id && 'text-brand-700')}>{c.label}</span>
          </button>
        ))}
      </HScroll>

      {/* Filter bar */}
      <div className="sticky top-16 z-20 -mx-4 mt-4 border-b border-ink-100 bg-ink-50/95 px-4 py-3 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          <button className={cx('chip', activeCount > 0 && 'chip-active')} onClick={() => { setDraft(f); setSheet('filters') }}>
            <SlidersHorizontal className="size-4" /> Filters{activeCount > 0 && ` (${activeCount})`}
          </button>
          <button className="chip" onClick={() => setSheet('sort')}><ArrowUpDown className="size-4" /> {SORTS.find((s) => s.id === sort)?.label}</button>
          <button className={cx('chip', f.rating === 4.5 && 'chip-active')} onClick={() => quick('rating', 4.5, 0)}><Star className="size-4" /> Rating 4.5+</button>
          <button className={cx('chip', f.maxTime === 30 && 'chip-active')} onClick={() => quick('maxTime', 30, 0)}><Clock className="size-4" /> Under 30 min</button>
          <button className={cx('chip', f.offers && 'chip-active')} onClick={() => quick('offers', true, false)}><Tag className="size-4" /> Offers</button>
          <button className={cx('chip', f.freeDelivery && 'chip-active')} onClick={() => quick('freeDelivery', true, false)}><Bike className="size-4" /> Free delivery</button>
          <button className={cx('chip', f.openNow && 'chip-active')} onClick={() => quick('openNow', true, false)}><DoorOpen className="size-4" /> Open now</button>
        </div>
      </div>

      <p className="mt-4 mb-3 text-sm text-ink-500">{loading ? 'Finding restaurants…' : `${list.length} restaurant${list.length === 1 ? '' : 's'}`}</p>
      {loading ? (
        <GridSkeleton count={6} />
      ) : list.length === 0 ? (
        <EmptyState emoji="🔍" title="No restaurants match" body="Try removing a filter or picking a different craving." action={<button className="btn btn-primary" onClick={() => { setF(EMPTY); setParam('cat', '') }}>Clear all filters</button>} />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => <RestaurantCard key={r.id} r={r} />)}
        </div>
      )}

      <Modal open={sheet === 'sort'} onClose={() => setSheet(null)} title="Sort by" size="sm">
        <div className="space-y-1">
          {SORTS.map((s) => (
            <button key={s.id} onClick={() => { setParam('sort', s.id === 'relevance' ? '' : s.id); setSheet(null) }} className={cx('flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold hover:bg-ink-50', sort === s.id && 'bg-brand-50 text-brand-700')}>
              {s.label} {sort === s.id && <Check className="size-4" />}
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={sheet === 'filters'} onClose={() => setSheet(null)} title="Filters"
        footer={<div className="flex gap-2"><button className="btn btn-secondary flex-1" onClick={() => setDraft(EMPTY)}>Reset</button><button className="btn btn-primary flex-1" onClick={() => { setF(draft); setSheet(null) }}>Show results</button></div>}>
        <FilterGroup title="Rating">
          {[0, 4, 4.5].map((r) => <button key={r} className={cx('chip', draft.rating === r && 'chip-active')} onClick={() => setDraft({ ...draft, rating: r })}>{r ? `${r}+ ★` : 'Any'}</button>)}
        </FilterGroup>
        <FilterGroup title="Delivery time">
          {[0, 25, 30, 40].map((t) => <button key={t} className={cx('chip', draft.maxTime === t && 'chip-active')} onClick={() => setDraft({ ...draft, maxTime: t })}>{t ? `Under ${t} min` : 'Any'}</button>)}
        </FilterGroup>
        <FilterGroup title="Price">
          {[1, 2, 3].map((p) => (
            <button key={p} className={cx('chip', draft.price.includes(p) && 'chip-active')} onClick={() => setDraft({ ...draft, price: draft.price.includes(p) ? draft.price.filter((x) => x !== p) : [...draft.price, p] })}>
              {'৳'.repeat(p)} {p === 1 ? 'Budget' : p === 2 ? 'Mid-range' : 'Premium'}
            </button>
          ))}
        </FilterGroup>
        <FilterGroup title="Cuisine">
          {FOOD_CATEGORIES.map((c) => <button key={c.id} className={cx('chip', cat === c.id && 'chip-active')} onClick={() => setParam('cat', cat === c.id ? '' : c.id)}>{c.emoji} {c.label}</button>)}
        </FilterGroup>
        <FilterGroup title="More">
          <button className={cx('chip', draft.offers && 'chip-active')} onClick={() => setDraft({ ...draft, offers: !draft.offers })}>Has offers</button>
          <button className={cx('chip', draft.freeDelivery && 'chip-active')} onClick={() => setDraft({ ...draft, freeDelivery: !draft.freeDelivery })}>Free delivery</button>
          <button className={cx('chip', draft.openNow && 'chip-active')} onClick={() => setDraft({ ...draft, openNow: !draft.openNow })}>Open now</button>
        </FilterGroup>
      </Modal>
    </div>
  )
}
