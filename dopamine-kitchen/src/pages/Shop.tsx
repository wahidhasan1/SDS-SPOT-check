import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowUpDown, Check, SlidersHorizontal, Truck, X } from 'lucide-react'
import type { ShopCategory } from '../data/types'
import { useStore } from '../store/store'
import { SHOP_CATEGORIES } from '../data/products'
import { IMG } from '../data/images'
import { cx, discounted, taka } from '../lib/format'
import { useSimLoad, useTitle } from '../lib/hooks'
import { ProductCard } from '../components/cards'
import { EmptyState, FilterGroup, GridSkeleton, Img, Modal } from '../components/ui'

type Sort = 'popular' | 'newest' | 'price_low' | 'price_high' | 'rating' | 'discount'
const SORTS: { id: Sort; label: string }[] = [
  { id: 'popular', label: 'Most popular' },
  { id: 'newest', label: 'Newest' },
  { id: 'price_low', label: 'Price: low to high' },
  { id: 'price_high', label: 'Price: high to low' },
  { id: 'rating', label: 'Top rated' },
  { id: 'discount', label: 'Biggest discount' },
]

export interface ShopFilters {
  brands: string[]
  sizes: string[]
  colors: string[]
  minPrice: string
  maxPrice: string
  rating: number
  express: boolean
  inStock: boolean
  onSale: boolean
}
export const EMPTY_SHOP: ShopFilters = { brands: [], sizes: [], colors: [], minPrice: '', maxPrice: '', rating: 0, express: false, inStock: false, onSale: false }

