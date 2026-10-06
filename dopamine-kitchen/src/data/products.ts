import type { Brand, ColorOption, Product, ShopCategory } from './types'
import { IMG, pick, type ImagePool } from './images'

// All brands are FICTIONAL demo labels created for this simulation.

export const SEED_BRANDS: Brand[] = [
  { id: 'b-nokshi', name: 'Nokshi Threads', tagline: 'Handcrafted ethnic wear', about: 'Contemporary kurtis, sarees and three-pieces inspired by nakshi kantha motifs. (Fictional demo brand.)', initials: 'NT', logoBg: '#9D174D', cover: pick('dress', 5), rating: 4.7, followers: 48200, categories: ['women'], areaId: 'dhanmondi' },
  { id: 'b-urban-tiger', name: 'Urban Tiger Co.', tagline: 'Streetwear from the city of rickshaws', about: 'Oversized tees, hoodies and caps with bold Dhaka graphics. (Fictional demo brand.)', initials: 'UT', logoBg: '#EA580C', cover: pick('hoodie', 0), rating: 4.6, followers: 61500, categories: ['streetwear', 'men'], areaId: 'banani' },
  { id: 'b-buriganga', name: 'Buriganga Denim', tagline: 'Denim that survives monsoon', about: 'Rigid & stretch denim cut for everyday Dhaka life. (Fictional demo brand.)', initials: 'BD', logoBg: '#1E3A8A', cover: pick('jeans', 0), rating: 4.5, followers: 22900, categories: ['men', 'women'], areaId: 'tejgaon' },
  { id: 'b-kolpo', name: 'Kolpo Leather', tagline: 'Full-grain leather goods', about: 'Formal shoes, belts, wallets and bags crafted from full-grain leather. (Fictional demo brand.)', initials: 'KL', logoBg: '#78350F', cover: pick('bags', 0), rating: 4.8, followers: 30400, categories: ['shoes', 'bags', 'accessories'], areaId: 'motijheel' },
  { id: 'b-monsoon', name: 'Monsoon Kicks', tagline: 'Sneakers for humid streets', about: 'Breathable sneakers and runners tested on Dhaka pavements. (Fictional demo brand.)', initials: 'MK', logoBg: '#0E7490', cover: pick('sneakers', 0), rating: 4.5, followers: 39800, categories: ['shoes', 'streetwear'], areaId: 'gulshan-1' },
  { id: 'b-lalbagh', name: 'Lalbagh Lane', tagline: 'Accessories with heritage', about: 'Watches, eyewear and jewellery with a vintage Dhaka twist. (Fictional demo brand.)', initials: 'LL', logoBg: '#6D28D9', cover: pick('watches', 0), rating: 4.4, followers: 17600, categories: ['accessories'], areaId: 'lalbagh' },
  { id: 'b-padma', name: 'Padma Loom', tagline: 'Panjabis & menswear', about: 'Cotton panjabis, casual shirts and polos woven for the tropics. (Fictional demo brand.)', initials: 'PL', logoBg: '#047857', cover: pick('shirt', 0), rating: 4.6, followers: 26700, categories: ['men'], areaId: 'uttara' },
  { id: 'b-shapla', name: 'Shapla Home & Living', tagline: 'Everyday lifestyle essentials', about: 'Audio, drinkware, skincare and fragrance for calm living. (Fictional demo brand.)', initials: 'SH', logoBg: '#0F766E', cover: pick('lifestyle', 3), rating: 4.5, followers: 14300, categories: ['lifestyle'], areaId: 'bashundhara' },
  { id: 'b-neon-rickshaw', name: 'Neon Rickshaw', tagline: 'Loud colours. Louder streets.', about: 'Graphic streetwear inspired by rickshaw art. (Fictional demo brand.)', initials: 'NR', logoBg: '#DB2777', cover: pick('tshirt', 2), rating: 4.3, followers: 33100, categories: ['streetwear'], areaId: 'mirpur' },
  { id: 'b-dhaka-basics', name: 'Dhaka Basics', tagline: 'Wardrobe essentials, fair prices', about: 'Plain tees, chinos and basics at honest prices. (Fictional demo brand.)', initials: 'DB', logoBg: '#334155', cover: pick('tshirt', 0), rating: 4.4, followers: 52000, categories: ['men', 'women'], areaId: 'farmgate' },
]

