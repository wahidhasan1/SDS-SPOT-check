import type { FoodCategory, MenuItem, MenuOptionGroup, Restaurant } from './types'
import { pick, type ImagePool } from './images'

// All restaurants below are FICTIONAL demo businesses. Replace this module with authorized
// partner data (same shapes) to power a real catalog.

const T0 = Date.UTC(2026, 0, 10)

export const SEED_RESTAURANTS: Restaurant[] = [
  {
    id: 'r-dhaka-grill', name: 'Dhaka Grill House', tagline: 'Charcoal kebabs, naan & late-night platters',
    cuisines: ['Grill', 'Kebab', 'Bangladeshi'], categories: ['grill', 'chicken', 'bangladeshi'], areaId: 'banani',
    address: 'Road 11, Banani', cover: pick('grill', 0), logoBg: '#7C2D12', logoEmoji: '🔥',
    rating: 4.7, reviewCount: 3240, priceLevel: 2, prepMinutes: 18, baseDeliveryFee: 39, minOrder: 300, isOpen: true,
    offer: { label: '20% off · up to ৳120', voucherCode: 'FOOD20' }, tags: ['Popular', 'Top rated'],
    sections: ['Popular', 'Kebabs', 'Platters', 'Breads & Sides', 'Drinks'], createdAt: T0,
  },
  {
    id: 'r-kacchi-corner', name: 'Kacchi Corner', tagline: 'Slow-cooked basmati kacchi with tender mutton',
    cuisines: ['Kacchi', 'Biriyani', 'Bangladeshi'], categories: ['kacchi', 'biriyani', 'bangladeshi'], areaId: 'dhanmondi',
    address: 'Satmasjid Road, Dhanmondi', cover: pick('biriyani', 0), logoBg: '#92400E', logoEmoji: '🍛',
    rating: 4.8, reviewCount: 5120, priceLevel: 2, prepMinutes: 15, baseDeliveryFee: 35, minOrder: 250, isOpen: true,
    offer: { label: 'Free Borhani over ৳800' }, tags: ['Popular', 'Local favourite'],
    sections: ['Popular', 'Kacchi', 'Biriyani & Polao', 'Add-ons', 'Drinks'], createdAt: T0,
  },
  {
    id: 'r-urban-burger', name: 'Urban Burger BD', tagline: 'Smashed patties, toasted brioche, loud sauces',
    cuisines: ['Burger', 'Fast food', 'American'], categories: ['burger', 'chicken', 'snacks'], areaId: 'gulshan-2',
    address: 'Gulshan Avenue, Gulshan 2', cover: pick('burger', 0), logoBg: '#111827', logoEmoji: '🍔',
    rating: 4.6, reviewCount: 4410, priceLevel: 2, prepMinutes: 14, baseDeliveryFee: 45, minOrder: 300, isOpen: true,
    offer: { label: '৳50 off first order', voucherCode: 'WELCOME50' }, tags: ['Popular', 'Free delivery'],
    sections: ['Popular', 'Beef Burgers', 'Chicken Burgers', 'Sides', 'Shakes'], createdAt: T0,
  },
  {
    id: 'r-spice-route', name: 'Spice Route', tagline: 'North Indian curries, tandoor & biriyani',
    cuisines: ['Indian', 'Curry', 'Tandoor'], categories: ['indian', 'chicken', 'biriyani'], areaId: 'uttara',
    address: 'Sector 7, Uttara', cover: pick('curry', 0), logoBg: '#B45309', logoEmoji: '🌶️',
    rating: 4.5, reviewCount: 1870, priceLevel: 2, prepMinutes: 20, baseDeliveryFee: 40, minOrder: 350, isOpen: true,
    tags: ['New'], sections: ['Popular', 'Curries', 'Tandoor', 'Rice & Breads', 'Desserts'], createdAt: T0 + 9e8,
  },
  {
    id: 'r-pizza-district', name: 'Pizza District', tagline: 'Stone-baked pizza, garlic knots & pasta',
    cuisines: ['Pizza', 'Italian', 'Pasta'], categories: ['pizza', 'snacks'], areaId: 'bashundhara',
    address: 'Block C, Bashundhara R/A', cover: pick('pizza', 1), logoBg: '#B91C1C', logoEmoji: '🍕',
    rating: 4.4, reviewCount: 2980, priceLevel: 2, prepMinutes: 22, baseDeliveryFee: 49, minOrder: 400, isOpen: true,
    offer: { label: 'Buy 1 Get 1 on Tuesdays (demo)' }, tags: ['Popular'],
    sections: ['Popular', 'Classic Pizzas', 'Signature Pizzas', 'Pasta', 'Sides & Drinks'], createdAt: T0,
  },
  {
    id: 'r-chaat-co', name: 'Chaat & Co.', tagline: 'Fuchka, chotpoti & Dhaka street snacks',
    cuisines: ['Street food', 'Snacks', 'Bangladeshi'], categories: ['snacks', 'bangladeshi', 'drinks'], areaId: 'mirpur',
    address: 'Section 10, Mirpur', cover: pick('snacks', 1), logoBg: '#CA8A04', logoEmoji: '🥟',
    rating: 4.6, reviewCount: 2210, priceLevel: 1, prepMinutes: 10, baseDeliveryFee: 25, minOrder: 150, isOpen: true,
    offer: { label: 'Free delivery', voucherCode: 'FREEDEL' }, tags: ['Budget friendly', 'Free delivery'],
    sections: ['Popular', 'Fuchka & Chotpoti', 'Rolls & Bites', 'Drinks'], createdAt: T0,
  },
  {
    id: 'r-wok-roll', name: 'Wok & Roll Dhaka', tagline: 'Thai-Chinese wok classics, soups & dumplings',
    cuisines: ['Chinese', 'Thai'], categories: ['chinese', 'chicken'], areaId: 'mohammadpur',
    address: 'Tajmahal Road, Mohammadpur', cover: pick('chinese', 0), logoBg: '#991B1B', logoEmoji: '🥡',
    rating: 4.3, reviewCount: 1640, priceLevel: 2, prepMinutes: 18, baseDeliveryFee: 35, minOrder: 300, isOpen: true,
    offer: { label: '15% off set menus' }, tags: [],
    sections: ['Popular', 'Soups', 'Rice & Noodles', 'Mains', 'Dumplings'], createdAt: T0,
  },
  {
    id: 'r-crispy-coop', name: 'Crispy Coop', tagline: 'Double-crunch fried chicken & wings',
    cuisines: ['Fried chicken', 'Fast food'], categories: ['chicken', 'burger', 'snacks'], areaId: 'mirpur',
    address: 'Mirpur 2, near stadium', cover: pick('chicken', 0), logoBg: '#EA580C', logoEmoji: '🍗',
    rating: 4.5, reviewCount: 3890, priceLevel: 1, prepMinutes: 12, baseDeliveryFee: 30, minOrder: 200, isOpen: true,
    offer: { label: '20% off · up to ৳120', voucherCode: 'FOOD20' }, tags: ['Popular', 'Budget friendly'],
    sections: ['Popular', 'Buckets', 'Wings', 'Sandwiches', 'Sides & Drinks'], createdAt: T0,
  },
  {
    id: 'r-mishti-mahal', name: 'Mishti Mahal', tagline: 'Roshogolla, mishti doi & festive sweets',
    cuisines: ['Desserts', 'Sweets', 'Bangladeshi'], categories: ['desserts', 'bangladeshi'], areaId: 'motijheel',
    address: 'Dilkusha, Motijheel', cover: pick('desserts', 4), logoBg: '#BE185D', logoEmoji: '🍮',
    rating: 4.7, reviewCount: 1420, priceLevel: 1, prepMinutes: 8, baseDeliveryFee: 30, minOrder: 200, isOpen: true,
    tags: ['Local favourite'], sections: ['Popular', 'Traditional Sweets', 'Cakes & Pastries', 'Ice Cream'], createdAt: T0,
  },
  {
    id: 'r-brew-bloom', name: 'Brew & Bloom Café', tagline: 'Specialty coffee, bakes & brunch plates',
    cuisines: ['Café', 'Coffee', 'Bakery'], categories: ['coffee', 'drinks', 'desserts'], areaId: 'gulshan-1',
    address: 'Road 32, Gulshan 1', cover: pick('desserts', 3), logoBg: '#3F2A1E', logoEmoji: '☕',
    rating: 4.6, reviewCount: 980, priceLevel: 3, prepMinutes: 10, baseDeliveryFee: 49, minOrder: 300, isOpen: true,
    offer: { label: '৳100 off orders over ৳600', voucherCode: 'CAFE100' }, tags: ['New'],
    sections: ['Popular', 'Coffee', 'Cold Drinks', 'Bakery', 'Brunch'], createdAt: T0 + 1.2e9,
  },
  {
    id: 'r-old-dhaka', name: 'Old Dhaka Bhoj', tagline: 'Morog polao, bakorkhani & Puran Dhaka classics',
    cuisines: ['Bangladeshi', 'Mughlai'], categories: ['bangladeshi', 'biriyani', 'kacchi'], areaId: 'lalbagh',
    address: 'Lalbagh Road, Old Dhaka', cover: pick('biriyani', 2), logoBg: '#14532D', logoEmoji: '🕌',
    rating: 4.8, reviewCount: 6020, priceLevel: 1, prepMinutes: 16, baseDeliveryFee: 45, minOrder: 250, isOpen: false,
    opensAt: '5:00 PM', tags: ['Top rated', 'Local favourite'],
    sections: ['Popular', 'Polao & Tehari', 'Curries', 'Breads', 'Drinks'], createdAt: T0,
  },
  {
    id: 'r-tokyo-tiffin', name: 'Tokyo Tiffin', tagline: 'Ramen bowls, katsu & rice boxes',
    cuisines: ['Japanese', 'Ramen'], categories: ['japanese', 'chicken'], areaId: 'banani',
    address: 'Road 17, Banani', cover: pick('japanese', 0), logoBg: '#1E3A8A', logoEmoji: '🍜',
    rating: 4.4, reviewCount: 760, priceLevel: 3, prepMinutes: 20, baseDeliveryFee: 55, minOrder: 450, isOpen: true,
    tags: ['New'], sections: ['Popular', 'Ramen', 'Rice Boxes', 'Small Plates'], createdAt: T0 + 1.5e9,
  },
  {
    id: 'r-green-bowl', name: 'Green Bowl', tagline: 'Salads, grain bowls & cold-pressed juice',
    cuisines: ['Healthy', 'Salads'], categories: ['healthy', 'drinks'], areaId: 'dhanmondi',
    address: 'Road 27, Dhanmondi', cover: pick('healthy', 0), logoBg: '#15803D', logoEmoji: '🥗',
    rating: 4.5, reviewCount: 640, priceLevel: 2, prepMinutes: 12, baseDeliveryFee: 35, minOrder: 300, isOpen: true,
    tags: ['Healthy'], sections: ['Popular', 'Bowls', 'Salads', 'Juices'], createdAt: T0,
  },
  {
    id: 'r-shawarma-station', name: 'Shawarma Station', tagline: 'Arabian shawarma, platters & mandi',
    cuisines: ['Arabian', 'Shawarma'], categories: ['arabian', 'chicken', 'grill'], areaId: 'uttara',
    address: 'Sector 4, Uttara', cover: pick('grill', 1), logoBg: '#0F766E', logoEmoji: '🌯',
    rating: 4.3, reviewCount: 1310, priceLevel: 1, prepMinutes: 12, baseDeliveryFee: 30, minOrder: 200, isOpen: true,
    offer: { label: '10% off everything' }, tags: ['Budget friendly'],
    sections: ['Popular', 'Shawarma', 'Platters', 'Sides & Drinks'], createdAt: T0,
  },
]