export default function Shop() {
  const [params, setParams] = useSearchParams()
  const cat = (params.get('cat') ?? '') as ShopCategory | ''
  const sort = (params.get('sort') as Sort) || 'popular'
  const products = useStore((s) => s.db.products)
  const brands = useStore((s) => s.db.brands)
  const [f, setF] = useState<ShopFilters>(() => ({ ...EMPTY_SHOP, brands: params.get('brand') ? [params.get('brand')!] : [] }))
  const [sheet, setSheet] = useState<'filters' | 'sort' | null>(null)
  const loading = useSimLoad([cat])
  const catLabel = SHOP_CATEGORIES.find((c) => c.id === cat)?.label
  useTitle(catLabel ?? 'Shop')

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v)
    else p.delete(k)
    setParams(p, { replace: true })
  }

  const inCat = useMemo(() => products.filter((p) => !cat || p.category === cat), [products, cat])
  const list = useMemo(() => applyShopFilters(inCat, f, sort), [inCat, f, sort])
  const activeCount = f.brands.length + f.sizes.length + f.colors.length + (f.minPrice || f.maxPrice ? 1 : 0) + (f.rating ? 1 : 0) + Number(f.express) + Number(f.inStock) + Number(f.onSale)

  return (
    <div className="animate-fade-in">
      <section className="relative overflow-hidden">
        <Img src={IMG.fashionHero[0]} alt="Shop" art="streetwear" className="absolute inset-0 size-full" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-900/90 via-brand-900/70 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:py-14 text-white">
          <p className="badge bg-white/15 text-white backdrop-blur">Next-day (simulated) delivery across Dhaka</p>
          <h1 className="mt-3 font-display text-3xl sm:text-5xl font-extrabold max-w-xl">{catLabel ?? 'Shop the craving'}</h1>
          <p className="mt-2 max-w-md text-white/80 text-sm sm:text-base">Fashion, shoes, bags & lifestyle from fictional local labels. Add to cart, check out, feel the thrill — keep your money.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4">
        <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-none pb-1">
          <button onClick={() => setParam('cat', '')} className={cx('chip', !cat && 'chip-active')}>All</button>
          {SHOP_CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => setParam('cat', c.id === cat ? '' : c.id)} className={cx('chip', cat === c.id && 'chip-active')}>{c.label}</button>
          ))}
        </div>

        <div className="mt-4 lg:grid lg:grid-cols-[250px_1fr] lg:gap-8">
          <aside className="hidden lg:block">
            <div className="sticky top-24 card p-4 max-h-[calc(100vh-120px)] overflow-y-auto">
              <div className="flex items-center justify-between mb-1">
                <p className="font-display text-lg font-bold">Filters</p>
                {activeCount > 0 && <button className="text-xs font-semibold text-brand-700" onClick={() => setF(EMPTY_SHOP)}>Clear all</button>}
              </div>
              <ShopFilterPanel f={f} setF={setF} products={inCat} brands={brands} />
            </div>
          </aside>

          <div>
            <div className="sticky top-16 z-20 -mx-4 border-b border-ink-100 bg-ink-50/95 px-4 py-3 backdrop-blur flex items-center gap-2">
              <button className={cx('chip lg:hidden', activeCount > 0 && 'chip-active')} onClick={() => setSheet('filters')}><SlidersHorizontal className="size-4" /> Filters{activeCount ? ` (${activeCount})` : ''}</button>
              <button className="chip" onClick={() => setSheet('sort')}><ArrowUpDown className="size-4" /> {SORTS.find((s) => s.id === sort)?.label}</button>
              <button className={cx('chip hidden sm:inline-flex', f.express && 'chip-active')} onClick={() => setF({ ...f, express: !f.express })}><Truck className="size-4" /> Same-day express</button>
              <span className="ml-auto text-sm text-ink-500 whitespace-nowrap">{loading ? '…' : `${list.length} items`}</span>
            </div>

            {activeCount > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {f.brands.map((b) => <Pill key={b} label={brands.find((x) => x.id === b)?.name ?? b} onX={() => setF({ ...f, brands: f.brands.filter((x) => x !== b) })} />)}
                {f.sizes.map((s) => <Pill key={s} label={`Size ${s}`} onX={() => setF({ ...f, sizes: f.sizes.filter((x) => x !== s) })} />)}
                {f.colors.map((c) => <Pill key={c} label={c} onX={() => setF({ ...f, colors: f.colors.filter((x) => x !== c) })} />)}
                {(f.minPrice || f.maxPrice) && <Pill label={`${f.minPrice ? taka(+f.minPrice) : '৳0'} – ${f.maxPrice ? taka(+f.maxPrice) : 'any'}`} onX={() => setF({ ...f, minPrice: '', maxPrice: '' })} />}
                {f.rating > 0 && <Pill label={`${f.rating}+ ★`} onX={() => setF({ ...f, rating: 0 })} />}
                {f.express && <Pill label="Express" onX={() => setF({ ...f, express: false })} />}
                {f.inStock && <Pill label="In stock" onX={() => setF({ ...f, inStock: false })} />}
                {f.onSale && <Pill label="On sale" onX={() => setF({ ...f, onSale: false })} />}
              </div>
            )}

            <div className="mt-4">
              {loading ? (
                <GridSkeleton count={8} tall className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4" />
              ) : list.length === 0 ? (
                <EmptyState emoji="🧺" title="Nothing matches those filters" body="Try a different size, colour or price range." action={<button className="btn btn-primary" onClick={() => setF(EMPTY_SHOP)}>Clear filters</button>} />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {list.map((p) => <ProductCard key={p.id} p={p} brand={brands.find((b) => b.id === p.brandId)} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal open={sheet === 'sort'} onClose={() => setSheet(null)} title="Sort by" size="sm">
        {SORTS.map((s) => (
          <button key={s.id} onClick={() => { setParam('sort', s.id === 'popular' ? '' : s.id); setSheet(null) }} className={cx('flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold hover:bg-ink-50', sort === s.id && 'bg-brand-50 text-brand-700')}>
            {s.label} {sort === s.id && <Check className="size-4" />}
          </button>
        ))}
      </Modal>
      <Modal open={sheet === 'filters'} onClose={() => setSheet(null)} title="Filters"
        footer={<div className="flex gap-2"><button className="btn btn-secondary flex-1" onClick={() => setF(EMPTY_SHOP)}>Reset</button><button className="btn btn-primary flex-1" onClick={() => setSheet(null)}>Show {list.length} items</button></div>}>
        <FilterGroup title="Category">
          <button onClick={() => setParam('cat', '')} className={cx('chip', !cat && 'chip-active')}>All</button>
          {SHOP_CATEGORIES.map((c) => <button key={c.id} onClick={() => setParam('cat', c.id)} className={cx('chip', cat === c.id && 'chip-active')}>{c.label}</button>)}
        </FilterGroup>
        <ShopFilterPanel f={f} setF={setF} products={inCat} brands={brands} />
      </Modal>
    </div>
  )
}

const Pill = ({ label, onX }: { label: string; onX: () => void }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 py-1 pl-3 pr-1.5 text-xs font-semibold text-brand-800">
    {label}
    <button onClick={onX} aria-label={`Remove ${label}`} className="grid size-5 place-items-center rounded-full hover:bg-brand-200"><X className="size-3" /></button>
  </span>
)

export function applyShopFilters<T extends { brandId: string; sizes: string[]; colors: { name: string }[]; price: number; discountPct: number; rating: number; expressAvailable: boolean; stock: number; reviewCount: number; createdAt: number }>(rows: T[], f: ShopFilters, sort: string) {
  const out = rows.filter((p) => {
    const price = discounted(p.price, p.discountPct)
    return (
      (!f.brands.length || f.brands.includes(p.brandId)) &&
      (!f.sizes.length || p.sizes.some((s) => f.sizes.includes(s))) &&
      (!f.colors.length || p.colors.some((c) => f.colors.includes(c.name))) &&
      (!f.minPrice || price >= +f.minPrice) &&
      (!f.maxPrice || price <= +f.maxPrice) &&
      (!f.rating || p.rating >= f.rating) &&
      (!f.express || p.expressAvailable) &&
      (!f.inStock || p.stock > 0) &&
      (!f.onSale || p.discountPct > 0)
    )
  })
  const by: Record<string, (a: T, b: T) => number> = {
    popular: (a, b) => b.reviewCount - a.reviewCount,
    newest: (a, b) => b.createdAt - a.createdAt,
    price_low: (a, b) => discounted(a.price, a.discountPct) - discounted(b.price, b.discountPct),
    price_high: (a, b) => discounted(b.price, b.discountPct) - discounted(a.price, a.discountPct),
    rating: (a, b) => b.rating - a.rating,
    discount: (a, b) => b.discountPct - a.discountPct,
  }
  return out.sort(by[sort] ?? by.popular)
}

export function ShopFilterPanel({ f, setF, products, brands }: { f: ShopFilters; setF: (f: ShopFilters) => void; products: { brandId: string; sizes: string[]; colors: { name: string; hex: string }[] }[]; brands: { id: string; name: string }[] }) {
  const brandIds = [...new Set(products.map((p) => p.brandId))]
  const sizes = [...new Set(products.flatMap((p) => p.sizes))].sort((a, b) => (isNaN(+a) || isNaN(+b) ? ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One size'].indexOf(a) - ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One size'].indexOf(b) : +a - +b))
  const colors = [...new Map(products.flatMap((p) => p.colors).map((c) => [c.name, c])).values()]
  const tog = (k: 'brands' | 'sizes' | 'colors', v: string) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] })
  return (
    <>
      <FilterGroup title="Brand">
        {brandIds.map((b) => <button key={b} onClick={() => tog('brands', b)} className={cx('chip h-8', f.brands.includes(b) && 'chip-active')}>{brands.find((x) => x.id === b)?.name}</button>)}
      </FilterGroup>
      <FilterGroup title="Size">
        {sizes.map((s) => <button key={s} onClick={() => tog('sizes', s)} className={cx('chip h-8 min-w-11 justify-center', f.sizes.includes(s) && 'chip-active')}>{s}</button>)}
      </FilterGroup>
      <FilterGroup title="Colour">
        {colors.map((c) => (
          <button key={c.name} onClick={() => tog('colors', c.name)} title={c.name} className={cx('chip h-8 pl-1.5', f.colors.includes(c.name) && 'chip-active')}>
            <span className="size-5 rounded-full border border-black/10" style={{ background: c.hex }} /> {c.name}
          </button>
        ))}
      </FilterGroup>
      <FilterGroup title="Price (৳)">
        <div className="flex w-full items-center gap-2">
          <input className="input h-10" inputMode="numeric" placeholder="Min" value={f.minPrice} onChange={(e) => setF({ ...f, minPrice: e.target.value.replace(/\D/g, '') })} />
          <span className="text-ink-400">–</span>
          <input className="input h-10" inputMode="numeric" placeholder="Max" value={f.maxPrice} onChange={(e) => setF({ ...f, maxPrice: e.target.value.replace(/\D/g, '') })} />
        </div>
        {[['Under ৳1,000', '', '1000'], ['৳1k–3k', '1000', '3000'], ['৳3k+', '3000', '']].map(([l, a, b]) => (
          <button key={l} className={cx('chip h-8', f.minPrice === a && f.maxPrice === b && 'chip-active')} onClick={() => setF({ ...f, minPrice: a, maxPrice: b })}>{l}</button>
        ))}
      </FilterGroup>
      <FilterGroup title="Rating">
        {[0, 4, 4.5].map((r) => <button key={r} className={cx('chip h-8', f.rating === r && 'chip-active')} onClick={() => setF({ ...f, rating: r })}>{r ? `${r}+ ★` : 'Any'}</button>)}
      </FilterGroup>
      <FilterGroup title="Delivery & availability">
        <button className={cx('chip h-8', f.express && 'chip-active')} onClick={() => setF({ ...f, express: !f.express })}>Same-day express</button>
        <button className={cx('chip h-8', f.inStock && 'chip-active')} onClick={() => setF({ ...f, inStock: !f.inStock })}>In stock</button>
        <button className={cx('chip h-8', f.onSale && 'chip-active')} onClick={() => setF({ ...f, onSale: !f.onSale })}>On sale</button>
      </FilterGroup>
    </>
  )
}
