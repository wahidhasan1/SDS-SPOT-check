import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, ChevronDown, CircleAlert, CircleCheck, FlaskConical, Heart, House, Info, MapPin, Search, ShoppingBag,
  ShoppingCart, Shirt, TriangleAlert, User, UtensilsCrossed, X, Bike, ReceiptText, WifiOff,
} from 'lucide-react'
import { useCurrentArea, useMe, useStore } from '../store/store'
import { useConfirmStore, useToasts } from '../store/toast'
import { useUI } from '../store/ui'
import { areaById } from '../data/areas'
import { cx } from '../lib/format'
import { isActive, minutesLeft, stageLabel } from '../lib/sim'
import { useT } from '../i18n'
import { useNow } from '../lib/hooks'
import { Logo, LogoMark } from './Logo'
import { AddressFormModal, LocationModal } from './location'
import { SearchBox } from './SearchBox'
import { Avatar, Modal } from './ui'

function SimTicker() {
  const tick = useStore((s) => s.tick)
  useEffect(() => {
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [tick])
  return null
}

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }), [pathname])
  return null
}

function SimulationChip() {
  const setHow = useUI((s) => s.setHowOpen)
  return (
    <button onClick={() => setHow(true)} className="inline-flex h-7 items-center gap-1 rounded-full border border-sun-300 bg-sun-50 px-2.5 text-[11px] font-bold uppercase tracking-wide text-sun-800 hover:bg-sun-100" aria-label="This is a simulation. Learn how pikk works">
      <FlaskConical className="size-3.5" /> Demo
    </button>
  )
}

/** Explains the concept in three steps; opened from the Demo chip, the home page and the footer. */
export function HowItWorksModal() {
  const open = useUI((s) => s.howOpen)
  const setOpen = useUI((s) => s.setHowOpen)
  const steps = [
    { icon: Search, title: 'Pick anything', body: 'Browse real-looking food and fashion from fictional local spots.' },
    { icon: ShoppingCart, title: 'Order for real (almost)', body: 'Cart, vouchers, checkout and demo payment work just like a real app.' },
    { icon: Bike, title: 'Track it, then let it go', body: 'Follow your order to “delivered”. Nothing is charged, ordered or delivered.' },
  ]
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="How pikk works" size="sm"
      footer={<button className="btn btn-primary w-full" onClick={() => setOpen(false)}>Got it, start exploring</button>}>
      <p className="text-[15px] text-ink-500">pikk is a craving simulator. You get the fun of ordering without spending money or receiving anything.</p>
      <ol className="mt-5 space-y-4">
        {steps.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="flex gap-3">
            <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <Icon className="size-5" />
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-ink-900 text-[11px] font-bold text-white">{i + 1}</span>
            </span>
            <span><span className="block font-bold">{title}</span><span className="block text-sm text-ink-500">{body}</span></span>
          </li>
        ))}
      </ol>
      <p className="mt-5 flex items-start gap-2 rounded-xl bg-ink-50 p-3 text-[13px] text-ink-700"><FlaskConical className="mt-0.5 size-4 shrink-0 text-sun-700" /> All restaurants, brands, riders and payments are fictional. Data stays in your browser.</p>
    </Modal>
  )
}

function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  if (online) return null
  return (
    <div role="status" className="bg-ink-900 px-4 py-2 text-center text-[13px] font-semibold text-white">
      <WifiOff className="mr-1.5 inline size-4" /> You're offline. Browsing still works and your changes are saved on this device.
    </div>
  )
}

