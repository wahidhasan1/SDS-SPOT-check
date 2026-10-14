"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  CircleHelp,
  Flame,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  Settings,
  ShieldCheck,
  Swords,
  Wrench,
  X,
} from "lucide-react";
import { titleForPath } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { api, errorMessage } from "@/lib/api-client";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/logo";
import { useToast } from "@/components/ui/toast";
import { DemoModeCard, NavLinks, SecondaryLinks } from "./sidebar";

export interface HeaderNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
}

interface TopBarProps {
  user: { displayName: string; avatar: string; isDemoAccount: boolean };
  streak: number;
  practicedToday: boolean;
  notifications: HeaderNotification[];
  demoMode: boolean;
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function TopBar({ user, streak, practicedToday, notifications, demoMode }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [drawer, setDrawer] = useState(false);
  const { open: bellOpen, setOpen: setBellOpen, ref: bellRef } = usePopover();
  const { open: menuOpen, setOpen: setMenuOpen, ref: menuRef } = usePopover();
  const unread = notifications.filter((n) => !n.read).length;
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);

  async function markAllRead() {
    try {
      await api("/api/notifications/read", { body: {} });
      router.refresh();
    } catch (error) {
      toast({ tone: "error", title: "Could not update notifications", description: errorMessage(error) });
    }
  }

