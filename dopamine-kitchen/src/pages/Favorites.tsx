import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFavorites, useStore } from '../store/store'
import { useTitle } from '../lib/hooks'
import { BrandChip, FavButton, ProductCard, RestaurantCard } from '../components/cards'
import { EmptyState, Img, Price, Tabs } from '../components/ui'

export default function Favorites() {
  useTitle('Favourites')
  const fav = useFavorites()
  const db = useStore((s) => s.db)
  const [tab, setTab] = useState<'restaurants' | 'foods' | 'products' | 'brands'>('restaurants')
  const restaurants = db.restaurants.filter((r) => fav.restaurants.includes(r.id))
  const foods = db.menu.filter((m) => fav.foods.includes(m.id))
  const products = db.products.filter((p) => fav.products.includes(p.id))
  const brands = db.brands.filter((b) => fav.brands.includes(b.id))
  const empty = (what: string, to: string, cta: string) => <EmptyState emoji="💜" title={`No favourite ${what} yet`} body="Tap the heart on anything you love to save it here." action={<Link to={to} className="btn btn-primary">{cta}</Link>} />
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-fade-in">
      <h1 className="font-display text-3xl font-extrabold">Favourites</h1>
      <Tabs className="mt-5 max-w-2xl" value={tab} onChange={setTab} items={[
        { id: 'restaurants', label: 'Restaurants', count: restaurants.length }, { id: 'foods', label: 'Food', count: foods.length },
        { id: 'products', label: 'Products', count: products.length }, { id: 'brands', label: 'Stores', count: brands.length },
      ]} />
      <div className="mt-5">
        {tab === 'restaurants' && (restaurants.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{restaurants.map((r) => <RestaurantCard key={r.id} r={r} />)}</div> : empty('restaurants', '/food', 'Explore restaurants'))}
        {tab === 'foods' && (foods.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {foods.map((m) => (
              <Link key={m.id} to={`/restaurant/${m.restaurantId}?item=${m.id}`} className="card card-hover relative flex gap-3 p-3">
                <Img src={m.image} alt={m.name} art={m.category} className="size-20 rounded-xl shrink-0" />
                <div className="min-w-0 pr-8">
                  <p className="font-semibold line-clamp-1">{m.name}</p>
                  <p className="text-xs text-ink-500">{db.restaurants.find((r) => r.id === m.restaurantId)?.name}</p>
                  <Price value={m.price} size="sm" className="mt-1" />
                </div>
                <FavButton type="foods" id={m.id} size="sm" className="absolute right-3 top-3" />
              </Link>
            ))}
          </div>
        ) : <EmptyState emoji="💜" title="No favourite dishes yet" body="Open any dish and tap the heart to save it." action={<Link to="/food" className="btn btn-primary">Find dishes</Link>} />)}
        {tab === 'products' && (products.length ? <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">{products.map((p) => <ProductCard key={p.id} p={p} brand={db.brands.find((b) => b.id === p.brandId)} />)}</div> : empty('products', '/shop', 'Start shopping'))}
        {tab === 'brands' && (brands.length ? <div className="flex flex-wrap gap-3">{brands.map((b) => <div key={b.id} className="relative"><BrandChip b={b} /><FavButton type="brands" id={b.id} size="sm" className="absolute -right-2 -top-2" /></div>)}</div> : empty('stores', '/shop', 'Discover stores'))}
      </div>
    </div>
  )
}
