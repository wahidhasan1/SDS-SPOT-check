import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, ChevronDown, CircleAlert, CircleCheck, FlaskConical, Heart, House, Info, MapPin, Search, ShoppingBag,
  ShoppingCart, Shirt, TriangleAlert, User, UtensilsCrossed, X, Bike, ReceiptText,
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

export function DemoBanner() {
  const t = useT()
  return (
    <div className="bg-ink-900 text-white text-[12px]">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-1.5 text-center">
        <FlaskConical className="size-3.5 text-amber-300 shrink-0" />
        <span className="font-semibold text-amber-200">DEMO</span>
        <span className="text-white/80 truncate hidden sm:inline">{t('demo.banner')}</span>
        <span className="text-white/80 truncate sm:hidden">{t('demo.bannerShort')}</span>
      </div>
    </div>
  )
}

function LocationButton({ className }: { className?: string }) {
  const t = useT()
  const setOpen = useUI((s) => s.setLocationOpen)
  const { areaId, address } = useCurrentArea()
  const area = areaById(areaId)
  return (
    <button onClick={() => setOpen(true)} className={cx('flex items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-ink-100 transition min-w-0', className)}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-coral-50 text-coral-600"><MapPin className="size-[18px]" /></span>
      <span className="min-w-0">
        <span className="block text-[11px] font-medium text-ink-500 leading-tight">{t('common.deliverTo')}{address ? ` · ${address.label}` : ''}</span>
        <span className="flex items-center gap-1 text-[13px] font-bold leading-tight truncate">
          <span className="truncate">{address ? `${address.road}, ${area.name}` : `${area.name}, ${area.city}`}</span>
          <ChevronDown className="size-3.5 shrink-0" />
        </span>
      </span>
    </button>
  )
}

function Header() {
  const t = useT()
  const nav = useNavigate()
  const me = useMe()
  const cartCount = useStore((s) => s.cart.reduce((a, l) => a + l.qty, 0))
  const unread = useStore((s) => s.db.notifications.filter((n) => n.userId === s.currentUserId && !n.read).length)
  const link = ({ isActive }: { isActive: boolean }) => cx('px-3 py-2 rounded-xl text-sm font-semibold transition', isActive ? 'text-brand-700 bg-brand-50' : 'text-ink-700 hover:bg-ink-100')
  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/90 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Link to="/" className="shrink-0" aria-label="Dopamine Kitchen home">
          <span className="hidden sm:inline-flex"><Logo compact /></span>
          <span className="sm:hidden"><LogoMark size={34} /></span>
        </Link>
        <LocationButton className="max-w-[46vw] sm:max-w-[220px]" />
        <SearchBox className="hidden md:block flex-1 max-w-xl mx-2" />
        <nav className="hidden lg:flex items-center gap-1">
          <NavLink to="/food" className={link}>{t('nav.food')}</NavLink>
          <NavLink to="/shop" className={link}>{t('nav.shop')}</NavLink>
          <NavLink to="/offers" className={link}>{t('nav.offers')}</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-0.5">
          <button className="icon-btn md:hidden" aria-label="Search" onClick={() => nav('/search')}><Search className="size-5" /></button>
          <Link to="/favorites" className="icon-btn hidden sm:inline-flex" aria-label={t('nav.favorites')}><Heart className="size-5" /></Link>
          <Link to="/notifications" className="icon-btn" aria-label={t('nav.notifications')}>
            <Bell className="size-5" />
            {unread > 0 && <span className="absolute right-1 top-1 grid min-w-[18px] h-[18px] place-items-center rounded-full bg-coral-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">{unread > 9 ? '9+' : unread}</span>}
          </Link>
          <Link to="/cart" className="icon-btn hidden md:inline-flex" aria-label={t('nav.cart')}>
            <ShoppingCart className="size-5" />
            {cartCount > 0 && <span className="absolute right-0.5 top-0.5 grid min-w-[18px] h-[18px] place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">{cartCount}</span>}
          </Link>
          {me ? (
            <Link to="/account" className="ml-1 hidden md:inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-ink-100" aria-label="Account">
              <Avatar name={me.name} color={me.avatarColor} size={32} />
              <span className="text-sm font-semibold hidden xl:inline">{me.name.split(' ')[0]}</span>
            </Link>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm ml-2 hidden md:inline-flex">Log in</Link>
          )}
        </div>
      </div>
    </header>
  )
}