  async function openNotification(n: HeaderNotification) {
    setBellOpen(false);
    if (!n.read) api("/api/notifications/read", { body: { id: n.id } }).then(() => router.refresh()).catch(() => {});
    if (n.href) router.push(n.href);
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await api("/api/auth/signout", { body: {} });
      router.push("/");
      router.refresh();
    } catch (error) {
      setSigningOut(false);
      toast({ tone: "error", title: "Sign out failed", description: errorMessage(error) });
    }
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line/80 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            className="-ml-1 rounded-xl p-2 text-ink-soft hover:bg-surface-muted lg:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Open navigation menu"
            aria-expanded={drawer}
          >
            <Menu className="h-6 w-6" />
          </button>
          <Link href="/dashboard" className="lg:hidden" aria-label="Pantora dashboard">
            <Logo className="[&_span:last-child]:hidden sm:[&_span:last-child]:inline" />
          </Link>
          <h1 className="hidden truncate text-lg font-bold tracking-tight text-ink lg:block">{titleForPath(pathname)}</h1>
          {demoMode && (
            <span className="hidden items-center rounded-full bg-streak-100 px-2.5 py-0.5 text-xs font-bold text-streak-700 md:inline-flex" title="Partners, calls, and sample data are simulated">
              Demo mode
            </span>
          )}

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/progress"
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-bold transition-colors",
                practicedToday ? "bg-streak-50 text-streak-700 hover:bg-streak-100" : "bg-surface-muted text-muted hover:bg-line",
              )}
              title={practicedToday ? "You practiced today" : "Practice today to keep your streak"}
              aria-label={`${streak}-day streak${practicedToday ? ", practiced today" : ", not practiced yet today"}`}
            >
              <Flame className={cn("h-4.5 w-4.5", practicedToday ? "fill-streak-400 text-streak-600" : "text-subtle")} aria-hidden />
              {streak}
            </Link>

            <div className="relative" ref={bellRef}>
              <button
                className="relative rounded-xl p-2 text-ink-soft hover:bg-surface-muted"
                onClick={() => setBellOpen(!bellOpen)}
                aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
                aria-expanded={bellOpen}
                aria-haspopup="true"
              >
                <Bell className="h-5.5 w-5.5" />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </button>
              {bellOpen && (
                <Popover className="w-[min(22rem,calc(100vw-2rem))]">
                  <div className="flex items-center justify-between border-b border-line px-4 py-3">
                    <p className="font-bold">Notifications</p>
                    {unread > 0 && (
                      <button className="text-xs font-semibold text-brand-600 hover:text-brand-800" onClick={markAllRead}>
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-muted">No notifications yet. Achievements and reminders will appear here.</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => openNotification(n)}
                          className={cn("flex w-full gap-3 border-b border-line/60 px-4 py-3 text-left last:border-0 hover:bg-surface-muted/70", !n.read && "bg-brand-50/50")}
                        >
                          <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand-500")} aria-hidden />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-ink">{n.title}</span>
                            <span className="mt-0.5 block text-sm text-muted">{n.body}</span>
                            <span className="mt-1 block text-xs text-subtle">{timeAgo(n.createdAt)}</span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </Popover>
              )}
            </div>

            <div className="relative" ref={menuRef}>
              <button
                className="flex items-center gap-2 rounded-xl p-1 pr-1 hover:bg-surface-muted sm:pr-2.5"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Open profile menu"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <Avatar name={user.displayName} avatar={user.avatar} size="sm" />
                <span className="hidden max-w-28 truncate text-sm font-semibold text-ink sm:block">{user.displayName}</span>
              </button>
              {menuOpen && (
                <Popover className="w-64" role="menu">
                  <div className="border-b border-line px-4 py-3">
                    <p className="font-bold text-ink">{user.displayName}</p>
                    <p className="text-xs text-muted">{user.isDemoAccount ? "Demo account · sample history included" : "Local demo profile"}</p>
                  </div>
                  <div className="p-1.5">
                    <MenuLink href="/settings" icon={<Settings className="h-4 w-4" />} onClick={() => setMenuOpen(false)}>
                      Settings
                    </MenuLink>
                    <MenuLink href="/safety" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => setMenuOpen(false)}>
                      Privacy & Safety
                    </MenuLink>
                    <MenuLink href="/help" icon={<CircleHelp className="h-4 w-4" />} onClick={() => setMenuOpen(false)}>
                      Help & Feedback
                    </MenuLink>
                    {demoMode && (
                      <MenuLink href="/admin" icon={<Wrench className="h-4 w-4" />} onClick={() => setMenuOpen(false)}>
                        Demo admin
                      </MenuLink>
                    )}
                    <button
                      role="menuitem"
                      onClick={signOut}
                      disabled={signingOut}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-danger-700 hover:bg-danger-50 disabled:opacity-60"
                    >
                      <LogOut className="h-4 w-4" />
                      {signingOut ? "Signing out…" : "Sign out"}
                    </button>
                  </div>
                </Popover>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 animate-fade-in bg-navy-950/60" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] animate-fade-in flex-col bg-navy-900 px-4 py-5 shadow-pop">
            <div className="mb-6 flex items-center justify-between px-2">
              <Logo tone="light" />
              <button onClick={() => setDrawer(false)} className="rounded-xl p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close navigation menu">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks compact onNavigate={() => setDrawer(false)} />
              <div className="my-4 h-px bg-white/10" />
              <SecondaryLinks onNavigate={() => setDrawer(false)} />
            </div>
            {demoMode && (
              <div className="mt-4">
                <DemoModeCard isDemoAccount={user.isDemoAccount} onNavigate={() => setDrawer(false)} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Popover({ children, className, role }: { children: ReactNode; className?: string; role?: string }) {
  return (
    <div role={role} className={cn("absolute top-full right-0 z-40 mt-2 animate-pop-in overflow-hidden rounded-2xl border border-line bg-surface shadow-pop", className)}>
      {children}
    </div>
  );
}

function MenuLink({ href, icon, children, onClick }: { href: string; icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return (
    <Link role="menuitem" href={href} onClick={onClick} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-muted hover:text-ink">
      {icon}
      {children}
    </Link>
  );
}

const TABS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/free-talk", label: "Free Talk", icon: MessagesSquare },
  { href: "/battles", label: "Battles", icon: Swords },
  { href: "/coach", label: "Coach", icon: GraduationCap },
];

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold", active ? "text-brand-600" : "text-muted")}
            >
              <t.icon className="h-5.5 w-5.5" aria-hidden />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
