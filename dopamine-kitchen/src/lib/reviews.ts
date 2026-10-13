import type { Review } from '../data/types'
import { hashStr, rng } from './format'

// Reviews are generated deterministically from an item id so every restaurant / product
// (including ones added from the admin panel) has believable demo reviews without bloating storage.

const NAMES = [
  'Farhana A.', 'Rafi K.', 'Tasnim R.', 'Shuvo D.', 'Mehjabin S.', 'Imran H.', 'Lamia C.', 'Asif M.', 'Puja S.',
  'Zarif T.', 'Nabila F.', 'Sakib B.', 'Riya G.', 'Fahim U.', 'Tahmid Z.', 'Anika P.', 'Rumana I.', 'Yasir A.',
]

const FOOD_TEXT: [number, string][] = [
  [5, 'Craving hit at 11 PM, ran the whole simulated order and honestly felt satisfied without eating a thing.'],
  [5, 'Photos are dangerously good. Tracked the rider till "Delivered" and the craving was gone.'],
  [4, 'Love the menu layout. Kacchi pics almost made me order for real — almost.'],
  [5, 'Portion descriptions are so detailed. Great for imagining the meal.'],
  [4, 'Smooth checkout, the bKash demo flow feels just like the real thing.'],
  [3, 'Simulated delivery took the full 30 minutes — realistic, maybe too realistic 😄'],
  [5, 'Saved ৳900 this week by riding out my burger cravings here.'],
  [4, 'Wish there were more dessert options, but the mishti doi photo is perfect.'],
  [5, 'The rider map animation is weirdly calming.'],
  [4, 'Good variety. Spice level option is a nice touch.'],
]

const SHOP_TEXT: [number, string][] = [
  [5, 'Added it to cart, checked out, watched it get "delivered" — the urge to buy passed. Magic.'],
  [4, 'Size guide is clear and the colour swatches look accurate.'],
  [5, 'Browsing this instead of real shops has saved me so much money.'],
  [4, 'Love the gallery. Would be nice to have a zoom view.'],
  [3, 'Demo stock ran out on my size, felt very real lol.'],
  [5, 'The same-day express simulation is hilarious and satisfying.'],
  [4, 'Nice fictional brand — the description sounds premium.'],
  [5, 'Great for impulse-shopping detox. 10/10 would not actually buy.'],
]

export function reviewsFor(id: string, kind: 'food' | 'shop', count = 6, variants?: string[]): Review[] {
  const r = rng(hashStr(id))
  const pool = kind === 'food' ? FOOD_TEXT : SHOP_TEXT
  const out: Review[] = []
  for (let i = 0; i < count; i++) {
    const [rating, text] = pool[Math.floor(r() * pool.length)]
    out.push({
      id: `${id}-rv-${i}`,
      name: NAMES[Math.floor(r() * NAMES.length)],
      rating,
      text,
      helpful: Math.floor(r() * 40),
      date: Date.now() - Math.floor(r() * 90 + i * 3) * 864e5,
      variant: variants?.length ? variants[Math.floor(r() * variants.length)] : undefined,
    })
  }
  return out.sort((a, b) => b.date - a.date)
}

/** Star distribution (5→1) consistent with an average rating. */
export function ratingBreakdown(avg: number, total: number) {
  const w5 = Math.max(0, (avg - 3.6) / 1.4)
  const raw = [0.55 + w5 * 0.35, 0.25 - w5 * 0.08, 0.1 - w5 * 0.05, 0.05 - w5 * 0.02, 0.05 - w5 * 0.02].map((x) => Math.max(0.01, x))
  const sum = raw.reduce((a, b) => a + b, 0)
  return raw.map((x) => Math.round((x / sum) * total))
}
