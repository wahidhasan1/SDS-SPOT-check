import { create } from 'zustand'
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware'
import type {
  Address, AppNotification, Brand, CartKind, CartLine, DeliveryMethod, Favorites, MenuItem, Order, OrderItem,
  OrderStatus, PaymentMethodId, Product, RecentItem, Restaurant, RewardEvent, SavedPayment, Settings, User, Voucher,
} from '../data/types'
import { SEED_BRANDS, SEED_PRODUCTS } from '../data/products'
import { SEED_MENU, SEED_RESTAURANTS } from '../data/restaurants'
import { SEED_ADDRESSES, SEED_USERS, makeRider, seedNotifications, seedOrders, seedVouchers } from '../data/seed'
import { areaById } from '../data/areas'
import { checkVoucher, subtotalOf } from '../lib/pricing'
import { STAGE_AT, STAGES, isActive, liveElapsed, progressOf, setSimSpeed, stageForProgress, stageLabel } from '../lib/sim'
import { uid } from '../lib/format'
import { pickSegment, voucherFromSegment, WHEEL_SEGMENTS } from '../lib/rewards'
import { toast } from './toast'

/** localStorage persistence that batches writes: serialising ~250 KB on every state change
 *  made the UI janky, so writes are coalesced and flushed when the page is hidden. */
function batchedStorage<S>(): PersistStorage<S> {
  let pending: { name: string; value: StorageValue<S> } | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  const flush = () => {
    clearTimeout(timer)
    if (!pending) return
    try {
      localStorage.setItem(pending.name, JSON.stringify(pending.value))
    } catch {
      /* storage full or unavailable: the app keeps working in memory */
    }
    pending = null
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush())
  }
  return {
    getItem: (name) => {
      try {
        const raw = localStorage.getItem(name)
        return raw ? (JSON.parse(raw) as StorageValue<S>) : null
      } catch {
        return null
      }
    },
    setItem: (name, value) => {
      pending = { name, value }
      clearTimeout(timer)
      timer = setTimeout(flush, 600)
    },
    removeItem: (name) => {
      try {
        localStorage.removeItem(name)
      } catch {
        /* ignore */
      }
    },
  }
}

export interface DB {
  restaurants: Restaurant[]
  menu: MenuItem[]
  brands: Brand[]
  products: Product[]
  vouchers: Voucher[]
  users: User[]
  addresses: Address[]
  orders: Order[]
  notifications: AppNotification[]
  rewardEvents: RewardEvent[]
  nextOrderNo: number
}

function freshDB(): DB {
  const now = Date.now()
  const addresses = structuredClone(SEED_ADDRESSES)
  const { orders, next } = seedOrders(now, addresses)
  return {
    restaurants: structuredClone(SEED_RESTAURANTS),
    menu: structuredClone(SEED_MENU),
    brands: structuredClone(SEED_BRANDS),
    products: structuredClone(SEED_PRODUCTS),
    vouchers: seedVouchers(now),
    users: SEED_USERS(now),
    addresses,
    orders,
    notifications: seedNotifications(now, orders),
    rewardEvents: [],
    nextOrderNo: next + 40,
  }
}

/** A few recently viewed items so the home page section isn't empty on a first visit. */
const demoRecent = (): RecentItem[] => {
  const now = Date.now()
  return [
    { kind: 'restaurant', id: 'r-kacchi-corner', at: now - 36e5 },
    { kind: 'product', id: 'p-025', at: now - 2 * 36e5 },
    { kind: 'restaurant', id: 'r-urban-burger', at: now - 5 * 36e5 },
    { kind: 'product', id: 'p-032', at: now - 8 * 36e5 },
    { kind: 'product', id: 'p-042', at: now - 20 * 36e5 },
  ]
}

const emptyFav = (): Favorites => ({ restaurants: [], foods: [], products: [], brands: [] })
const demoFav = (): Favorites => ({ restaurants: ['r-kacchi-corner', 'r-urban-burger'], foods: ['r-kacchi-corner-0', 'r-urban-burger-1'], products: ['p-016', 'p-034'], brands: ['b-urban-tiger'] })

export interface PlaceOrderInput {
  kind: CartKind
  addressId: string
  delivery: DeliveryMethod
  payment: PaymentMethodId
  paymentRef: string
  cravingBefore?: number
}

