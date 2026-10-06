import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bike, ReceiptText, Search } from 'lucide-react'
import { useStore } from '../store/store'
import { isActive } from '../lib/sim'
import { useTitle } from '../lib/hooks'
import { taka } from '../lib/format'
import { OrderCard } from '../components/cards'
import { useReorder } from '../components/reorder'
import { EmptyState, Skeleton, Tabs } from '../components/ui'

export default function Orders() {
  useTitle('My orders')
  const uid = useStore((s) => s.currentUserId)
  const all = useStore((s) => s.db.orders)
  const reorder = useReorder()
  const loading = false
  const mine = useMemo(() => all.filter((o) => o.userId === uid).sort((a, b) => b.placedAt - a.placedAt), [all, uid])
  const active = mine.filter(isActive)
  const [tab, setTab] = useState<'active' | 'past' | 'cancelled'>(() => (active.length ? 'active' : 'past'))
  const [kind, setKind] = useState<'all' | 'food' | 'shop'>('all')
  const [q, setQ] = useState('')
  const past = mine.filter((o) => o.status === 'delivered')
  const cancelled = mine.filter((o) => o.status === 'cancelled')
  const list = (tab === 'active' ? active : tab === 'past' ? past : cancelled)
    .filter((o) => kind === 'all' || o.kind === kind)
    .filter((o) => !q || `${o.id} ${o.storeName} ${o.items.map((i) => i.name).join(' ')}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">My orders</h1>
          <p className="text-sm text-ink-500">{mine.length} simulated orders · {taka(past.reduce((a, o) => a + o.total, 0))} never spent</p>
        </div>
      </div>
      <Tabs className="mt-5" value={tab} onChange={setTab} items={[{ id: 'active', label: 'Active', count: active.length }, { id: 'past', label: 'Delivered', count: past.length }, { id: 'cancelled', label: 'Cancelled', count: cancelled.length }]} />
      <div className="mt-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by order #, store or item" className="input h-10 pl-9" />
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="input h-10 w-auto">
          <option value="all">All types</option><option value="food">Food</option><option value="shop">Shopping</option>
        </select>
      </div>
      <div className="mt-4 space-y-3">
        {loading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36" />) : list.length === 0 ? (
          <EmptyState icon={tab === 'active' ? Bike : ReceiptText} title={q ? 'No orders match your search' : tab === 'active' ? 'No active orders' : tab === 'past' ? 'No delivered orders yet' : 'No cancelled orders'} body={tab === 'active' ? 'Got a craving? Place a simulated order and track it here.' : undefined}
            action={tab === 'active' && !q ? <><Link to="/food" className="btn btn-primary">Order food</Link><Link to="/shop" className="btn btn-secondary">Go shopping</Link></> : undefined} />
        ) : list.map((o) => <OrderCard key={o.id} o={o} onReorder={isActive(o) ? undefined : () => reorder(o)} />)}
      </div>
    </div>
  )
}
