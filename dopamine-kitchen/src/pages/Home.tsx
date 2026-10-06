import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Brain, ChevronRight, Footprints, HeartHandshake, PiggyBank, Shirt, ShoppingBag, Sparkles, TicketPercent, UtensilsCrossed, X } from 'lucide-react'
import { useCurrentArea, useMe, useStore } from '../store/store'
import { FOOD_CATEGORIES } from '../data/restaurants'
import { SHOP_CATEGORIES } from '../data/products'
import { IMG, pick } from '../data/images'
import { distanceKm } from '../data/areas'
import { useTitle } from '../lib/hooks'
import { taka } from '../lib/format'
import { useT } from '../i18n'
import { SearchBox } from '../components/SearchBox'
import { BrandChip, DishCard, ProductCard, RestaurantCard, VoucherCard } from '../components/cards'
import { CardSkeleton, HScroll, Img, SectionHeader, Skeleton } from '../components/ui'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Late-night cravings'
}

export default function Home() {
  useTitle('')
  const t = useT()
  const me = useMe()
  const loading = false
  const { areaId } = useCurrentArea()
  const db = useStore((s) => s.db)
  const recently = useStore((s) => s.recentlyViewed)
  const clearRecent = useStore((s) => s.clearRecentlyViewed)
  const myOrders = db.orders.filter((o) => o.userId === me?.id)
  const notSpent = myOrders.filter((o) => o.status === 'delivered').reduce((a, o) => a + o.total, 0)

  const nearby = useMemo(
    () => {
      const score = (r: (typeof db.restaurants)[number]) => distanceKm(r.areaId, areaId) - r.rating * 3
      return [...db.restaurants].sort((a, b) => (a.isOpen === b.isOpen ? score(a) - score(b) : a.isOpen ? -1 : 1)).slice(0, 8)
    },
    [db.restaurants, areaId],
  )
  const trending = useMemo(() => db.menu.filter((m) => m.popular && db.restaurants.some((r) => r.id === m.restaurantId && r.isOpen)).filter((_, i) => i % 2 === 0).slice(0, 12), [db.menu, db.restaurants])
  const recommended = useMemo(() => [...db.products].filter((p) => p.stock > 0).sort((a, b) => b.rating * 100 + b.discountPct - (a.rating * 100 + a.discountPct)).slice(0, 10), [db.products])
  const vouchers = db.vouchers.filter((v) => v.active && v.expiresAt > Date.now()).slice(0, 6)
  const brand = (id: string) => db.brands.find((b) => b.id === id)

  const recentItems = recently
    .map((r) => {
      if (r.kind === 'product') {
        const p = db.products.find((x) => x.id === r.id)
        return p && { key: `p${p.id}`, to: `/product/${p.id}`, img: p.images[0], name: p.name, sub: brand(p.brandId)?.name ?? '', art: p.category }
      }
      const x = db.restaurants.find((y) => y.id === r.id)
      return x && { key: `r${x.id}`, to: `/restaurant/${x.id}`, img: x.cover, name: x.name, sub: x.cuisines.join(', '), art: x.categories[0] }
    })
    .filter(Boolean) as { key: string; to: string; img: string; name: string; sub: string; art: string }[]

  const verticals = [
    { to: '/food', label: 'Food', sub: `${db.restaurants.length} restaurants`, icon: UtensilsCrossed, img: IMG.biriyani[0], art: 'kacchi', cls: 'from-coral-500/90' },
    { to: '/shop?cat=men', label: 'Fashion', sub: "Men's & women's", icon: Shirt, img: IMG.womenswear[0], art: 'women', cls: 'from-brand-700/90', pos: 'object-[50%_18%]' },
    { to: '/shop?cat=shoes', label: 'Shoes', sub: 'Sneakers, formal, heels', icon: Footprints, img: IMG.shoes[0], art: 'shoes', cls: 'from-sky-700/90' },
    { to: '/shop', label: 'Shopping', sub: 'Bags, gadgets, lifestyle', icon: ShoppingBag, img: IMG.bags[0], art: 'bags', cls: 'from-emerald-700/90' },
    { to: '/offers', label: 'Offers', sub: `${vouchers.length} live vouchers`, icon: TicketPercent, img: IMG.desserts[0], art: 'default', cls: 'from-amber-600/90' },
  ]

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-gradient text-white">
        <div className="absolute -right-20 -top-24 size-80 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-32 left-1/3 size-96 rounded-full bg-coral-400/30 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 pt-7 pb-24 sm:pt-12 sm:pb-28">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
            <Sparkles className="size-3.5" /> {greeting()}{me ? `, ${me.name.split(' ')[0]}` : ''} 👋
          </p>
          <h1 className="mt-3 max-w-2xl text-[2rem] leading-[1.05] sm:text-5xl font-extrabold">{t('home.craving')}</h1>
          <p className="mt-3 max-w-xl text-white/85 text-[15px]">{t('brand.tagline')} Browse, order and track the full experience — no money spent, nothing delivered.</p>
          <div className="mt-6 max-w-xl text-ink-900">
            <SearchBox />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4">
        {/* Vertical tiles */}
        <section className="-mt-16 relative grid grid-cols-2 sm:grid-cols-5 gap-3">
          {verticals.map((v, i) => (
            <Link key={v.label} to={v.to} className={`group relative overflow-hidden rounded-2xl shadow-lift h-32 sm:h-40 ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`}>
              <Img src={v.img} alt={v.label} art={v.art} className="absolute inset-0 size-full" imgClassName={`group-hover:scale-105 transition-transform duration-500 ${'pos' in v ? v.pos : ''}`} />
              <div className={`absolute inset-0 bg-gradient-to-t ${v.cls} via-black/10 to-transparent`} />
              <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
                <v.icon className="size-5 mb-1" />
                <p className="font-display text-lg font-bold leading-none">{v.label}</p>
                <p className="text-[12px] text-white/85 mt-1">{v.sub}</p>
              </div>
            </Link>
          ))}
        </section>

        {/* Craving categories */}
        <section className="mt-10">
          <SectionHeader title={t('home.craving')} subtitle="Pick a craving — we'll show you where to (not) get it." action={<Link to="/food" className="btn btn-ghost btn-sm text-brand-700">{t('common.seeAll')} <ChevronRight className="size-4" /></Link>} />
          <HScroll itemClass="gap-3 sm:gap-5">
            {FOOD_CATEGORIES.slice(0, 12).map((c) => (
              <Link key={c.id} to={`/food?cat=${c.id}`} className="group flex w-[76px] sm:w-24 shrink-0 snap-start flex-col items-center gap-2">
                <Img src={pick(c.pool, c.idx)} alt={c.label} art={c.id} className="size-[76px] sm:size-24 rounded-full ring-4 ring-white shadow-card" imgClassName="group-hover:scale-110 transition-transform duration-500" />
                <span className="text-[13px] font-semibold text-center">{c.label}</span>
              </Link>
            ))}
          </HScroll>
        </section>

        {/* Offers */}
        <section className="mt-10">
          <SectionHeader title={t('home.offers')} subtitle="Demo vouchers — apply them at checkout." action={<Link to="/offers" className="btn btn-ghost btn-sm text-brand-700">{t('common.seeAll')} <ChevronRight className="size-4" /></Link>} />
          <HScroll>{vouchers.map((v) => <VoucherCard key={v.code} v={v} compact />)}</HScroll>
        </section>

        {/* Popular nearby */}
        <section className="mt-10">
          <SectionHeader title={t('home.popularNearby')} subtitle="Sorted by distance and rating from your location." action={<Link to="/food" className="btn btn-ghost btn-sm text-brand-700">{t('common.seeAll')} <ChevronRight className="size-4" /></Link>} />
          <HScroll>
            {loading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="w-[78vw] max-w-[300px] shrink-0"><CardSkeleton /></div>) : nearby.map((r) => <RestaurantCard key={r.id} r={r} compact />)}
          </HScroll>
        </section>

        {/* Trending dishes */}
        <section className="mt-10">
          <SectionHeader title="Trending dishes in Dhaka" subtitle="What everyone is (pretend) ordering tonight." />
          <HScroll>
            {loading ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="w-[44vw] max-w-[200px] aspect-[3/4] shrink-0" />) : trending.map((m) => <DishCard key={m.id} m={m} restaurant={db.restaurants.find((r) => r.id === m.restaurantId)} />)}
          </HScroll>
        </section>

        {/* Shop categories */}
        <section className="mt-10">
          <SectionHeader title={t('home.shopCategories')} subtitle="Fashion, shoes & lifestyle from fictional local labels." action={<Link to="/shop" className="btn btn-ghost btn-sm text-brand-700">{t('common.seeAll')} <ChevronRight className="size-4" /></Link>} />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {SHOP_CATEGORIES.map((c) => (
              <Link key={c.id} to={`/shop?cat=${c.id}`} className="group relative overflow-hidden rounded-2xl h-28 sm:h-36 shadow-card">
                <Img src={c.image} alt={c.label} art={c.id} className="absolute inset-0 size-full" imgClassName="group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <span className="absolute bottom-2.5 left-3 right-3 font-bold text-white text-sm leading-tight">{c.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Recommended products */}
        <section className="mt-10">
          <SectionHeader title={t('home.recommended')} subtitle="Top-rated picks with the best (simulated) deals." action={<Link to="/shop" className="btn btn-ghost btn-sm text-brand-700">{t('common.seeAll')} <ChevronRight className="size-4" /></Link>} />
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">{Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} tall />)}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">{recommended.map((p) => <ProductCard key={p.id} p={p} brand={brand(p.brandId)} />)}</div>
          )}
        </section>

        {/* Brands */}
        <section className="mt-10">
          <SectionHeader title="Popular stores" subtitle="All brands are fictional demo labels." />
          <HScroll>{db.brands.map((b) => <BrandChip key={b.id} b={b} />)}</HScroll>
        </section>

        {/* Recently viewed */}
        {recentItems.length > 0 && (
          <section className="mt-10">
            <SectionHeader title={t('home.recent')} action={<button onClick={clearRecent} className="btn btn-ghost btn-sm"><X className="size-4" /> Clear</button>} />
            <HScroll>
              {recentItems.map((r) => (
                <Link key={r.key} to={r.to} className="card card-hover flex items-center gap-3 p-2.5 pr-4 w-[70vw] max-w-[260px] shrink-0 snap-start">
                  <Img src={r.img} alt={r.name} art={r.art} className="size-14 rounded-xl shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold line-clamp-1">{r.name}</p>
                    <p className="text-xs text-ink-500 line-clamp-1">{r.sub}</p>
                  </div>
                </Link>
              ))}
            </HScroll>
          </section>
        )}

        {/* How it works */}
        <section className="mt-12 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="card p-6 sm:p-8 bg-gradient-to-br from-white to-brand-50">
            <p className="badge bg-brand-100 text-brand-700"><Brain className="size-3" /> How Dopamine Kitchen works</p>
            <h2 className="mt-3 font-display text-2xl sm:text-3xl font-extrabold">Ride the craving all the way to “Delivered”.</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                ['1', 'Browse & choose', 'Scroll real-looking menus and products, just like you would on any delivery app.'],
                ['2', 'Order & pay (demo)', 'Use test bKash, Nagad or card details. Nothing is charged — ever.'],
                ['3', 'Track & release', 'Follow your rider on the map until the simulation completes. Craving: handled.'],
              ].map(([n, title, body]) => (
                <div key={n}>
                  <span className="grid size-8 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{n}</span>
                  <p className="mt-2 font-bold">{title}</p>
                  <p className="text-sm text-ink-500">{body}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-6 sm:p-8 bg-ink-900 text-white border-ink-900">
            <PiggyBank className="size-8 text-coral-300" />
            <p className="mt-3 text-white/70 text-sm">Money not spent{me ? ' on your simulated orders' : ''}</p>
            <p className="font-display text-4xl font-extrabold">{taka(notSpent)}</p>
            <p className="mt-2 text-sm text-white/70">{myOrders.filter((o) => o.status === 'delivered').length} cravings ridden out · 0 real deliveries</p>
            <Link to={me ? '/orders' : '/login'} className="btn mt-5 bg-white text-ink-900 hover:bg-ink-100">
              {me ? 'View my simulated orders' : 'Log in to track savings'} <ArrowRight className="size-4" />
            </Link>
            <p className="mt-4 flex items-start gap-2 text-xs text-white/60"><HeartHandshake className="size-4 shrink-0" /> If cravings feel overwhelming, consider talking to someone you trust or a health professional.</p>
          </div>
        </section>
      </div>
    </div>
  )
}
