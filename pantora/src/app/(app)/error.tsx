"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">
        <TriangleAlert className="h-7 w-7" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold">Something went wrong</h1>
      <p className="mt-2 text-muted">This page couldn&apos;t load. Your practice data is safe — try again in a moment.</p>
      <div className="mt-6 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/dashboard" variant="outline">
          Dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
