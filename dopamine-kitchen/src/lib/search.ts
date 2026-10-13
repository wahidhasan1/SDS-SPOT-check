import type { Brand, MenuItem, Product, Restaurant } from '../data/types'
import { FOOD_CATEGORIES } from '../data/restaurants'
import { SHOP_CATEGORIES } from '../data/products'

export type SearchHit =
  | { type: 'restaurant'; item: Restaurant; score: number }
  | { type: 'dish'; item: MenuItem; score: number }
  | { type: 'product'; item: Product; score: number }
  | { type: 'brand'; item: Brand; score: number }
  | { type: 'category'; item: { id: string; label: string; vertical: 'food' | 'shop'; emoji?: string }; score: number }

const SYNONYMS: Record<string, string[]> = {
  biryani: ['biriyani'], biriani: ['biriyani'], kachchi: ['kacchi'], kacchi: ['kacchi', 'biriyani'], fuchka: ['fuchka', 'panipuri'],
  tea: ['cha', 'tea'], cha: ['cha', 'tea'], shoe: ['shoes', 'sneaker'], shoes: ['shoes', 'sneaker'], sneakers: ['sneaker'],
  tshirt: ['tee'], 't-shirt': ['tee'], tee: ['tee'], dress: ['dress', 'kurti', 'saree'], bag: ['bag', 'tote', 'backpack'],
  sweet: ['dessert', 'mishti', 'sweet'], sweets: ['dessert', 'mishti'], chicken: ['chicken'], burgers: ['burger'], pizzas: ['pizza'],
}

function score(hay: string, q: string): number {
  const h = hay.toLowerCase()
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return 0
  let s = 0
  for (const t of terms) {
    const variants = [t, ...(SYNONYMS[t] ?? [])]
    const best = Math.max(
      ...variants.map((v) => {
        if (h.startsWith(v)) return 6
        if (new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(h)) return 4
        if (h.includes(v)) return 2
        return 0
      }),
    )
    if (!best) return 0
    s += best
  }
  return s
}

export function searchAll(q: string, data: { restaurants: Restaurant[]; menu: MenuItem[]; products: Product[]; brands: Brand[] }): SearchHit[] {
  const query = q.trim()
  if (!query) return []
  const hits: SearchHit[] = []
  const rMap = new Map(data.restaurants.map((r) => [r.id, r]))
  const bMap = new Map(data.brands.map((b) => [b.id, b]))
  for (const r of data.restaurants) {
    const s = score(r.name, query) * 3 + score(`${r.cuisines.join(' ')} ${r.categories.join(' ')} ${r.tagline}`, query)
    if (s) hits.push({ type: 'restaurant', item: r, score: s + r.rating })
  }
  for (const m of data.menu) {
    if (!rMap.has(m.restaurantId)) continue
    const s = score(m.name, query) * 3 + score(`${m.category} ${m.description} ${m.section}`, query)
    if (s) hits.push({ type: 'dish', item: m, score: s + (m.popular ? 2 : 0) })
  }
  for (const p of data.products) {
    const b = bMap.get(p.brandId)
    const s = score(p.name, query) * 3 + score(`${p.subcategory} ${p.category} ${b?.name ?? ''} ${p.colors.map((c) => c.name).join(' ')}`, query)
    if (s) hits.push({ type: 'product', item: p, score: s + p.rating })
  }
  for (const b of data.brands) {
    const s = score(b.name, query) * 3 + score(`${b.tagline} ${b.categories.join(' ')}`, query)
    if (s) hits.push({ type: 'brand', item: b, score: s })
  }
  for (const c of FOOD_CATEGORIES) {
    const s = score(c.label, query)
    if (s) hits.push({ type: 'category', item: { id: c.id, label: c.label, vertical: 'food', emoji: c.emoji }, score: s * 3 })
  }
  for (const c of SHOP_CATEGORIES) {
    const s = score(`${c.label} ${c.id}`, query)
    if (s) hits.push({ type: 'category', item: { id: c.id, label: c.label, vertical: 'shop' }, score: s * 3 })
  }
  return hits.sort((a, b) => b.score - a.score)
}

export const POPULAR_SEARCHES = ['Kacchi', 'Burger', 'Pizza', 'Fuchka', 'Sneakers', 'Panjabi', 'Coffee', 'Hoodie', 'Fried chicken', 'Mishti doi']
