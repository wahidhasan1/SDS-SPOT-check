import type { Brand, ColorOption, Product, ShopCategory } from './types'
import { PRODUCT_PHOTOS } from './photos'

// All brands are FICTIONAL demo labels created for this simulation. Product photos are bundled
// demo photography (see public/img/CREDITS.md); names, prices and descriptions are invented.

const photo = (code: string, i = 0) => {
  const p = PRODUCT_PHOTOS[code]
  return Object.values(p.colors)[i] ?? Object.values(p.colors)[0]
}

export const SEED_BRANDS: Brand[] = [
  { id: 'b-nokshi', name: 'Nokshi Threads', tagline: "Women's everyday & athleisure", about: 'Soft jersey tees, cowl tops and layering pieces cut for Dhaka humidity, finished with small nakshi-inspired details. (Fictional demo brand.)', initials: 'NT', logoBg: '#9D174D', cover: photo('wh03'), rating: 4.7, followers: 48200, categories: ['women'], areaId: 'dhanmondi' },
  { id: 'b-urban-tiger', name: 'Urban Tiger Co.', tagline: 'Streetwear from the city of rickshaws', about: 'Hoodies, tanks and caps with bold Dhaka energy. (Fictional demo brand.)', initials: 'UT', logoBg: '#EA580C', cover: photo('mh12'), rating: 4.6, followers: 61500, categories: ['streetwear', 'men', 'bags'], areaId: 'banani' },
  { id: 'b-buriganga', name: 'Buriganga Outfitters', tagline: 'Trousers & outerwear that survive monsoon', about: 'Quick-dry trousers, cargos and shells for everyday commutes. (Fictional demo brand.)', initials: 'BO', logoBg: '#1E3A8A', cover: photo('mp11'), rating: 4.5, followers: 22900, categories: ['men', 'women'], areaId: 'tejgaon' },
  { id: 'b-kolpo', name: 'Kolpo Leather', tagline: 'Leather shoes & bags', about: 'Formal shoes, sandals and carry-alls with a focus on durable materials. (Fictional demo brand.)', initials: 'KL', logoBg: '#78350F', cover: photo('mb05'), rating: 4.8, followers: 30400, categories: ['shoes', 'bags'], areaId: 'motijheel' },
  { id: 'b-monsoon', name: 'Monsoon Kicks', tagline: 'Sneakers & rainwear for humid streets', about: 'Breathable sneakers, slides and packable rain layers tested on Dhaka pavements. (Fictional demo brand.)', initials: 'MK', logoBg: '#0E7490', cover: photo('wj04'), rating: 4.5, followers: 39800, categories: ['shoes', 'women'], areaId: 'gulshan-1' },
  { id: 'b-lalbagh', name: 'Lalbagh Lane', tagline: 'Watches & accessories', about: 'Watches, caps and everyday carry with a vintage Dhaka twist. (Fictional demo brand.)', initials: 'LL', logoBg: '#6D28D9', cover: photo('mg05'), rating: 4.4, followers: 17600, categories: ['accessories', 'bags'], areaId: 'lalbagh' },
  { id: 'b-padma', name: 'Padma Loom', tagline: 'Menswear for the tropics', about: 'Tees, hoodies and jackets made for hot days and air-conditioned offices. (Fictional demo brand.)', initials: 'PL', logoBg: '#047857', cover: photo('mj03'), rating: 4.6, followers: 26700, categories: ['men'], areaId: 'uttara' },
  { id: 'b-shapla', name: 'Shapla Fit & Living', tagline: 'Fitness & wellness essentials', about: 'Bottles, yoga kits and home-workout gear for calmer, healthier routines. (Fictional demo brand.)', initials: 'SF', logoBg: '#0F766E', cover: photo('yogakit'), rating: 4.5, followers: 14300, categories: ['lifestyle'], areaId: 'bashundhara' },
  { id: 'b-neon-rickshaw', name: 'Neon Rickshaw', tagline: 'Loud colours. Louder streets.', about: 'Colour-block sweatshirts, joggers and jackets inspired by rickshaw art. (Fictional demo brand.)', initials: 'NR', logoBg: '#DB2777', cover: photo('mh05'), rating: 4.3, followers: 33100, categories: ['streetwear', 'men'], areaId: 'mirpur' },
  { id: 'b-dhaka-basics', name: 'Dhaka Basics', tagline: 'Wardrobe essentials, fair prices', about: 'Plain tees, joggers and leggings at honest prices. (Fictional demo brand.)', initials: 'DB', logoBg: '#334155', cover: photo('ms04'), rating: 4.4, followers: 52000, categories: ['men', 'women'], areaId: 'farmgate' },
]

