"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, FlaskConical, ShieldCheck } from "lucide-react";
import { PRIMARY_NAV } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/ui/logo";
import { isHostedPreview } from "@/lib/runtime";

export function NavLinks({ onNavigate, compact }: { onNavigate?: () => void; compact?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="flex flex-col gap-0.5">
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
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
              active ? "bg-white/12 text-white" : "text-white/65 hover:bg-white/6 hover:text-white",
              compact && "py-3",
            )}
          >
            <Icon className={cn("h-5 w-5 shrink-0", active ? "text-brand-300" : "text-white/50 group-hover:text-white/80")} aria-hidden />
            {item.label}
            {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-300" aria-hidden />}
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
            "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
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

export function DemoModeCard({ isDemoAccount, onNavigate }: { isDemoAccount: boolean; onNavigate?: () => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
      <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-streak-400 uppercase">
        <FlaskConical className="h-4 w-4" aria-hidden />
        Demo mode
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-white/65">
        {isHostedPreview
          ? "Hosted preview: partners are fictional, calls are simulated, and your data stays in this browser. Voice features need the local version."
          : "Partners are fictional and calls are simulated."}
        {isDemoAccount ? " This account includes labeled sample history." : ""}
      </p>
      <Link href="/help#demo-mode" onClick={onNavigate} className="mt-2 inline-block text-xs font-semibold text-brand-300 hover:text-white">
        What&apos;s real and what&apos;s simulated?
      </Link>
    </div>
  );
}

export function Sidebar({ isDemoAccount, demoMode }: { isDemoAccount: boolean; demoMode: boolean }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-68 flex-col bg-navy-900 px-4 py-5 lg:flex">
      <Link href="/dashboard" className="mb-7 px-2" aria-label="Pantora dashboard">
        <Logo tone="light" />
      </Link>
      <div className="scrollbar-none -mx-1 flex-1 overflow-y-auto px-1">
        <NavLinks />
        <div className="my-4 h-px bg-white/10" />
        <SecondaryLinks />
      </div>
      {demoMode && (
        <div className="mt-4">
          <DemoModeCard isDemoAccount={isDemoAccount} />
        </div>
      )}
    </aside>
  );
}
