import type { CartKind, Order, OrderStage, OrderStatus } from '../data/types'

// Order simulation: status is derived from simulated progress (simElapsed / ETA).
export const STAGES: OrderStage[] = ['confirmed', 'preparing', 'picked_up', 'on_the_way', 'delivered']

export const STAGE_AT: Record<OrderStage, number> = {
  confirmed: 0,
  preparing: 0.08,
  picked_up: 0.5,
  on_the_way: 0.58,
  delivered: 1,
}

const LABELS: Record<CartKind, Record<OrderStage, { title: string; detail: string }>> = {
  food: {
    confirmed: { title: 'Order Confirmed', detail: 'The kitchen received your test order.' },
    preparing: { title: 'Preparing', detail: 'Your food is being (virtually) cooked.' },
    picked_up: { title: 'Picked Up', detail: 'Your rider collected the order.' },
    on_the_way: { title: 'On the Way', detail: 'Your rider is heading to you.' },
    delivered: { title: 'Delivered', detail: 'Simulation complete — nothing was actually delivered.' },
  },
  shop: {
    confirmed: { title: 'Order Confirmed', detail: 'The store accepted your test order.' },
    preparing: { title: 'Packing', detail: 'Your items are being packed at the warehouse.' },
    picked_up: { title: 'Picked Up', detail: 'Handed over to the courier.' },
    on_the_way: { title: 'Out for Delivery', detail: 'The courier is on the way to you.' },
    delivered: { title: 'Delivered', detail: 'Simulation complete — nothing was actually delivered.' },
  },
}

export const stageLabel = (kind: CartKind, s: OrderStatus) =>
  s === 'cancelled' ? { title: 'Cancelled', detail: 'This test order was cancelled.' } : LABELS[kind][s]

// Simulation speed currently in effect (kept in sync with settings by the store).
let currentSpeed = 1
export const setSimSpeed = (s: number) => {
  currentSpeed = s
}

/** Simulated ms elapsed right now: the last committed value plus wall-clock time since, scaled by speed.
 *  Deriving it (instead of writing it every second) keeps the store and localStorage quiet. */
export function liveElapsed(o: Order, now = Date.now()) {
  if (o.status === 'delivered' || o.status === 'cancelled') return o.simElapsedMs
  return o.simElapsedMs + Math.max(0, now - o.lastTickAt) * currentSpeed
}

export function progressOf(o: Order, now = Date.now()) {
  return Math.min(1, liveElapsed(o, now) / (o.etaMinutes * 60000))
}

export function stageForProgress(p: number): OrderStage {
  let s: OrderStage = 'confirmed'
  for (const st of STAGES) if (p >= STAGE_AT[st]) s = st
  return s
}

export const isActive = (o: Order) => o.status !== 'delivered' && o.status !== 'cancelled'

/** Simulated minutes remaining (in simulation time). */
export const minutesLeft = (o: Order) => Math.max(0, o.etaMinutes - liveElapsed(o) / 60000)

export const statusTone = (s: OrderStatus) =>
  s === 'delivered' ? 'success' : s === 'cancelled' ? 'danger' : s === 'confirmed' ? 'info' : 'brand'
