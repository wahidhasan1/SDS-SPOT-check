import { useEffect, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpenText, Bell, GraduationCap, Home, Library, Mic, PhoneCall, ScanText, Shield, Swords, User } from 'lucide-react'
import { api } from '../lib/api'
import { socket } from '../lib/ws'
import { useUser } from '../lib/session'
import { useCall } from '../features/call/engine'
import { Logo } from './Logo'
import { Avatar, cx, mmss, toast } from './ui'

const DESKTOP = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/ielts', label: 'IELTS', icon: GraduationCap },
  { to: '/speak', label: 'Speaking', icon: Mic },
  { to: '/battles', label: 'Battles', icon: Swords },
  { to: '/read', label: 'Read with AI', icon: ScanText },
  { to: '/vocab', label: 'Vocabulary', icon: Library },
  { to: '/grammar', label: 'Grammar', icon: BookOpenText },
  { to: '/profile', label: 'Profile', icon: User },
]
const MOBILE = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/ielts', label: 'IELTS', icon: GraduationCap },
  { to: '/speak', label: 'Speak', icon: Mic },
  { to: '/learn', label: 'Learn', icon: Library, also: ['/vocab', '/grammar', '/battles', '/read'] },
  { to: '/profile', label: 'Profile', icon: User },
]

function NotificationBell() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ unread: number }>('/notifications'), refetchInterval: 120_000 })
  useEffect(
    () =>
      socket.on('notify', (m) => {
        qc.invalidateQueries({ queryKey: ['notifications'] })
        if (m.kind !== 'battle_invite') toast(String(m.title), 'info')
      }),
    [qc],
  )
  return (
    <Link to="/notifications" className="btn btn-ghost relative size-10 p-0" aria-label={`Notifications${data?.unread ? `, ${data.unread} unread` : ''}`}>
      <Bell className="size-5" />
      {!!data?.unread && <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">{data.unread > 9 ? '9+' : data.unread}</span>}
    </Link>
  )
}

/** Visible everywhere while a call is running, so leaving the call screen never loses the call. */
function ReturnToCall() {
  const call = useCall()
  const loc = useLocation()
  const nav = useNavigate()
  if (loc.pathname.startsWith('/speak/call') || !['matching', 'found', 'connecting', 'connected', 'reconnecting'].includes(call.phase)) return null
  const label = call.phase === 'matching' ? 'Finding a partner…' : call.phase === 'connected' ? `In call · ${mmss(call.elapsedMs)}` : 'Connecting your call…'
  return (
    <button onClick={() => nav('/speak/call')} className="fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-talk px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-pop)] md:bottom-6">
      <PhoneCall className="size-4" /> {label} · Return
    </button>
  )
}

export function AppLayout() {
  const me = useUser()
  const loc = useLocation()
  const immersive = loc.pathname.startsWith('/speak/call') || /^\/ielts\/(test|mock)\//.test(loc.pathname)

  useEffect(() => {
    socket.connect()
  }, [])

  if (immersive)
    return (
      <>
        <Outlet />
        <ReturnToCall />
      </>
    )

  return (
    <div className="md:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 md:flex">
        <Link to="/" className="mb-6 px-3">
          <Logo />
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5" aria-label="Main">
          {DESKTOP.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors', isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-2 hover:text-text')}>
              <n.icon className="size-5" /> {n.label}
            </NavLink>
          ))}
          {me.role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => cx('mt-2 flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold', isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-2 hover:text-text')}>
              <Shield className="size-5" /> Admin
            </NavLink>
          )}
        </nav>
        <Link to="/profile" className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2">
          <Avatar icon={me.profile.avatarIcon} color={me.profile.avatarColor} size={36} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{me.profile.displayName}</span>
            <span className="block truncate text-xs text-muted">{me.plan.planName} plan</span>
          </span>
        </Link>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur md:h-16 md:justify-end md:px-6">
          <Link to="/" className="md:hidden">
            <Logo size={26} />
          </Link>
          <div className="flex items-center gap-1">
            {me.role === 'admin' && (
              <Link to="/admin" className="btn btn-ghost size-10 p-0 md:hidden" aria-label="Admin">
                <Shield className="size-5" />
              </Link>
            )}
            <NotificationBell />
          </div>
        </header>
        <main id="main">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Main">
        {MOBILE.map((n) => {
          const active = n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to) || n.also?.some((p) => loc.pathname.startsWith(p))
          return (
            <Link key={n.to} to={n.to} className={cx('flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold', active ? 'text-primary' : 'text-muted')} aria-current={active ? 'page' : undefined}>
              <n.icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
              {n.label}
            </Link>
          )
        })}
      </nav>
      <ReturnToCall />
    </div>
  )
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between px-5">
        <Link to="/welcome">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center">{children}</main>
    </div>
  )
}