// ---------- Option templates ----------
const og = (id: string, name: string, required: boolean, type: 'single' | 'multi', options: [string, number][], max?: number): MenuOptionGroup => ({
  id, name, required, type, max,
  options: options.map(([n, p], i) => ({ id: `${id}-${i}`, name: n, price: p })),
})

const OPT = {
  spice: og('spice', 'Spice level', true, 'single', [['Mild', 0], ['Medium', 0], ['Hot', 0], ['Dhaka Hot 🔥', 0]]),
  burgerExtras: og('bx', 'Add extras', false, 'multi', [['Extra cheese', 40], ['Extra patty', 150], ['Jalapeños', 30], ['Fried egg', 35]], 3),
  combo: og('combo', 'Make it a meal', false, 'single', [['No thanks', 0], ['Fries + Coke (250ml)', 120], ['Loaded fries + Shake', 220]]),
  pizzaSize: og('psize', 'Choose size', true, 'single', [['Small 8"', 0], ['Medium 10"', 220], ['Large 12"', 420]]),
  crust: og('crust', 'Crust', true, 'single', [['Classic hand-tossed', 0], ['Thin crust', 0], ['Cheese-stuffed crust', 160]]),
  portion: og('portion', 'Portion', true, 'single', [['Half (1 person)', 0], ['Full (2 persons)', 260]]),
  biriyaniAdd: og('badd', 'Add-ons', false, 'multi', [['Borhani (250ml)', 60], ['Jali kabab', 90], ['Boiled egg', 25], ['Firni', 70]], 4),
  drinkSize: og('dsize', 'Size', true, 'single', [['Regular', 0], ['Large', 60]]),
  milk: og('milk', 'Milk', false, 'single', [['Full cream', 0], ['Oat milk', 70], ['Almond milk', 80]]),
  wings: og('wsauce', 'Sauce', true, 'single', [['Buffalo', 0], ['Honey garlic', 0], ['Naga fire', 0], ['BBQ', 0]]),
  pieces: og('pcs', 'Pieces', true, 'single', [['2 pcs', 0], ['4 pcs', 170], ['8 pcs', 480]]),
  naan: og('naan', 'Add bread', false, 'multi', [['Butter naan', 50], ['Garlic naan', 60], ['Paratha', 35]], 3),
  noodles: og('ntype', 'Protein', true, 'single', [['Chicken', 0], ['Beef', 60], ['Prawn', 120], ['Vegetable', -40]]),
}