function LocationButton({ className }: { className?: string }) {
  const setOpen = useUI((s) => s.setLocationOpen)
  const { areaId, address } = useCurrentArea()
  const area = areaById(areaId)
  return (
    <button onClick={() => setOpen(true)} className={cx('flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-left hover:bg-ink-100 transition min-w-0', className)} aria-label={`Delivery location: ${area.name}. Change`}>
      <MapPin className="size-[18px] shrink-0 text-brand-600" />
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold text-ink-500 leading-tight">{address ? `Deliver to ${address.label}` : 'Deliver to'}</span>
        <span className="flex items-center gap-0.5 text-[13px] font-bold leading-tight">
          <span className="truncate">{area.name}</span>
          <ChevronDown className="size-3.5 shrink-0" />
        </span>
      </span>
    </button>
  )
}

function CartButton() {
  const cartCount = useStore((s) => s.cart.reduce((a, l) => a + l.qty, 0))
  return (
    <Link to="/cart" className="icon-btn" aria-label={`Cart, ${cartCount} items`}>
      <ShoppingBag className="size-[21px]" />
      {cartCount > 0 && <span key={cartCount} className="animate-bump absolute right-0 top-0 grid min-w-[18px] h-[18px] place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">{cartCount}</span>}
    </Link>
  )
}

function Header() {
  const t = useT()
  const nav = useNavigate()
  const me = useMe()
  const unread = useStore((s) => s.db.notifications.filter((n) => n.userId === s.currentUserId && !n.read).length)
  const link = ({ isActive }: { isActive: boolean }) => cx('px-3 py-2 rounded-xl text-sm font-bold transition', isActive ? 'text-brand-700 bg-brand-50' : 'text-ink-700 hover:bg-ink-100')
  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/95 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4">
        <Link to="/" className="shrink-0" aria-label="pikk home">
          <span className="hidden sm:inline-flex"><Logo compact /></span>
          <span className="sm:hidden"><LogoMark size={32} /></span>
        </Link>
        <span className="hidden sm:inline-flex"><SimulationChip /></span>
        <LocationButton className="max-w-[40vw] sm:max-w-[170px]" />
        <SearchBox className="hidden md:block flex-1 max-w-lg mx-2" />
        <nav className="hidden lg:flex items-center gap-0.5" aria-label="Main">
          <NavLink to="/food" className={link}>{t('nav.food')}</NavLink>
          <NavLink to="/shop" className={link}>{t('nav.shop')}</NavLink>
          <NavLink to="/offers" className={link}>Deals</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-0.5">
          <span className="sm:hidden"><SimulationChip /></span>
          <button className="icon-btn md:hidden" aria-label="Search" onClick={() => nav('/search')}><Search className="size-[21px]" /></button>
          <Link to="/favorites" className="icon-btn hidden md:inline-flex" aria-label={t('nav.favorites')}><Heart className="size-[21px]" /></Link>
          <Link to="/notifications" className="icon-btn hidden sm:inline-flex" aria-label={`${t('nav.notifications')}${unread ? `, ${unread} unread` : ''}`}>
            <Bell className="size-[21px]" />
            {unread > 0 && <span className="absolute right-1 top-1 grid min-w-[18px] h-[18px] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">{unread > 9 ? '9+' : unread}</span>}
          </Link>
          <CartButton />
          {me ? (
            <Link to="/account" className="ml-1 hidden md:inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-ink-100" aria-label="Account">
              <Avatar name={me.name} color={me.avatarColor} size={32} />
              <span className="text-sm font-bold hidden xl:inline">{me.name.split(' ')[0]}</span>
            </Link>
          ) : (
            <Link to="/login?mode=signup" className="btn btn-primary btn-sm ml-2 hidden md:inline-flex">Sign up</Link>
          )}
        </div>
      </div>
    </header>
  )
}

