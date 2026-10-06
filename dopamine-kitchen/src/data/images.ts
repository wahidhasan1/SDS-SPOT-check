// Image pools. All photos are bundled with the app (public/img, compressed WebP), so they load fast and
// work anywhere — including hosts that block third-party images. Sources and licences: public/img/CREDITS.md.
// Every <Img> still falls back to a generated illustration if a file is missing.
import { FOOD_PHOTOS, PRODUCT_PHOTOS } from './photos'

const food = (k: keyof typeof FOOD_PHOTOS) => [...FOOD_PHOTOS[k]] as string[]
const products = (...codes: string[]) => codes.flatMap((c) => Object.values(PRODUCT_PHOTOS[c]?.colors ?? {}))

export const IMG = {
  biriyani: food('biriyani'),
  polao: food('polao'),
  grill: food('grill'),
  burger: food('burger'),
  chicken: food('chicken'),
  fries: food('fries'),
  curry: food('curry'),
  desserts: food('desserts'),
  sweets: food('sweets'),
  yogurt: food('yogurt'),
  drinks: food('drinks'),
  coffee: food('coffee'),
  chinese: food('chinese'),
  ramen: [...food('noodles'), ...food('japanese')],
  japanese: food('japanese'),
  snacks: food('snacks'),
  pizza: food('pizza'),
  pasta: food('pasta'),
  healthy: food('healthy'),
  restaurant: [...food('biriyani').slice(0, 3), ...food('burger').slice(0, 3), ...food('pizza').slice(0, 2)],
  // ---- Shopping ----
  menswear: products('ms04', 'mj03', 'mh01', 'mp04', 'ms11', 'mj11'),
  womenswear: products('wh03', 'ws03', 'wj06', 'wj04', 'wp02', 'wh05'),
  streetwear: products('mh08', 'mh12', 'mh05', 'mp06'),
  shoes: products('shoe-knit', 'shoe-court', 'shoe-boots', 'shoe-loafer', 'shoe-pumps', 'shoe-flats'),
  bags: products('mb02', 'mb03', 'mb01', 'mb04', 'mb05', 'mb06'),
  watches: products('mg01', 'mg03', 'mg04', 'mg05'),
  lifestyle: products('yogakit', 'ball', 'ug06', 'roller'),
  fashionHero: products('wj04', 'mj03', 'wh03'),
}

export type ImagePool = keyof typeof IMG

/** Deterministically pick from a pool (wraps around). */
export const pick = (p: ImagePool, i: number) => IMG[p][((i % IMG[p].length) + IMG[p].length) % IMG[p].length]

/** Emoji + hue used by the generated fallback illustration. */
export const FALLBACK_ART: Record<string, { emoji: string; hue: number }> = {
  burger: { emoji: '🍔', hue: 28 },
  pizza: { emoji: '🍕', hue: 12 },
  kacchi: { emoji: '🍛', hue: 38 },
  biriyani: { emoji: '🍛', hue: 40 },
  bangladeshi: { emoji: '🍚', hue: 45 },
  chinese: { emoji: '🥡', hue: 0 },
  chicken: { emoji: '🍗', hue: 30 },
  desserts: { emoji: '🍰', hue: 330 },
  snacks: { emoji: '🥟', hue: 48 },
  drinks: { emoji: '🧋', hue: 190 },
  coffee: { emoji: '☕', hue: 25 },
  grill: { emoji: '🍢', hue: 15 },
  indian: { emoji: '🍲', hue: 20 },
  healthy: { emoji: '🥗', hue: 120 },
  japanese: { emoji: '🍜', hue: 350 },
  arabian: { emoji: '🌯', hue: 35 },
  restaurant: { emoji: '🍽️', hue: 265 },
  men: { emoji: '👕', hue: 215 },
  women: { emoji: '👗', hue: 320 },
  shoes: { emoji: '👟', hue: 200 },
  bags: { emoji: '👜', hue: 30 },
  accessories: { emoji: '⌚', hue: 260 },
  streetwear: { emoji: '🧢', hue: 280 },
  lifestyle: { emoji: '🧘', hue: 170 },
  default: { emoji: '✨', hue: 265 },
}
