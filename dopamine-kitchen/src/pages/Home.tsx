import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronRight, Gift, Info, Shirt, UtensilsCrossed, X } from 'lucide-react'
import { useCurrentArea, useMe, useStore } from '../store/store'
import { useUI } from '../store/ui'
import { FOOD_CATEGORIES } from '../data/restaurants'
import { SHOP_CATEGORIES } from '../data/products'
import { IMG, pick } from '../data/images'
import { distanceKm } from '../data/areas'
import { visibleTo } from '../lib/pricing'
import { useTitle } from '../lib/hooks'
import { useT } from '../i18n'
import { SearchBox } from '../components/SearchBox'
import { DishCard, ProductCard, RestaurantCard, VoucherCard } from '../components/cards'
import { HScroll, Img, SectionHeader, Tabs } from '../components/ui'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const SeeAll = ({ to, label = 'See all' }: { to: string; label?: string }) => (
  <Link to={to} className="inline-flex shrink-0 items-center gap-0.5 text-sm font-bold text-brand-700 hover:underline">{label} <ChevronRight className="size-4" /></Link>
)

export default function Home() {
  useTitle('')
  const t = useT()
  const me = useMe()
  const { areaId } = useCurrentArea()
  const setHow = useUI((s) => s.setHowOpen)
  const db = useStore((s) => s.db)
  const recently = useStore((s) => s.recentlyViewed)
  const clearRecent = useStore((s) => s.clearRecentlyViewed)
  const [catTab, setCatTab] = useState<'food' | 'shop'>('food')
  const hasSpun = !!me && db.rewardEvents.some((e) => e.userId === me.id && e.kind === 'welcome_spin')

  const nearby = useMemo(() => {
    const score = (r: (typeof db.restaurants)[number]) => distanceKm(r.areaId, areaId) - r.rating * 3
    return [...db.restaurants].sort((a, b) => (a.isOpen === b.isOpen ? score(a) - score(b) : a.isOpen ? -1 : 1)).slice(0, 8)
  }, [db.restaurants, areaId])
  const popularDishes = useMemo(() => db.menu.filter((m) => m.popular && db.restaurants.some((r) => r.id === m.restaurantId && r.isOpen)).filter((_, i) => i % 2 === 0).slice(0, 10), [db.menu, db.restaurants])
  const recommended = useMemo(() => [...db.products].filter((p) => p.stock > 0).sort((a, b) => b.rating * 100 + b.discountPct - (a.rating * 100 + a.discountPct)).slice(0, 8), [db.products])
  const deals = db.vouchers.filter((v) => visibleTo(v, me?.id) && v.active && !v.usedAt && v.expiresAt > Date.now()).sort((a, b) => Number(!!b.ownerId) - Number(!!a.ownerId)).slice(0, 6)
  const brand = (id: string) => db.brands.find((b) => b.id === id)

  const recentItems = recently
    .map((r) => {
      if (r.kind === 'product') {
        const p = db.products.find((x) => x.id === r.id)
        return p && { key: `p${p.id}`, to: `/product/${p.id}`, img: p.images[0], name: p.name, sub: brand(p.brandId)?.name ?? '', art: p.category }
      }
      const x = db.restaurants.find((y) => y.id === r.id)
      return x && { key: `r${x.id}`, to: `/restaurant/${x.id}`, img: x.cover, name: x.name, sub: x.cuisines.slice(0, 2).join(' · '), art: x.categories[0] }
    })
    .filter(Boolean) as { key: string; to: string; img: string; name: string; sub: string; art: string }[]

  return (
    <div className="animate-fade-in">
      {/* 1. Greeting, search, value proposition */}
      <section className="mx-auto max-w-7xl px-4 pt-5 sm:pt-8">
        <p className="text-sm font-bold text-ink-500">{greeting()}{me ? `, ${me.name.split(' ')[0]}` : ''}</p>
        <h1 className="mt-1 text-[1.75rem] leading-tight sm:text-4xl font-extrabold tracking-tight">{t('home.craving')}</h1>
        <SearchBox className="mt-4 max-w-2xl md:hidden" />
        <p className="mt-3 text-sm text-ink-500">
          <b className="text-ink-900">{t('brand.tagline')}</b> Order and track food and fashion — it’s all a simulation.{' '}
          <button onClick={() => setHow(true)} className="inline-flex items-center gap-1 font-bold text-brand-700 hover:underline"><Info className="size-4" /> How it works</button>
        </p>
      </section>

      <div className="mx-auto max-w-7xl px-4">
        {/* 2. First-time reward, only when relevant */}
        {!me ? (
          <Link to="/login?mode=signup" className="mt-5 flex items-center gap-4 rounded-2xl bg-brand-surface p-4 text-white transition hover:brightness-105">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sun-400 text-ink-900"><Gift className="size-6" /></span>
            <span className="flex-1 min-w-0"><span className="block font-extrabold">New here? Sign up and spin</span><span className="block text-sm text-white/80">Win a welcome voucher: up to 30% off or free delivery.</span></span>
            <ArrowRight className="size-5 shrink-0" />
          </Link>
        ) : !hasSpun ? (
          <Link to="/welcome" className="mt-5 flex items-center gap-4 rounded-2xl border border-sun-300 bg-sun-50 p-4 transition hover:bg-sun-100">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sun-400 text-ink-900"><Gift className="size-6" /></span>
            <span className="flex-1 min-w-0"><span className="block font-extrabold">Your welcome spin is waiting</span><span className="block text-sm text-ink-500">One spin, one real voucher. Takes 5 seconds.</span></span>
            <ArrowRight className="size-5 shrink-0 text-ink-700" />
          </Link>
        ) : null}

        {/* 3. Two worlds */}
        <section className="mt-5 grid grid-cols-2 gap-3" aria-label="Choose food or fashion">
          {[
            { to: '/food', title: 'Food', sub: `${db.restaurants.length} restaurants · ~30 min`, icon: UtensilsCrossed, img: IMG.biriyani[0], art: 'kacchi', pos: '' },
            { to: '/shop', title: 'Fashion & lifestyle', sub: `${db.products.length} items · next day`, icon: Shirt, img: IMG.womenswear[0], art: 'women', pos: 'object-[50%_18%]' },
          ].map((v) => (
            <Link key={v.to} to={v.to} className="group relative h-36 sm:h-48 overflow-hidden rounded-2xl shadow-card">
              <Img src={v.img} alt="" art={v.art} className="absolute inset-0 size-full" imgClassName={`group-hover:scale-105 transition-transform duration-500 ${v.pos}`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-5 text-white">
                <v.icon className="size-5 mb-1" />
                <p className="text-lg sm:text-2xl font-extrabold leading-tight">{v.title}</p>
                <p className="text-xs sm:text-sm text-white/85">{v.sub}</p>
              </div>
            </Link>
          ))}
        </section>

        {/* 4. Categories */}
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="section-title">{t('home.categories')}</h2>
            <Tabs value={catTab} onChange={setCatTab} items={[{ id: 'food', label: 'Food' }, { id: 'shop', label: 'Fashion' }]} className="w-44 shrink-0" />
          </div>
          {catTab === 'food' ? (
            <HScroll itemClass="gap-3 sm:gap-5">
              {FOOD_CATEGORIES.slice(0, 12).map((c) => (
                <Link key={c.id} to={`/food?cat=${c.id}`} className="group flex w-[72px] sm:w-24 shrink-0 snap-start flex-col items-center gap-2">
                  <Img src={pick(c.pool, c.idx)} alt="" art={c.id} className="size-[72px] sm:size-24 rounded-full" imgClassName="group-hover:scale-110 transition-transform duration-500" />
                  <span className="text-[13px] font-bold text-center">{c.label}</span>
                </Link>
              ))}
            </HScroll>
          ) : (
            <HScroll itemClass="gap-3">
              {SHOP_CATEGORIES.map((c) => (
                <Link key={c.id} to={`/shop?cat=${c.id}`} className="group relative h-32 w-28 sm:h-40 sm:w-36 shrink-0 snap-start overflow-hidden rounded-2xl bg-white shadow-card">
                  <Img src={c.image} alt="" art={c.id} className="absolute inset-0 size-full" imgClassName="group-hover:scale-105 transition-transform duration-500 object-[50%_20%]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <span className="absolute bottom-2.5 left-3 right-3 text-sm font-bold leading-tight text-white">{c.label}</span>
                </Link>
              ))}
            </HScroll>
          )}
        </section>

        {/* 5. Popular nearby */}
        <section className="mt-9">
          <SectionHeader title={t('home.popularNearby')} subtitle="Open now, sorted by rating and distance" action={<SeeAll to="/food" />} />
          <HScroll>{nearby.map((r) => <RestaurantCard key={r.id} r={r} compact />)}</HScroll>
        </section>

        {/* 6. Popular dishes */}
        <section className="mt-9">
          <SectionHeader title="Popular dishes" subtitle="What Dhaka is (pretend) ordering today" />
          <HScroll>{popularDishes.map((m) => <DishCard key={m.id} m={m} restaurant={db.restaurants.find((r) => r.id === m.restaurantId)} />)}</HScroll>
        </section>

        {/* 7. Recommended products */}
        <section className="mt-9">
          <SectionHeader title={t('home.recommended')} subtitle="Top-rated picks from local labels" action={<SeeAll to="/shop" />} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">{recommended.map((p) => <ProductCard key={p.id} p={p} brand={brand(p.brandId)} />)}</div>
        </section>

        {/* 8. Deals */}
        <section className="mt-9">
          <SectionHeader title={t('home.offers')} subtitle="Apply them at checkout" action={<SeeAll to={me ? '/account/vouchers' : '/offers'} />} />
          <HScroll>{deals.map((v) => <VoucherCard key={v.code} v={v} compact />)}</HScroll>
        </section>

        {/* 9. Jump back in */}
        {recentItems.length > 0 && (
          <section className="mt-9">
            <SectionHeader title={t('home.recent')} subtitle="Recently viewed" action={<button onClick={clearRecent} className="inline-flex items-center gap-1 text-sm font-bold text-ink-500 hover:text-ink-900"><X className="size-4" /> Clear</button>} />
            <HScroll>
              {recentItems.map((r) => (
                <Link key={r.key} to={r.to} className="card card-hover flex items-center gap-3 p-2.5 pr-4 w-[68vw] max-w-[260px] shrink-0 snap-start">
                  <Img src={r.img} alt="" art={r.art} className="size-14 rounded-xl shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold line-clamp-1">{r.name}</p>
                    <p className="text-xs text-ink-500 line-clamp-1">{r.sub}</p>
                  </div>
                </Link>
              ))}
            </HScroll>
          </section>
        )}
      </div>
    </div>
  )
}
