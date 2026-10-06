import { useNavigate } from 'react-router-dom'
import type { Order } from '../data/types'
import { useStore } from '../store/store'
import { confirmDialog, toast } from '../store/toast'

/** Re-adds a past order's items to the cart (skipping anything no longer available). */
export function useReorder() {
  const nav = useNavigate()
  return async (o: Order) => {
    const s = useStore.getState()
    if (o.kind === 'food') {
      const r = s.db.restaurants.find((x) => x.id === o.storeId)
      if (!r) return toast('error', 'Restaurant unavailable', 'This demo restaurant was removed from the catalog.')
      if (!r.isOpen) return toast('warning', `${r.name} is closed`, `Opens at ${r.opensAt ?? 'a later time'}. Try again then.`)
      const other = s.cart.find((l) => l.kind === 'food' && l.storeId !== r.id)
      if (other) {
        const ok = await confirmDialog({ title: 'Start a new food cart?', body: `Your cart has items from another restaurant. Reordering from ${r.name} will clear it.`, confirmLabel: 'Start new cart' })
        if (!ok) return
        s.clearCart('food')
      }
    }
    let added = 0
    for (const it of o.items) {
      if (o.kind === 'food') {
        const m = useStore.getState().db.menu.find((x) => x.id === it.refId)
        if (!m || !m.available) continue
      } else {
        const p = useStore.getState().db.products.find((x) => x.id === it.refId)
        if (!p || p.stock === 0) continue
      }
      useStore.getState().addToCart({ kind: o.kind, refId: it.refId, storeId: o.kind === 'food' ? o.storeId : useStore.getState().db.products.find((x) => x.id === it.refId)!.brandId, name: it.name, image: it.image, unitPrice: it.unitPrice, qty: it.qty, optionLabels: it.optionLabels, size: it.size, color: it.color })
      added++
    }
    if (!added) return toast('error', 'Nothing to reorder', 'Those items are no longer available.')
    toast('success', `${added} item${added > 1 ? 's' : ''} added to cart`, added < o.items.length ? 'Some items are no longer available.' : undefined)
    nav(`/cart?tab=${o.kind}`)
  }
}