type Def = [name: string, description: string, price: number, pool: ImagePool, flags?: string]
// flags: p = popular, s = spicy, v = veg, o:<key,key> = option groups, x:<orig> = original price

function build(rid: string, category: FoodCategory, section: string, defs: Def[], startIdx: number): MenuItem[] {
  return defs.map((d, i) => {
    const [name, description, price, pool, flags = ''] = d
    const optKeys = /o:([\w,]+)/.exec(flags)?.[1]?.split(',') as (keyof typeof OPT)[] | undefined
    const orig = /x:(\d+)/.exec(flags)?.[1]
    return {
      id: `${rid}-${startIdx + i}`,
      restaurantId: rid,
      section,
      name,
      description,
      price,
      originalPrice: orig ? Number(orig) : undefined,
      image: pick(pool, startIdx + i),
      category,
      popular: /(^|\s)p(\s|$)/.test(flags),
      spicy: /(^|\s)s(\s|$)/.test(flags),
      veg: /(^|\s)v(\s|$)/.test(flags),
      options: optKeys?.map((k) => OPT[k]),
      available: true,
    }
  })
}

function menu(rid: string, sections: [section: string, category: FoodCategory, defs: Def[]][]): MenuItem[] {
  let idx = 0
  return sections.flatMap(([section, cat, defs]) => {
    const items = build(rid, cat, section, defs, idx)
    idx += defs.length
    return items
  })
}

