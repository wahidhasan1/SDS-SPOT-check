"use client";

import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";

export function AccessForm({ next }: { next: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setPending(true);
    setError(null);
    try {
      await api("/api/access", { body: { code } });
      // Full navigation so the new cookie is sent with the next request.
      window.location.assign(next);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3 text-left">
      <Label htmlFor="access-code">Access code</Label>
      <Input id="access-code" type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
      {error && (
        <p role="alert" className="rounded-xl bg-danger-50 px-3 py-2 text-sm font-medium text-danger-700">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" loading={pending} disabled={!code.trim()}>
        <LockKeyhole className="h-5 w-5" /> Enter
      </Button>
    </form>
  );
}
