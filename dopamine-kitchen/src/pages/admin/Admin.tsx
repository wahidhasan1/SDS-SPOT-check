import { useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Download, FastForward, LayoutDashboard, Package, Pencil, Plus, RotateCcw, Settings, ShoppingBag, Store,
  TicketPercent, Trash2, Users, UtensilsCrossed, Eye, LogIn, FlaskConical,
} from 'lucide-react'
import type { CartKind, FoodCategory, MenuItem, OrderStatus, Product, Restaurant, ShopCategory, SimSpeed, Voucher, VoucherScope, VoucherType } from '../../data/types'
import { useMe, useStore } from '../../store/store'
import { confirmDialog, toast } from '../../store/toast'
import { AREAS, areaById } from '../../data/areas'
import { FOOD_CATEGORIES } from '../../data/restaurants'
import { SHOP_CATEGORIES } from '../../data/products'
import { IMG, type ImagePool } from '../../data/images'
import { STAGES, isActive, stageLabel } from '../../lib/sim'
import { cx, discounted, fmtDateTime, normalizeBdPhone, prettyPhone, taka, uid } from '../../lib/format'
import { useTitle } from '../../lib/hooks'
import { voucherHeadline } from '../../lib/pricing'
import { WHEEL_SEGMENTS } from '../../lib/rewards'
import { Logo } from '../../components/Logo'
import { StatusBadge } from '../../components/cards'
import { Avatar, Badge, Field, Img, Modal, Toggle } from '../../components/ui'

const NAV = [
  { id: '', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'restaurants', label: 'Restaurants', icon: Store },
  { id: 'menu', label: 'Food items', icon: UtensilsCrossed },
  { id: 'products', label: 'Products', icon: ShoppingBag },
  { id: 'vouchers', label: 'Vouchers', icon: TicketPercent },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function Admin() {
  useTitle('Demo Control Panel')
  const { pathname } = useLocation()
  const tab = pathname.replace(/^\/admin\/?/, '').split('/')[0]
  const me = useMe()
  return (
    <div className="min-h-dvh bg-ink-50">
      <header className="sticky top-0 z-30 border-b border-ink-100 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link to="/" className="icon-btn -ml-2" aria-label="Back to app"><ArrowLeft className="size-5" /></Link>
          <Logo compact />
          <Badge tone="dark" className="hidden sm:inline-flex">Demo Control Panel</Badge>
          <span className="ml-auto text-xs text-ink-500 hidden sm:block">Signed in as {me?.name ?? 'guest'}</span>
        </div>
        <nav className="lg:hidden flex gap-1 overflow-x-auto scrollbar-none px-3 pb-2">
          {NAV.map((n) => (
            <NavLink key={n.id} to={`/admin/${n.id}`} end className={() => cx('chip h-8 shrink-0', tab === n.id && 'chip-active')}><n.icon className="size-3.5" /> {n.label}</NavLink>
          ))}
        </nav>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden lg:block w-56 shrink-0">
          <nav className="sticky top-20 space-y-1">
            {NAV.map((n) => (
              <NavLink key={n.id} to={`/admin/${n.id}`} end className={() => cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', tab === n.id ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-white')}>
                <n.icon className="size-[18px]" /> {n.label}
              </NavLink>
            ))}
            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900"><FlaskConical className="mb-1 size-4" />Changes affect only this browser's simulation data.</div>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 animate-fade-in" key={tab}>
          {tab === '' && <Dashboard />}
          {tab === 'orders' && <OrdersAdmin />}
          {tab === 'restaurants' && <RestaurantsAdmin />}
          {tab === 'menu' && <MenuAdmin />}
          {tab === 'products' && <ProductsAdmin />}
          {tab === 'vouchers' && <VouchersAdmin />}
          {tab === 'users' && <UsersAdmin />}
          {tab === 'settings' && <SettingsAdmin />}
          {!NAV.some((n) => n.id === tab) && <p className="card p-6">Unknown section. <Link to="/admin" className="text-brand-700 font-semibold">Back to dashboard</Link></p>}
        </main>
      </div>
    </div>
  )
}

const H = ({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="font-display text-2xl font-extrabold">{title}</h1>{sub && <p className="text-sm text-ink-500">{sub}</p>}</div>
    {action}
  </div>
)

function NumCell({ value, onSave, prefix, width = 'w-24' }: { value: number; onSave: (v: number) => void; prefix?: string; width?: string }) {
  const [v, setV] = useState(String(value))
  const commit = () => {
    const n = Number(v)
    if (Number.isFinite(n) && n >= 0 && n !== value) {
      onSave(n)
      toast('success', 'Saved')
    } else setV(String(value))
  }
  return (
    <span className="inline-flex items-center gap-1">
      {prefix && <span className="text-ink-400 text-xs">{prefix}</span>}
      <input value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ''))} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className={cx('input h-8 px-2 text-sm', width)} inputMode="decimal" />
    </span>
  )
}

const Table = ({ head, children }: { head: string[]; children: ReactNode }) => (
  <div className="card overflow-x-auto">
    <table className="w-full min-w-[720px] text-sm">
      <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500"><tr>{head.map((h) => <th key={h} className="px-3 py-2.5 font-bold">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-ink-100">{children}</tbody>
    </table>
  </div>
)

