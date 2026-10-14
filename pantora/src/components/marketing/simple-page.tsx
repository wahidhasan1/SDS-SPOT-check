import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";

export function SimplePage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Pantora home">
            <Logo />
          </Link>
          <ButtonLink href="/" variant="ghost" size="sm">
            Home
          </ButtonLink>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-3 text-lg text-muted">{intro}</p>
        <div className="mt-10 space-y-8">{children}</div>
      </main>
    </div>
  );
}