const C = {
  black: { name: 'Black', hex: '#111827' }, white: { name: 'White', hex: '#F9FAFB' }, navy: { name: 'Navy', hex: '#1E3A8A' },
  maroon: { name: 'Maroon', hex: '#7F1D1D' }, olive: { name: 'Olive', hex: '#4D5B2B' }, beige: { name: 'Beige', hex: '#D6C3A3' },
  grey: { name: 'Grey', hex: '#9CA3AF' }, blue: { name: 'Indigo Blue', hex: '#3B5BA9' }, lightBlue: { name: 'Light Wash', hex: '#93B4DB' },
  pink: { name: 'Blush Pink', hex: '#F9A8D4' }, mustard: { name: 'Mustard', hex: '#CA8A04' }, green: { name: 'Bottle Green', hex: '#065F46' },
  brown: { name: 'Tan Brown', hex: '#92400E' }, red: { name: 'Crimson', hex: '#B91C1C' }, purple: { name: 'Plum', hex: '#6B21A8' },
  orange: { name: 'Sunset Orange', hex: '#EA580C' }, gold: { name: 'Gold', hex: '#D4A017' }, silver: { name: 'Silver', hex: '#C0C0C0' },
  teal: { name: 'Teal', hex: '#0F766E' }, cream: { name: 'Cream', hex: '#FEF3C7' },
} satisfies Record<string, ColorOption>

const S = {
  apparel: ['S', 'M', 'L', 'XL', 'XXL'],
  women: ['XS', 'S', 'M', 'L', 'XL'],
  waist: ['28', '30', '32', '34', '36', '38'],
  shoes: ['39', '40', '41', '42', '43', '44'],
  womenShoes: ['36', '37', '38', '39', '40'],
  one: ['One size'],
  panjabi: ['38', '40', '42', '44', '46'],
}

type P = {
  brand: string; name: string; cat: ShopCategory; sub: string; pool: ImagePool; i: number; price: number; off: number
  desc: string; hl: string[]; sizes: string[]; colors: ColorOption[]; rating: number; reviews: number; stock: number; tags?: string[]
}