export const SEED_MENU: MenuItem[] = [
  ...menu('r-dhaka-grill', [
    ['Kebabs', 'grill', [
      ['Chicken Tikka Kebab', 'Yoghurt-marinated boneless chicken, charcoal-grilled, mint chutney', 320, 'grill', 'p o:spice'],
      ['Beef Seekh Kebab (4 pcs)', 'Minced beef with green chilli & coriander on skewers', 380, 'grill', 's'],
      ['Mutton Boti Kebab', 'Tender mutton cubes, papaya & garam masala marinade', 520, 'grill', 'p s'],
      ['Reshmi Kebab', 'Creamy cashew-marinated chicken, mildly spiced', 340, 'grill'],
      ['Grilled Chicken Quarter', 'Smoky quarter chicken with garlic toum', 290, 'chicken', 'o:spice'],
    ]],
    ['Platters', 'grill', [
      ['Grill House Mixed Platter', 'Tikka, seekh, boti, 2 naan, salad & sauces — feeds 2', 1250, 'grill', 'p x:1450'],
      ['BBQ Family Platter', 'Whole grilled chicken, kebabs, fries, naan — feeds 4', 2350, 'grill'],
    ]],
    ['Breads & Sides', 'bangladeshi', [
      ['Butter Naan', 'Clay-oven naan brushed with butter', 50, 'curry', 'v'],
      ['Garlic Naan', 'Naan with roasted garlic & coriander', 60, 'curry', 'v'],
      ['Chicken Fry Rice', 'Wok-tossed rice with egg & chicken', 260, 'chinese'],
    ]],
    ['Drinks', 'drinks', [
      ['Borhani', 'Spiced yoghurt drink with mint', 70, 'yogurt', 'v'],
      ['Fresh Lime Soda', 'Sweet, salted or mixed', 90, 'drinks', 'v'],
    ]],
  ]),
  ...menu('r-kacchi-corner', [
    ['Kacchi', 'kacchi', [
      ['Basmati Mutton Kacchi', 'Dum-cooked basmati, tender mutton, aloo & mawa — the classic', 450, 'biriyani', 'p o:portion,biriyaniAdd'],
      ['Special Kacchi (with Jali Kabab & Egg)', 'Our signature plate with jali kabab, egg & salad', 590, 'biriyani', 'p o:portion,biriyaniAdd x:650'],
      ['Chinigura Kacchi', 'Aromatic chinigura rice with mutton & ghee', 420, 'biriyani', 'o:portion'],
      ['Kacchi Family Pack (4 persons)', 'Full handi with 8 pcs mutton, 4 eggs, borhani & firni', 1850, 'biriyani'],
    ]],
    ['Biriyani & Polao', 'biriyani', [
      ['Chicken Biriyani', 'Spiced chicken leg on fragrant rice', 320, 'biriyani', 'o:portion,biriyaniAdd'],
      ['Beef Tehari', 'Mustard-oil tehari with diced beef & green chilli', 260, 'biriyani', 'p s'],
      ['Morog Polao', 'Half chicken roast on ghee-scented polao', 380, 'polao'],
    ]],
    ['Add-ons', 'bangladeshi', [
      ['Jali Kabab', 'Pan-fried minced meat patty with egg lace', 90, 'grill'],
      ['Chicken Roast (1 pc)', 'Rich, sweet-savoury wedding-style roast', 180, 'polao'],
      ['Firni', 'Chilled rice pudding with cardamom', 70, 'yogurt', 'v'],
    ]],
    ['Drinks', 'drinks', [
      ['Borhani (500ml)', 'House borhani with mint & black salt', 110, 'yogurt', 'p v'],
      ['Mango Lassi', 'Ripe mango & yoghurt', 140, 'yogurt', 'v'],
    ]],
  ]),
  ...menu('r-urban-burger', [
    ['Beef Burgers', 'burger', [
      ['The Urban Smash', 'Double smashed beef, American cheese, pickles, urban sauce', 450, 'burger', 'p o:combo,burgerExtras'],
      ['Naga Smokehouse', 'Beef patty, naga-chilli mayo, smoked cheddar, crispy onions', 520, 'burger', 'p s o:combo,burgerExtras'],
      ['Mushroom Swiss', 'Sautéed mushrooms, Swiss cheese, garlic aioli', 490, 'burger', 'o:combo,burgerExtras'],
      ['Classic Cheeseburger', 'Single patty, cheese, lettuce, tomato', 350, 'burger', 'o:combo,burgerExtras x:390'],
      ['Triple Threat', 'Three smashed patties, triple cheese — not for the weak', 690, 'burger', 'o:combo,burgerExtras'],
    ]],
    ['Chicken Burgers', 'burger', [
      ['Crispy Chicken Burger', 'Buttermilk fried chicken thigh, slaw, honey mustard', 390, 'burger', 'p o:combo,burgerExtras'],
      ['Grilled Chicken Burger', 'Peri-peri grilled chicken, lettuce, tomato', 370, 'burger', 'o:combo'],
      ['Spicy Zinger Stack', 'Hot crispy fillet, hash brown, jalapeños', 420, 'burger', 's o:combo,burgerExtras'],
    ]],
    ['Sides', 'snacks', [
      ['Loaded Cheese Fries', 'Fries, cheese sauce, beef bits, jalapeños', 290, 'fries', 'p'],
      ['Classic Fries', 'Crispy skin-on fries', 150, 'fries', 'v'],
      ['Onion Rings (8 pcs)', 'Beer-battered style, ranch dip', 190, 'fries', 'v'],
    ]],
    ['Shakes', 'drinks', [
      ['Oreo Thick Shake', 'Vanilla ice cream, cookies, whipped cream', 280, 'drinks'],
      ['Nutella Shake', 'Hazelnut chocolate shake', 320, 'drinks', 'p'],
      ['Strawberry Shake', 'Strawberry & vanilla', 260, 'drinks'],
    ]],
  ]),
  ...menu('r-spice-route', [
    ['Curries', 'indian', [
      ['Butter Chicken', 'Tandoori chicken in silky tomato-butter gravy', 420, 'curry', 'p o:naan'],
      ['Chicken Tikka Masala', 'Charred tikka in spiced masala', 410, 'curry', 'o:naan'],
      ['Mutton Rogan Josh', 'Kashmiri chilli, slow-cooked mutton', 560, 'curry', 's o:naan'],
      ['Paneer Butter Masala', 'Cottage cheese in creamy gravy', 360, 'curry', 'v o:naan'],
      ['Dal Makhani', 'Black lentils simmered overnight', 260, 'curry', 'v'],
    ]],
    ['Tandoor', 'indian', [
      ['Tandoori Chicken (Half)', 'Classic red tandoori, lemon & onion', 380, 'grill', 'p'],
      ['Malai Tikka', 'Cream-cheese marinated chicken', 400, 'grill'],
    ]],
    ['Rice & Breads', 'indian', [
      ['Hyderabadi Chicken Biriyani', 'Dum biriyani with raita', 390, 'biriyani', 'p s'],
      ['Jeera Rice', 'Basmati tempered with cumin', 160, 'polao', 'v'],
      ['Butter Naan', 'Soft clay-oven naan', 55, 'curry', 'v'],
    ]],
    ['Desserts', 'desserts', [
      ['Gulab Jamun (2 pcs)', 'Warm milk dumplings in rose syrup', 120, 'sweets', 'v'],
      ['Kulfi Falooda', 'Pistachio kulfi, vermicelli, rose', 220, 'desserts', 'v'],
    ]],
  ]),
  ...menu('r-pizza-district', [
    ['Classic Pizzas', 'pizza', [
      ['Margherita', 'San Marzano-style tomato, mozzarella, basil', 590, 'pizza', 'v o:pizzaSize,crust'],
      ['Pepperoni Classic', 'Beef pepperoni, mozzarella, oregano', 790, 'pizza', 'p o:pizzaSize,crust'],
      ['Chicken BBQ', 'Smoky BBQ chicken, red onion, cheddar', 750, 'pizza', 'p o:pizzaSize,crust'],
      ['Veggie Supreme', 'Peppers, olives, mushroom, onion, corn', 650, 'pizza', 'v o:pizzaSize,crust'],
    ]],
    ['Signature Pizzas', 'pizza', [
      ['Desi Tikka Pizza', 'Chicken tikka, green chilli, onion, mint mayo', 820, 'pizza', 'p s o:pizzaSize,crust'],
      ['Four Cheese Bomb', 'Mozzarella, cheddar, parmesan, cream cheese', 880, 'pizza', 'o:pizzaSize,crust x:950'],
      ['Beef Kala Bhuna Pizza', 'Chattogram-style kala bhuna beef on a pizza', 890, 'pizza', 's o:pizzaSize,crust'],
    ]],
    ['Pasta', 'snacks', [
      ['Creamy Alfredo Chicken', 'Penne in parmesan cream sauce', 520, 'pasta', 'p'],
      ['Spicy Arrabbiata', 'Tomato, garlic, chilli flakes', 450, 'pasta', 'v s'],
      ['Beef Bolognese', 'Slow-cooked beef ragù, spaghetti', 560, 'pasta'],
    ]],
    ['Sides & Drinks', 'snacks', [
      ['Garlic Knots (6 pcs)', 'Buttery knots with marinara', 220, 'snacks', 'v'],
      ['Cheesy Wedges', 'Potato wedges, cheese sauce', 240, 'fries', 'v'],
      ['Coke (500ml)', 'Chilled soft drink', 80, 'drinks', 'v'],
    ]],
  ]),
  ...menu('r-chaat-co', [
    ['Fuchka & Chotpoti', 'snacks', [
      ['Classic Fuchka (12 pcs)', 'Crisp shells, spiced potato, tamarind water', 120, 'snacks', 'p v s'],
      ['Doi Fuchka (8 pcs)', 'Topped with sweet yoghurt & chaat masala', 150, 'snacks', 'p v'],
      ['Chotpoti', 'Yellow peas, egg, onion, tamarind & chilli', 110, 'snacks', 's'],
      ['Jhalmuri', 'Puffed rice, mustard oil, onion, chilli', 60, 'snacks', 'v s'],
    ]],
    ['Rolls & Bites', 'snacks', [
      ['Chicken Roll', 'Paratha roll with spiced chicken & sauce', 160, 'snacks', 'p'],
      ['Beef Shingara (4 pcs)', 'Crisp pastry with spiced beef', 80, 'snacks'],
      ['Aloo Samosa (4 pcs)', 'Potato & pea samosa', 60, 'snacks', 'v'],
      ['Vegetable Pakora', 'Mixed veg fritters', 90, 'snacks', 'v'],
      ['Haleem Bowl', 'Slow-cooked lentils & beef, fried onions', 180, 'curry', 's'],
    ]],
    ['Drinks', 'drinks', [
      ['Malai Cha', 'Milk tea topped with malai', 50, 'coffee', 'p v'],
      ['Lebu Pani', 'Fresh lemon water with mint', 50, 'drinks', 'v'],
      ['Tamarind Cooler', 'Sweet-sour tetul sherbet', 70, 'drinks', 'v'],
    ]],
  ]),
  ...menu('r-wok-roll', [
    ['Soups', 'chinese', [
      ['Thai Soup (Bowl)', 'Hot & sour, prawn, chicken, lemongrass', 320, 'ramen', 'p s'],
      ['Chicken Corn Soup', 'Silky corn soup with egg drop', 260, 'ramen'],
    ]],
    ['Rice & Noodles', 'chinese', [
      ['Special Fried Rice', 'Egg, chicken, prawn & vegetables', 320, 'chinese', 'p'],
      ['Chow Mein', 'Wok-tossed egg noodles', 290, 'chinese', 'o:noodles'],
      ['Pad Thai', 'Rice noodles, tamarind, peanuts, lime', 350, 'chinese', 'o:noodles'],
      ['Szechuan Noodles', 'Fiery noodles with chilli oil', 310, 'chinese', 's o:noodles'],
    ]],
    ['Mains', 'chinese', [
      ['Chilli Chicken (Dry)', 'Crispy chicken, capsicum, chilli', 380, 'chicken', 'p s'],
      ['Beef Chilli Onion', 'Sliced beef, onion, black pepper sauce', 420, 'chinese'],
      ['Cashew Nut Salad', 'Chicken, cashew, lime dressing', 360, 'healthy'],
      ['Sweet & Sour Prawn', 'Battered prawns, pineapple', 480, 'chinese'],
    ]],
    ['Dumplings', 'chinese', [
      ['Chicken Dumplings (6 pcs)', 'Steamed, soy-chilli dip', 260, 'chinese', 'p'],
      ['Fried Wontons (8 pcs)', 'Crispy wontons, sweet chilli', 240, 'chinese'],
    ]],
  ]),
  ...menu('r-crispy-coop', [
    ['Buckets', 'chicken', [
      ['Crispy Bucket (8 pcs)', 'Signature double-crunch fried chicken', 1190, 'chicken', 'p x:1350'],
      ['Hot & Crispy (2 pcs)', 'Spicy fried chicken with dip', 290, 'chicken', 'p s o:pieces'],
      ['Family Feast', '12 pcs chicken, 4 fries, 1.5L drink', 1990, 'chicken'],
    ]],
    ['Wings', 'chicken', [
      ['Saucy Wings (6 pcs)', 'Tossed in your choice of sauce', 320, 'chicken', 'p o:wings'],
      ['Naga Wings (6 pcs)', 'Bangladeshi naga chilli glaze', 340, 'chicken', 's'],
    ]],
    ['Sandwiches', 'burger', [
      ['Coop Crunch Sandwich', 'Fried fillet, pickles, mayo, brioche', 330, 'burger', 'o:combo'],
      ['Chicken Wrap', 'Tortilla, crispy strips, slaw', 280, 'snacks'],
      ['Popcorn Chicken Box', 'Bite-size chicken, two dips', 250, 'chicken'],
    ]],
    ['Sides & Drinks', 'snacks', [
      ['Spicy Fries', 'Fries dusted with peri-peri', 160, 'fries', 'v s'],
      ['Coleslaw', 'Creamy cabbage slaw', 90, 'healthy', 'v'],
      ['Iced Lemon Tea', 'House-brewed', 120, 'drinks', 'v'],
    ]],
  ]),
  ...menu('r-mishti-mahal', [
    ['Traditional Sweets', 'desserts', [
      ['Roshogolla (1 kg)', 'Spongy chhana balls in light syrup', 420, 'sweets', 'p v'],
      ['Mishti Doi (500g clay pot)', 'Caramelised sweet yoghurt', 180, 'yogurt', 'p v'],
      ['Kalojam (1 kg)', 'Dark fried milk sweets', 450, 'sweets', 'v'],
      ['Chomchom (1 kg)', 'Tangail-style chomchom with mawa', 480, 'sweets', 'v'],
      ['Sandesh (12 pcs)', 'Nolen gur sandesh', 360, 'sweets', 'v'],
    ]],
    ['Cakes & Pastries', 'desserts', [
      ['Chocolate Fudge Cake (1 lb)', 'Rich chocolate layers', 750, 'desserts', 'p'],
      ['Red Velvet Pastry', 'Cream cheese frosting', 180, 'desserts'],
      ['Black Forest Pastry', 'Cherry & chocolate', 160, 'desserts'],
    ]],
    ['Ice Cream', 'desserts', [
      ['Kulfi Malai (2 pcs)', 'Pistachio-cardamom kulfi', 140, 'desserts', 'v'],
      ['Mango Ice Cream Tub', 'Himsagar mango, 500ml', 380, 'desserts', 'v'],
    ]],
  ]),
  ...menu('r-brew-bloom', [
    ['Coffee', 'coffee', [
      ['Flat White', 'Double shot, velvety milk', 260, 'coffee', 'p o:milk'],
      ['Café Latte', 'Espresso & steamed milk', 240, 'coffee', 'o:milk,drinkSize'],
      ['Caramel Macchiato', 'Vanilla, espresso, caramel drizzle', 290, 'coffee', 'o:milk'],
      ['Americano', 'Espresso with hot water', 190, 'coffee', 'v'],
    ]],
    ['Cold Drinks', 'drinks', [
      ['Iced Spanish Latte', 'Condensed milk & espresso over ice', 310, 'coffee', 'p o:milk'],
      ['Cold Brew Tonic', 'Cold brew, tonic, orange', 330, 'drinks'],
      ['Matcha Iced Latte', 'Ceremonial-grade matcha', 340, 'drinks', 'o:milk'],
    ]],
    ['Bakery', 'desserts', [
      ['Butter Croissant', 'Laminated, flaky', 180, 'coffee', 'v'],
      ['Cinnamon Roll', 'Cream cheese glaze', 220, 'desserts', 'p v'],
      ['Chocolate Chip Cookie', 'Brown-butter cookie', 120, 'desserts', 'v'],
    ]],
    ['Brunch', 'healthy', [
      ['Avocado Toast', 'Sourdough, smashed avocado, egg', 450, 'coffee'],
      ['French Toast Stack', 'Brioche, berries, maple', 420, 'coffee', 'v'],
    ]],
  ]),
  ...menu('r-old-dhaka', [
    ['Polao & Tehari', 'bangladeshi', [
      ['Haji-style Beef Biriyani', 'Puran Dhaka style biriyani with mustard oil', 280, 'biriyani', 'p s'],
      ['Morog Polao (Full)', 'Whole-chicken polao with egg', 360, 'polao', 'p'],
      ['Mutton Kacchi', 'Old Dhaka kacchi with aloo', 420, 'biriyani', 'o:portion,biriyaniAdd'],
      ['Beef Tehari', 'Classic tehari with green chilli', 220, 'biriyani'],
    ]],
    ['Curries', 'bangladeshi', [
      ['Beef Kala Bhuna', 'Dark, slow-cooked beef', 380, 'curry', 'p s'],
      ['Chicken Rezala', 'White, creamy Mughlai gravy', 340, 'curry'],
      ['Shorshe Ilish', 'Hilsa in mustard gravy', 520, 'curry', 'p'],
    ]],
    ['Breads', 'bangladeshi', [
      ['Bakorkhani (6 pcs)', 'Flaky Old Dhaka bread', 90, 'snacks', 'v'],
      ['Nan Ruti', 'Tandoori bread', 40, 'curry', 'v'],
    ]],
    ['Drinks', 'drinks', [
      ['Lassi (Old Dhaka style)', 'Thick lassi with malai', 120, 'yogurt', 'p v'],
      ['Rooh Afza Sherbet', 'Rose sherbet with basil seeds', 80, 'drinks', 'v'],
    ]],
  ]),
  ...menu('r-tokyo-tiffin', [
    ['Ramen', 'japanese', [
      ['Chicken Shoyu Ramen', 'Soy broth, chashu chicken, ajitama egg', 650, 'ramen', 'p'],
      ['Spicy Miso Ramen', 'Miso, chilli oil, corn, beef', 720, 'ramen', 'p s'],
      ['Veggie Tantanmen', 'Sesame broth, tofu, greens', 580, 'ramen', 'v'],
    ]],
    ['Rice Boxes', 'japanese', [
      ['Chicken Katsu Curry', 'Panko chicken, Japanese curry, rice', 690, 'curry', 'p'],
      ['Teriyaki Beef Bowl', 'Glazed beef, rice, pickles', 720, 'japanese'],
      ['Salmon Don', 'Torched salmon on rice (demo item)', 890, 'japanese'],
    ]],
    ['Small Plates', 'japanese', [
      ['Gyoza (6 pcs)', 'Pan-fried chicken dumplings', 380, 'chinese', 'p'],
      ['Karaage Chicken', 'Japanese fried chicken, kewpie', 420, 'chicken'],
      ['Edamame', 'Sea salt & chilli', 260, 'healthy', 'v'],
    ]],
  ]),
  ...menu('r-green-bowl', [
    ['Bowls', 'healthy', [
      ['Grilled Chicken Power Bowl', 'Brown rice, chicken, avocado, greens', 520, 'healthy', 'p'],
      ['Falafel Hummus Bowl', 'Falafel, hummus, quinoa, pickles', 480, 'healthy', 'v'],
      ['Teriyaki Tofu Bowl', 'Glazed tofu, edamame, sesame', 450, 'healthy', 'v'],
    ]],
    ['Salads', 'healthy', [
      ['Caesar Salad', 'Romaine, parmesan, croutons, chicken', 420, 'healthy', 'p'],
      ['Greek Salad', 'Feta, olives, cucumber, tomato', 390, 'healthy', 'v'],
      ['Mango Chicken Salad', 'Seasonal mango, chicken, lime', 440, 'healthy'],
    ]],
    ['Juices', 'drinks', [
      ['Green Detox Juice', 'Spinach, apple, cucumber, ginger', 260, 'drinks', 'p v'],
      ['Watermelon Mint Cooler', 'Fresh-pressed', 220, 'drinks', 'v'],
      ['Protein Smoothie', 'Banana, peanut butter, oats', 320, 'drinks', 'v'],
    ]],
  ]),
  ...menu('r-shawarma-station', [
    ['Shawarma', 'arabian', [
      ['Chicken Shawarma', 'Garlic toum, pickles, fries inside', 180, 'snacks', 'p'],
      ['Beef Shawarma', 'Spiced beef, tahini, onion', 220, 'snacks'],
      ['Mexican Shawarma', 'Jalapeño, cheese, chipotle sauce', 230, 'snacks', 's'],
      ['Shawarma Plate', 'Sliced shawarma, rice, salad, sauces', 380, 'grill', 'p'],
    ]],
    ['Platters', 'arabian', [
      ['Chicken Mandi (Half)', 'Smoked mandi rice, roasted chicken', 550, 'biriyani', 'p'],
      ['Mixed Grill Platter', 'Shish tawook, kofta, wings', 690, 'grill'],
      ['Hummus & Pita', 'Creamy hummus, warm pita', 220, 'healthy', 'v'],
    ]],
    ['Sides & Drinks', 'drinks', [
      ['Garlic Fries', 'Fries with toum', 150, 'fries', 'v'],
      ['Mint Lemonade', 'Blended mint & lemon', 140, 'drinks', 'p v'],
      ['Laban Ayran', 'Salted yoghurt drink', 90, 'yogurt', 'v'],
    ]],
  ]),
]

