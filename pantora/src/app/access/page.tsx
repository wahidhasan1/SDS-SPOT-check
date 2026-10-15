import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { accessCode } from "@/server/access";
import { safeNextPath } from "@/lib/access";
import { Logo } from "@/components/ui/logo";
import { Mascot } from "@/components/art/mascot";
import { AccessForm } from "./access-form";

export const metadata: Metadata = { title: "Private test", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  if (!accessCode()) redirect(next);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-lavender to-canvas px-4 py-10">
      <Logo />
      <div className="mt-8 w-full max-w-md rounded-[2rem] border border-line bg-surface p-6 text-center shadow-card sm:p-8">
        <Mascot mood="wave" className="mx-auto h-24 w-24 animate-bob" />
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Private test</h1>
        <p className="mt-2 text-muted">Pantora is in a private test. Enter the access code you were given to continue.</p>
        <AccessForm next={next} />
      </div>
      <p className="mt-6 max-w-md text-center text-xs text-muted">Demo build: partners are fictional, and test data may be reset at any time.</p>
    </div>
  );
}