const RAW: P[] = [
  // Men
  { brand: 'b-padma', name: 'Handloom Cotton Panjabi', cat: 'men', sub: 'Panjabi', pool: 'shirt', i: 0, price: 2450, off: 15, desc: 'A breathable handloom cotton panjabi with a mandarin collar and subtle self-stripe. Perfect for Jummah, weddings and Eid get-togethers.', hl: ['100% handloom cotton', 'Mandarin collar', 'Regular fit', 'Hand wash recommended'], sizes: S.panjabi, colors: [C.white, C.navy, C.maroon], rating: 4.7, reviews: 412, stock: 34, tags: ['Bestseller'] },
  { brand: 'b-padma', name: 'Linen Blend Casual Shirt', cat: 'men', sub: 'Shirts', pool: 'shirt', i: 1, price: 1890, off: 10, desc: 'Lightweight linen-blend shirt with a relaxed fit that keeps you cool through Dhaka summers.', hl: ['55% linen, 45% cotton', 'Relaxed fit', 'Coconut buttons'], sizes: S.apparel, colors: [C.beige, C.white, C.olive], rating: 4.5, reviews: 238, stock: 52 },
  { brand: 'b-padma', name: 'Piqué Polo Shirt', cat: 'men', sub: 'Polos', pool: 'shirt', i: 3, price: 1290, off: 0, desc: 'Classic piqué polo with ribbed collar and two-button placket.', hl: ['Cotton piqué', 'Ribbed collar', 'Slim fit'], sizes: S.apparel, colors: [C.navy, C.white, C.green, C.maroon], rating: 4.4, reviews: 190, stock: 80 },
  { brand: 'b-dhaka-basics', name: 'Everyday Crew Tee (Pack of 2)', cat: 'men', sub: 'T-Shirts', pool: 'tshirt', i: 0, price: 990, off: 20, desc: 'Soft 180 GSM combed cotton tees — a two-pack of your new daily uniform.', hl: ['180 GSM combed cotton', 'Pre-shrunk', 'Pack of 2'], sizes: S.apparel, colors: [C.white, C.black, C.grey], rating: 4.6, reviews: 1290, stock: 140, tags: ['Bestseller'] },
  { brand: 'b-dhaka-basics', name: 'Stretch Chino Trousers', cat: 'men', sub: 'Trousers', pool: 'jeans', i: 2, price: 1650, off: 12, desc: 'Comfort-stretch chinos with a tapered leg — office to evening.', hl: ['98% cotton, 2% elastane', 'Tapered fit', 'Wrinkle resistant'], sizes: S.waist, colors: [C.beige, C.navy, C.olive, C.black], rating: 4.3, reviews: 342, stock: 61 },
  { brand: 'b-buriganga', name: 'Slim Fit Selvedge Jeans', cat: 'men', sub: 'Jeans', pool: 'jeans', i: 0, price: 3200, off: 18, desc: 'Japanese-style selvedge denim in a slim fit that fades beautifully over time.', hl: ['13.5 oz selvedge denim', 'Slim fit', 'Copper rivets'], sizes: S.waist, colors: [C.blue, C.black], rating: 4.6, reviews: 288, stock: 22 },
  { brand: 'b-buriganga', name: 'Relaxed Light-Wash Jeans', cat: 'men', sub: 'Jeans', pool: 'jeans', i: 1, price: 2400, off: 25, desc: 'Relaxed, vintage-washed denim with a little stretch.', hl: ['Comfort stretch', 'Relaxed fit', 'Vintage wash'], sizes: S.waist, colors: [C.lightBlue, C.blue], rating: 4.4, reviews: 176, stock: 4, tags: ['Low stock'] },
  { brand: 'b-buriganga', name: 'Denim Trucker Jacket', cat: 'men', sub: 'Jackets', pool: 'jacket', i: 1, price: 3900, off: 15, desc: 'The timeless trucker jacket in rigid indigo denim — layer it for Dhaka winters.', hl: ['Rigid denim', 'Button front', 'Chest pockets'], sizes: S.apparel, colors: [C.blue, C.black], rating: 4.5, reviews: 98, stock: 18 },
  // Women
  { brand: 'b-nokshi', name: 'Embroidered Cotton Kurti', cat: 'women', sub: 'Kurtis', pool: 'dress', i: 5, price: 2150, off: 20, desc: 'A-line cotton kurti with hand-embroidered nakshi motifs on the yoke.', hl: ['Pure cotton', 'Hand embroidery', 'A-line silhouette', 'Side pockets'], sizes: S.women, colors: [C.mustard, C.teal, C.pink], rating: 4.8, reviews: 521, stock: 40, tags: ['Bestseller'] },
  { brand: 'b-nokshi', name: 'Jamdani-Inspired Saree', cat: 'women', sub: 'Sarees', pool: 'dress', i: 4, price: 6800, off: 10, desc: 'Lightweight saree with jamdani-inspired woven motifs. Comes with unstitched blouse piece. (Demo listing.)', hl: ['Cotton-silk blend', '5.5 m + blouse piece', 'Woven motifs'], sizes: S.one, colors: [C.red, C.cream, C.purple], rating: 4.9, reviews: 143, stock: 9, tags: ['Premium'] },
  { brand: 'b-nokshi', name: 'Three-Piece Lawn Set', cat: 'women', sub: 'Three-piece', pool: 'dress', i: 0, price: 3450, off: 30, desc: 'Printed lawn kameez, trousers and chiffon orna — unstitched no more, ready to wear.', hl: ['Lawn cotton kameez', 'Chiffon orna', 'Ready to wear'], sizes: S.women, colors: [C.pink, C.green, C.cream], rating: 4.6, reviews: 389, stock: 27, tags: ['Eid edit'] },
  { brand: 'b-nokshi', name: 'Floral Midi Dress', cat: 'women', sub: 'Dresses', pool: 'dress', i: 1, price: 2890, off: 15, desc: 'Flowing floral midi with tie waist and flutter sleeves.', hl: ['Viscose', 'Tie waist', 'Midi length'], sizes: S.women, colors: [C.pink, C.navy], rating: 4.5, reviews: 211, stock: 33 },
  { brand: 'b-dhaka-basics', name: 'Relaxed Linen Co-ord Set', cat: 'women', sub: 'Co-ords', pool: 'dress', i: 2, price: 3150, off: 10, desc: 'Breezy linen shirt and wide-leg trouser set.', hl: ['Linen blend', 'Wide-leg trousers', 'Elastic waist'], sizes: S.women, colors: [C.beige, C.white, C.olive], rating: 4.4, reviews: 97, stock: 0, tags: ['Sold out'] },
  { brand: 'b-buriganga', name: 'High-Rise Mom Jeans', cat: 'women', sub: 'Jeans', pool: 'jeans', i: 1, price: 2550, off: 20, desc: 'High-rise, tapered mom jeans with a vintage wash.', hl: ['High rise', 'Tapered leg', 'Rigid cotton'], sizes: ['26', '28', '30', '32', '34'], colors: [C.lightBlue, C.blue], rating: 4.5, reviews: 264, stock: 38 },
  { brand: 'b-nokshi', name: 'Printed Georgette Orna', cat: 'women', sub: 'Ornas & Scarves', pool: 'dress', i: 3, price: 890, off: 0, desc: 'Soft georgette orna with block-print border.', hl: ['Georgette', '2.5 m length'], sizes: S.one, colors: [C.mustard, C.pink, C.teal, C.white], rating: 4.3, reviews: 77, stock: 64 },
  // Shoes
  { brand: 'b-monsoon', name: 'AirFlow Knit Runner', cat: 'shoes', sub: 'Sneakers', pool: 'sneakers', i: 0, price: 4200, off: 20, desc: 'Featherweight knit runner with a cushioned foam midsole and quick-dry upper — built for humid mornings.', hl: ['Breathable knit upper', 'EVA foam midsole', 'Quick-dry lining', '220 g per shoe'], sizes: S.shoes, colors: [C.black, C.white, C.teal], rating: 4.6, reviews: 642, stock: 45, tags: ['Bestseller'] },
  { brand: 'b-monsoon', name: 'Court Classic Leather Sneaker', cat: 'shoes', sub: 'Sneakers', pool: 'sneakers', i: 3, price: 3600, off: 10, desc: 'Clean white leather court sneaker that goes with literally everything.', hl: ['Faux leather upper', 'Rubber cupsole', 'Padded collar'], sizes: S.shoes, colors: [C.white, C.black], rating: 4.5, reviews: 418, stock: 51 },
  { brand: 'b-monsoon', name: 'Retro Suede Trainer', cat: 'shoes', sub: 'Sneakers', pool: 'sneakers', i: 1, price: 3900, off: 25, desc: '80s-inspired suede trainer with gum sole.', hl: ['Suede overlays', 'Gum rubber sole'], sizes: S.shoes, colors: [C.grey, C.navy, C.beige], rating: 4.4, reviews: 233, stock: 12 },
  { brand: 'b-monsoon', name: 'Monsoon Rain Slides', cat: 'shoes', sub: 'Sandals', pool: 'sneakers', i: 6, price: 990, off: 0, desc: 'Waterproof cushioned slides for rainy days and rooftop hangouts.', hl: ['Waterproof EVA', 'Contoured footbed'], sizes: S.shoes, colors: [C.black, C.olive, C.pink], rating: 4.2, reviews: 512, stock: 120 },
  { brand: 'b-kolpo', name: 'Oxford Leather Formal Shoe', cat: 'shoes', sub: 'Formal', pool: 'formalShoes', i: 0, price: 5600, off: 15, desc: 'Hand-lasted full-grain leather oxfords with a leather sole.', hl: ['Full-grain leather', 'Leather lining', 'Goodyear-style welt (demo)'], sizes: S.shoes, colors: [C.black, C.brown], rating: 4.8, reviews: 301, stock: 20, tags: ['Premium'] },
  { brand: 'b-kolpo', name: 'Suede Chelsea Boots', cat: 'shoes', sub: 'Boots', pool: 'formalShoes', i: 3, price: 6200, off: 20, desc: 'Elastic-gusset chelsea boots in soft suede.', hl: ['Suede upper', 'Pull tab', 'Rubber sole'], sizes: S.shoes, colors: [C.brown, C.black], rating: 4.6, reviews: 122, stock: 7 },
  { brand: 'b-kolpo', name: 'Block Heel Leather Sandal', cat: 'shoes', sub: 'Heels', pool: 'heels', i: 0, price: 2950, off: 10, desc: 'Comfortable 2-inch block heel with padded footbed.', hl: ['Genuine leather straps', '2" block heel', 'Padded insole'], sizes: S.womenShoes, colors: [C.beige, C.black, C.red], rating: 4.5, reviews: 187, stock: 26 },
  { brand: 'b-kolpo', name: 'Embellished Flat Nagra', cat: 'shoes', sub: 'Flats', pool: 'heels', i: 2, price: 1650, off: 0, desc: 'Festive flat nagra with zari embellishment.', hl: ['Zari work', 'Cushioned sole'], sizes: S.womenShoes, colors: [C.gold, C.silver], rating: 4.4, reviews: 96, stock: 30, tags: ['Eid edit'] },
  // Bags
  { brand: 'b-kolpo', name: 'Structured Leather Tote', cat: 'bags', sub: 'Totes', pool: 'bags', i: 0, price: 6900, off: 20, desc: 'Roomy structured tote in pebbled leather with laptop sleeve.', hl: ['Pebbled leather', 'Fits 14" laptop', 'Magnetic closure'], sizes: S.one, colors: [C.brown, C.black, C.beige], rating: 4.7, reviews: 156, stock: 14 },
  { brand: 'b-kolpo', name: 'Mini Crossbody Bag', cat: 'bags', sub: 'Crossbody', pool: 'bags', i: 1, price: 3400, off: 15, desc: 'Compact crossbody with adjustable strap — phone, cards, keys, done.', hl: ['Adjustable strap', 'Zip closure'], sizes: S.one, colors: [C.maroon, C.black, C.cream], rating: 4.5, reviews: 210, stock: 40 },
  { brand: 'b-urban-tiger', name: 'Commuter Backpack 22L', cat: 'bags', sub: 'Backpacks', pool: 'bags', i: 2, price: 2800, off: 25, desc: 'Water-resistant backpack with padded laptop compartment and hidden pocket — CNG-proof.', hl: ['Water-resistant', '15.6" laptop sleeve', 'Anti-theft pocket'], sizes: S.one, colors: [C.black, C.olive, C.grey], rating: 4.6, reviews: 388, stock: 66, tags: ['Bestseller'] },
  { brand: 'b-kolpo', name: 'Bifold Leather Wallet', cat: 'bags', sub: 'Wallets', pool: 'bags', i: 4, price: 1450, off: 0, desc: 'Slim bifold wallet with 6 card slots.', hl: ['Full-grain leather', '6 card slots', 'RFID lining (demo)'], sizes: S.one, colors: [C.brown, C.black], rating: 4.6, reviews: 274, stock: 90 },
  // Accessories
  { brand: 'b-lalbagh', name: 'Heritage Analog Watch', cat: 'accessories', sub: 'Watches', pool: 'watches', i: 0, price: 5400, off: 20, desc: 'Minimal analog watch with sapphire-coated glass and leather strap.', hl: ['Japanese quartz movement', '40 mm case', '3 ATM water resistance'], sizes: S.one, colors: [C.brown, C.black], rating: 4.6, reviews: 189, stock: 23 },
  { brand: 'b-lalbagh', name: 'Steel Chronograph Watch', cat: 'accessories', sub: 'Watches', pool: 'watches', i: 1, price: 7900, off: 15, desc: 'Stainless steel chronograph with date window.', hl: ['Chronograph', 'Steel bracelet', '42 mm'], sizes: S.one, colors: [C.silver, C.gold], rating: 4.5, reviews: 88, stock: 11, tags: ['Premium'] },
  { brand: 'b-lalbagh', name: 'Polarised Aviator Sunglasses', cat: 'accessories', sub: 'Eyewear', pool: 'eyewear', i: 0, price: 1990, off: 30, desc: 'Metal-frame aviators with UV400 polarised lenses.', hl: ['UV400 protection', 'Polarised lenses', 'Case included'], sizes: S.one, colors: [C.gold, C.black], rating: 4.3, reviews: 301, stock: 70 },
  { brand: 'b-lalbagh', name: 'Square Acetate Sunglasses', cat: 'accessories', sub: 'Eyewear', pool: 'eyewear', i: 1, price: 1750, off: 10, desc: 'Bold square acetate frames.', hl: ['Acetate frame', 'UV400'], sizes: S.one, colors: [C.black, C.brown], rating: 4.2, reviews: 144, stock: 39 },
  { brand: 'b-lalbagh', name: 'Oxidised Silver Jhumka', cat: 'accessories', sub: 'Jewellery', pool: 'jewelry', i: 1, price: 850, off: 0, desc: 'Lightweight oxidised jhumkas with bead drops.', hl: ['Oxidised finish', 'Lightweight'], sizes: S.one, colors: [C.silver], rating: 4.6, reviews: 412, stock: 85 },
  { brand: 'b-lalbagh', name: 'Layered Pendant Necklace', cat: 'accessories', sub: 'Jewellery', pool: 'jewelry', i: 0, price: 1250, off: 15, desc: 'Delicate layered chain with crescent pendant.', hl: ['Gold-tone plating', 'Adjustable length'], sizes: S.one, colors: [C.gold, C.silver], rating: 4.4, reviews: 133, stock: 48 },
  // Streetwear
  { brand: 'b-urban-tiger', name: 'Rickshaw Art Oversized Tee', cat: 'streetwear', sub: 'Graphic Tees', pool: 'tshirt', i: 2, price: 1190, off: 15, desc: 'Drop-shoulder tee with a hand-drawn rickshaw art back print.', hl: ['220 GSM heavy cotton', 'Oversized fit', 'Puff print'], sizes: S.apparel, colors: [C.black, C.cream], rating: 4.7, reviews: 803, stock: 95, tags: ['Bestseller'] },
  { brand: 'b-urban-tiger', name: 'Tiger Logo Hoodie', cat: 'streetwear', sub: 'Hoodies', pool: 'hoodie', i: 0, price: 2650, off: 20, desc: 'Heavyweight fleece hoodie with embroidered tiger.', hl: ['380 GSM fleece', 'Embroidered chest logo', 'Kangaroo pocket'], sizes: S.apparel, colors: [C.black, C.grey, C.maroon], rating: 4.6, reviews: 455, stock: 31 },
  { brand: 'b-urban-tiger', name: 'Six-Panel Dad Cap', cat: 'streetwear', sub: 'Caps', pool: 'caps', i: 0, price: 690, off: 0, desc: 'Washed cotton cap with curved brim.', hl: ['Washed cotton', 'Adjustable strap'], sizes: S.one, colors: [C.black, C.beige, C.navy], rating: 4.4, reviews: 266, stock: 110 },
  { brand: 'b-neon-rickshaw', name: 'Neon Bloom Graphic Tee', cat: 'streetwear', sub: 'Graphic Tees', pool: 'tshirt', i: 3, price: 990, off: 10, desc: 'Fluorescent shapla print tee — glows (metaphorically).', hl: ['Cotton jersey', 'Regular fit'], sizes: S.apparel, colors: [C.white, C.black, C.purple], rating: 4.3, reviews: 172, stock: 58 },
  { brand: 'b-neon-rickshaw', name: 'Cargo Joggers', cat: 'streetwear', sub: 'Bottoms', pool: 'jeans', i: 2, price: 1990, off: 20, desc: 'Utility joggers with six pockets and cuffed hem.', hl: ['Cotton twill', 'Elastic cuffs', '6 pockets'], sizes: S.apparel, colors: [C.olive, C.black, C.beige], rating: 4.4, reviews: 208, stock: 44 },
  { brand: 'b-neon-rickshaw', name: 'Varsity Bomber Jacket', cat: 'streetwear', sub: 'Jackets', pool: 'jacket', i: 2, price: 4500, off: 25, desc: 'Wool-blend varsity bomber with chenille patches.', hl: ['Wool blend body', 'Faux leather sleeves', 'Chenille patches'], sizes: S.apparel, colors: [C.maroon, C.navy], rating: 4.5, reviews: 91, stock: 15 },
  { brand: 'b-neon-rickshaw', name: 'Knit Beanie', cat: 'streetwear', sub: 'Caps', pool: 'caps', i: 1, price: 590, off: 0, desc: 'Ribbed knit beanie for chilly December nights.', hl: ['Acrylic rib knit', 'Fold-over cuff'], sizes: S.one, colors: [C.orange, C.black, C.grey], rating: 4.2, reviews: 64, stock: 72 },
  // Lifestyle
  { brand: 'b-shapla', name: 'Noise-Cancelling Headphones', cat: 'lifestyle', sub: 'Audio', pool: 'lifestyle', i: 0, price: 8900, off: 22, desc: 'Over-ear wireless headphones with ANC and 40-hour battery — for when the horns get too loud.', hl: ['Active noise cancelling', '40 h battery', 'USB-C fast charge'], sizes: S.one, colors: [C.black, C.cream], rating: 4.6, reviews: 356, stock: 19, tags: ['Bestseller'] },
  { brand: 'b-shapla', name: 'Portable Bluetooth Speaker', cat: 'lifestyle', sub: 'Audio', pool: 'lifestyle', i: 1, price: 3900, off: 15, desc: 'Splash-proof speaker with punchy bass for rooftop adda.', hl: ['IPX5 splash-proof', '12 h playtime'], sizes: S.one, colors: [C.black, C.teal, C.red], rating: 4.4, reviews: 211, stock: 36 },
  { brand: 'b-shapla', name: 'Insulated Steel Bottle 750ml', cat: 'lifestyle', sub: 'Drinkware', pool: 'lifestyle', i: 2, price: 1290, off: 10, desc: 'Keeps water cold for 24 hours — even in a Dhaka June.', hl: ['Double-wall vacuum', '24 h cold / 12 h hot', 'BPA free'], sizes: S.one, colors: [C.teal, C.black, C.white, C.pink], rating: 4.7, reviews: 690, stock: 150 },
  { brand: 'b-shapla', name: 'Stoneware Mug Set (2)', cat: 'lifestyle', sub: 'Drinkware', pool: 'lifestyle', i: 3, price: 1150, off: 0, desc: 'Hand-glazed stoneware mugs for your morning cha.', hl: ['Stoneware', '350 ml each', 'Microwave safe'], sizes: S.one, colors: [C.cream, C.teal], rating: 4.5, reviews: 132, stock: 47 },
  { brand: 'b-shapla', name: 'Vitamin C Glow Serum', cat: 'lifestyle', sub: 'Skincare', pool: 'lifestyle', i: 5, price: 1450, off: 20, desc: 'Lightweight brightening serum. (Demo product — not a real cosmetic.)', hl: ['30 ml', 'Fragrance free', 'Dermatologist-style packaging'], sizes: S.one, colors: [C.orange], rating: 4.3, reviews: 245, stock: 88 },
  { brand: 'b-shapla', name: 'Oud & Amber Eau de Parfum', cat: 'lifestyle', sub: 'Fragrance', pool: 'lifestyle', i: 7, price: 3450, off: 15, desc: 'Warm oud and amber with a hint of rose. (Demo product.)', hl: ['50 ml EDP', 'Long-lasting'], sizes: S.one, colors: [C.gold], rating: 4.6, reviews: 158, stock: 25 },
  { brand: 'b-shapla', name: 'Smart Fitness Watch', cat: 'lifestyle', sub: 'Wearables', pool: 'watches', i: 3, price: 4990, off: 25, desc: 'AMOLED fitness watch with heart-rate, SpO2 and 10-day battery.', hl: ['1.4" AMOLED', '10-day battery', '5 ATM'], sizes: S.one, colors: [C.black, C.pink, C.silver], rating: 4.4, reviews: 517, stock: 3, tags: ['Low stock'] },
]

