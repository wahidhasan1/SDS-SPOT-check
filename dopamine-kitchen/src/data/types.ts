// Core data model for pikk.
// Everything here is demo/simulation data. The shapes are deliberately plain JSON so the
// seed files can later be swapped for authorized real catalog data (e.g. from an API).

export type ID = string

export type City = 'Dhaka' | 'Chattogram' | 'Sylhet'

export interface Area {
  id: ID
  name: string
  city: City
  postcode: string
  lat: number
  lng: number
  /** Areas outside the launch zone are listed but marked "coming soon". */
  available: boolean
}

export type AddressLabel = 'Home' | 'Office' | 'Other'

export interface Address {
  id: ID
  userId: ID
  label: AddressLabel
  recipient: string
  phone: string
  areaId: ID
  house: string
  road: string
  block?: string
  floor?: string
  notes?: string
  isDefault: boolean
}

export type FoodCategory =
  | 'burger' | 'pizza' | 'kacchi' | 'biriyani' | 'chinese' | 'chicken' | 'desserts'
  | 'snacks' | 'drinks' | 'bangladeshi' | 'grill' | 'indian' | 'coffee' | 'healthy'
  | 'japanese' | 'arabian'

export interface RestaurantOffer {
  label: string
  voucherCode?: string
}

export interface Restaurant {
  id: ID
  name: string
  tagline: string
  cuisines: string[]
  categories: FoodCategory[]
  areaId: ID
  address: string
  cover: string
  logoBg: string
  logoEmoji: string
  rating: number
  reviewCount: number
  /** 1 = budget, 3 = premium */
  priceLevel: 1 | 2 | 3
  prepMinutes: number
  baseDeliveryFee: number
  minOrder: number
  isOpen: boolean
  opensAt?: string
  offer?: RestaurantOffer
  tags: string[]
  sections: string[]
  createdAt: number
}

export interface MenuOption {
  id: ID
  name: string
  price: number
}

export interface MenuOptionGroup {
  id: ID
  name: string
  required: boolean
  type: 'single' | 'multi'
  max?: number
  options: MenuOption[]
}

export interface MenuItem {
  id: ID
  restaurantId: ID
  section: string
  name: string
  description: string
  price: number
  originalPrice?: number
  image: string
  category: FoodCategory
  popular?: boolean
  spicy?: boolean
  veg?: boolean
  options?: MenuOptionGroup[]
  available: boolean
}

export type ShopCategory = 'men' | 'women' | 'shoes' | 'bags' | 'accessories' | 'streetwear' | 'lifestyle'

export interface Brand {
  id: ID
  name: string
  tagline: string
  about: string
  initials: string
  logoBg: string
  cover: string
  rating: number
  followers: number
  categories: ShopCategory[]
  areaId: ID
}

export interface ColorOption {
  name: string
  hex: string
}

export interface Product {
  id: ID
  brandId: ID
  name: string
  category: ShopCategory
  subcategory: string
  images: string[]
  /** Photo for each colour option (by colour name), when the catalog has one. */
  colorImages?: Record<string, string>
  price: number
  discountPct: number
  description: string
  highlights: string[]
  sizes: string[]
  colors: ColorOption[]
  rating: number
  reviewCount: number
  stock: number
  /** Standard delivery window in hours (shopping target: within 1 day). */
  deliveryHours: number
  expressAvailable: boolean
  tags: string[]
  createdAt: number
}

export interface Review {
  id: ID
  name: string
  rating: number
  date: number
  text: string
  helpful: number
  variant?: string
}

export type VoucherType = 'flat' | 'percent' | 'freeDelivery'
export type VoucherScope = 'all' | 'food' | 'shop'

export interface Voucher {
  code: string
  title: string
  description: string
  type: VoucherType
  value: number
  maxDiscount?: number
  minOrder: number
  expiresAt: number
  scope: VoucherScope
  categoriesLabel: string
  firstOrderOnly?: boolean
  active: boolean
  /** Personal vouchers belong to one user and can be used once. Public vouchers have no owner. */
  ownerId?: ID
  source?: RewardSource
  createdAt?: number
  usedAt?: number
  usedOnOrder?: string
}

/** Where a voucher or reward came from. New reward mechanics add a value here. */
export type RewardSource = 'promo' | 'welcome_spin' | 'support' | 'daily_spin' | 'streak' | 'referral' | 'badge'

/** Append-only reward history (powers "My rewards" and future streaks/loyalty). */
export interface RewardEvent {
  id: ID
  userId: ID
  kind: RewardSource
  title: string
  voucherCode?: string
  at: number
}

export interface User {
  id: ID
  name: string
  phone: string
  email: string
  avatarColor: string
  joinedAt: number
  role: 'customer' | 'admin'
  savedPayments: SavedPayment[]
}

export type PaymentMethodId = 'bkash' | 'nagad' | 'card' | 'cod'

export interface SavedPayment {
  id: ID
  method: Exclude<PaymentMethodId, 'cod'>
  label: string
  masked: string
}

export type CartKind = 'food' | 'shop'

export interface CartLine {
  key: string
  kind: CartKind
  refId: ID
  storeId: ID
  name: string
  image: string
  unitPrice: number
  qty: number
  optionLabels?: string[]
  size?: string
  color?: string
}

export type OrderStage = 'confirmed' | 'preparing' | 'picked_up' | 'on_the_way' | 'delivered'
export type OrderStatus = OrderStage | 'cancelled'

export interface OrderItem {
  refId: ID
  name: string
  image: string
  qty: number
  unitPrice: number
  optionLabels?: string[]
  size?: string
  color?: string
}

export interface Rider {
  name: string
  phone: string
  vehicle: string
  plate: string
  rating: number
  trips: number
}

export interface AddressSnapshot {
  label: AddressLabel
  recipient: string
  phone: string
  line: string
  areaId: ID
}

export interface DeliveryMethod {
  id: string
  label: string
  description: string
  fee: number
  etaMinutes: number
}

export interface Order {
  id: string
  userId: ID
  kind: CartKind
  storeId: ID
  storeName: string
  items: OrderItem[]
  subtotal: number
  deliveryFee: number
  platformFee: number
  discount: number
  voucherCode?: string
  total: number
  address: AddressSnapshot
  paymentMethod: PaymentMethodId
  paymentRef: string
  delivery: DeliveryMethod
  placedAt: number
  etaMinutes: number
  /** Simulated time elapsed since placement (ms). Advanced by the simulation ticker. */
  simElapsedMs: number
  lastTickAt: number
  status: OrderStatus
  stageTimes: Partial<Record<OrderStage, number>>
  rider: Rider
  cancelledAt?: number
  cravingBefore?: number
  cravingAfter?: number
  rating?: number
  isTest: true
}

export type NotificationType = 'order' | 'voucher' | 'promo' | 'system' | 'support'

export interface AppNotification {
  id: ID
  userId: ID
  type: NotificationType
  title: string
  body: string
  createdAt: number
  read: boolean
  link?: string
}

export interface Favorites {
  restaurants: ID[]
  foods: ID[]
  products: ID[]
  brands: ID[]
}

export type RecentItem = { kind: 'restaurant' | 'product' | 'food'; id: ID; at: number }

export type SimSpeed = 1 | 10 | 60

export interface Settings {
  simSpeed: SimSpeed
  lang: 'en' | 'bn'
  mindfulCheckIn: boolean
  notifyOrders: boolean
  notifyPromos: boolean
  /** Demo control: force the next welcome-spin result (segment id). Cleared after use. */
  nextSpin?: string | null
}