const COLOR: Record<string, ColorOption> = {
  black: { name: 'Black', hex: '#111827' }, bk: { name: 'Black', hex: '#111827' }, gray: { name: 'Heather Grey', hex: '#9CA3AF' },
  orange: { name: 'Sunset Orange', hex: '#F97316' }, red: { name: 'Crimson', hex: '#DC2626' }, blue: { name: 'Ocean Blue', hex: '#2563EB' },
  green: { name: 'Mint Green', hex: '#34D399' }, yellow: { name: 'Mustard', hex: '#EAB308' }, purple: { name: 'Plum', hex: '#8B5CF6' },
  white: { name: 'White', hex: '#F3F4F6' }, brown: { name: 'Olive Brown', hex: '#6B5B3E' }, br: { name: 'Tan Brown', hex: '#92400E' },
  lb: { name: 'Clear Blue', hex: '#7DD3FC' }, gr: { name: 'Graphite', hex: '#4B5563' }, pink: { name: 'Pink', hex: '#EC4899' },
}

const S = {
  apparel: ['S', 'M', 'L', 'XL', 'XXL'],
  women: ['XS', 'S', 'M', 'L', 'XL'],
  waist: ['28', '30', '32', '34', '36', '38'],
  shoes: ['39', '40', '41', '42', '43', '44'],
  womenShoes: ['36', '37', '38', '39', '40'],
  one: ['One size'],
}

type P = {
  brand: string; name: string; cat: ShopCategory; sub: string; photo: string; price: number; off: number
  desc: string; hl: string[]; sizes: string[]; rating: number; reviews: number; stock: number; tags?: string[]
  /** Colour name for single-photo items (whose photo key is "default"). */
  color?: ColorOption
}

