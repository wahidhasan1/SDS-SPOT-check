import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowUpDown, MapPin, Users } from 'lucide-react'
import { useStore } from '../store/store'
import { areaById } from '../data/areas'
import { SHOP_CATEGORIES } from '../data/products'
import { cx } from '../lib/format'
import { useTitle } from '../lib/hooks'
import { FavButton, ProductCard } from '../components/cards'
import { Badge, EmptyState, GridSkeleton, Img, Rating, StoreLogo } from '../components/ui'
import { applyShopFilters, EMPTY_SHOP } from './Shop'

export default function StorePage() {
  const { id = '' } = useParams()
  const b = useStore((s) => s.db.brands.find((x) => x.id === id))
  const products = useStore((s) => s.db.products)
  const [cat, setCat] = useState('')
  const [sort, setSort] = useState('popular')
  const loading = false
  useTitle(b?.name ?? 'Store')
  const mine = useMemo(() => products.filter((p) => p.brandId === id), [products, id])
  const list = useMemo(() => applyShopFilters(mine.filter((p) => !cat || p.category === cat), EMPTY_SHOP, sort), [mine, cat, sort])
  if (!b) return <div className="mx-auto max-w-3xl px-4"><EmptyState emoji="🏬" title="Store not found" action={<Link to="/shop" className="btn btn-primary">Back to shop</Link>} /></div>
  const cats = [...new Set(mine.map((p) => p.category))]
  return (
    <div className="animate-fade-in">
      <div className="relative">
        <Img src={b.cover} alt={b.name} art={b.categories[0]} className="h-44 sm:h-64" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>
      <div className="mx-auto max-w-7xl px-4">
        <div className="relative -mt-12 card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <StoreLogo initials={b.initials} bg={b.logoBg} size={76} className="-mt-14 sm:mt-0" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold">{b.name}</h1>
              <Badge tone="warning">Fictional brand</Badge>
            </div>
            <p className="text-sm text-ink-500">{b.tagline}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-500">
              <Rating value={b.rating} size="md" />
              <span className="inline-flex items-center gap-1"><Users className="size-4" /> {(b.followers / 1000).toFixed(1)}k followers</span>
              <span className="inline-flex items-center gap-1"><MapPin className="size-4" /> {areaById(b.areaId).name}, Dhaka</span>
            </div>
          </div>
          <FavButton type="brands" id={b.id} />
        </div>
        <p className="mt-4 max-w-3xl text-sm text-ink-700">{b.about}</p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button className={cx('chip', !cat && 'chip-active')} onClick={() => setCat('')}>All ({mine.length})</button>
          {cats.map((c) => <button key={c} className={cx('chip', cat === c && 'chip-active')} onClick={() => setCat(c)}>{SHOP_CATEGORIES.find((x) => x.id === c)?.label}</button>)}
          <label className="ml-auto inline-flex items-center gap-2 text-sm">
            <ArrowUpDown className="size-4 text-ink-400" />
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="input h-9 w-auto py-0 text-sm">
              <option value="popular">Most popular</option>
              <option value="newest">Newest</option>
              <option value="price_low">Price: low to high</option>
              <option value="price_high">Price: high to low</option>
              <option value="discount">Biggest discount</option>
            </select>
          </label>
        </div>
        <div className="mt-4">
          {loading ? <GridSkeleton count={8} tall className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4" /> : list.length === 0 ? (
            <EmptyState emoji="📦" title="No products yet" body="This demo store hasn't listed anything in this category." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">{list.map((p) => <ProductCard key={p.id} p={p} brand={b} />)}</div>
          )}
        </div>
      </div>
    </div>
  )
}
