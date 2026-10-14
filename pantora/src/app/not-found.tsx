import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 text-center">
      <Link href="/" aria-label="Pantora home">
        <Logo />
      </Link>
      <p className="mt-10 text-sm font-bold tracking-wide text-brand-600 uppercase">404</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="mt-3 max-w-md text-muted">The link may be old, or the session you&apos;re looking for may have been deleted.</p>
      <div className="mt-8 flex gap-3">
        <ButtonLink href="/dashboard">Go to dashboard</ButtonLink>
        <ButtonLink href="/" variant="outline">
          Home
        </ButtonLink>
      </div>
    </div>
  );
}