const RAW: P[] = [
  // ---------------- Men ----------------
  { brand: 'b-dhaka-basics', name: 'Everyday Performance Tee', cat: 'men', sub: 'T-Shirts', photo: 'ms04', price: 990, off: 20, desc: 'A soft, quick-dry crew tee that keeps its shape wash after wash. Your new daily uniform for Dhaka heat.', hl: ['Moisture-wicking jersey', 'Regular fit', 'Pre-shrunk', 'Machine wash cold'], sizes: S.apparel, rating: 4.6, reviews: 1290, stock: 140, tags: ['Bestseller'] },
  { brand: 'b-dhaka-basics', name: 'Breeze V-Neck Tee', cat: 'men', sub: 'T-Shirts', photo: 'ms11', price: 850, off: 10, desc: 'Lightweight V-neck in a breathable blend, cut slightly longer for tucking in or wearing loose.', hl: ['Breathable blend', 'V-neck', 'Slim fit'], sizes: S.apparel, rating: 4.4, reviews: 512, stock: 80 },
  { brand: 'b-padma', name: 'Long-Sleeve Training Tee', cat: 'men', sub: 'T-Shirts', photo: 'ms07', price: 1290, off: 0, desc: 'Long-sleeve tee with flatlock seams for morning runs around Hatirjheel or a cool office.', hl: ['Flatlock seams', 'Thumbholes', 'UPF 30 (demo claim)'], sizes: S.apparel, rating: 4.5, reviews: 238, stock: 52 },
  { brand: 'b-urban-tiger', name: 'Sleeveless Gym Tank', cat: 'men', sub: 'Tanks', photo: 'mt01', price: 690, off: 0, desc: 'Relaxed muscle tank with dropped armholes. Built for leg day, worn every day.', hl: ['Cotton-poly blend', 'Dropped armholes', 'Relaxed fit'], sizes: S.apparel, rating: 4.3, reviews: 190, stock: 64 },
  { brand: 'b-dhaka-basics', name: 'Commuter Track Pants', cat: 'men', sub: 'Trousers', photo: 'mp04', price: 1650, off: 12, desc: 'Tapered track pants with a soft brushed inside and zip pockets that keep your phone safe on a CNG.', hl: ['Zip pockets', 'Tapered leg', 'Elastic waist with drawcord'], sizes: S.waist, rating: 4.3, reviews: 342, stock: 61 },
  { brand: 'b-buriganga', name: 'Utility Cargo Trousers', cat: 'men', sub: 'Trousers', photo: 'mp11', price: 2400, off: 25, desc: 'Quick-dry ripstop cargos with six pockets — ready for monsoon puddles.', hl: ['Ripstop fabric', 'Quick-dry', '6 pockets'], sizes: S.waist, rating: 4.4, reviews: 176, stock: 4, tags: ['Low stock'] },
  { brand: 'b-urban-tiger', name: 'Run Club Shorts', cat: 'men', sub: 'Shorts', photo: 'msh03', price: 990, off: 15, desc: '7-inch running shorts with a built-in liner and a back key pocket.', hl: ['7" inseam', 'Built-in liner', 'Reflective trims'], sizes: S.apparel, rating: 4.5, reviews: 264, stock: 38 },
  { brand: 'b-padma', name: 'Monsoon Puffer Jacket', cat: 'men', sub: 'Jackets', photo: 'mj03', price: 4900, off: 15, desc: 'A lightweight quilted puffer for December evenings and over-cooled offices. Packs into its own pocket.', hl: ['Synthetic insulation', 'Water-repellent shell', 'Packable'], sizes: S.apparel, rating: 4.6, reviews: 98, stock: 18, tags: ['Premium'] },
  { brand: 'b-neon-rickshaw', name: 'Full-Zip Track Jacket', cat: 'men', sub: 'Jackets', photo: 'mj06', price: 3200, off: 20, desc: 'Retro track jacket with a stand collar and contrast piping.', hl: ['Stand collar', 'Zip pockets', 'Regular fit'], sizes: S.apparel, rating: 4.4, reviews: 122, stock: 26 },
  { brand: 'b-neon-rickshaw', name: 'City Bomber Jacket', cat: 'men', sub: 'Jackets', photo: 'mj11', price: 4500, off: 25, desc: 'Clean bomber with ribbed cuffs and a smooth satin-feel finish.', hl: ['Ribbed collar & cuffs', 'Two hand pockets', 'Lined'], sizes: S.apparel, rating: 4.5, reviews: 91, stock: 15 },
  { brand: 'b-padma', name: 'Colour-Block Hooded Pullover', cat: 'men', sub: 'Hoodies', photo: 'mh01', price: 2650, off: 10, desc: 'Lightweight hooded pullover with contrast sleeves and a chest pocket.', hl: ['French terry', 'Chest pocket', 'Contrast sleeves'], sizes: S.apparel, rating: 4.6, reviews: 412, stock: 34, tags: ['Bestseller'] },
  // ---------------- Women ----------------
  { brand: 'b-nokshi', name: 'Ruched Jersey Tee', cat: 'women', sub: 'Tops', photo: 'ws03', price: 1190, off: 20, desc: 'Fitted tee with side ruching that flatters without clinging.', hl: ['Stretch jersey', 'Side ruching', 'Scoop neck'], sizes: S.women, rating: 4.7, reviews: 521, stock: 40, tags: ['Bestseller'] },
  { brand: 'b-dhaka-basics', name: 'Relaxed V-Neck Tee', cat: 'women', sub: 'Tops', photo: 'ws06', price: 890, off: 10, desc: 'Slub-knit V-neck tee with a relaxed drape.', hl: ['Slub knit', 'Relaxed fit'], sizes: S.women, rating: 4.4, reviews: 389, stock: 77 },
  { brand: 'b-dhaka-basics', name: 'Everyday Scoop Tee', cat: 'women', sub: 'Tops', photo: 'ws11', price: 850, off: 0, desc: 'Breathable scoop-neck tee for workouts and weekends.', hl: ['Breathable mesh back', 'Scoop neck'], sizes: S.women, rating: 4.3, reviews: 211, stock: 0, tags: ['Sold out'] },
  { brand: 'b-nokshi', name: 'Cowl-Neck Draped Top', cat: 'women', sub: 'Tops', photo: 'wh03', price: 1890, off: 15, desc: 'Draped cowl-neck top with soft dolman sleeves — dressy enough for dawat, comfy enough for adda.', hl: ['Modal blend', 'Cowl neck', 'Dolman sleeves'], sizes: S.women, rating: 4.8, reviews: 143, stock: 9, tags: ['Premium'] },
  { brand: 'b-urban-tiger', name: 'Zip-Up Hoodie', cat: 'women', sub: 'Hoodies', photo: 'wh05', price: 2450, off: 20, desc: 'Brushed-fleece zip hoodie with thumbholes and a fitted hem.', hl: ['Brushed fleece', 'Thumbholes', 'Full zip'], sizes: S.women, rating: 4.6, reviews: 455, stock: 31 },
  { brand: 'b-nokshi', name: 'Drawstring Cowl Hoodie', cat: 'women', sub: 'Hoodies', photo: 'wh01', price: 2290, off: 30, desc: 'Lightweight pullover with a drawstring cowl and raglan sleeves.', hl: ['Raglan sleeves', 'Drawstring cowl'], sizes: S.women, rating: 4.5, reviews: 196, stock: 27, tags: ['Eid edit'] },
  { brand: 'b-dhaka-basics', name: 'Quilted Puffer Jacket', cat: 'women', sub: 'Jackets', photo: 'wj06', price: 4900, off: 20, desc: 'Featherlight quilted puffer with a stand collar — winter warmth without bulk.', hl: ['Synthetic down', 'Water-repellent', 'Zip pockets'], sizes: S.women, rating: 4.6, reviews: 164, stock: 12 },
  { brand: 'b-monsoon', name: 'Packable Windbreaker', cat: 'women', sub: 'Jackets', photo: 'wj04', price: 3300, off: 15, desc: 'A packable shell for sudden showers. Folds into its own pocket and lives in your bag.', hl: ['Water-repellent', 'Packable', 'Adjustable hood'], sizes: S.women, rating: 4.5, reviews: 132, stock: 22 },
  { brand: 'b-dhaka-basics', name: 'High-Rise Leggings', cat: 'women', sub: 'Bottoms', photo: 'wp02', price: 1490, off: 10, desc: 'Squat-proof high-rise leggings with a wide waistband and hidden pocket.', hl: ['Squat-proof', 'High rise', 'Hidden waistband pocket'], sizes: S.women, rating: 4.6, reviews: 690, stock: 85 },
  { brand: 'b-buriganga', name: 'Relaxed Jogger Pants', cat: 'women', sub: 'Bottoms', photo: 'wp03', price: 1890, off: 20, desc: 'Lightweight joggers with ruched cuffs and deep pockets.', hl: ['Quick-dry', 'Cuffed hem', 'Deep pockets'], sizes: S.women, rating: 4.4, reviews: 264, stock: 38 },
  { brand: 'b-nokshi', name: 'Two-in-One Active Shorts', cat: 'women', sub: 'Bottoms', photo: 'wsh04', price: 1090, off: 0, desc: 'Running shorts with an inner bike-short layer.', hl: ['Inner short', 'Phone pocket'], sizes: S.women, rating: 4.3, reviews: 77, stock: 64 },
  { brand: 'b-nokshi', name: 'Racerback Tank', cat: 'women', sub: 'Tops', photo: 'wt02', price: 750, off: 0, desc: 'Breathable racerback tank for yoga, gym or layering.', hl: ['Racerback', 'Breathable knit'], sizes: S.women, rating: 4.4, reviews: 158, stock: 48 },
  { brand: 'b-nokshi', name: 'Ruched Training Tank', cat: 'women', sub: 'Tops', photo: 'wt05', price: 790, off: 15, desc: 'Fitted tank with centre ruching and a longer hem.', hl: ['Centre ruching', 'Longline'], sizes: S.women, rating: 4.5, reviews: 133, stock: 33 },
  // ---------------- Streetwear ----------------
  { brand: 'b-urban-tiger', name: 'Olive Pullover Hoodie', cat: 'streetwear', sub: 'Hoodies', photo: 'mh08', price: 2650, off: 20, desc: 'Heavyweight pullover hoodie with a kangaroo pocket. The one you will live in.', hl: ['380 GSM fleece', 'Kangaroo pocket', 'Relaxed fit'], sizes: S.apparel, rating: 4.7, reviews: 803, stock: 95, tags: ['Bestseller'] },
  { brand: 'b-urban-tiger', name: 'Striped Zip Hoodie', cat: 'streetwear', sub: 'Hoodies', photo: 'mh12', price: 2850, off: 15, desc: 'Marled stripe zip hoodie with ribbed trims.', hl: ['Cotton blend', 'Full zip', 'Ribbed trims'], sizes: S.apparel, rating: 4.5, reviews: 266, stock: 41 },
  { brand: 'b-neon-rickshaw', name: 'Raglan Colour-Block Sweatshirt', cat: 'streetwear', sub: 'Sweatshirts', photo: 'mh05', price: 2250, off: 25, desc: 'Retro raglan crew in bold rickshaw-art colour blocks.', hl: ['Brushed back fleece', 'Raglan sleeves'], sizes: S.apparel, rating: 4.4, reviews: 172, stock: 58 },
  { brand: 'b-neon-rickshaw', name: 'Mustard Crew Sweatshirt', cat: 'streetwear', sub: 'Sweatshirts', photo: 'mh11', price: 1990, off: 10, desc: 'Garment-dyed crew sweatshirt with contrast cover-stitching.', hl: ['Garment dyed', 'Contrast stitching'], sizes: S.apparel, rating: 4.3, reviews: 208, stock: 44 },
  { brand: 'b-neon-rickshaw', name: 'Heather Jogger Pants', cat: 'streetwear', sub: 'Bottoms', photo: 'mp06', price: 1990, off: 20, desc: 'Soft heather joggers with a tapered leg and cuffed hem.', hl: ['Cotton-rich fleece', 'Cuffed hem', 'Drawcord waist'], sizes: S.apparel, rating: 4.4, reviews: 302, stock: 72 },
  { brand: 'b-urban-tiger', name: 'Six-Panel Dad Cap', cat: 'streetwear', sub: 'Caps', photo: 'cap-dad', price: 690, off: 0, desc: 'Washed cotton cap with a curved brim and adjustable strap.', hl: ['Washed cotton', 'Adjustable strap'], sizes: S.one, rating: 4.4, reviews: 266, stock: 110, color: { name: 'Charcoal', hex: '#374151' } },
  { brand: 'b-neon-rickshaw', name: 'Fair-Isle Knit Beanie', cat: 'streetwear', sub: 'Caps', photo: 'cap-beanie', price: 590, off: 0, desc: 'Patterned knit beanie for chilly December nights.', hl: ['Acrylic knit', 'Fold-over cuff'], sizes: S.one, rating: 4.2, reviews: 64, stock: 72, color: { name: 'Sky Pattern', hex: '#93C5FD' } },
  // ---------------- Shoes ----------------
  { brand: 'b-monsoon', name: 'AirFlow Knit Runner', cat: 'shoes', sub: 'Sneakers', photo: 'shoe-knit', price: 4200, off: 20, desc: 'Featherweight knit runner with a cushioned foam midsole and quick-dry upper — built for humid mornings.', hl: ['Breathable knit upper', 'EVA foam midsole', 'Quick-dry lining', '220 g per shoe'], sizes: S.shoes, rating: 4.6, reviews: 642, stock: 45, tags: ['Bestseller'], color: { name: 'Charcoal Knit', hex: '#3F3F55' } },
  { brand: 'b-monsoon', name: 'Court Classic Sneaker', cat: 'shoes', sub: 'Sneakers', photo: 'shoe-court', price: 3600, off: 10, desc: 'Clean white low-top sneaker with a glitter-flecked upper.', hl: ['Faux leather upper', 'Rubber cupsole', 'Padded collar'], sizes: S.shoes, rating: 4.5, reviews: 418, stock: 51, color: { name: 'White Glitter', hex: '#E5E7EB' } },
  { brand: 'b-monsoon', name: 'Canvas Slip-On', cat: 'shoes', sub: 'Sneakers', photo: 'shoe-slipon', price: 1890, off: 15, desc: 'Easy canvas slip-ons with elastic gores.', hl: ['Canvas upper', 'Elastic gores', 'Cushioned insole'], sizes: S.womenShoes, rating: 4.3, reviews: 233, stock: 30, color: { name: 'Lilac', hex: '#A78BFA' } },
  { brand: 'b-monsoon', name: 'Monsoon Rain Slides', cat: 'shoes', sub: 'Sandals', photo: 'shoe-slides', price: 590, off: 0, desc: 'Waterproof flip-flops for rainy days and rooftop hangouts.', hl: ['Waterproof EVA', 'Soft toe post'], sizes: S.shoes, rating: 4.2, reviews: 512, stock: 120, color: { name: 'Aqua', hex: '#67E8F9' } },
  { brand: 'b-kolpo', name: 'Leather Derby Boots', cat: 'shoes', sub: 'Boots', photo: 'shoe-boots', price: 5600, off: 15, desc: 'Lace-up leather boots with a rugged sole that ages beautifully.', hl: ['Full-grain leather', 'Rubber lug sole'], sizes: S.shoes, rating: 4.8, reviews: 301, stock: 20, tags: ['Premium'], color: { name: 'Dark Brown', hex: '#3F2A1E' } },
  { brand: 'b-kolpo', name: 'Hand-Stitched Loafer', cat: 'shoes', sub: 'Formal', photo: 'shoe-loafer', price: 4900, off: 20, desc: 'Moc-toe leather loafer with woven detailing.', hl: ['Genuine leather', 'Hand-stitched moc toe'], sizes: S.shoes, rating: 4.6, reviews: 122, stock: 7, color: { name: 'Cognac', hex: '#8B4513' } },
  { brand: 'b-kolpo', name: 'Bow Block-Heel Pumps', cat: 'shoes', sub: 'Heels', photo: 'shoe-pumps', price: 2950, off: 10, desc: 'Comfortable 2-inch block heel with a bow detail.', hl: ['Faux leather', '2" block heel', 'Padded insole'], sizes: S.womenShoes, rating: 4.5, reviews: 187, stock: 26, color: { name: 'Black', hex: '#111827' } },
  { brand: 'b-kolpo', name: 'Classic Stiletto', cat: 'shoes', sub: 'Heels', photo: 'shoe-stiletto', price: 3450, off: 0, desc: 'Glossy platform stiletto for weddings and holud nights.', hl: ['Patent finish', '4" heel', 'Hidden platform'], sizes: S.womenShoes, rating: 4.4, reviews: 96, stock: 14, tags: ['Eid edit'], color: { name: 'Black Patent', hex: '#0B0B0F' } },
  { brand: 'b-kolpo', name: 'Comfort Strap Sandals', cat: 'shoes', sub: 'Sandals', photo: 'shoe-sandal', price: 1650, off: 0, desc: 'Adjustable three-strap sandals with a contoured cork-style footbed.', hl: ['Adjustable straps', 'Contoured footbed'], sizes: S.shoes, rating: 4.4, reviews: 210, stock: 40, color: { name: 'Brown', hex: '#78350F' } },
  { brand: 'b-kolpo', name: 'Patent Ballet Flats', cat: 'shoes', sub: 'Flats', photo: 'shoe-flats', price: 1990, off: 15, desc: 'Glossy ballet flats for office-to-evening.', hl: ['Patent finish', 'Cushioned sole'], sizes: S.womenShoes, rating: 4.3, reviews: 144, stock: 39, color: { name: 'Black Patent', hex: '#0B0B0F' } },
  // ---------------- Bags ----------------
  { brand: 'b-urban-tiger', name: 'Trail Backpack 22L', cat: 'bags', sub: 'Backpacks', photo: 'mb02', price: 2800, off: 25, desc: 'Water-resistant daypack with padded straps and a hidden pocket — CNG-proof.', hl: ['Water-resistant', '22 L', 'Hidden back pocket'], sizes: S.one, rating: 4.6, reviews: 388, stock: 66, tags: ['Bestseller'] },
  { brand: 'b-urban-tiger', name: 'Commuter Laptop Backpack', cat: 'bags', sub: 'Backpacks', photo: 'mb03', price: 3400, off: 15, desc: 'Structured backpack with a padded 15.6" laptop sleeve and organiser panel.', hl: ['15.6" laptop sleeve', 'Organiser panel'], sizes: S.one, rating: 4.7, reviews: 156, stock: 14 },
  { brand: 'b-kolpo', name: 'Weekender Duffle', cat: 'bags', sub: 'Duffles', photo: 'mb01', price: 3900, off: 20, desc: 'Roomy duffle for Cox’s Bazar weekends and gym days.', hl: ['40 L', 'Shoulder strap', 'Shoe pocket'], sizes: S.one, rating: 4.5, reviews: 210, stock: 40 },
  { brand: 'b-lalbagh', name: 'Crossbody Sling Pack', cat: 'bags', sub: 'Slings', photo: 'mb04', price: 1950, off: 15, desc: 'Compact one-strap sling — phone, wallet, keys, done.', hl: ['Adjustable strap', 'Quick-access pocket'], sizes: S.one, rating: 4.5, reviews: 274, stock: 90 },
  { brand: 'b-kolpo', name: 'Office Messenger Bag', cat: 'bags', sub: 'Messengers', photo: 'mb05', price: 4200, off: 10, desc: 'Flap-over messenger with a padded laptop compartment.', hl: ['Padded laptop slot', 'Magnetic buckles'], sizes: S.one, rating: 4.6, reviews: 119, stock: 23 },
  { brand: 'b-kolpo', name: 'Canvas Field Satchel', cat: 'bags', sub: 'Messengers', photo: 'mb06', price: 2950, off: 0, desc: 'Washed canvas satchel with leather-look buckles.', hl: ['Washed canvas', 'Two front pockets'], sizes: S.one, rating: 4.4, reviews: 88, stock: 31 },
  // ---------------- Accessories ----------------
  { brand: 'b-lalbagh', name: 'Digital Sport Watch', cat: 'accessories', sub: 'Watches', photo: 'mg01', price: 3900, off: 20, desc: 'Chunky digital watch with stopwatch, alarm and backlight.', hl: ['Stopwatch & alarm', 'Backlight', '5 ATM (demo)'], sizes: S.one, rating: 4.5, reviews: 189, stock: 23 },
  { brand: 'b-lalbagh', name: 'Outdoor Compass Watch', cat: 'accessories', sub: 'Watches', photo: 'mg03', price: 5400, off: 15, desc: 'Rugged outdoor watch with compass bezel.', hl: ['Compass bezel', 'Silicone strap'], sizes: S.one, rating: 4.4, reviews: 88, stock: 11, tags: ['Premium'] },
  { brand: 'b-lalbagh', name: 'Minimal Analog Watch', cat: 'accessories', sub: 'Watches', photo: 'mg04', price: 4500, off: 10, desc: 'Clean analog dial on a soft silicone strap.', hl: ['Japanese quartz (demo)', '42 mm'], sizes: S.one, rating: 4.6, reviews: 301, stock: 70 },
  { brand: 'b-lalbagh', name: 'Dual-Time Leather Watch', cat: 'accessories', sub: 'Watches', photo: 'mg05', price: 6900, off: 20, desc: 'Two time zones on a stitched leather cuff — Dhaka and wherever your family is.', hl: ['Dual time', 'Leather cuff strap'], sizes: S.one, rating: 4.7, reviews: 144, stock: 3, tags: ['Low stock'] },
  { brand: 'b-lalbagh', name: 'Leather Flat Cap', cat: 'accessories', sub: 'Caps', photo: 'cap-flat', price: 1250, off: 15, desc: 'Classic flat cap in soft faux leather.', hl: ['Faux leather', 'Quilted lining'], sizes: S.one, rating: 4.3, reviews: 133, stock: 48, color: { name: 'Olive Black', hex: '#3F4637' } },
  // ---------------- Lifestyle ----------------
  { brand: 'b-shapla', name: 'Hydro Bottle 1L', cat: 'lifestyle', sub: 'Drinkware', photo: 'ug06', price: 990, off: 10, desc: 'BPA-free 1-litre bottle with a carabiner lid. Hydration for a Dhaka June.', hl: ['BPA free', '1 L', 'Carabiner loop'], sizes: S.one, rating: 4.7, reviews: 690, stock: 150 },
  { brand: 'b-shapla', name: 'Anti-Burst Exercise Ball', cat: 'lifestyle', sub: 'Fitness', photo: 'ball', price: 1850, off: 20, desc: '65 cm anti-burst stability ball with pump included.', hl: ['65 cm', 'Anti-burst', 'Pump included'], sizes: S.one, rating: 4.5, reviews: 245, stock: 36 },
  { brand: 'b-shapla', name: 'Foam Roller', cat: 'lifestyle', sub: 'Recovery', photo: 'roller', price: 1290, off: 0, desc: 'High-density foam roller for post-workout recovery.', hl: ['High-density foam', '45 cm'], sizes: S.one, rating: 4.4, reviews: 132, stock: 47, color: { name: 'Blue', hex: '#3B82F6' } },
  { brand: 'b-shapla', name: 'Yoga Starter Kit', cat: 'lifestyle', sub: 'Yoga', photo: 'yogakit', price: 3450, off: 25, desc: 'Ball, brick, strap and roller — everything for a calm home practice.', hl: ['4-piece kit', 'Carry bag'], sizes: S.one, rating: 4.6, reviews: 158, stock: 25, tags: ['Bestseller'], color: { name: 'Blue', hex: '#3B82F6' } },
  { brand: 'b-shapla', name: 'Yoga Strap Set (3)', cat: 'lifestyle', sub: 'Yoga', photo: 'strap', price: 790, off: 0, desc: 'Three cotton yoga straps with metal D-rings.', hl: ['Cotton webbing', 'Metal D-ring'], sizes: S.one, rating: 4.3, reviews: 66, stock: 88, color: { name: 'Multicolour', hex: '#22C55E' } },
  { brand: 'b-shapla', name: 'Yoga Block', cat: 'lifestyle', sub: 'Yoga', photo: 'brick', price: 590, off: 0, desc: 'Lightweight EVA foam block for support and alignment.', hl: ['EVA foam', 'Non-slip'], sizes: S.one, rating: 4.4, reviews: 97, stock: 120, color: { name: 'Blue', hex: '#3B82F6' } },
  { brand: 'b-shapla', name: 'Speed Jump Rope', cat: 'lifestyle', sub: 'Fitness', photo: 'ug04', price: 650, off: 10, desc: 'Ball-bearing jump rope with foam grips — cardio in a small flat.', hl: ['Ball bearings', 'Adjustable length'], sizes: S.one, rating: 4.3, reviews: 211, stock: 64 },
  { brand: 'b-shapla', name: 'Push-Up Bars', cat: 'lifestyle', sub: 'Fitness', photo: 'ug05', price: 1150, off: 0, desc: 'Non-slip push-up handles that go easy on your wrists.', hl: ['Non-slip base', 'Foam grips'], sizes: S.one, rating: 4.4, reviews: 76, stock: 0, tags: ['Sold out'] },
  { brand: 'b-shapla', name: 'Resistance Band Set', cat: 'lifestyle', sub: 'Fitness', photo: 'ug01', price: 1450, off: 15, desc: 'Tube resistance band with cushioned handles for full-body workouts.', hl: ['Cushioned handles', 'Door anchor'], sizes: S.one, rating: 4.5, reviews: 154, stock: 58 },
]

