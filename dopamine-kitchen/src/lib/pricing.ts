import type { CartKind, CartLine, DeliveryMethod, Restaurant, Voucher } from '../data/types'
import { distanceKm } from '../data/areas'

export const PLATFORM_FEE_FOOD = 9
export const SHOP_FREE_DELIVERY_OVER = 3000

export function foodDelivery(r: Restaurant, areaId: string) {
  const km = distanceKm(r.areaId, areaId)
  const fee = Math.min(r.baseDeliveryFee + Math.round(km * 5), 129)
  const eta = Math.min(45, Math.max(20, Math.round((r.prepMinutes + 6 + km * 1.4) / 5) * 5))
  return { km, fee, eta, etaLabel: `${eta - 5}–${eta + 5} min` }
}

export function foodDeliveryMethods(r: Restaurant, areaId: string): DeliveryMethod[] {
  const d = foodDelivery(r, areaId)
  return [
    { id: 'standard', label: 'Standard delivery', description: `${d.etaLabel} · ${d.km} km away`, fee: d.fee, etaMinutes: d.eta },
    { id: 'priority', label: 'Priority delivery', description: `Rider goes straight to you · ~${Math.max(15, d.eta - 10)} min`, fee: d.fee + 30, etaMinutes: Math.max(15, d.eta - 10) },
    { id: 'pickup', label: 'Self pick-up (simulated)', description: `Ready in ~${r.prepMinutes} min at ${r.address}`, fee: 0, etaMinutes: r.prepMinutes },
  ]
}

export function shopDeliveryMethods(subtotal: number): DeliveryMethod[] {
  const free = subtotal >= SHOP_FREE_DELIVERY_OVER
  return [
    { id: 'standard', label: 'Standard (next day)', description: free ? 'Within 24 hours · Free over ৳3,000' : 'Within 24 hours', fee: free ? 0 : 60, etaMinutes: 24 * 60 },
    { id: 'express', label: 'Express (same day)', description: 'Within 6 hours inside Dhaka', fee: 120, etaMinutes: 6 * 60 },
  ]
}

export const subtotalOf = (lines: CartLine[]) => lines.reduce((s, l) => s + l.unitPrice * l.qty, 0)

export type VoucherCheck = { ok: true; discount: number; freeDelivery: boolean } | { ok: false; error: string }

export function checkVoucher(
  v: Voucher | undefined,
  kind: CartKind,
  subtotal: number,
  deliveryFee: number,
  ctx: { now: number; isFirstOrder: boolean },
): VoucherCheck {
  if (!v) return { ok: false, error: 'This voucher code does not exist.' }
  if (!v.active) return { ok: false, error: 'This voucher is no longer active.' }
  if (v.expiresAt < ctx.now) return { ok: false, error: 'This voucher has expired.' }
  if (v.scope !== 'all' && v.scope !== kind)
    return { ok: false, error: `This voucher is only valid on ${v.scope === 'food' ? 'food' : 'shopping'} orders.` }
  if (v.firstOrderOnly && !ctx.isFirstOrder) return { ok: false, error: 'This voucher is only valid on your first order.' }
  if (subtotal < v.minOrder) return { ok: false, error: `Add ৳${v.minOrder - subtotal} more to use this voucher (min. order ৳${v.minOrder}).` }
  let discount = 0
  if (v.type === 'flat') discount = v.value
  if (v.type === 'percent') discount = Math.round((subtotal * v.value) / 100)
  if (v.maxDiscount) discount = Math.min(discount, v.maxDiscount)
  if (v.type === 'freeDelivery') return { ok: true, discount: deliveryFee, freeDelivery: true }
  return { ok: true, discount: Math.min(discount, subtotal), freeDelivery: false }
}

export function voucherHeadline(v: Voucher) {
  if (v.type === 'flat') return `৳${v.value} OFF`
  if (v.type === 'percent') return `${v.value}% OFF`
  return 'FREE DELIVERY'
}
