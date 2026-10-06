import type { Voucher, VoucherScope, VoucherType } from '../data/types'

// Reward engine. The welcome Lucky Wheel is the only mechanic shipped today; future mechanics
// (daily spins, streaks, referrals, badges) reuse WheelSegment/voucherFromSegment and log a RewardEvent.

export interface WheelSegment {
  id: string
  /** Text on the wheel. */
  label: string
  /** Headline on the result card. */
  headline: string
  type: VoucherType
  value: number
  maxDiscount?: number
  minOrder: number
  scope: VoucherScope
  /** Relative probability. Shown to users in "See the odds". */
  weight: number
  fill: string
  text: string
  mystery?: boolean
}

const JADE = '#0A7F57', SUN = '#FFC233', INK = '#121513', CREAM = '#F1F5F2'

export const WHEEL_SEGMENTS: WheelSegment[] = [
  { id: 'p5', label: '5% OFF', headline: '5% OFF', type: 'percent', value: 5, maxDiscount: 50, minOrder: 200, scope: 'all', weight: 18, fill: JADE, text: '#fff' },
  { id: 'p10', label: '10% OFF', headline: '10% OFF', type: 'percent', value: 10, maxDiscount: 80, minOrder: 300, scope: 'all', weight: 20, fill: CREAM, text: INK },
  { id: 'free', label: 'FREE DELIVERY', headline: 'Free delivery', type: 'freeDelivery', value: 0, minOrder: 250, scope: 'all', weight: 12, fill: SUN, text: INK },
  { id: 'p15', label: '15% FOOD', headline: '15% OFF food', type: 'percent', value: 15, maxDiscount: 120, minOrder: 400, scope: 'food', weight: 16, fill: INK, text: '#fff' },
  { id: 'p20', label: '20% OFF', headline: '20% OFF', type: 'percent', value: 20, maxDiscount: 150, minOrder: 500, scope: 'all', weight: 14, fill: JADE, text: '#fff' },
  { id: 'mystery', label: 'MYSTERY', headline: 'Mystery reward', type: 'flat', value: 150, minOrder: 600, scope: 'all', weight: 5, fill: CREAM, text: INK, mystery: true },
  { id: 'p25', label: '25% FASHION', headline: '25% OFF fashion', type: 'percent', value: 25, maxDiscount: 300, minOrder: 1200, scope: 'shop', weight: 9, fill: SUN, text: INK },
  { id: 'p30', label: '30% FOOD', headline: '30% OFF food', type: 'percent', value: 30, maxDiscount: 200, minOrder: 600, scope: 'food', weight: 6, fill: INK, text: '#fff' },
]

export const WELCOME_VALID_DAYS = 14

export function pickSegment(rand: () => number = Math.random): number {
  const total = WHEEL_SEGMENTS.reduce((a, s) => a + s.weight, 0)
  let r = rand() * total
  for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
    r -= WHEEL_SEGMENTS[i].weight
    if (r < 0) return i
  }
  return 0
}

export const oddsPct = (seg: WheelSegment) => Math.round((seg.weight / WHEEL_SEGMENTS.reduce((a, s) => a + s.weight, 0)) * 100)

const code4 = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')

const scopeLabel = (s: VoucherScope) => (s === 'food' ? 'Food orders' : s === 'shop' ? 'Fashion & shopping' : 'Food & shopping')

/** Turns a wheel result into a unique, single-use personal voucher. Mystery resolves to a flat amount. */
export function voucherFromSegment(seg: WheelSegment, userId: string, now = Date.now(), rand: () => number = Math.random): { voucher: Voucher; headline: string } {
  const value = seg.mystery ? [100, 150, 200][Math.floor(rand() * 3)] : seg.value
  const prefix = seg.type === 'freeDelivery' ? 'FREEDEL' : seg.mystery ? `MYSTERY${value}` : `SPIN${value}`
  const headline = seg.mystery ? `৳${value} OFF` : seg.type === 'freeDelivery' ? 'Free delivery' : `${value}% OFF${seg.scope === 'food' ? ' food' : seg.scope === 'shop' ? ' fashion' : ''}`
  const voucher: Voucher = {
    code: `${prefix}-${code4()}`,
    title: seg.mystery ? `Mystery reward: ৳${value} off` : seg.type === 'freeDelivery' ? 'Free delivery' : `${value}% off${seg.maxDiscount ? ` (up to ৳${seg.maxDiscount})` : ''}`,
    description: 'Your welcome spin reward. One use, on any eligible order.',
    type: seg.type,
    value,
    maxDiscount: seg.maxDiscount,
    minOrder: seg.minOrder,
    expiresAt: now + WELCOME_VALID_DAYS * 864e5,
    scope: seg.scope,
    categoriesLabel: scopeLabel(seg.scope),
    active: true,
    ownerId: userId,
    source: 'welcome_spin',
    createdAt: now,
  }
  return { voucher, headline }
}
