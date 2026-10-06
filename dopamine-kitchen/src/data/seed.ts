import type { Address, AppNotification, Order, OrderItem, Rider, User, Voucher } from './types'
import { SEED_BRANDS, SEED_PRODUCTS } from './products'
import { SEED_MENU, SEED_RESTAURANTS } from './restaurants'
import { areaById } from './areas'
import { discounted, rng } from '../lib/format'
import { foodDelivery, PLATFORM_FEE_FOOD } from '../lib/pricing'
import { STAGE_AT, STAGES, stageForProgress } from '../lib/sim'

const DAY = 864e5

export function seedVouchers(now: number): Voucher[] {
  return [
    { code: 'WELCOME50', title: '৳50 off any order', description: 'A little welcome treat for your next simulated craving.', type: 'flat', value: 50, minOrder: 250, expiresAt: now + 30 * DAY, scope: 'all', categoriesLabel: 'Food & Shopping', active: true },
    { code: 'FIRSTORDER', title: '40% off your first order', description: 'New here? Take 40% off (up to ৳200) on your very first test order.', type: 'percent', value: 40, maxDiscount: 200, minOrder: 300, expiresAt: now + 60 * DAY, scope: 'all', categoriesLabel: 'Food & Shopping', firstOrderOnly: true, active: true },
    { code: 'FOOD20', title: '20% off food', description: 'Up to ৳120 off on any restaurant.', type: 'percent', value: 20, maxDiscount: 120, minOrder: 400, expiresAt: now + 14 * DAY, scope: 'food', categoriesLabel: 'All restaurants', active: true },
    { code: 'SHOP100', title: '৳100 off shopping', description: 'Flat ৳100 off fashion, shoes & lifestyle.', type: 'flat', value: 100, minOrder: 1500, expiresAt: now + 21 * DAY, scope: 'shop', categoriesLabel: 'Fashion, Shoes, Lifestyle', active: true },
    { code: 'FREEDEL', title: 'Free delivery', description: 'Delivery fee waived on food orders.', type: 'freeDelivery', value: 0, minOrder: 200, expiresAt: now + 7 * DAY, scope: 'food', categoriesLabel: 'All restaurants', active: true },
    { code: 'STYLE15', title: '15% off fashion', description: 'Up to ৳500 off clothing & accessories.', type: 'percent', value: 15, maxDiscount: 500, minOrder: 2000, expiresAt: now + 10 * DAY, scope: 'shop', categoriesLabel: "Men's, Women's, Streetwear", active: true },
    { code: 'CAFE100', title: '৳100 off café orders', description: 'For coffee & dessert cravings over ৳600.', type: 'flat', value: 100, minOrder: 600, expiresAt: now + 5 * DAY, scope: 'food', categoriesLabel: 'Cafés & Desserts', active: true },
    { code: 'MIDNIGHT30', title: 'Late-night 30% off', description: 'Up to ৳150 off — for those 1 AM kacchi thoughts.', type: 'percent', value: 30, maxDiscount: 150, minOrder: 350, expiresAt: now + 2 * DAY, scope: 'food', categoriesLabel: 'All restaurants', active: true },
    { code: 'EID25', title: 'Eid special 25% off', description: 'Festive season offer (expired — kept to show the expired state).', type: 'percent', value: 25, maxDiscount: 300, minOrder: 500, expiresAt: now - 3 * DAY, scope: 'all', categoriesLabel: 'Food & Shopping', active: true },
  ]
}

export const SEED_USERS = (now: number): User[] => [
  { id: 'u-ayesha', name: 'Ayesha Rahman', phone: '+8801712345678', email: 'ayesha.demo@example.com', avatarColor: '#7C3AED', joinedAt: now - 210 * DAY, role: 'admin',
    savedPayments: [
      { id: 'pm-1', method: 'bkash', label: 'bKash (test wallet)', masked: '01700-000000' },
      { id: 'pm-2', method: 'card', label: 'Demo Visa', masked: '•••• 4242' },
    ] },
  { id: 'u-tanvir', name: 'Tanvir Hossain', phone: '+8801819876543', email: 'tanvir.demo@example.com', avatarColor: '#EA580C', joinedAt: now - 120 * DAY, role: 'customer',
    savedPayments: [{ id: 'pm-3', method: 'nagad', label: 'Nagad (test wallet)', masked: '01800-000000' }] },
  { id: 'u-nusrat', name: 'Nusrat Jahan', phone: '+8801911223344', email: 'nusrat.demo@example.com', avatarColor: '#DB2777', joinedAt: now - 60 * DAY, role: 'customer', savedPayments: [] },
  { id: 'u-arif', name: 'Arif Chowdhury', phone: '+8801556677889', email: 'arif.demo@example.com', avatarColor: '#0E7490', joinedAt: now - 30 * DAY, role: 'customer', savedPayments: [] },
  { id: 'u-mim', name: 'Sadia Mim', phone: '+8801633445566', email: 'mim.demo@example.com', avatarColor: '#15803D', joinedAt: now - 2 * DAY, role: 'customer', savedPayments: [] },
]