export interface State {
  db: DB
  currentUserId: string | null
  guestAreaId: string
  selectedAddressId: string | null
  cart: CartLine[]
  saved: CartLine[]
  vouchersApplied: Partial<Record<CartKind, string>>
  favorites: Record<string, Favorites>
  recentSearches: string[]
  recentlyViewed: RecentItem[]
  settings: Settings

  // session
  login: (userId: string) => void
  loginWithPhone: (phone: string, name?: string) => string
  logout: () => void
  updateUser: (patch: Partial<User>) => void
  addSavedPayment: (p: Omit<SavedPayment, 'id'>) => void
  removeSavedPayment: (id: string) => void

  // location & addresses
  setGuestArea: (areaId: string) => void
  selectAddress: (id: string) => void
  saveAddress: (a: Omit<Address, 'id' | 'userId'> & { id?: string }) => string
  deleteAddress: (id: string) => void
  setDefaultAddress: (id: string) => void

  // cart
  addToCart: (line: Omit<CartLine, 'key'>) => void
  replaceFoodCart: (line: Omit<CartLine, 'key'>) => void
  setQty: (key: string, qty: number) => void
  removeLine: (key: string) => CartLine | undefined
  restoreLine: (line: CartLine) => void
  saveForLater: (key: string) => void
  moveToCart: (key: string) => { ok: boolean; reason?: string }
  removeSaved: (key: string) => void
  clearCart: (kind: CartKind) => void
  applyVoucher: (kind: CartKind, code: string, deliveryFee: number) => { ok: boolean; error?: string }
  removeVoucher: (kind: CartKind) => void

  // orders
  placeOrder: (input: PlaceOrderInput) => Order
  tick: () => void
  setOrderStatus: (id: string, status: OrderStatus) => void
  advanceOrder: (id: string) => void
  setOrderEta: (id: string, minutes: number) => void
  cancelOrder: (id: string) => void
  patchOrder: (id: string, patch: Partial<Order>) => void
  deleteOrder: (id: string) => void
  createDemoOrder: (p: { userId: string; kind: CartKind; storeId: string; status: OrderStatus; etaMinutes: number }) => Order | null

  // rewards
  /** Spins the one-time welcome wheel for the current user. Returns the existing result if already spun. */
  spinWelcomeWheel: () => { segmentIndex: number; voucher: Voucher; headline: string } | null

  // favourites, recents
  toggleFavorite: (type: keyof Favorites, id: string) => boolean
  addRecentSearch: (q: string) => void
  clearRecentSearches: () => void
  addRecentlyViewed: (kind: RecentItem['kind'], id: string) => void
  clearRecentlyViewed: () => void

  // notifications
  notify: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
  clearNotifications: () => void

  updateSettings: (s: Partial<Settings>) => void

  // admin
  upsertRestaurant: (r: Restaurant) => void
  deleteRestaurant: (id: string) => void
  upsertMenuItem: (m: MenuItem) => void
  deleteMenuItem: (id: string) => void
  upsertProduct: (p: Product) => void
  deleteProduct: (id: string) => void
  upsertVoucher: (v: Voucher) => void
  deleteVoucher: (code: string) => void
  addUser: (u: Omit<User, 'id' | 'joinedAt' | 'savedPayments'>) => string
  deleteUser: (id: string) => void
  resetDemo: () => void
}