function BottomNav() {
  const t = useT()
  const activeOrders = useStore((s) => s.db.orders.filter((o) => o.userId === s.currentUserId && isActive(o)).length)
  const items = [
    { to: '/', icon: House, label: t('nav.home'), end: true },
    { to: '/food', icon: UtensilsCrossed, label: t('nav.food') },
    { to: '/shop', icon: Shirt, label: t('nav.shop') },
    { to: '/orders', icon: ReceiptText, label: t('nav.orders'), badge: activeOrders },
    { to: '/account', icon: User, label: t('nav.account') },
  ]
  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white/95 backdrop-blur-lg pb-safe" aria-label="Primary">
      <div className="grid grid-cols-5">
        {items.map(({ to, icon: Icon, label, end, badge }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('relative flex flex-col items-center gap-0.5 pt-2 pb-1.5 min-h-14 text-[11px] font-bold transition', isActive ? 'text-brand-700' : 'text-ink-500')}>
            {({ isActive }) => (
              <>
                <span className={cx('grid h-7 w-12 place-items-center rounded-full transition', isActive && 'bg-brand-100')}>
                  <Icon className="size-[21px]" strokeWidth={isActive ? 2.4 : 2} />
                </span>
                {label}
                {!!badge && <span className="absolute left-1/2 top-1 ml-2 grid min-w-[17px] h-[17px] place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">{badge}</span>}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function ActiveOrderPill({ hasBottomNav }: { hasBottomNav: boolean }) {
  useNow(10000)
  const { pathname } = useLocation()
  const uid = useStore((s) => s.currentUserId)
  const orders = useStore((s) => s.db.orders)
  const active = orders.filter((o) => o.userId === uid && isActive(o)).sort((a, b) => b.placedAt - a.placedAt)
  const o = active[0]
  if (!o || pathname.startsWith('/orders/') || pathname.startsWith('/checkout') || pathname.startsWith('/admin') || pathname.startsWith('/cart') || pathname.startsWith('/restaurant/') || pathname.startsWith('/product/') || pathname.startsWith('/help/chat') || pathname.startsWith('/login')) return null
  const left = minutesLeft(o)
  return (
    <Link
      to={`/orders/${o.id}`}
      className={cx('fixed left-1/2 z-30 -translate-x-1/2 md:left-6 md:translate-x-0 flex items-center gap-3 rounded-full bg-ink-900 py-2 pl-2 pr-4 text-white shadow-lift animate-slide-up max-w-[calc(100vw-24px)]', hasBottomNav ? 'bottom-[76px] md:bottom-6' : 'bottom-6')}
    >
      <span className="relative grid size-9 place-items-center rounded-full bg-brand-600">
        <span className="absolute inset-0 rounded-full bg-brand-500 animate-ping-slow opacity-60" />
        <Bike className="relative size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-bold leading-tight truncate">{stageLabel(o.kind, o.status).title} · {o.storeName}</span>
        <span className="block text-[11px] text-white/70 leading-tight">
          {left >= 60 ? `~${Math.round(left / 60)} hr` : `~${Math.max(1, Math.ceil(left))} min`} left · Test order
        </span>
      </span>
      {active.length > 1 ? <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold">+{active.length - 1}</span> : <ReceiptText className="size-4 text-white/60 shrink-0" />}
    </Link>
  )
}

function Toaster() {
  const items = useToasts((s) => s.items)
  const dismiss = useToasts((s) => s.dismiss)
  const icon = { success: CircleCheck, error: CircleAlert, info: Info, warning: TriangleAlert }
  const color = { success: 'text-emerald-500', error: 'text-red-500', info: 'text-brand-500', warning: 'text-amber-500' }
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3 sm:top-auto sm:bottom-6 sm:right-6 sm:left-auto sm:items-end" aria-live="polite">
      {items.map((t, i) => {
        const Icon = icon[t.tone]
        return (
          <div key={t.id} className={cx('pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-ink-100 bg-white p-3.5 shadow-lift animate-slide-up', i < items.length - 2 && 'max-sm:hidden')}>
            <Icon className={cx('mt-0.5 size-5 shrink-0', color[t.tone])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-snug">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[13px] text-ink-500 leading-snug">{t.body}</p>}
            </div>
            {t.action && (
              <button className="text-sm font-bold text-brand-700 hover:underline" onClick={() => { t.action!.onClick(); dismiss(t.id) }}>{t.action.label}</button>
            )}
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-ink-400 hover:text-ink-700"><X className="size-4" /></button>
          </div>
        )
      })}
    </div>
  )
}

function ConfirmHost() {
  const open = useConfirmStore((s) => s.open)
  const close = useConfirmStore((s) => s.close)
  return (
    <Modal open={!!open} onClose={() => close(false)} size="sm" title={open?.title}
      footer={
        <div className="flex gap-2">
          <button className="btn btn-secondary flex-1" onClick={() => close(false)}>{open?.cancelLabel ?? 'Cancel'}</button>
          <button className={cx('btn flex-1', open?.tone === 'danger' ? 'btn-danger' : 'btn-primary')} onClick={() => close(true)} autoFocus>{open?.confirmLabel ?? 'Confirm'}</button>
        </div>
      }
    >
      {open?.body && <p className="text-sm text-ink-500">{open.body}</p>}
    </Modal>
  )
}

function Footer() {
  const setHow = useUI((s) => s.setHowOpen)
  return (
    <footer className="mt-16 border-t border-ink-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div className="space-y-3">
          <Logo />
          <p className="text-ink-500 text-[13px]">Browse, order and track food and fashion across Dhaka without spending a taka.</p>
        </div>
        <div>
          <p className="font-bold mb-2">Explore</p>
          <ul className="space-y-1.5 text-ink-500">
            <li><Link to="/food" className="hover:text-brand-700">Food</Link></li>
            <li><Link to="/shop" className="hover:text-brand-700">Fashion & lifestyle</Link></li>
            <li><Link to="/offers" className="hover:text-brand-700">Deals & vouchers</Link></li>
            <li><Link to="/search" className="hover:text-brand-700">Search</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-bold mb-2">You</p>
          <ul className="space-y-1.5 text-ink-500">
            <li><Link to="/orders" className="hover:text-brand-700">Orders</Link></li>
            <li><Link to="/account/vouchers" className="hover:text-brand-700">My vouchers</Link></li>
            <li><Link to="/help" className="hover:text-brand-700">Help & support</Link></li>
            <li><Link to="/admin" className="hover:text-brand-700">Demo control panel</Link></li>
          </ul>
        </div>
        <div className="rounded-2xl bg-sun-50 border border-sun-200 p-4 text-[13px] text-ink-700">
          <p className="font-bold flex items-center gap-1.5 text-ink-900"><FlaskConical className="size-4 text-sun-700" /> It's a simulation</p>
          <p className="mt-1">No money is charged, no orders reach a business and nothing is delivered. Every restaurant, brand and rider is fictional.</p>
          <button onClick={() => setHow(true)} className="mt-2 font-bold text-brand-700 hover:underline">How pikk works</button>
        </div>
      </div>
      <div className="border-t border-ink-100 py-4 text-center text-xs text-ink-400">© {new Date().getFullYear()} pikk (prototype) · Pick anything. Pay nothing.</div>
    </footer>
  )
}

export default function Layout() {
  const { pathname } = useLocation()
  const focused = /^\/(checkout|admin|help\/chat|login|welcome)/.test(pathname)
  const hasBottomNav = !focused
  return (
    <div className="min-h-dvh flex flex-col">
      <SimTicker />
      <ScrollTop />
      <OfflineBanner />
      {!/^\/(admin|checkout|help\/chat|welcome)/.test(pathname) && <Header />}
      <main className="flex-1">
        <Outlet />
      </main>
      {!focused && <Footer />}
      {hasBottomNav && <BottomNav />}
      <ActiveOrderPill hasBottomNav={hasBottomNav} />
      <LocationModal />
      <AddressFormModal />
      <HowItWorksModal />
      <ConfirmHost />
      <Toaster />
      {hasBottomNav && <div className="h-20 md:hidden" />}
    </div>
  )
}