export const SEED_ADDRESSES: Address[] = [
  { id: 'a-1', userId: 'u-ayesha', label: 'Home', recipient: 'Ayesha Rahman', phone: '+8801712345678', areaId: 'banani', house: 'House 24, Flat 5B', road: 'Road 11', block: 'Block F', floor: '5th floor', notes: 'Ring the bell twice. Guard knows me.', isDefault: true },
  { id: 'a-2', userId: 'u-ayesha', label: 'Office', recipient: 'Ayesha Rahman', phone: '+8801712345678', areaId: 'gulshan-1', house: 'Navana Tower (demo), Level 9', road: 'Gulshan Avenue', notes: 'Reception desk on level 9', isDefault: false },
  { id: 'a-3', userId: 'u-ayesha', label: 'Other', recipient: 'Ammu', phone: '+8801711000222', areaId: 'dhanmondi', house: 'House 7', road: 'Road 9/A', isDefault: false },
  { id: 'a-4', userId: 'u-tanvir', label: 'Home', recipient: 'Tanvir Hossain', phone: '+8801819876543', areaId: 'mirpur', house: 'House 18', road: 'Road 3', block: 'Section 10, Block C', isDefault: true },
  { id: 'a-5', userId: 'u-tanvir', label: 'Office', recipient: 'Tanvir Hossain', phone: '+8801819876543', areaId: 'motijheel', house: 'Shapla Bhaban (demo), 4th floor', road: 'Dilkusha C/A', isDefault: false },
  { id: 'a-6', userId: 'u-nusrat', label: 'Home', recipient: 'Nusrat Jahan', phone: '+8801911223344', areaId: 'uttara', house: 'House 45', road: 'Road 12', block: 'Sector 7', isDefault: true },
  { id: 'a-7', userId: 'u-arif', label: 'Home', recipient: 'Arif Chowdhury', phone: '+8801556677889', areaId: 'bashundhara', house: 'House 210', road: 'Road 8', block: 'Block D', isDefault: true },
  { id: 'a-8', userId: 'u-mim', label: 'Home', recipient: 'Sadia Mim', phone: '+8801633445566', areaId: 'mohammadpur', house: 'House 3/2', road: 'Tajmahal Road', isDefault: true },
]

const RIDER_NAMES = ['Rakib Hasan', 'Sohel Rana', 'Jamal Uddin', 'Mithun Das', 'Arafat Hossain', 'Shimul Roy', 'Nayeem Islam', 'Kamrul Ahsan']

export function makeRider(seed: number, kind: 'food' | 'shop'): Rider {
  const r = rng(seed)
  const name = RIDER_NAMES[Math.floor(r() * RIDER_NAMES.length)]
  return {
    name,
    phone: `+8801${'35789'[Math.floor(r() * 5)]}${String(Math.floor(r() * 1e8)).padStart(8, '0')}`,
    vehicle: kind === 'food' ? (r() > 0.25 ? 'Motorbike' : 'Bicycle') : 'Delivery van',
    plate: kind === 'food' ? `Dhaka Metro-HA ${Math.floor(r() * 90 + 10)}-${Math.floor(r() * 9000 + 1000)}` : `Dhaka Metro-NA ${Math.floor(r() * 90 + 10)}-${Math.floor(r() * 9000 + 1000)}`,
    rating: Math.round((4.5 + r() * 0.5) * 10) / 10,
    trips: Math.floor(300 + r() * 4000),
  }
}

