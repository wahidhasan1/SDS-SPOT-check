import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, CreditCard, Heart, Headphones, LayoutDashboard, LogOut, MapPin, Package, Pencil, PiggyBank, Settings, TicketPercent, User, Brain } from 'lucide-react'
import { useMe, useStore } from '../store/store'
import { confirmDialog, toast } from '../store/toast'
import { fmtDate, prettyPhone, taka } from '../lib/format'
import { useTitle } from '../lib/hooks'
import { Avatar, Badge } from '../components/ui'

export default function Account() {
  useTitle('Account')
  const me = useMe()!
  const nav = useNavigate()
  const logout = useStore((s) => s.logout)
  const orders = useStore((s) => s.db.orders).filter((o) => o.userId === me.id)
  const addresses = useStore((s) => s.db.addresses).filter((a) => a.userId === me.id)
  const unread = useStore((s) => s.db.notifications).filter((n) => n.userId === me.id && !n.read).length
  const vouchers = useStore((s) => s.db.vouchers).filter((v) => v.active && v.expiresAt > Date.now()).length
  const delivered = orders.filter((o) => o.status === 'delivered')
  const notSpent = delivered.reduce((a, o) => a + o.total, 0)
  const checkins = delivered.filter((o) => o.cravingBefore && o.cravingAfter)
  const eased = checkins.length ? Math.round((checkins.filter((o) => o.cravingAfter! < o.cravingBefore!).length / checkins.length) * 100) : null

  const items = [
    { to: '/account/profile', icon: User, label: 'Profile', sub: 'Name, phone, email' },
    { to: '/account/addresses', icon: MapPin, label: 'Saved addresses', sub: `${addresses.length} saved` },
    { to: '/orders', icon: Package, label: 'Orders', sub: `${orders.length} simulated orders` },
    { to: '/favorites', icon: Heart, label: 'Favourites', sub: 'Restaurants, food, products, stores' },
    { to: '/offers', icon: TicketPercent, label: 'Vouchers', sub: `${vouchers} available` },
    { to: '/account/payments', icon: CreditCard, label: 'Payment methods', sub: 'Demo wallets & test cards' },
    { to: '/notifications', icon: Bell, label: 'Notifications', sub: unread ? `${unread} unread` : 'All caught up' },
    { to: '/help', icon: Headphones, label: 'Help & Support', sub: 'FAQ, chat (simulated)' },
    { to: '/account/settings', icon: Settings, label: 'Settings', sub: 'Language, simulation speed, privacy' },
    { to: '/admin', icon: LayoutDashboard, label: 'Demo Control Panel', sub: 'Admin tools for the simulation' },
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 animate-fade-in">
      <div className="card overflow-hidden">
        <div className="bg-brand-gradient h-20" />
        <div className="px-5 pb-5">
          <div className="-mt-10 flex items-end gap-4">
            <span className="rounded-full ring-4 ring-white"><Avatar name={me.name} color={me.avatarColor} size={80} /></span>
            <Link to="/account/profile" className="btn btn-secondary btn-sm mb-1 ml-auto"><Pencil className="size-4" /> Edit</Link>
          </div>
          <h1 className="mt-3 font-display text-2xl font-extrabold">{me.name}</h1>
          <p className="text-sm text-ink-500">{prettyPhone(me.phone)}{me.email && ` · ${me.email}`}</p>
          <div className="mt-2 flex flex-wrap gap-1.5"><Badge tone="warning">Demo account</Badge>{me.role === 'admin' && <Badge tone="brand">Admin</Badge>}<Badge tone="neutral">Member since {fmtDate(me.joinedAt)}</Badge></div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat icon={<Package className="size-5 text-brand-600" />} label="Cravings simulated" value={String(delivered.length)} />
        <Stat icon={<PiggyBank className="size-5 text-coral-500" />} label="Money not spent" value={taka(notSpent)} />
        <Stat icon={<Brain className="size-5 text-emerald-600" />} label="Cravings eased" value={eased === null ? '—' : `${eased}%`} />
      </div>

      <div className="mt-4 card divide-y divide-ink-100 overflow-hidden">
        {items.map(({ to, icon: Icon, label, sub }) => (
          <Link key={to} to={to} className="flex items-center gap-4 px-4 py-3.5 hover:bg-ink-50">
            <span className="grid size-10 place-items-center rounded-xl bg-ink-50 text-ink-700"><Icon className="size-5" /></span>
            <span className="flex-1"><span className="block font-semibold">{label}</span><span className="block text-xs text-ink-500">{sub}</span></span>
            <ChevronRight className="size-5 text-ink-300" />
          </Link>
        ))}
        <button onClick={async () => { if (await confirmDialog({ title: 'Log out?', body: 'Your simulated orders and saved data stay on this device.', confirmLabel: 'Log out', tone: 'danger' })) { logout(); toast('info', 'Logged out'); nav('/') } }} className="flex w-full items-center gap-4 px-4 py-3.5 text-left text-red-600 hover:bg-red-50">
          <span className="grid size-10 place-items-center rounded-xl bg-red-50"><LogOut className="size-5" /></span>
          <span className="font-semibold">Log out</span>
        </button>
      </div>
    </div>
  )
}

const Stat = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => (
  <div className="card p-3 sm:p-4">
    {icon}
    <p className="mt-2 font-display text-lg sm:text-2xl font-extrabold leading-none">{value}</p>
    <p className="mt-1 text-[11px] sm:text-xs text-ink-500">{label}</p>
  </div>
)
