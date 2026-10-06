import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Clock, Star, Tag, TrendingUp, Trash2, DoorOpen } from 'lucide-react'
import { useStore } from '../store/store'
import { FOOD_CATEGORIES } from '../data/restaurants'
import { SHOP_CATEGORIES } from '../data/products'
import { POPULAR_SEARCHES, searchAll } from '../lib/search'
import { cx, discounted } from '../lib/format'
import { useSimLoad, useTitle } from '../lib/hooks'
import { SearchBox } from '../components/SearchBox'
import { BrandChip, ProductCard, RestaurantCard } from '../components/cards'
import { EmptyState, GridSkeleton, Img, Price, Tabs } from '../components/ui'

type Tab = 'all' | 'restaurant' | 'dish' | 'product' | 'brand'

export default function SearchPage() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const q = params.get('q') ?? ''
  const db = useStore((s) => s.db)
  const recent = useStore((s) => s.recentSearches)
  const clearRecent = useStore((s) => s.clearRecentSearches)
  const [tab, setTab] = useState<Tab>('all')
  const [sort, setSort] = useState<'relevance' | 'rating' | 'price_low' | 'price_high'>('relevance')
  const [topRated, setTopRated] = useState(false)
  const [openOnly, setOpenOnly] = useState(false)
  const [onSale, setOnSale] = useState(false)
  const loading = useSimLoad([q], 400)
  useTitle(q ? `“${q}”` : 'Search')

  const hits = useMemo(() => searchAll(q, db), [q, db])
  const filtered = useMemo(() => {
    let h = hits.filter((x) => x.type !== 'category')
    if (topRated) h = h.filter((x) => (x.type === 'restaurant' || x.type === 'product' || x.type === 'brand' ? x.item.rating >= 4.5 : x.type === 'dish' ? db.restaurants.find((r) => r.id === x.item.restaurantId)!.rating >= 4.5 : true))
    if (openOnly) h = h.filter((x) => (x.type === 'restaurant' ? x.item.isOpen : x.type === 'dish' ? db.restaurants.find((r) => r.id === x.item.restaurantId)?.isOpen : true))
    if (onSale) h = h.filter((x) => (x.type === 'product' ? x.item.discountPct > 0 : x.type === 'dish' ? !!x.item.originalPrice : x.type === 'restaurant' ? !!x.item.offer : true))
    const price = (x: (typeof h)[number]) => (x.type === 'dish' ? x.item.price : x.type === 'product' ? discounted(x.item.price, x.item.discountPct) : 0)
    const rating = (x: (typeof h)[number]) => (x.type === 'dish' ? 0 : x.item.rating)
    if (sort === 'rating') h = [...h].sort((a, b) => rating(b) - rating(a))
    if (sort === 'price_low') h = [...h].sort((a, b) => price(a) - price(b))
    if (sort === 'price_high') h = [...h].sort((a, b) => price(b) - price(a))
    return h
  }, [hits, topRated, openOnly, onSale, sort, db.restaurants])
  const cats = hits.filter((h) => h.type === 'category')
  const count = (t: Tab) => (t === 'all' ? filtered.length : filtered.filter((h) => h.type === t).length)
  const show = (t: Exclude<Tab, 'all'>) => tab === 'all' || tab === t
  const restaurants = filtered.flatMap((h) => (h.type === 'restaurant' ? [h.item] : []))
  const dishes = filtered.flatMap((h) => (h.type === 'dish' ? [h.item] : []))
  const products = filtered.flatMap((h) => (h.type === 'product' ? [h.item] : []))
  const brands = filtered.flatMap((h) => (h.type === 'brand' ? [h.item] : []))

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 animate-fade-in">
      <div className="flex items-center gap-2">
        <button onClick={() => nav(-1)} className="icon-btn shrink-0" aria-label="Back"><ArrowLeft className="size-5" /></button>
        <SearchBox key={q} initial={q} autoFocus={!q} className="flex-1" />
      </div>

      {!q ? (
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div>
            {recent.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-lg font-bold">Recent searches</h2>
                  <button onClick={clearRecent} className="btn btn-ghost btn-sm"><Trash2 className="size-4" /> Clear</button>
                </div>
                <div className="flex flex-wrap gap-2">{recent.map((r) => <Link key={r} to={`/search?q=${encodeURIComponent(r)}`} className="chip"><Clock className="size-3.5 text-ink-400" /> {r}</Link>)}</div>
              </div>
            )}
            <h2 className="font-display text-lg font-bold mb-3">Popular searches</h2>
            <div className="flex flex-wrap gap-2">{POPULAR_SEARCHES.map((p) => <Link key={p} to={`/search?q=${encodeURIComponent(p)}`} className="chip"><TrendingUp className="size-3.5 text-coral-500" /> {p}</Link>)}</div>
          </div>
          <div>
            <h2 className="font-display text-lg font-bold mb-3">Browse categories</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {FOOD_CATEGORIES.slice(0, 8).map((c) => <Link key={c.id} to={`/food?cat=${c.id}`} className="card card-hover p-3 text-center"><div className="text-2xl">{c.emoji}</div><p className="mt-1 text-xs font-semibold">{c.label}</p></Link>)}
              {SHOP_CATEGORIES.slice(0, 4).map((c) => <Link key={c.id} to={`/shop?cat=${c.id}`} className="card card-hover p-3 text-center"><div className="text-2xl">🛍️</div><p className="mt-1 text-xs font-semibold">{c.label}</p></Link>)}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-2xl font-bold">Results for “{q}”</h1>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="input h-9 w-auto text-sm py-0">
              <option value="relevance">Sort: Relevance</option>
              <option value="rating">Sort: Rating</option>
              <option value="price_low">Sort: Price low → high</option>
              <option value="price_high">Sort: Price high → low</option>
            </select>
          </div>
          {cats.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {cats.map((c) => c.type === 'category' && <Link key={c.item.id + c.item.vertical} to={c.item.vertical === 'food' ? `/food?cat=${c.item.id}` : `/shop?cat=${c.item.id}`} className="chip border-brand-200 bg-brand-50 text-brand-800">Browse {c.item.label} →</Link>)}
            </div>
          )}
          <Tabs className="mt-4" value={tab} onChange={setTab} items={[
            { id: 'all', label: 'All', count: count('all') }, { id: 'restaurant', label: 'Restaurants', count: count('restaurant') },
            { id: 'dish', label: 'Dishes', count: count('dish') }, { id: 'product', label: 'Products', count: count('product') }, { id: 'brand', label: 'Brands', count: count('brand') },
          ]} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={cx('chip h-8', topRated && 'chip-active')} onClick={() => setTopRated(!topRated)}><Star className="size-3.5" /> Rating 4.5+</button>
            <button className={cx('chip h-8', openOnly && 'chip-active')} onClick={() => setOpenOnly(!openOnly)}><DoorOpen className="size-3.5" /> Open now</button>
            <button className={cx('chip h-8', onSale && 'chip-active')} onClick={() => setOnSale(!onSale)}><Tag className="size-3.5" /> Deals</button>
          </div>

          {loading ? <GridSkeleton count={6} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" /> : count(tab) === 0 ? (
            <EmptyState emoji="🤷" title={`No results for “${q}”`} body={hits.length ? 'Try removing a filter.' : 'Check the spelling or try something more general — like “burger”, “kacchi” or “sneakers”.'}
              action={<>{POPULAR_SEARCHES.slice(0, 4).map((p) => <Link key={p} to={`/search?q=${encodeURIComponent(p)}`} className="chip">{p}</Link>)}</>} />
          ) : (
            <div className="mt-5 space-y-10">
              {show('restaurant') && restaurants.length > 0 && (
                <section>
                  {tab === 'all' && <h2 className="font-display text-lg font-bold mb-3">Restaurants</h2>}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{restaurants.slice(0, tab === 'all' ? 3 : 99).map((r) => <RestaurantCard key={r.id} r={r} />)}</div>
                  {tab === 'all' && restaurants.length > 3 && <button onClick={() => setTab('restaurant')} className="btn btn-ghost btn-sm mt-2 text-brand-700">See all {restaurants.length} restaurants</button>}
                </section>
              )}
              {show('dish') && dishes.length > 0 && (
                <section>
                  {tab === 'all' && <h2 className="font-display text-lg font-bold mb-3">Dishes</h2>}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {dishes.slice(0, tab === 'all' ? 6 : 99).map((m) => {
                      const r = db.restaurants.find((x) => x.id === m.restaurantId)
                      return (
                        <Link key={m.id} to={`/restaurant/${m.restaurantId}?item=${m.id}`} className="card card-hover flex gap-3 p-3">
                          <Img src={m.image} alt={m.name} art={m.category} className="size-20 rounded-xl shrink-0" />
                          <div className="min-w-0">
                            <p className="font-semibold leading-snug line-clamp-1">{m.name}</p>
                            <p className="text-xs text-ink-500 line-clamp-1">{r?.name}{r && !r.isOpen && ' · Closed'}</p>
                            <p className="text-xs text-ink-500 line-clamp-1 mt-0.5">{m.description}</p>
                            <Price value={m.price} original={m.originalPrice} size="sm" className="mt-1" />
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                  {tab === 'all' && dishes.length > 6 && <button onClick={() => setTab('dish')} className="btn btn-ghost btn-sm mt-2 text-brand-700">See all {dishes.length} dishes</button>}
                </section>
              )}
              {show('brand') && brands.length > 0 && (
                <section>
                  {tab === 'all' && <h2 className="font-display text-lg font-bold mb-3">Brands</h2>}
                  <div className="flex flex-wrap gap-3">{brands.map((b) => <BrandChip key={b.id} b={b} />)}</div>
                </section>
              )}
              {show('product') && products.length > 0 && (
                <section>
                  {tab === 'all' && <h2 className="font-display text-lg font-bold mb-3">Products</h2>}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">{products.slice(0, tab === 'all' ? 10 : 99).map((p) => <ProductCard key={p.id} p={p} brand={db.brands.find((b) => b.id === p.brandId)} />)}</div>
                  {tab === 'all' && products.length > 10 && <button onClick={() => setTab('product')} className="btn btn-ghost btn-sm mt-2 text-brand-700">See all {products.length} products</button>}
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