// "Popular" section is virtual: items flagged popular show there in addition to their own section.
export const FOOD_CATEGORIES: { id: FoodCategory; label: string; emoji: string; pool: ImagePool; idx: number }[] = [
  { id: 'burger', label: 'Burger', emoji: '🍔', pool: 'burger', idx: 0 },
  { id: 'pizza', label: 'Pizza', emoji: '🍕', pool: 'pizza', idx: 0 },
  { id: 'kacchi', label: 'Kacchi', emoji: '🍛', pool: 'biriyani', idx: 2 },
  { id: 'biriyani', label: 'Biriyani', emoji: '🍚', pool: 'biriyani', idx: 1 },
  { id: 'chinese', label: 'Chinese', emoji: '🥡', pool: 'chinese', idx: 0 },
  { id: 'chicken', label: 'Chicken', emoji: '🍗', pool: 'chicken', idx: 0 },
  { id: 'desserts', label: 'Desserts', emoji: '🍰', pool: 'desserts', idx: 0 },
  { id: 'snacks', label: 'Snacks', emoji: '🥟', pool: 'snacks', idx: 0 },
  { id: 'drinks', label: 'Drinks', emoji: '🧋', pool: 'drinks', idx: 0 },
  { id: 'coffee', label: 'Coffee', emoji: '☕', pool: 'coffee', idx: 0 },
  { id: 'bangladeshi', label: 'Bangladeshi', emoji: '🍲', pool: 'curry', idx: 1 },
  { id: 'grill', label: 'Grill', emoji: '🍢', pool: 'grill', idx: 1 },
  { id: 'indian', label: 'Indian', emoji: '🌶️', pool: 'curry', idx: 0 },
  { id: 'japanese', label: 'Japanese', emoji: '🍜', pool: 'japanese', idx: 0 },
  { id: 'healthy', label: 'Healthy', emoji: '🥗', pool: 'healthy', idx: 0 },
  { id: 'arabian', label: 'Arabian', emoji: '🌯', pool: 'grill', idx: 2 },
]