// ---------------- Dashboard ----------------
function Dashboard() {
  const db = useStore((s) => s.db)
  const nav = useNavigate()
  const active = db.orders.filter(isActive)
  const delivered = db.orders.filter((o) => o.status === 'delivered')
  const stats = [
    ['Total orders', db.orders.length], ['Active now', active.length], ['Delivered (simulated)', delivered.length], ['Cancelled', db.orders.filter((o) => o.status === 'cancelled').length],
    ['Simulated GMV', taka(db.orders.filter((o) => o.status !== 'cancelled').reduce((a, o) => a + o.total, 0))], ['Users', db.users.length],
    ['Restaurants', db.restaurants.length], ['Food items', db.menu.length], ['Products', db.products.length], ['Vouchers', db.vouchers.length],
  ] as const
  return (
    <>
      <H title="Dashboard" sub="Overview of the local simulation" action={<button className="btn btn-primary btn-sm" onClick={() => nav('/admin/orders')}><Plus className="size-4" /> Create demo order</button>} />
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {stats.map(([l, v]) => <div key={l} className="card p-4"><p className="text-xs text-ink-500">{l}</p><p className="mt-1 font-display text-2xl font-extrabold">{v}</p></div>)}
      </div>
      <div className="mt-6 card p-4">
        <p className="font-bold mb-3">Status distribution</p>
        <div className="flex h-3 overflow-hidden rounded-full bg-ink-100">
          {[...STAGES, 'cancelled' as const].map((s, i) => {
            const n = db.orders.filter((o) => o.status === s).length
            return n ? <div key={s} title={`${s}: ${n}`} style={{ width: `${(n / db.orders.length) * 100}%`, background: ['#B9C0BB', '#6FC9A3', '#0F9466', '#FFC233', '#086648', '#E5484D'][i] }} /> : null
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-500">
          {[...STAGES, 'cancelled' as const].map((s, i) => <span key={s} className="inline-flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: ['#B9C0BB', '#6FC9A3', '#0F9466', '#FFC233', '#086648', '#E5484D'][i] }} />{stageLabel('food', s).title} ({db.orders.filter((o) => o.status === s).length})</span>)}
        </div>
      </div>
      <h2 className="mt-6 mb-3 font-display text-lg font-bold">Recent orders</h2>
      <Table head={['Order', 'Customer', 'Store', 'Total', 'Status', 'Placed']}>
        {[...db.orders].sort((a, b) => b.placedAt - a.placedAt).slice(0, 8).map((o) => (
          <tr key={o.id} className="hover:bg-ink-50">
            <td className="px-3 py-2.5 font-mono font-semibold"><Link to={`/orders/${o.id}`} className="text-brand-700">{o.id}</Link></td>
            <td className="px-3 py-2.5">{db.users.find((u) => u.id === o.userId)?.name}</td>
            <td className="px-3 py-2.5">{o.storeName}</td>
            <td className="px-3 py-2.5 font-semibold">{taka(o.total)}</td>
            <td className="px-3 py-2.5"><StatusBadge order={o} /></td>
            <td className="px-3 py-2.5 text-ink-500">{fmtDateTime(o.placedAt)}</td>
          </tr>
        ))}
      </Table>
    </>
  )
}

// ---------------- Orders ----------------
function OrdersAdmin() {
  const db = useStore((s) => s.db)
  const setStatus = useStore((s) => s.setOrderStatus)
  const setEta = useStore((s) => s.setOrderEta)
  const advance = useStore((s) => s.advanceOrder)
  const del = useStore((s) => s.deleteOrder)
  const [filter, setFilter] = useState<'all' | OrderStatus>('all')
  const [q, setQ] = useState('')
  const [create, setCreate] = useState(false)
  const list = [...db.orders].sort((a, b) => b.placedAt - a.placedAt).filter((o) => (filter === 'all' || o.status === filter) && (!q || `${o.id} ${o.storeName} ${db.users.find((u) => u.id === o.userId)?.name}`.toLowerCase().includes(q.toLowerCase())))
  return (
    <>
      <H title="Simulated orders" sub="Change status, adjust ETA, or create demo orders" action={<button className="btn btn-primary btn-sm" onClick={() => setCreate(true)}><Plus className="size-4" /> Create demo order</button>} />
      <div className="mb-3 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order, store, customer" className="input h-9 max-w-xs" />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="input h-9 w-auto">
          <option value="all">All statuses</option>
          {[...STAGES, 'cancelled' as const].map((s) => <option key={s} value={s}>{stageLabel('food', s).title}</option>)}
        </select>
      </div>
      <Table head={['Order', 'Customer', 'Store', 'Total', 'Status', 'ETA (min)', 'Actions']}>
        {list.map((o) => (
          <tr key={o.id} className="hover:bg-ink-50">
            <td className="px-3 py-2"><p className="font-mono font-semibold">{o.id}</p><p className="text-xs text-ink-500">{fmtDateTime(o.placedAt)} · {o.kind}</p></td>
            <td className="px-3 py-2">{db.users.find((u) => u.id === o.userId)?.name ?? '—'}</td>
            <td className="px-3 py-2">{o.storeName}</td>
            <td className="px-3 py-2 font-semibold">{taka(o.total)}</td>
            <td className="px-3 py-2">
              <select value={o.status} onChange={(e) => { setStatus(o.id, e.target.value as OrderStatus); toast('success', `${o.id} → ${stageLabel(o.kind, e.target.value as OrderStatus).title}`) }} className="input h-8 w-auto px-2 text-sm">
                {[...STAGES, 'cancelled' as const].map((s) => <option key={s} value={s}>{stageLabel(o.kind, s).title}</option>)}
              </select>
            </td>
            <td className="px-3 py-2"><NumCell key={o.etaMinutes} value={o.etaMinutes} onSave={(v) => setEta(o.id, v)} width="w-20" /></td>
            <td className="px-3 py-2">
              <div className="flex gap-1">
                <Link to={`/orders/${o.id}`} className="icon-btn size-8" title="View"><Eye className="size-4" /></Link>
                <button disabled={!isActive(o)} onClick={() => advance(o.id)} className="icon-btn size-8 disabled:opacity-30" title="Advance stage"><FastForward className="size-4" /></button>
                <button onClick={async () => { if (await confirmDialog({ title: `Delete ${o.id}?`, confirmLabel: 'Delete', tone: 'danger' })) del(o.id) }} className="icon-btn size-8 text-red-600" title="Delete"><Trash2 className="size-4" /></button>
              </div>
            </td>
          </tr>
        ))}
        {!list.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-ink-500">No orders match.</td></tr>}
      </Table>
      <CreateOrderModal open={create} onClose={() => setCreate(false)} />
    </>
  )
}

function CreateOrderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useStore((s) => s.db)
  const createDemoOrder = useStore((s) => s.createDemoOrder)
  const [f, setF] = useState({ userId: db.users[0]?.id ?? '', kind: 'food' as CartKind, storeId: db.restaurants[0]?.id ?? '', status: 'preparing' as OrderStatus, eta: 30 })
  const stores = f.kind === 'food' ? db.restaurants.map((r) => ({ id: r.id, name: r.name })) : db.brands.map((b) => ({ id: b.id, name: b.name }))
  const submit = () => {
    const o = createDemoOrder({ userId: f.userId, kind: f.kind, storeId: f.storeId, status: f.status, etaMinutes: f.eta })
    if (!o) return toast('error', 'Could not create order', 'The user needs an address and the store needs items.')
    toast('success', `Created ${o.id}`)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Create demo order" footer={<button className="btn btn-primary w-full" onClick={submit}>Create order</button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Customer"><select className="input" value={f.userId} onChange={(e) => setF({ ...f, userId: e.target.value })}>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        <Field label="Type"><select className="input" value={f.kind} onChange={(e) => { const kind = e.target.value as CartKind; setF({ ...f, kind, storeId: kind === 'food' ? db.restaurants[0]?.id : db.brands[0]?.id, eta: kind === 'food' ? 30 : 1440 }) }}><option value="food">Food</option><option value="shop">Shopping</option></select></Field>
        <Field label={f.kind === 'food' ? 'Restaurant' : 'Brand'} className="sm:col-span-2"><select className="input" value={f.storeId} onChange={(e) => setF({ ...f, storeId: e.target.value })}>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Initial status"><select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as OrderStatus })}>{[...STAGES, 'cancelled' as const].map((s) => <option key={s} value={s}>{stageLabel(f.kind, s).title}</option>)}</select></Field>
        <Field label="ETA (minutes)"><input className="input" inputMode="numeric" value={f.eta} onChange={(e) => setF({ ...f, eta: Number(e.target.value.replace(/\D/g, '')) || 1 })} /></Field>
      </div>
      <p className="mt-3 text-xs text-ink-500">Random items from the selected store are added. The order appears in that user's history and notifications.</p>
    </Modal>
  )
}

// ---------------- Restaurants ----------------
function RestaurantsAdmin() {
  const restaurants = useStore((s) => s.db.restaurants)
  const menu = useStore((s) => s.db.menu)
  const upsert = useStore((s) => s.upsertRestaurant)
  const del = useStore((s) => s.deleteRestaurant)
  const [edit, setEdit] = useState<Restaurant | null | 'new'>(null)
  return (
    <>
      <H title="Restaurants" sub={`${restaurants.length} demo restaurants`} action={<button className="btn btn-primary btn-sm" onClick={() => setEdit('new')}><Plus className="size-4" /> Add restaurant</button>} />
      <Table head={['Restaurant', 'Area', 'Rating', 'Delivery fee', 'Min order', 'Items', 'Open', '']}>
        {restaurants.map((r) => (
          <tr key={r.id} className="hover:bg-ink-50">
            <td className="px-3 py-2"><div className="flex items-center gap-2"><Img src={r.cover} alt={r.name} art={r.categories[0]} className="size-10 rounded-lg shrink-0" /><div><Link to={`/restaurant/${r.id}`} className="font-semibold hover:text-brand-700">{r.name}</Link><p className="text-xs text-ink-500">{r.cuisines.join(', ')}</p></div></div></td>
            <td className="px-3 py-2">{areaById(r.areaId).name}</td>
            <td className="px-3 py-2"><NumCell value={r.rating} onSave={(v) => upsert({ ...r, rating: Math.min(5, v) })} width="w-16" /></td>
            <td className="px-3 py-2"><NumCell value={r.baseDeliveryFee} onSave={(v) => upsert({ ...r, baseDeliveryFee: v })} prefix="৳" width="w-20" /></td>
            <td className="px-3 py-2"><NumCell value={r.minOrder} onSave={(v) => upsert({ ...r, minOrder: v })} prefix="৳" width="w-20" /></td>
            <td className="px-3 py-2">{menu.filter((m) => m.restaurantId === r.id).length}</td>
            <td className="px-3 py-2"><Toggle checked={r.isOpen} onChange={(v) => upsert({ ...r, isOpen: v, opensAt: v ? r.opensAt : r.opensAt ?? '5:00 PM' })} label="Open" /></td>
            <td className="px-3 py-2"><div className="flex gap-1">
              <button className="icon-btn size-8" onClick={() => setEdit(r)} title="Edit"><Pencil className="size-4" /></button>
              <button className="icon-btn size-8 text-red-600" title="Delete" onClick={async () => { if (await confirmDialog({ title: `Delete ${r.name}?`, body: 'Its menu items will be removed too.', confirmLabel: 'Delete', tone: 'danger' })) del(r.id) }}><Trash2 className="size-4" /></button>
            </div></td>
          </tr>
        ))}
      </Table>
      {edit && <RestaurantForm initial={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </>
  )
}

const POOL_OPTS: ImagePool[] = ['burger', 'pizza', 'biriyani', 'polao', 'curry', 'grill', 'chinese', 'chicken', 'snacks', 'ramen', 'desserts', 'sweets', 'drinks', 'coffee', 'healthy', 'pasta']

function ImagePicker({ value, onChange, pools = POOL_OPTS }: { value: string; onChange: (v: string) => void; pools?: ImagePool[] }) {
  const [pool, setPool] = useState<ImagePool>(pools[0])
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select className="input h-9 w-auto" value={pool} onChange={(e) => setPool(e.target.value as ImagePool)}>{pools.map((p) => <option key={p} value={p}>{p}</option>)}</select>
        <input className="input h-9" placeholder="…or paste an image URL" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {IMG[pool].map((src) => <button type="button" key={src} onClick={() => onChange(src)} className={cx('shrink-0 rounded-lg ring-2', value === src ? 'ring-brand-600' : 'ring-transparent')}><Img src={src} alt={pool} art={pool} className="size-14 rounded-lg" /></button>)}
      </div>
    </div>
  )
}

function RestaurantForm({ initial, onClose }: { initial: Restaurant | null; onClose: () => void }) {
  const upsert = useStore((s) => s.upsertRestaurant)
  const [f, setF] = useState<Restaurant>(() => initial ?? {
    id: uid('r'), name: '', tagline: '', cuisines: [], categories: ['burger'], areaId: 'banani', address: '', cover: IMG.restaurant[0], logoBg: '#0A7F57', logoEmoji: '🍽️',
    rating: 4.5, reviewCount: 0, priceLevel: 2, prepMinutes: 15, baseDeliveryFee: 39, minOrder: 250, isOpen: true, tags: ['New'], sections: ['Popular', 'Mains', 'Drinks'], createdAt: Date.now(),
  })
  const [cuisines, setCuisines] = useState(f.cuisines.join(', '))
  const [sections, setSections] = useState(f.sections.join(', '))
  const [offer, setOffer] = useState(f.offer?.label ?? '')
  const save = () => {
    if (!f.name.trim()) return toast('error', 'Name is required')
    upsert({ ...f, name: f.name.trim(), cuisines: cuisines.split(',').map((s) => s.trim()).filter(Boolean), sections: sections.split(',').map((s) => s.trim()).filter(Boolean), offer: offer.trim() ? { label: offer.trim() } : undefined, address: f.address || areaById(f.areaId).name })
    toast('success', initial ? 'Restaurant updated' : 'Restaurant added')
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={initial ? `Edit ${initial.name}` : 'Add restaurant'} size="lg" footer={<button className="btn btn-primary w-full" onClick={save}>Save restaurant</button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Biryani Bros (fictional)" /></Field>
        <Field label="Tagline"><input className="input" value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></Field>
        <Field label="Cuisines (comma separated)"><input className="input" value={cuisines} onChange={(e) => setCuisines(e.target.value)} /></Field>
        <Field label="Menu sections (comma separated)"><input className="input" value={sections} onChange={(e) => setSections(e.target.value)} /></Field>
        <Field label="Area"><select className="input" value={f.areaId} onChange={(e) => setF({ ...f, areaId: e.target.value })}>{AREAS.filter((a) => a.available).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Street address"><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        <Field label="Logo emoji"><input className="input" value={f.logoEmoji} onChange={(e) => setF({ ...f, logoEmoji: e.target.value })} /></Field>
        <Field label="Logo colour"><input type="color" className="input p-1" value={f.logoBg} onChange={(e) => setF({ ...f, logoBg: e.target.value })} /></Field>
        <Field label="Rating"><input className="input" inputMode="decimal" value={f.rating} onChange={(e) => setF({ ...f, rating: Math.min(5, Number(e.target.value) || 0) })} /></Field>
        <Field label="Price level"><select className="input" value={f.priceLevel} onChange={(e) => setF({ ...f, priceLevel: Number(e.target.value) as 1 | 2 | 3 })}><option value={1}>৳ Budget</option><option value={2}>৳৳ Mid-range</option><option value={3}>৳৳৳ Premium</option></select></Field>
        <Field label="Base delivery fee (৳)"><input className="input" inputMode="numeric" value={f.baseDeliveryFee} onChange={(e) => setF({ ...f, baseDeliveryFee: Number(e.target.value) || 0 })} /></Field>
        <Field label="Minimum order (৳)"><input className="input" inputMode="numeric" value={f.minOrder} onChange={(e) => setF({ ...f, minOrder: Number(e.target.value) || 0 })} /></Field>
        <Field label="Prep time (min)"><input className="input" inputMode="numeric" value={f.prepMinutes} onChange={(e) => setF({ ...f, prepMinutes: Number(e.target.value) || 0 })} /></Field>
        <Field label="Offer label (optional)"><input className="input" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="e.g. 10% off everything" /></Field>
        <Field label="Food categories" className="sm:col-span-2">
          <div className="flex flex-wrap gap-1.5">{FOOD_CATEGORIES.map((c) => <button type="button" key={c.id} onClick={() => setF({ ...f, categories: f.categories.includes(c.id) ? f.categories.filter((x) => x !== c.id) : [...f.categories, c.id] })} className={cx('chip h-8', f.categories.includes(c.id) && 'chip-active')}>{c.emoji} {c.label}</button>)}</div>
        </Field>
        <Field label="Cover image" className="sm:col-span-2"><ImagePicker value={f.cover} onChange={(cover) => setF({ ...f, cover })} /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold"><Toggle checked={f.isOpen} onChange={(v) => setF({ ...f, isOpen: v })} /> Open now</label>
      </div>
    </Modal>
  )
}

// ---------------- Menu ----------------
function MenuAdmin() {
  const restaurants = useStore((s) => s.db.restaurants)
  const menu = useStore((s) => s.db.menu)
  const upsert = useStore((s) => s.upsertMenuItem)
  const del = useStore((s) => s.deleteMenuItem)
  const [rid, setRid] = useState(restaurants[0]?.id ?? '')
  const [edit, setEdit] = useState<MenuItem | null | 'new'>(null)
  const items = menu.filter((m) => m.restaurantId === rid)
  const r = restaurants.find((x) => x.id === rid)
  return (
    <>
      <H title="Food items" sub={`${menu.length} items across ${restaurants.length} restaurants`} action={<button disabled={!r} className="btn btn-primary btn-sm" onClick={() => setEdit('new')}><Plus className="size-4" /> Add food item</button>} />
      <select className="input mb-3 h-10 max-w-sm" value={rid} onChange={(e) => setRid(e.target.value)}>{restaurants.map((x) => <option key={x.id} value={x.id}>{x.name} ({menu.filter((m) => m.restaurantId === x.id).length})</option>)}</select>
      <Table head={['Item', 'Section', 'Price', 'Popular', 'Available', '']}>
        {items.map((m) => (
          <tr key={m.id} className="hover:bg-ink-50">
            <td className="px-3 py-2"><div className="flex items-center gap-2"><Img src={m.image} alt={m.name} art={m.category} className="size-10 rounded-lg shrink-0" /><div className="min-w-0"><p className="font-semibold">{m.name}</p><p className="text-xs text-ink-500 line-clamp-1 max-w-xs">{m.description}</p></div></div></td>
            <td className="px-3 py-2">{m.section}</td>
            <td className="px-3 py-2"><NumCell value={m.price} onSave={(v) => upsert({ ...m, price: v })} prefix="৳" /></td>
            <td className="px-3 py-2"><Toggle checked={!!m.popular} onChange={(v) => upsert({ ...m, popular: v })} label="Popular" /></td>
            <td className="px-3 py-2"><Toggle checked={m.available} onChange={(v) => upsert({ ...m, available: v })} label="Available" /></td>
            <td className="px-3 py-2"><div className="flex gap-1">
              <button className="icon-btn size-8" onClick={() => setEdit(m)} title="Edit"><Pencil className="size-4" /></button>
              <button className="icon-btn size-8 text-red-600" title="Delete" onClick={async () => { if (await confirmDialog({ title: `Delete ${m.name}?`, confirmLabel: 'Delete', tone: 'danger' })) del(m.id) }}><Trash2 className="size-4" /></button>
            </div></td>
          </tr>
        ))}
        {!items.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-ink-500">No items yet — add the first one.</td></tr>}
      </Table>
      {edit && r && <MenuForm r={r} initial={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function MenuForm({ r, initial, onClose }: { r: Restaurant; initial: MenuItem | null; onClose: () => void }) {
  const upsert = useStore((s) => s.upsertMenuItem)
  const [f, setF] = useState<MenuItem>(() => initial ?? { id: uid(r.id), restaurantId: r.id, section: r.sections.find((s) => s !== 'Popular') ?? 'Mains', name: '', description: '', price: 250, image: '', category: r.categories[0] ?? 'snacks', available: true })
  const save = () => {
    if (!f.name.trim()) return toast('error', 'Name is required')
    upsert({ ...f, name: f.name.trim() })
    toast('success', initial ? 'Item updated' : 'Item added')
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={initial ? 'Edit food item' : `Add item to ${r.name}`} size="lg" footer={<button className="btn btn-primary w-full" onClick={save}>Save item</button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Price (৳)"><input className="input" inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) || 0 })} /></Field>
        <Field label="Description" className="sm:col-span-2"><textarea className="input h-20 py-2" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Section"><input className="input" list="sections" value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })} /><datalist id="sections">{r.sections.map((s) => <option key={s} value={s} />)}</datalist></Field>
        <Field label="Category"><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as FoodCategory })}>{FOOD_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
        <div className="sm:col-span-2 flex flex-wrap gap-4 text-sm font-semibold">
          <label className="flex items-center gap-2"><Toggle checked={!!f.popular} onChange={(v) => setF({ ...f, popular: v })} /> Popular</label>
          <label className="flex items-center gap-2"><Toggle checked={!!f.spicy} onChange={(v) => setF({ ...f, spicy: v })} /> Spicy</label>
          <label className="flex items-center gap-2"><Toggle checked={!!f.veg} onChange={(v) => setF({ ...f, veg: v })} /> Vegetarian</label>
        </div>
        <Field label="Image" className="sm:col-span-2"><ImagePicker value={f.image} onChange={(image) => setF({ ...f, image })} /></Field>
      </div>
    </Modal>
  )
}

// ---------------- Products ----------------
function ProductsAdmin() {
  const products = useStore((s) => s.db.products)
  const brands = useStore((s) => s.db.brands)
  const upsert = useStore((s) => s.upsertProduct)
  const del = useStore((s) => s.deleteProduct)
  const [cat, setCat] = useState('')
  const [edit, setEdit] = useState<Product | null | 'new'>(null)
  const list = products.filter((p) => !cat || p.category === cat)
  return (
    <>
      <H title="Products" sub={`${products.length} demo products · ${brands.length} fictional brands`} action={<button className="btn btn-primary btn-sm" onClick={() => setEdit('new')}><Plus className="size-4" /> Add product</button>} />
      <select className="input mb-3 h-10 max-w-xs" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{SHOP_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
      <Table head={['Product', 'Brand', 'Price', 'Discount %', 'Sale price', 'Stock', '']}>
        {list.map((p) => (
          <tr key={p.id} className="hover:bg-ink-50">
            <td className="px-3 py-2"><div className="flex items-center gap-2"><Img src={p.images[0]} alt={p.name} art={p.category} className="size-10 rounded-lg shrink-0" /><div><Link to={`/product/${p.id}`} className="font-semibold hover:text-brand-700">{p.name}</Link><p className="text-xs text-ink-500">{p.subcategory}</p></div></div></td>
            <td className="px-3 py-2">{brands.find((b) => b.id === p.brandId)?.name}</td>
            <td className="px-3 py-2"><NumCell value={p.price} onSave={(v) => upsert({ ...p, price: v })} prefix="৳" /></td>
            <td className="px-3 py-2"><NumCell value={p.discountPct} onSave={(v) => upsert({ ...p, discountPct: Math.min(90, v) })} width="w-16" /></td>
            <td className="px-3 py-2 font-semibold">{taka(discounted(p.price, p.discountPct))}</td>
            <td className="px-3 py-2"><NumCell value={p.stock} onSave={(v) => upsert({ ...p, stock: Math.round(v) })} width="w-16" /></td>
            <td className="px-3 py-2"><div className="flex gap-1">
              <button className="icon-btn size-8" onClick={() => setEdit(p)} title="Edit"><Pencil className="size-4" /></button>
              <button className="icon-btn size-8 text-red-600" title="Delete" onClick={async () => { if (await confirmDialog({ title: `Delete ${p.name}?`, confirmLabel: 'Delete', tone: 'danger' })) del(p.id) }}><Trash2 className="size-4" /></button>
            </div></td>
          </tr>
        ))}
      </Table>
      {edit && <ProductForm initial={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </>
  )
}

const SHOP_POOLS: ImagePool[] = ['menswear', 'womenswear', 'streetwear', 'shoes', 'bags', 'watches', 'lifestyle']

function ProductForm({ initial, onClose }: { initial: Product | null; onClose: () => void }) {
  const brands = useStore((s) => s.db.brands)
  const upsert = useStore((s) => s.upsertProduct)
  const [f, setF] = useState<Product>(() => initial ?? {
    id: uid('p'), brandId: brands[0]?.id ?? '', name: '', category: 'men', subcategory: '', images: [IMG.menswear[0]], price: 1500, discountPct: 0, description: '', highlights: [],
    sizes: ['S', 'M', 'L', 'XL'], colors: [{ name: 'Black', hex: '#111827' }], rating: 4.5, reviewCount: 0, stock: 25, deliveryHours: 24, expressAvailable: true, tags: ['New'], createdAt: Date.now(),
  })
  const [sizes, setSizes] = useState(f.sizes.join(', '))
  const [colors, setColors] = useState(f.colors.map((c) => `${c.name}:${c.hex}`).join(', '))
  const [highlights, setHighlights] = useState(f.highlights.join('\n'))
  const save = () => {
    if (!f.name.trim()) return toast('error', 'Name is required')
    const cs = colors.split(',').map((c) => c.trim()).filter(Boolean).map((c) => { const [name, hex] = c.split(':'); return { name: name.trim(), hex: /^#[0-9a-f]{3,6}$/i.test(hex?.trim() ?? '') ? hex.trim() : '#9CA3AF' } })
    upsert({ ...f, name: f.name.trim(), sizes: sizes.split(',').map((s) => s.trim()).filter(Boolean).length ? sizes.split(',').map((s) => s.trim()).filter(Boolean) : ['One size'], colors: cs.length ? cs : [{ name: 'Default', hex: '#9CA3AF' }], highlights: highlights.split('\n').map((h) => h.trim()).filter(Boolean), images: f.images.filter(Boolean) })
    toast('success', initial ? 'Product updated' : 'Product added')
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={initial ? 'Edit product' : 'Add product'} size="lg" footer={<button className="btn btn-primary w-full" onClick={save}>Save product</button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Brand"><select className="input" value={f.brandId} onChange={(e) => setF({ ...f, brandId: e.target.value })}>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field label="Category"><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ShopCategory })}>{SHOP_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
        <Field label="Subcategory"><input className="input" value={f.subcategory} onChange={(e) => setF({ ...f, subcategory: e.target.value })} placeholder="e.g. T-Shirts" /></Field>
        <Field label="Price (৳)"><input className="input" inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) || 0 })} /></Field>
        <Field label="Discount %"><input className="input" inputMode="numeric" value={f.discountPct} onChange={(e) => setF({ ...f, discountPct: Math.min(90, Number(e.target.value) || 0) })} /></Field>
        <Field label="Stock"><input className="input" inputMode="numeric" value={f.stock} onChange={(e) => setF({ ...f, stock: Number(e.target.value) || 0 })} /></Field>
        <Field label="Rating"><input className="input" inputMode="decimal" value={f.rating} onChange={(e) => setF({ ...f, rating: Math.min(5, Number(e.target.value) || 0) })} /></Field>
        <Field label="Sizes (comma separated)"><input className="input" value={sizes} onChange={(e) => setSizes(e.target.value)} /></Field>
        <Field label="Colours (name:#hex, …)"><input className="input" value={colors} onChange={(e) => setColors(e.target.value)} /></Field>
        <Field label="Description" className="sm:col-span-2"><textarea className="input h-20 py-2" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Highlights (one per line)" className="sm:col-span-2"><textarea className="input h-20 py-2" value={highlights} onChange={(e) => setHighlights(e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold"><Toggle checked={f.expressAvailable} onChange={(v) => setF({ ...f, expressAvailable: v })} /> Same-day express</label>
        <Field label="Main image" className="sm:col-span-2"><ImagePicker pools={SHOP_POOLS} value={f.images[0] ?? ''} onChange={(src) => setF({ ...f, images: [src, ...f.images.slice(1).filter((x) => x !== src)] })} /></Field>
      </div>
    </Modal>
  )
}

// ---------------- Vouchers ----------------
function VouchersAdmin() {
  const vouchers = useStore((s) => s.db.vouchers)
  const upsert = useStore((s) => s.upsertVoucher)
  const del = useStore((s) => s.deleteVoucher)
  const [open, setOpen] = useState(false)
  return (
    <>
      <H title="Vouchers" sub={`${vouchers.length} voucher codes`} action={<button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Plus className="size-4" /> Create voucher</button>} />
      <Table head={['Code', 'Offer', 'Min order', 'Scope', 'Expires', 'Active', '']}>
        {vouchers.map((v) => (
          <tr key={v.code} className="hover:bg-ink-50">
            <td className="px-3 py-2 font-mono font-bold">{v.code}</td>
            <td className="px-3 py-2"><p className="font-semibold">{voucherHeadline(v)}{v.maxDiscount ? ` (max ৳${v.maxDiscount})` : ''}</p><p className="text-xs text-ink-500">{v.title}{v.firstOrderOnly && ' · first order'}{v.ownerId && ` · ${v.source === 'welcome_spin' ? 'welcome spin' : 'personal'}${v.usedAt ? ` · used on ${v.usedOnOrder}` : ''}`}</p></td>
            <td className="px-3 py-2"><NumCell value={v.minOrder} onSave={(n) => upsert({ ...v, minOrder: n })} prefix="৳" width="w-20" /></td>
            <td className="px-3 py-2 capitalize">{v.scope}</td>
            <td className="px-3 py-2">{v.expiresAt < Date.now() ? <Badge tone="danger">Expired</Badge> : fmtDateTime(v.expiresAt)}</td>
            <td className="px-3 py-2"><Toggle checked={v.active} onChange={(a) => upsert({ ...v, active: a })} label="Active" /></td>
            <td className="px-3 py-2"><div className="flex gap-1">
              {v.expiresAt < Date.now() && <button className="btn btn-ghost btn-sm" onClick={() => { upsert({ ...v, expiresAt: Date.now() + 7 * 864e5 }); toast('success', `${v.code} extended by 7 days`) }}>Extend</button>}
              <button className="icon-btn size-8 text-red-600" title="Delete" onClick={async () => { if (await confirmDialog({ title: `Delete ${v.code}?`, confirmLabel: 'Delete', tone: 'danger' })) del(v.code) }}><Trash2 className="size-4" /></button>
            </div></td>
          </tr>
        ))}
      </Table>
      {open && <VoucherForm onClose={() => setOpen(false)} />}
    </>
  )
}

function VoucherForm({ onClose }: { onClose: () => void }) {
  const vouchers = useStore((s) => s.db.vouchers)
  const upsert = useStore((s) => s.upsertVoucher)
  const [f, setF] = useState({ code: '', title: '', description: '', type: 'percent' as VoucherType, value: 15, maxDiscount: 150, minOrder: 300, days: 14, scope: 'all' as VoucherScope, firstOrderOnly: false })
  const save = () => {
    const code = f.code.trim().toUpperCase().replace(/\s/g, '')
    if (!/^[A-Z0-9]{3,16}$/.test(code)) return toast('error', 'Code must be 3–16 letters/numbers')
    if (vouchers.some((v) => v.code === code)) return toast('error', 'That code already exists')
    const v: Voucher = {
      code, title: f.title || (f.type === 'flat' ? `৳${f.value} off` : f.type === 'percent' ? `${f.value}% off` : 'Free delivery'), description: f.description || 'Created from the demo control panel.',
      type: f.type, value: f.value, maxDiscount: f.type === 'percent' ? f.maxDiscount : undefined, minOrder: f.minOrder, expiresAt: Date.now() + f.days * 864e5, scope: f.scope,
      categoriesLabel: f.scope === 'all' ? 'Food & Shopping' : f.scope === 'food' ? 'All restaurants' : 'All shopping', firstOrderOnly: f.firstOrderOnly, active: true,
    }
    upsert(v)
    toast('success', `Voucher ${code} created`)
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="Create voucher" footer={<button className="btn btn-primary w-full" onClick={save}>Create voucher</button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Code"><input className="input font-mono uppercase" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="CRAVE25" /></Field>
        <Field label="Title (optional)"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Type"><select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as VoucherType })}><option value="percent">Percentage off</option><option value="flat">Flat amount off</option><option value="freeDelivery">Free delivery</option></select></Field>
        <Field label={f.type === 'percent' ? 'Percent' : 'Amount (৳)'}><input disabled={f.type === 'freeDelivery'} className="input" inputMode="numeric" value={f.value} onChange={(e) => setF({ ...f, value: Number(e.target.value) || 0 })} /></Field>
        {f.type === 'percent' && <Field label="Max discount (৳)"><input className="input" inputMode="numeric" value={f.maxDiscount} onChange={(e) => setF({ ...f, maxDiscount: Number(e.target.value) || 0 })} /></Field>}
        <Field label="Minimum order (৳)"><input className="input" inputMode="numeric" value={f.minOrder} onChange={(e) => setF({ ...f, minOrder: Number(e.target.value) || 0 })} /></Field>
        <Field label="Valid for (days)"><input className="input" inputMode="numeric" value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) || 1 })} /></Field>
        <Field label="Applies to"><select className="input" value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value as VoucherScope })}><option value="all">Food & shopping</option><option value="food">Food only</option><option value="shop">Shopping only</option></select></Field>
        <Field label="Description" className="sm:col-span-2"><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold"><Toggle checked={f.firstOrderOnly} onChange={(v) => setF({ ...f, firstOrderOnly: v })} /> First order only</label>
      </div>
    </Modal>
  )
}

// ---------------- Users ----------------
function UsersAdmin() {
  const users = useStore((s) => s.db.users)
  const orders = useStore((s) => s.db.orders)
  const addresses = useStore((s) => s.db.addresses)
  const login = useStore((s) => s.login)
  const addUser = useStore((s) => s.addUser)
  const deleteUser = useStore((s) => s.deleteUser)
  const current = useStore((s) => s.currentUserId)
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', phone: '', email: '', role: 'customer' as 'customer' | 'admin' })
  const create = () => {
    const phone = normalizeBdPhone(f.phone)
    if (f.name.trim().length < 2) return toast('error', 'Name is required')
    if (!phone) return toast('error', 'Enter a valid +880 mobile number')
    if (users.some((u) => u.phone === phone)) return toast('error', 'Phone already in use')
    addUser({ name: f.name.trim(), phone, email: f.email.trim(), role: f.role, avatarColor: ['#0A7F57', '#EA580C', '#0E7490', '#B45309', '#334155'][users.length % 5] })
    toast('success', 'Demo user created')
    setOpen(false)
    setF({ name: '', phone: '', email: '', role: 'customer' })
  }
  return (
    <>
      <H title="Users" sub="Demo accounts stored in this browser" action={<button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Plus className="size-4" /> Add user</button>} />
      <Table head={['User', 'Phone', 'Orders', 'Addresses', 'Role', '']}>
        {users.map((u) => (
          <tr key={u.id} className="hover:bg-ink-50">
            <td className="px-3 py-2"><div className="flex items-center gap-2"><Avatar name={u.name} color={u.avatarColor} size={32} /><div><p className="font-semibold">{u.name}{u.id === current && <Badge tone="success" className="ml-2">Signed in</Badge>}</p><p className="text-xs text-ink-500">{u.email || '—'}</p></div></div></td>
            <td className="px-3 py-2 font-mono text-xs">{prettyPhone(u.phone)}</td>
            <td className="px-3 py-2">{orders.filter((o) => o.userId === u.id).length}</td>
            <td className="px-3 py-2">{addresses.filter((a) => a.userId === u.id).length}</td>
            <td className="px-3 py-2"><Badge tone={u.role === 'admin' ? 'brand' : 'neutral'}>{u.role}</Badge></td>
            <td className="px-3 py-2"><div className="flex gap-1">
              <button disabled={u.id === current} className="btn btn-ghost btn-sm" onClick={() => { login(u.id); toast('success', `Now signed in as ${u.name}`); nav('/') }}><LogIn className="size-4" /> Switch to</button>
              <button className="icon-btn size-8 text-red-600" title="Delete user" onClick={async () => { if (await confirmDialog({ title: `Delete ${u.name}?`, body: 'Their addresses and orders will be removed.', confirmLabel: 'Delete', tone: 'danger' })) deleteUser(u.id) }}><Trash2 className="size-4" /></button>
            </div></td>
          </tr>
        ))}
      </Table>
      <Modal open={open} onClose={() => setOpen(false)} title="Add demo user" footer={<button className="btn btn-primary w-full" onClick={create}>Create user</button>}>
        <div className="grid gap-3">
          <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Mobile (+880)"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="01XXXXXXXXX" /></Field>
          <Field label="Email (optional)"><input className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Role"><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as 'customer' | 'admin' })}><option value="customer">Customer</option><option value="admin">Admin</option></select></Field>
        </div>
      </Modal>
    </>
  )
}

// ---------------- Settings ----------------
function SettingsAdmin() {
  const settings = useStore((s) => s.settings)
  const update = useStore((s) => s.updateSettings)
  const reset = useStore((s) => s.resetDemo)
  const db = useStore((s) => s.db)
  const size = useMemo(() => Math.round(JSON.stringify(db).length / 1024), [db])
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `pikk-demo-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <>
      <H title="Simulation settings" />
      <div className="card divide-y divide-ink-100">
        <div className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex-1 min-w-[200px]"><p className="font-semibold">Global simulation speed</p><p className="text-xs text-ink-500">How fast active orders progress. Real-time = food ≈ 30 min, shopping ≈ 1 day.</p></div>
          <div className="flex rounded-xl bg-ink-100 p-0.5">{([1, 10, 60] as SimSpeed[]).map((s) => <button key={s} onClick={() => update({ simSpeed: s })} className={cx('h-8 rounded-lg px-3 text-xs font-bold', settings.simSpeed === s ? 'bg-white shadow-sm text-brand-700' : 'text-ink-500')}>{s}×</button>)}</div>
        </div>
        <div className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex-1 min-w-[200px]"><p className="font-semibold">Next welcome spin result</p><p className="text-xs text-ink-500">Force the outcome of the next Lucky Wheel spin (for demos and testing). Resets to random after one spin.</p></div>
          <select aria-label="Next welcome spin result" className="input h-9 w-auto" value={settings.nextSpin ?? ''} onChange={(e) => update({ nextSpin: e.target.value || null })}>
            <option value="">Random (real odds)</option>
            {WHEEL_SEGMENTS.map((g) => <option key={g.id} value={g.id}>{g.headline}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex-1 min-w-[200px]"><p className="font-semibold">Export data</p><p className="text-xs text-ink-500">Download the full simulation database as JSON (~{size} KB). Useful as a template for real catalog data.</p></div>
          <button className="btn btn-secondary btn-sm" onClick={exportJson}><Download className="size-4" /> Export JSON</button>
        </div>
        <div className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex-1 min-w-[200px]"><p className="font-semibold">Reset demo data</p><p className="text-xs text-ink-500">Restore the original seed (restaurants, products, users, orders, vouchers).</p></div>
          <button className="btn btn-danger btn-sm" onClick={async () => { if (await confirmDialog({ title: 'Reset all demo data?', body: 'All changes made in the control panel will be lost.', confirmLabel: 'Reset', tone: 'danger' })) { reset(); toast('success', 'Demo data reset') } }}><RotateCcw className="size-4" /> Reset</button>
        </div>
      </div>
    </>
  )
}