/** Builds a fully-formed order object at a given simulated progress. */
export function buildOrder(p: {
  id: string; userId: string; address: Address; kind: 'food' | 'shop'; storeId: string; storeName: string
  items: OrderItem[]; placedAt: number; etaMinutes: number; deliveryFee: number; deliveryLabel: string
  progress: number; payment: Order['paymentMethod']; voucher?: { code: string; discount: number }; cancelled?: boolean; seed: number
}): Order {
  const subtotal = p.items.reduce((s, i) => s + i.unitPrice * i.qty, 0)
  const platformFee = p.kind === 'food' ? PLATFORM_FEE_FOOD : 0
  const discount = p.voucher?.discount ?? 0
  const elapsed = p.progress * p.etaMinutes * 60000
  const stage = stageForProgress(p.progress)
  const stageTimes: Order['stageTimes'] = {}
  for (const s of STAGES) if (p.progress >= STAGE_AT[s]) stageTimes[s] = p.placedAt + STAGE_AT[s] * p.etaMinutes * 60000
  const area = areaById(p.address.areaId)
  return {
    id: p.id, userId: p.userId, kind: p.kind, storeId: p.storeId, storeName: p.storeName, items: p.items,
    subtotal, deliveryFee: p.deliveryFee, platformFee, discount, voucherCode: p.voucher?.code,
    total: Math.max(0, subtotal + p.deliveryFee + platformFee - discount),
    address: { label: p.address.label, recipient: p.address.recipient, phone: p.address.phone, areaId: p.address.areaId,
      line: [p.address.house, p.address.road, p.address.block, `${area.name}, ${area.city} ${area.postcode}`].filter(Boolean).join(', ') },
    paymentMethod: p.payment, paymentRef: `SIM-${(p.seed * 7919).toString(36).toUpperCase().slice(0, 8)}`,
    delivery: { id: 'standard', label: p.deliveryLabel, description: '', fee: p.deliveryFee, etaMinutes: p.etaMinutes },
    placedAt: p.placedAt, etaMinutes: p.etaMinutes, simElapsedMs: p.cancelled ? Math.min(elapsed, 0.05 * p.etaMinutes * 60000) : elapsed,
    lastTickAt: Date.now(), status: p.cancelled ? 'cancelled' : stage, stageTimes: p.cancelled ? { confirmed: p.placedAt } : stageTimes,
    rider: makeRider(p.seed, p.kind), cancelledAt: p.cancelled ? p.placedAt + 3 * 60000 : undefined, isTest: true,
    cravingBefore: p.progress >= 1 ? 4 : undefined, cravingAfter: p.progress >= 1 ? 2 : undefined, rating: p.progress >= 1 ? 5 : undefined,
  }
}

export function seedOrders(now: number, addresses: Address[]): { orders: Order[]; next: number } {
  const orders: Order[] = []
  let no = 10431
  const addr = (uid: string) => addresses.find((a) => a.userId === uid && a.isDefault)!
  const food = (rid: string, picks: [number, number][], uid: string, ago: number, progress: number, payment: Order['paymentMethod'], extra: Partial<{ voucher: { code: string; discount: number }; cancelled: boolean }> = {}) => {
    const r = SEED_RESTAURANTS.find((x) => x.id === rid)!
    const items = picks.map(([idx, qty]) => {
      const m = SEED_MENU.filter((x) => x.restaurantId === rid)[idx]
      return { refId: m.id, name: m.name, image: m.image, qty, unitPrice: m.price }
    })
    const a = addr(uid)
    const d = foodDelivery(r, a.areaId)
    orders.push(buildOrder({ id: `DK-${no++}`, userId: uid, address: a, kind: 'food', storeId: rid, storeName: r.name, items, placedAt: now - ago, etaMinutes: d.eta, deliveryFee: d.fee, deliveryLabel: 'Standard delivery', progress, payment, seed: no, ...extra }))
  }
  const shop = (picks: [string, number, number, number][], uid: string, ago: number, progress: number, payment: Order['paymentMethod'], extra: Partial<{ voucher: { code: string; discount: number } }> = {}) => {
    const items = picks.map(([pid, qty, sizeI, colorI]) => {
      const p = SEED_PRODUCTS.find((x) => x.id === pid)!
      return { refId: p.id, name: p.name, image: p.images[0], qty, unitPrice: discounted(p.price, p.discountPct), size: p.sizes[sizeI] ?? p.sizes[0], color: p.colors[colorI]?.name ?? p.colors[0].name }
    })
    const brand = SEED_BRANDS.find((b) => b.id === SEED_PRODUCTS.find((x) => x.id === picks[0][0])!.brandId)!
    orders.push(buildOrder({ id: `DK-${no++}`, userId: uid, address: addr(uid), kind: 'shop', storeId: brand.id, storeName: brand.name, items, placedAt: now - ago, etaMinutes: 24 * 60, deliveryFee: 60, deliveryLabel: 'Standard (next day)', progress, payment, seed: no, ...extra }))
  }
  const H = 36e5
  // Ayesha — the default demo account: a rich history with every status.
  food('r-kacchi-corner', [[0, 2], [11, 2]], 'u-ayesha', 41 * DAY, 1, 'bkash')
  shop([['p-016', 1, 2, 0]], 'u-ayesha', 33 * DAY, 1, 'card', { voucher: { code: 'SHOP100', discount: 100 } })
  food('r-urban-burger', [[0, 1], [5, 1], [8, 1]], 'u-ayesha', 26 * DAY, 1, 'cod')
  food('r-pizza-district', [[1, 1], [7, 1]], 'u-ayesha', 19 * DAY, 0.03, 'nagad', { cancelled: true })
  food('r-chaat-co', [[0, 2], [11, 2]], 'u-ayesha', 12 * DAY, 1, 'bkash')
  shop([['p-009', 1, 2, 0], ['p-033', 1, 0, 0]], 'u-ayesha', 8 * DAY, 1, 'bkash')
  food('r-brew-bloom', [[4, 1], [8, 2]], 'u-ayesha', 3 * DAY, 1, 'card', { voucher: { code: 'CAFE100', discount: 100 } })
  food('r-dhaka-grill', [[0, 1], [5, 1], [7, 2]], 'u-ayesha', 1 * DAY, 1, 'cod')
  shop([['p-026', 1, 0, 1]], 'u-ayesha', 13 * H, 0.62, 'card')
  food('r-crispy-coop', [[1, 1], [3, 1], [10, 1]], 'u-ayesha', 6 * 60000, 0.22, 'bkash')
  // Other demo users
  food('r-kacchi-corner', [[1, 1], [10, 1]], 'u-tanvir', 15 * DAY, 1, 'nagad')
  food('r-wok-roll', [[2, 1], [6, 1], [10, 1]], 'u-tanvir', 4 * DAY, 1, 'cod', { voucher: { code: 'FOOD20', discount: 120 } })
  shop([['p-034', 2, 1, 0], ['p-036', 1, 0, 1]], 'u-tanvir', 2 * DAY, 1, 'bkash')
  food('r-shawarma-station', [[0, 3], [9, 2]], 'u-tanvir', 10 * 60000, 0.35, 'nagad')
  food('r-green-bowl', [[0, 1], [6, 1]], 'u-nusrat', 9 * DAY, 1, 'card')
  shop([['p-011', 1, 1, 0]], 'u-nusrat', 5 * DAY, 1, 'cod')
  food('r-mishti-mahal', [[0, 1], [1, 2]], 'u-arif', 6 * DAY, 1, 'bkash')
  food('r-spice-route', [[0, 1], [8, 2]], 'u-arif', 20 * DAY, 0.03, 'card', { cancelled: true })
  return { orders, next: no }
}

