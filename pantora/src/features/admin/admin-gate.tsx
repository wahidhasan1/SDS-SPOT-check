"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, Wrench } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";

export function AdminGate({ mode }: { mode: "token" | "demo" | "disabled" }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enter(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/api/admin/access", { body: mode === "token" ? { token } : {} });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Card>
        <CardBody className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">{mode === "token" ? <KeyRound className="h-7 w-7" /> : <Wrench className="h-7 w-7" />}</span>
          <h1 className="mt-4 text-2xl font-extrabold">{mode === "token" ? "Admin sign-in" : mode === "demo" ? "Demo admin" : "Admin disabled"}</h1>
          {mode === "demo" && (
            <>
              <p className="mt-2 text-sm text-muted">
                Inspect sample profiles, sessions, battles, safety reports, and feedback records, and reset the demo data. This area is open because the app is running in demo mode without an admin token.
              </p>
              <Button className="mt-6 w-full" size="lg" onClick={() => enter()} loading={loading}>
                Enter demo admin
              </Button>
            </>
          )}
          {mode === "token" && (
            <form onSubmit={enter} className="mt-6 space-y-4 text-left">
              <div>
                <Label htmlFor="admin-token">Admin token</Label>
                <Input id="admin-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="current-password" />
              </div>
              <Button type="submit" className="w-full" loading={loading} disabled={!token}>
                Sign in
              </Button>
            </form>
          )}
          {mode === "disabled" && <p className="mt-2 text-sm text-muted">Set PANTORA_ADMIN_TOKEN on the server to enable the admin area.</p>}
          {error && (
            <p role="alert" className="mt-4 text-sm font-medium text-danger-600">
              {error}
            </p>
          )}
        </CardBody>
      </Card>
    </main>
  );
}
