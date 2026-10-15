"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, Flame, FlaskConical, ShieldCheck } from "lucide-react";
import { NAV_COLOR_CLASSES, PRIMARY_NAV } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { LevelBadge } from "@/components/art/medal";
import { isHostedPreview } from "@/lib/runtime";

export interface PlayerSummary {
  displayName: string;
  avatar: string;
  xp: number;
  levelIndex: number;
  levelName: string;
  progress: number;
  xpToNext: number;
  nextLevelName: string | null;
  streak: number;
  practicedToday: boolean;
}

export function NavLinks({ onNavigate, compact }: { onNavigate?: () => void; compact?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {PRIMARY_NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-2xl px-2.5 py-1.5 text-[0.9375rem] font-bold transition-all",
              active ? "bg-white text-ink shadow-[0_3px_0_0_rgb(0_0_0/0.25)]" : "text-white/70 hover:bg-white/8 hover:text-white",
              compact && "py-2.5",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110 group-hover:-rotate-6",
                active ? NAV_COLOR_CLASSES[item.color] : "bg-white/8 text-white/70 group-hover:text-white",
              )}
            >
              <Icon className="h-4.5 w-4.5" aria-hidden strokeWidth={2.4} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SecondaryLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = [
    { href: "/safety", label: "Privacy & Safety", icon: ShieldCheck },
    { href: "/help", label: "Help & Feedback", icon: CircleHelp },
  ];
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={pathname === item.href ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
            pathname === item.href ? "bg-white/12 text-white" : "text-white/55 hover:bg-white/6 hover:text-white",
          )}
        >
          <item.icon className="h-4.5 w-4.5" aria-hidden />
          {item.label}
        </Link>
      ))}
    </div>
  );
}

/** Compact player card: avatar, level, XP progress, and streak. */
export function PlayerCard({ player, onNavigate }: { player: PlayerSummary; onNavigate?: () => void }) {
  return (
    <Link
      href="/achievements"
      onClick={onNavigate}
      className="group block rounded-3xl bg-white/8 p-3 ring-1 ring-white/10 transition-colors hover:bg-white/12"
      aria-label={`${player.displayName}: level ${player.levelIndex}, ${player.levelName}, ${player.xp} XP, ${player.streak}-day streak`}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar name={player.displayName} avatar={player.avatar} size="md" />
          <LevelBadge level={player.levelIndex} className="absolute -right-2 -bottom-2 h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-white">{player.displayName}</p>
          <p className="truncate text-xs font-semibold text-brand-200">{player.levelName}</p>
        </div>
        <span
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-1 text-sm font-extrabold",
            player.practicedToday ? "bg-orange-500/20 text-orange-300" : "bg-white/10 text-white/60",
          )}
          title={player.practicedToday ? "You practiced today" : "Practice today to keep your streak"}
        >
          <Flame className={cn("h-4 w-4", player.practicedToday && "animate-flame fill-sun-400 text-orange-400")} aria-hidden />
          {player.streak}
        </span>
      </div>
      <div className="mt-3">
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-sun-400 via-pink-400 to-brand-400 transition-[width] duration-700" style={{ width: `${player.progress * 100}%` }} />
        </div>
        <p className="mt-1.5 flex justify-between text-[11px] font-semibold text-white/55">
          <span>{player.xp.toLocaleString("en-US")} XP</span>
          <span>{player.nextLevelName ? `${player.xpToNext} to Lv ${player.levelIndex + 1}` : "Max level"}</span>
        </p>
      </div>
    </Link>
  );
}

export function DemoModeCard({ isDemoAccount, onNavigate, compact }: { isDemoAccount: boolean; onNavigate?: () => void; compact?: boolean }) {
  if (compact) {
    return (
      <Link
        href="/help#demo-mode"
        onClick={onNavigate}
        className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white"
        title={isHostedPreview ? "Hosted preview: partners are fictional, calls are simulated, and your data stays in this browser." : "Partners are fictional and calls are simulated."}
      >
        <FlaskConical className="h-4 w-4 shrink-0 text-sun-300" aria-hidden />
        <span>
          <span className="font-extrabold text-sun-300">Demo mode</span> · fictional partners
          {isDemoAccount ? ", sample history" : ""}. What&apos;s real?
        </span>
      </Link>
    );
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
      <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-sun-300 uppercase">
        <FlaskConical className="h-4 w-4" aria-hidden />
        Demo mode
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-white/65">
        {isHostedPreview
          ? "Hosted preview: partners are fictional, calls are simulated, and your data stays in this browser. Voice features need the local version."
          : "Partners are fictional and calls are simulated."}
        {isDemoAccount ? " This account includes labeled sample history." : ""}
      </p>
      <Link href="/help#demo-mode" onClick={onNavigate} className="mt-2 inline-block text-xs font-semibold text-brand-200 hover:text-white">
        What&apos;s real and what&apos;s simulated?
      </Link>
    </div>
  );
}

export function Sidebar({ isDemoAccount, demoMode, player }: { isDemoAccount: boolean; demoMode: boolean; player: PlayerSummary }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-68 flex-col bg-navy-900 bg-dots-light px-4 py-5 lg:flex">
      <Link href="/dashboard" className="mb-5 px-2" aria-label="Pantora dashboard">
        <Logo tone="light" />
      </Link>
      <PlayerCard player={player} />
      <div className="scrollbar-none -mx-1 mt-3 flex-1 overflow-y-auto px-1">
        <NavLinks />
        <div className="my-3 h-px bg-white/10" />
        <SecondaryLinks />
      </div>
      {demoMode && (
        <div className="mt-3">
          <DemoModeCard isDemoAccount={isDemoAccount} compact />
        </div>
      )}
    </aside>
  );
}