function BottomNav() {
  const t = useT()
  const cartCount = useStore((s) => s.cart.reduce((a, l) => a + l.qty, 0))
  const items = [
    { to: '/', icon: House, label: t('nav.home'), end: true },
    { to: '/food', icon: UtensilsCrossed, label: t('nav.food') },
    { to: '/shop', icon: Shirt, label: t('nav.shop') },
    { to: '/cart', icon: ShoppingBag, label: t('nav.cart'), badge: cartCount },
    { to: '/account', icon: User, label: t('nav.account') },
  ]
  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white/95 backdrop-blur-lg pb-safe" aria-label="Primary">
      <div className="grid grid-cols-5">
        {items.map(({ to, icon: Icon, label, end, badge }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('relative flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-semibold transition', isActive ? 'text-brand-700' : 'text-ink-500')}>
            {({ isActive }) => (
              <>
                <span className={cx('grid h-7 w-12 place-items-center rounded-full transition', isActive && 'bg-brand-100')}>
                  <Icon className="size-[20px]" strokeWidth={isActive ? 2.4 : 2} />
                </span>
                {label}
                {!!badge && <span className="absolute left-1/2 top-1 ml-2 grid min-w-[17px] h-[17px] place-items-center rounded-full bg-coral-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">{badge}</span>}
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
  return (
    <footer className="mt-16 border-t border-ink-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div className="space-y-3">
          <Logo />
          <p className="text-ink-500 text-[13px]">A craving-reduction simulator for Bangladesh. Browse, order and track — without spending or receiving anything.</p>
        </div>
        <div>
          <p className="font-bold mb-2">Explore</p>
          <ul className="space-y-1.5 text-ink-500">
            <li><Link to="/food" className="hover:text-brand-700">Restaurants</Link></li>
            <li><Link to="/shop" className="hover:text-brand-700">Fashion & lifestyle</Link></li>
            <li><Link to="/offers" className="hover:text-brand-700">Offers & vouchers</Link></li>
            <li><Link to="/search" className="hover:text-brand-700">Search</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-bold mb-2">Account</p>
          <ul className="space-y-1.5 text-ink-500">
            <li><Link to="/orders" className="hover:text-brand-700">Orders</Link></li>
            <li><Link to="/favorites" className="hover:text-brand-700">Favourites</Link></li>
            <li><Link to="/help" className="hover:text-brand-700">Help & Support</Link></li>
            <li><Link to="/admin" className="hover:text-brand-700">Demo Control Panel</Link></li>
          </ul>
        </div>
        <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-[13px] text-amber-900">
          <p className="font-bold flex items-center gap-1.5"><FlaskConical className="size-4" /> This is a simulation</p>
          <p className="mt-1">No real money is charged, no orders reach any business, and nothing is delivered. All restaurants, brands, riders and payments are fictional.</p>
        </div>
      </div>
      <div className="border-t border-ink-100 py-4 text-center text-xs text-ink-400">© {new Date().getFullYear()} Dopamine Kitchen (prototype) · Feed the craving. Skip the delivery.</div>
    </footer>
  )
}

export default function Layout() {
  const { pathname } = useLocation()
  const focused = /^\/(checkout|admin|help\/chat|login)/.test(pathname)
  const hasBottomNav = !focused
  return (
    <div className="min-h-dvh flex flex-col">
      <SimTicker />
      <ScrollTop />
      <DemoBanner />
      {!/^\/(admin|checkout|help\/chat)/.test(pathname) && <Header />}
      <main className="flex-1">
        <Outlet />
      </main>
      {!focused && <Footer />}
      {hasBottomNav && <BottomNav />}
      <ActiveOrderPill hasBottomNav={hasBottomNav} />
      <LocationModal />
      <AddressFormModal />
      <ConfirmHost />
      <Toaster />
      {/* spacer so footer content isn't hidden behind the mobile nav */}
      {hasBottomNav && <div className="h-20 md:hidden" />}
    </div>
  )
}