export function seedNotifications(now: number, orders: Order[]): AppNotification[] {
  const n: AppNotification[] = []
  let i = 0
  const add = (userId: string, type: AppNotification['type'], title: string, body: string, ago: number, read: boolean, link?: string) =>
    n.push({ id: `n-seed-${i++}`, userId, type, title, body, createdAt: now - ago, read, link })
  for (const o of orders) {
    if (o.status === 'delivered')
      add(o.userId, 'order', `${o.id} delivered (simulation)`, `Your test order from ${o.storeName} completed. No real product was delivered.`, now - o.placedAt - o.etaMinutes * 60000, true, `/orders/${o.id}`)
    else if (o.status === 'cancelled') add(o.userId, 'order', `${o.id} cancelled`, `Your test order from ${o.storeName} was cancelled. No money was charged.`, now - (o.cancelledAt ?? o.placedAt), true, `/orders/${o.id}`)
    else add(o.userId, 'order', `${o.id} confirmed`, `${o.storeName} accepted your test order.`, now - o.placedAt, false, `/orders/${o.id}`)
  }
  for (const uid of ['u-ayesha', 'u-tanvir', 'u-nusrat', 'u-arif', 'u-mim']) {
    add(uid, 'voucher', 'New voucher: MIDNIGHT30 🌙', 'Late-night craving? 30% off food (up to ৳150). Expires in 2 days.', 2 * 36e5, false, '/offers')
    add(uid, 'promo', 'Kacchi Week is here 🍛', 'Explore Kacchi Corner and Old Dhaka Bhoj — browse as much as you like, spend nothing.', 26 * 36e5, uid !== 'u-ayesha', '/food?cat=kacchi')
    add(uid, 'promo', 'New drops from Urban Tiger Co.', 'Rickshaw Art oversized tees are back in (simulated) stock.', 3 * 864e5, true, '/store/b-urban-tiger')
    add(uid, 'system', 'Welcome to Dopamine Kitchen', 'Everything here is a simulation: no real payments, orders or deliveries. Enjoy the ride.', 5 * 864e5, true, '/help')
  }
  return n.sort((a, b) => b.createdAt - a.createdAt)
}
