import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Bell, LogOut, Menu, X, Flame } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { ADMIN_ITEM, MOBILE_TABS, NAV, type NavItem } from './nav';
import { Logo } from './Logo';

function NavItemLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/ielts'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
          isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
        }`
      }
    >
      <Icon className="h-[18px] w-[18px]" />
      {item.label}
    </NavLink>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { me } = useAuth();
  return (
    <nav className="flex flex-col gap-5" aria-label="Main">
      {NAV.map((s) => (
        <div key={s.title || 'main'}>
          {s.title && <div className="mb-1.5 px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">{s.title}</div>}
          <div className="flex flex-col gap-0.5">
            {s.items.map((i) => (
              <NavItemLink key={i.to} item={i} onClick={onNavigate} />
            ))}
          </div>
        </div>
      ))}
      {me?.role === 'admin' && (
        <div>
          <div className="mb-1.5 px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">Administration</div>
          <NavItemLink item={ADMIN_ITEM} onClick={onNavigate} />
        </div>
      )}
    </nav>
  );
}

export function AppLayout() {
  const { me, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [drawer, setDrawer] = useState(false);
  const unread = useApi<{ unread: number }>('/api/notifications/unread-count', [loc.pathname]);
  const streak = useApi<{ current: number }>('/api/progress/streak', [loc.pathname === '/dashboard']);

  useEffect(() => setDrawer(false), [loc.pathname]);

  const doLogout = async () => {
    await logout();
    nav('/login');
  };

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white px-3 py-5 lg:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 px-3">
          <Logo to="/dashboard" />
        </div>
        <SidebarNav />
        <div className="mt-auto border-t border-slate-100 pt-4 dark:border-slate-800">
          <button onClick={doLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
            <LogOut className="h-[18px] w-[18px]" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-900/90">
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => setDrawer(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden">
            <Logo to="/dashboard" />
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <NavLink to="/progress" className="hidden items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700 sm:flex dark:bg-orange-900/30 dark:text-orange-300" title="Study streak (days in a row)">
              <Flame className="h-4 w-4" /> {streak.data?.current ?? 0}
            </NavLink>
            <NavLink to="/notifications" className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {(unread.data?.unread ?? 0) > 0 && (
                <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread.data!.unread}</span>
              )}
            </NavLink>
            <NavLink to="/profile" className="flex items-center gap-2 rounded-full py-1 pr-1 pl-1 hover:bg-slate-100 sm:pr-3 dark:hover:bg-slate-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">{me?.profile.displayName.slice(0, 1).toUpperCase()}</span>
              <span className="hidden max-w-[140px] truncate text-sm font-medium sm:block">{me?.profile.displayName}</span>
            </NavLink>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 sm:px-6 lg:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col overflow-y-auto bg-white px-3 py-5 dark:bg-slate-900">
            <div className="mb-6 flex items-center justify-between px-3">
              <Logo to="/dashboard" />
              <button onClick={() => setDrawer(false)} className="rounded-lg p-1 text-slate-500" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav onNavigate={() => setDrawer(false)} />
            <button onClick={doLogout} className="mt-6 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400">
              <LogOut className="h-[18px] w-[18px]" /> Sign out
            </button>
          </div>
        </div>
      )}

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden dark:border-slate-800 dark:bg-slate-900" aria-label="Quick navigation">
        {MOBILE_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <NavLink key={t.to} to={t.to} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500'}`}>
              <Icon className="h-5 w-5" />
              {t.label}
            </NavLink>
          );
        })}
        <button onClick={() => setDrawer(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500">
          <Menu className="h-5 w-5" />
          More
        </button>
      </nav>
    </div>
  );
}