const lineKey = (l: Omit<CartLine, 'key'>) =>
  [l.kind, l.refId, l.size ?? '', l.color ?? '', (l.optionLabels ?? []).join('|')].join('::')

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const patchDB = (fn: (db: DB) => Partial<DB>) => set((s) => ({ db: { ...s.db, ...fn(s.db) } }))
      const me = () => get().currentUserId

      const pushNotification = (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>, createdAt = Date.now()) =>
        patchDB((db) => ({ notifications: [{ ...n, id: uid('n'), createdAt, read: false }, ...db.notifications].slice(0, 300) }))

      const stageNotice = (o: Order, stage: OrderStatus) => {
        const label = stageLabel(o.kind, stage)
        const body =
          stage === 'delivered'
            ? `Simulation complete — no real product was delivered. Your craving rode the full journey.`
            : stage === 'picked_up'
              ? `${o.rider.name} picked up your test order from ${o.storeName}.`
              : stage === 'on_the_way'
                ? `${o.kind === 'food' ? o.rider.name : 'The courier'} is on the way to ${o.address.label.toLowerCase()}.`
                : stage === 'cancelled'
                  ? 'Your test order was cancelled. Nothing was charged.'
                  : label.detail
        if (get().settings.notifyOrders) pushNotification({ userId: o.userId, type: 'order', title: `${o.id} · ${label.title}`, body, link: `/orders/${o.id}` })
        // Skip the toast when the user is already watching this order's tracking screen.
        const watching = typeof window !== 'undefined' && window.location.hash.startsWith(`#/orders/${o.id}`)
        if (o.userId === me() && !watching) toast(stage === 'delivered' ? 'success' : 'info', `${label.title} · ${o.id}`, body)
      }

      const updateOrder = (id: string, fn: (o: Order) => Order) =>
        patchDB((db) => ({ orders: db.orders.map((o) => (o.id === id ? fn(o) : o)) }))

      /** Move an order to an exact progress value, recording stage times + notifications. */
      const jumpTo = (id: string, progress: number) => {
        const o = get().db.orders.find((x) => x.id === id)
        if (!o || o.status === 'cancelled') return
        const target = stageForProgress(progress)
        const now = Date.now()
        const stageTimes = { ...o.stageTimes }
        for (const s of STAGES) if (STAGE_AT[s] <= progress && !stageTimes[s]) stageTimes[s] = now
        for (const s of STAGES) if (STAGE_AT[s] > progress) delete stageTimes[s]
        updateOrder(id, (x) => ({ ...x, simElapsedMs: progress * x.etaMinutes * 60000, status: target, stageTimes, lastTickAt: now }))
        if (target !== o.status) stageNotice(o, target)
      }

      return {
        db: freshDB(),
        currentUserId: null,
        guestAreaId: 'banani',
        selectedAddressId: null,
        cart: [],
        saved: [],
        vouchersApplied: {},
        favorites: { 'u-ayesha': demoFav() },
        recentSearches: ['kacchi', 'burger', 'sneakers'],
        recentlyViewed: demoRecent(),
        settings: { simSpeed: 1, lang: 'en', mindfulCheckIn: true, notifyOrders: true, notifyPromos: true },

        login: (userId) => {
          const def = get().db.addresses.find((a) => a.userId === userId && a.isDefault) ?? get().db.addresses.find((a) => a.userId === userId)
          set((s) => ({ currentUserId: userId, selectedAddressId: def?.id ?? null, vouchersApplied: {}, favorites: s.favorites[userId] ? s.favorites : { ...s.favorites, [userId]: emptyFav() } }))
        },
        loginWithPhone: (phone, name) => {
          const existing = get().db.users.find((u) => u.phone === phone)
          if (existing) {
            get().login(existing.id)
            return existing.id
          }
          const id = get().addUser({ name: name || 'Demo Guest', phone, email: '', avatarColor: '#0A7F57', role: 'customer' })
          get().login(id)
          pushNotification({ userId: id, type: 'voucher', title: 'Your FIRSTORDER voucher is ready 🎁', body: '40% off (up to ৳200) your first simulated order.', link: '/offers' })
          return id
        },
        logout: () => set({ currentUserId: null, selectedAddressId: null, cart: [], saved: [], vouchersApplied: {} }),
        updateUser: (patch) => patchDB((db) => ({ users: db.users.map((u) => (u.id === me() ? { ...u, ...patch } : u)) })),
        addSavedPayment: (p) => patchDB((db) => ({ users: db.users.map((u) => (u.id === me() ? { ...u, savedPayments: [...u.savedPayments, { ...p, id: uid('pm') }] } : u)) })),
        removeSavedPayment: (id) => patchDB((db) => ({ users: db.users.map((u) => (u.id === me() ? { ...u, savedPayments: u.savedPayments.filter((p) => p.id !== id) } : u)) })),

        setGuestArea: (areaId) => set({ guestAreaId: areaId, selectedAddressId: null }),
        selectAddress: (id) => set({ selectedAddressId: id }),
        saveAddress: (a) => {
          const userId = me()
          if (!userId) return ''
          const id = a.id ?? uid('a')
          patchDB((db) => {
            let list = db.addresses.filter((x) => x.id !== id)
            const mine = list.filter((x) => x.userId === userId)
            const isDefault = a.isDefault || mine.length === 0
            if (isDefault) list = list.map((x) => (x.userId === userId ? { ...x, isDefault: false } : x))
            const existing = db.addresses.find((x) => x.id === id)
            const rec: Address = { ...a, id, userId, isDefault }
            const idx = existing ? db.addresses.findIndex((x) => x.id === id) : -1
            if (idx >= 0) list.splice(Math.min(idx, list.length), 0, rec)
            else list.push(rec)
            return { addresses: list }
          })
          return id
        },
        deleteAddress: (id) => {
          const userId = me()
          patchDB((db) => {
            const removed = db.addresses.find((a) => a.id === id)
            let list = db.addresses.filter((a) => a.id !== id)
            if (removed?.isDefault) {
              const first = list.find((a) => a.userId === userId)
              if (first) list = list.map((a) => (a.id === first.id ? { ...a, isDefault: true } : a))
            }
            return { addresses: list }
          })
          if (get().selectedAddressId === id) {
            const next = get().db.addresses.find((a) => a.userId === userId && a.isDefault)
            set({ selectedAddressId: next?.id ?? null })
          }
        },
        setDefaultAddress: (id) =>
          patchDB((db) => ({ addresses: db.addresses.map((a) => (a.userId === me() ? { ...a, isDefault: a.id === id } : a)) })),

        addToCart: (line) => {
          const key = lineKey(line)
          set((s) => {
            const ex = s.cart.find((l) => l.key === key)
            if (ex) return { cart: s.cart.map((l) => (l.key === key ? { ...l, qty: Math.min(20, l.qty + line.qty) } : l)) }
            return { cart: [...s.cart, { ...line, key }] }
          })
        },
        replaceFoodCart: (line) => {
          set((s) => ({ cart: [...s.cart.filter((l) => l.kind !== 'food'), { ...line, key: lineKey(line) }], vouchersApplied: { ...s.vouchersApplied, food: undefined } }))
        },
        setQty: (key, qty) => set((s) => ({ cart: qty <= 0 ? s.cart.filter((l) => l.key !== key) : s.cart.map((l) => (l.key === key ? { ...l, qty: Math.min(20, qty) } : l)) })),
        removeLine: (key) => {
          const l = get().cart.find((x) => x.key === key)
          set((s) => ({ cart: s.cart.filter((x) => x.key !== key) }))
          return l
        },
        restoreLine: (line) => set((s) => ({ cart: s.cart.some((l) => l.key === line.key) ? s.cart : [...s.cart, line] })),
        saveForLater: (key) =>
          set((s) => {
            const l = s.cart.find((x) => x.key === key)
            if (!l) return {}
            return { cart: s.cart.filter((x) => x.key !== key), saved: [l, ...s.saved.filter((x) => x.key !== key)] }
          }),
        moveToCart: (key) => {
          const s = get()
          const l = s.saved.find((x) => x.key === key)
          if (!l) return { ok: false }
          const foodStore = s.cart.find((x) => x.kind === 'food')?.storeId
          if (l.kind === 'food' && foodStore && foodStore !== l.storeId) return { ok: false, reason: 'Your food cart has items from another restaurant.' }
          set({ saved: s.saved.filter((x) => x.key !== key) })
          get().addToCart(l)
          return { ok: true }
        },
        removeSaved: (key) => set((s) => ({ saved: s.saved.filter((x) => x.key !== key) })),
        clearCart: (kind) => set((s) => ({ cart: s.cart.filter((l) => l.kind !== kind), vouchersApplied: { ...s.vouchersApplied, [kind]: undefined } })),
        applyVoucher: (kind, code, deliveryFee) => {
          const s = get()
          const c = code.trim().toUpperCase()
          const v = s.db.vouchers.find((x) => x.code === c)
          const lines = s.cart.filter((l) => l.kind === kind)
          const res = checkVoucher(v, kind, subtotalOf(lines), deliveryFee, { now: Date.now(), isFirstOrder: !s.db.orders.some((o) => o.userId === s.currentUserId && o.status !== 'cancelled'), userId: s.currentUserId })
          if (!res.ok) return { ok: false, error: res.error }
          set({ vouchersApplied: { ...s.vouchersApplied, [kind]: c } })
          return { ok: true }
        },
        removeVoucher: (kind) => set((s) => ({ vouchersApplied: { ...s.vouchersApplied, [kind]: undefined } })),

        placeOrder: (input) => {
          const s = get()
          const userId = s.currentUserId!
          const lines = s.cart.filter((l) => l.kind === input.kind)
          const addr = s.db.addresses.find((a) => a.id === input.addressId)!
          const area = areaById(addr.areaId)
          const storeId = lines[0].storeId
          const storeName =
            input.kind === 'food'
              ? s.db.restaurants.find((r) => r.id === storeId)?.name ?? 'Restaurant'
              : (() => {
                  const brands = [...new Set(lines.map((l) => l.storeId))]
                  const first = s.db.brands.find((b) => b.id === brands[0])?.name ?? 'Store'
                  return brands.length > 1 ? `${first} + ${brands.length - 1} more` : first
                })()
          const subtotal = subtotalOf(lines)
          const platformFee = input.kind === 'food' ? 9 : 0
          const code = s.vouchersApplied[input.kind]
          const v = code ? s.db.vouchers.find((x) => x.code === code) : undefined
          const vr = v ? checkVoucher(v, input.kind, subtotal, input.delivery.fee, { now: Date.now(), isFirstOrder: !s.db.orders.some((o) => o.userId === userId && o.status !== 'cancelled'), userId }) : null
          const discount = vr && vr.ok ? vr.discount : 0
          const now = Date.now()
          const id = `DK-${s.db.nextOrderNo}`
          const items: OrderItem[] = lines.map((l) => ({ refId: l.refId, name: l.name, image: l.image, qty: l.qty, unitPrice: l.unitPrice, optionLabels: l.optionLabels, size: l.size, color: l.color }))
          const order: Order = {
            id, userId, kind: input.kind, storeId, storeName, items, subtotal,
            deliveryFee: input.delivery.fee, platformFee, discount, voucherCode: vr && vr.ok ? code : undefined,
            total: Math.max(0, subtotal + input.delivery.fee + platformFee - discount),
            address: { label: addr.label, recipient: addr.recipient, phone: addr.phone, areaId: addr.areaId,
              line: [addr.house, addr.road, addr.block, `${area.name}, ${area.city} ${area.postcode}`].filter(Boolean).join(', ') },
            paymentMethod: input.payment, paymentRef: input.paymentRef, delivery: input.delivery,
            placedAt: now, etaMinutes: input.delivery.etaMinutes, simElapsedMs: 0, lastTickAt: now,
            status: 'confirmed', stageTimes: { confirmed: now }, rider: makeRider(now % 100000, input.kind),
            cravingBefore: input.cravingBefore, isTest: true,
          }
          const usedCode = vr && vr.ok && v?.ownerId ? v.code : null
          set((st) => ({
            db: {
              ...st.db,
              orders: [order, ...st.db.orders],
              nextOrderNo: st.db.nextOrderNo + 1 + Math.floor(Math.random() * 3),
              vouchers: usedCode ? st.db.vouchers.map((x) => (x.code === usedCode ? { ...x, usedAt: now, usedOnOrder: id } : x)) : st.db.vouchers,
            },
            cart: st.cart.filter((l) => l.kind !== input.kind),
            vouchersApplied: { ...st.vouchersApplied, [input.kind]: undefined },
          }))
          pushNotification({ userId, type: 'order', title: `${id} · Order Confirmed`, body: `${storeName} accepted your test order. Nothing was charged.`, link: `/orders/${id}` })
          return order
        },

        tick: () => {
          // Progress is derived from the clock; only commit when an order reaches a new stage.
          const s = get()
          const now = Date.now()
          const changes: [Order, OrderStatus][] = []
          const orders = s.db.orders.map((o) => {
            if (!isActive(o)) return o
            const p = progressOf(o, now)
            const st = stageForProgress(p)
            if (st === o.status) return o
            const stageTimes = { ...o.stageTimes }
            for (const x of STAGES) if (STAGE_AT[x] <= p && !stageTimes[x]) stageTimes[x] = now
            changes.push([o, st])
            return { ...o, simElapsedMs: liveElapsed(o, now), lastTickAt: now, status: st, stageTimes }
          })
          if (!changes.length) return
          set({ db: { ...s.db, orders } })
          for (const [o, st] of changes) stageNotice(o, st)
        },
        setOrderStatus: (id, status) => {
          if (status === 'cancelled') return get().cancelOrder(id)
          const o = get().db.orders.find((x) => x.id === id)
          if (o?.status === 'cancelled') updateOrder(id, (x) => ({ ...x, status: 'confirmed', cancelledAt: undefined }))
          jumpTo(id, STAGE_AT[status] + (status === 'delivered' ? 0 : 0.001))
        },
        advanceOrder: (id) => {
          const o = get().db.orders.find((x) => x.id === id)
          if (!o || !isActive(o)) return
          const idx = STAGES.indexOf(o.status as (typeof STAGES)[number])
          const nxt = STAGES[Math.min(STAGES.length - 1, idx + 1)]
          jumpTo(id, STAGE_AT[nxt] + (nxt === 'delivered' ? 0 : 0.001))
        },
        setOrderEta: (id, minutes) => {
          const m = Math.max(1, Math.round(minutes))
          updateOrder(id, (o) => {
            // Keep the current progress fraction so the stage doesn't jump unexpectedly.
            const p = progressOf(o)
            return { ...o, etaMinutes: m, simElapsedMs: p * m * 60000, lastTickAt: Date.now() }
          })
        },
        cancelOrder: (id) => {
          const o = get().db.orders.find((x) => x.id === id)
          if (!o || o.status === 'cancelled') return
          updateOrder(id, (x) => ({ ...x, status: 'cancelled', cancelledAt: Date.now() }))
          stageNotice(o, 'cancelled')
        },
        patchOrder: (id, patch) => updateOrder(id, (o) => ({ ...o, ...patch })),
        deleteOrder: (id) => patchDB((db) => ({ orders: db.orders.filter((o) => o.id !== id) })),
        createDemoOrder: ({ userId, kind, storeId, status, etaMinutes }) => {
          const s = get()
          const addr = s.db.addresses.find((a) => a.userId === userId && a.isDefault) ?? s.db.addresses.find((a) => a.userId === userId)
          if (!addr) return null
          const pool =
            kind === 'food'
              ? s.db.menu.filter((m) => m.restaurantId === storeId).map((m) => ({ refId: m.id, name: m.name, image: m.image, unitPrice: m.price }))
              : s.db.products.filter((p) => p.brandId === storeId).map((p) => ({ refId: p.id, name: p.name, image: p.images[0], unitPrice: Math.round((p.price * (100 - p.discountPct)) / 100 / 5) * 5, size: p.sizes[0], color: p.colors[0]?.name }))
          if (!pool.length) return null
          const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(pool.length, 1 + Math.floor(Math.random() * 3)))
          const items: OrderItem[] = picks.map((p) => ({ ...p, qty: 1 + Math.floor(Math.random() * 2) }))
          const area = areaById(addr.areaId)
          const subtotal = items.reduce((a, i) => a + i.unitPrice * i.qty, 0)
          const fee = kind === 'food' ? 45 : 60
          const now = Date.now()
          const id = `DK-${s.db.nextOrderNo}`
          const storeName = kind === 'food' ? s.db.restaurants.find((r) => r.id === storeId)?.name ?? '' : s.db.brands.find((b) => b.id === storeId)?.name ?? ''
          const order: Order = {
            id, userId, kind, storeId, storeName, items, subtotal, deliveryFee: fee, platformFee: kind === 'food' ? 9 : 0, discount: 0,
            total: subtotal + fee + (kind === 'food' ? 9 : 0),
            address: { label: addr.label, recipient: addr.recipient, phone: addr.phone, areaId: addr.areaId, line: [addr.house, addr.road, `${area.name}, ${area.city} ${area.postcode}`].join(', ') },
            paymentMethod: 'cod', paymentRef: `SIM-ADMIN-${now.toString(36).toUpperCase().slice(-5)}`,
            delivery: { id: 'standard', label: 'Standard delivery', description: 'Created from admin panel', fee, etaMinutes },
            placedAt: now, etaMinutes, simElapsedMs: 0, lastTickAt: now, status: 'confirmed', stageTimes: { confirmed: now },
            rider: makeRider(now % 99991, kind), isTest: true,
          }
          set((st) => ({ db: { ...st.db, orders: [order, ...st.db.orders], nextOrderNo: st.db.nextOrderNo + 1 } }))
          pushNotification({ userId, type: 'order', title: `${id} · Order Confirmed`, body: `Demo order created by the control panel for ${storeName}.`, link: `/orders/${id}` })
          if (status !== 'confirmed') get().setOrderStatus(id, status)
          return get().db.orders.find((o) => o.id === id) ?? order
        },

        spinWelcomeWheel: () => {
          const s = get()
          const userId = s.currentUserId
          if (!userId) return null
          const prior = s.db.rewardEvents.find((e) => e.userId === userId && e.kind === 'welcome_spin')
          if (prior) {
            const v = s.db.vouchers.find((x) => x.code === prior.voucherCode)
            const idx = Math.max(0, WHEEL_SEGMENTS.findIndex((g) => g.id === prior.id.split(':')[1]))
            return v ? { segmentIndex: idx, voucher: v, headline: prior.title } : null
          }
          const forced = WHEEL_SEGMENTS.findIndex((g) => g.id === s.settings.nextSpin)
          const segmentIndex = forced >= 0 ? forced : pickSegment()
          if (forced >= 0) set((st) => ({ settings: { ...st.settings, nextSpin: null } }))
          const { voucher, headline } = voucherFromSegment(WHEEL_SEGMENTS[segmentIndex], userId)
          const ev: RewardEvent = { id: `${uid('rw')}:${WHEEL_SEGMENTS[segmentIndex].id}`, userId, kind: 'welcome_spin', title: headline, voucherCode: voucher.code, at: Date.now() }
          patchDB((db) => ({ vouchers: [voucher, ...db.vouchers], rewardEvents: [ev, ...db.rewardEvents] }))
          pushNotification({ userId, type: 'voucher', title: `You won ${headline}`, body: `Voucher ${voucher.code} is in My vouchers. Valid for 14 days.`, link: '/account/vouchers' })
          return { segmentIndex, voucher, headline }
        },

        toggleFavorite: (type, id) => {
          const userId = me() ?? 'guest'
          const fav = get().favorites[userId] ?? emptyFav()
          const has = fav[type].includes(id)
          const next = { ...fav, [type]: has ? fav[type].filter((x) => x !== id) : [id, ...fav[type]] }
          set((s) => ({ favorites: { ...s.favorites, [userId]: next } }))
          return !has
        },
        addRecentSearch: (q) => {
          const t = q.trim()
          if (!t) return
          set((s) => ({ recentSearches: [t, ...s.recentSearches.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8) }))
        },
        clearRecentSearches: () => set({ recentSearches: [] }),
        addRecentlyViewed: (kind, id) =>
          set((s) => ({ recentlyViewed: [{ kind, id, at: Date.now() }, ...s.recentlyViewed.filter((r) => !(r.kind === kind && r.id === id))].slice(0, 16) })),
        clearRecentlyViewed: () => set({ recentlyViewed: [] }),

        notify: (n) => pushNotification(n),
        markRead: (id) => patchDB((db) => ({ notifications: db.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
        markAllRead: () => patchDB((db) => ({ notifications: db.notifications.map((n) => (n.userId === me() ? { ...n, read: true } : n)) })),
        clearNotifications: () => patchDB((db) => ({ notifications: db.notifications.filter((n) => n.userId !== me()) })),

        updateSettings: (patch) => {
          if (patch.simSpeed && patch.simSpeed !== get().settings.simSpeed) {
            // Lock in progress made at the old speed before switching.
            const now = Date.now()
            patchDB((db) => ({ orders: db.orders.map((o) => (isActive(o) ? { ...o, simElapsedMs: liveElapsed(o, now), lastTickAt: now } : o)) }))
            setSimSpeed(patch.simSpeed)
          }
          set((s) => ({ settings: { ...s.settings, ...patch } }))
        },

        upsertRestaurant: (r) => patchDB((db) => ({ restaurants: db.restaurants.some((x) => x.id === r.id) ? db.restaurants.map((x) => (x.id === r.id ? r : x)) : [r, ...db.restaurants] })),
        deleteRestaurant: (id) => patchDB((db) => ({ restaurants: db.restaurants.filter((r) => r.id !== id), menu: db.menu.filter((m) => m.restaurantId !== id) })),
        upsertMenuItem: (m) => patchDB((db) => ({ menu: db.menu.some((x) => x.id === m.id) ? db.menu.map((x) => (x.id === m.id ? m : x)) : [...db.menu, m] })),
        deleteMenuItem: (id) => patchDB((db) => ({ menu: db.menu.filter((m) => m.id !== id) })),
        upsertProduct: (p) => patchDB((db) => ({ products: db.products.some((x) => x.id === p.id) ? db.products.map((x) => (x.id === p.id ? p : x)) : [p, ...db.products] })),
        deleteProduct: (id) => patchDB((db) => ({ products: db.products.filter((p) => p.id !== id) })),
        upsertVoucher: (v) => patchDB((db) => ({ vouchers: db.vouchers.some((x) => x.code === v.code) ? db.vouchers.map((x) => (x.code === v.code ? v : x)) : [v, ...db.vouchers] })),
        deleteVoucher: (code) => patchDB((db) => ({ vouchers: db.vouchers.filter((v) => v.code !== code) })),
        addUser: (u) => {
          const id = uid('u')
          patchDB((db) => ({ users: [...db.users, { ...u, id, joinedAt: Date.now(), savedPayments: [] }] }))
          return id
        },
        deleteUser: (id) => {
          patchDB((db) => ({ users: db.users.filter((u) => u.id !== id), addresses: db.addresses.filter((a) => a.userId !== id), orders: db.orders.filter((o) => o.userId !== id) }))
          if (me() === id) get().logout()
        },
        resetDemo: () =>
          set({
            db: freshDB(), currentUserId: 'u-ayesha', selectedAddressId: 'a-1', guestAreaId: 'banani', cart: [], saved: [], vouchersApplied: {},
            favorites: { 'u-ayesha': demoFav() }, recentSearches: ['kacchi', 'burger', 'sneakers'], recentlyViewed: demoRecent(),
          }),
      }
    },
    {
      name: 'pikk-v1',
      version: 3,
      // v2 bundled the catalog photos locally and refreshed the shop catalog; v3 added extra gallery views.
      // Both reseed the demo data and keep settings/session.
      migrate: (persisted, version) => {
        const p = persisted as Partial<State>
        if (version < 3) return { ...p, db: freshDB(), cart: [], saved: [], vouchersApplied: {}, recentlyViewed: demoRecent() } as unknown as State
        return p as State
      },
      storage: batchedStorage<State>(),
    },
  ),
)

setSimSpeed(useStore.getState().settings.simSpeed)

// ---------- Selectors / hooks ----------
export const useMe = () => {
  const id = useStore((s) => s.currentUserId)
  const users = useStore((s) => s.db.users)
  return users.find((u) => u.id === id) ?? null
}

export const useFavorites = () => {
  const id = useStore((s) => s.currentUserId) ?? 'guest'
  const fav = useStore((s) => s.favorites[id])
  return fav ?? { restaurants: [], foods: [], products: [], brands: [] }
}

/** The area used for distance/ETA: the selected address, else the guest location. */
export const useCurrentArea = () => {
  const sel = useStore((s) => s.selectedAddressId)
  const addresses = useStore((s) => s.db.addresses)
  const guest = useStore((s) => s.guestAreaId)
  const addr = addresses.find((a) => a.id === sel)
  return { areaId: addr?.areaId ?? guest, address: addr ?? null }
}

/** Category used by the image fallback for a cart/order line. */
export function artFor(refId: string, kind: CartKind): string {
  const db = useStore.getState().db
  if (kind === 'food') return db.menu.find((m) => m.id === refId)?.category ?? 'restaurant'
  return db.products.find((p) => p.id === refId)?.category ?? 'lifestyle'
}