const T0 = Date.UTC(2026, 3, 1)

export const SEED_PRODUCTS: Product[] = RAW.map((p, n) => {
  const pl = IMG[p.pool]
  // 3 gallery images: the hero plus two others from the same pool.
  const images = [0, 1, 2].map((k) => pick(p.pool, p.i + k)).filter((v, idx, arr) => arr.indexOf(v) === idx)
  if (images.length < 2 && pl.length) images.push(pl[0])
  return {
    id: `p-${String(n + 1).padStart(3, '0')}`,
    brandId: p.brand,
    name: p.name,
    category: p.cat,
    subcategory: p.sub,
    images,
    price: p.price,
    discountPct: p.off,
    description: p.desc,
    highlights: p.hl,
    sizes: p.sizes,
    colors: p.colors,
    rating: p.rating,
    reviewCount: p.reviews,
    stock: p.stock,
    deliveryHours: 24,
    expressAvailable: p.price < 7000,
    tags: p.tags ?? [],
    createdAt: T0 + n * 36e5 * 20,
  }
})

export const SHOP_CATEGORIES: { id: ShopCategory; label: string; pool: ImagePool; idx: number }[] = [
  { id: 'men', label: "Men's Fashion", pool: 'shirt', idx: 0 },
  { id: 'women', label: "Women's Fashion", pool: 'dress', idx: 0 },
  { id: 'shoes', label: 'Shoes', pool: 'sneakers', idx: 0 },
  { id: 'bags', label: 'Bags', pool: 'bags', idx: 0 },
  { id: 'accessories', label: 'Accessories', pool: 'watches', idx: 0 },
  { id: 'streetwear', label: 'Streetwear', pool: 'hoodie', idx: 0 },
  { id: 'lifestyle', label: 'Lifestyle', pool: 'lifestyle', idx: 0 },
]