const T0 = Date.UTC(2026, 3, 1)

export const SEED_PRODUCTS: Product[] = RAW.map((p, n) => {
  const ph = PRODUCT_PHOTOS[p.photo]
  const entries = Object.entries(ph.colors)
  const colors = entries.map(([key]) => (key === 'default' ? p.color ?? { name: 'Default', hex: '#9CA3AF' } : COLOR[key] ?? { name: key, hex: '#9CA3AF' }))
  const colorImages = Object.fromEntries(entries.map(([, src], i) => [colors[i].name, src]))
  const images = [...entries.map(([, src]) => src), ...(ph.back ? [ph.back] : [])]
  return {
    id: `p-${String(n + 1).padStart(3, '0')}`,
    brandId: p.brand,
    name: p.name,
    category: p.cat,
    subcategory: p.sub,
    images,
    colorImages,
    price: p.price,
    discountPct: p.off,
    description: p.desc,
    highlights: p.hl,
    sizes: p.sizes,
    colors,
    rating: p.rating,
    reviewCount: p.reviews,
    stock: p.stock,
    deliveryHours: 24,
    expressAvailable: p.price < 6000,
    tags: p.tags ?? [],
    createdAt: T0 + n * 36e5 * 20,
  }
})

export const SHOP_CATEGORIES: { id: ShopCategory; label: string; image: string }[] = [
  { id: 'men', label: "Men's Fashion", image: photo('mj03') },
  { id: 'women', label: "Women's Fashion", image: photo('wh03') },
  { id: 'shoes', label: 'Shoes', image: photo('shoe-knit') },
  { id: 'bags', label: 'Bags', image: photo('mb02') },
  { id: 'accessories', label: 'Accessories', image: photo('mg05') },
  { id: 'streetwear', label: 'Streetwear', image: photo('mh08') },
  { id: 'lifestyle', label: 'Lifestyle', image: photo('yogakit') },
]
