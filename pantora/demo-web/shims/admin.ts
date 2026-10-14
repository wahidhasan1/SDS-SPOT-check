// Browser replacement for src/server/admin.ts: the hosted demo's admin area is
// always the open demo admin (there is no server to protect).
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/server/auth";
import { HttpError } from "@/server/http";

export function adminAccessMode(): "token" | "demo" | "disabled" {
  return "demo";
}

export function expectedAdminCookie(): string | null {
  return "demo-admin";
}

export function verifyAdminToken(): boolean {
  return true;
}

export async function isAdmin(): Promise<boolean> {
  return (await cookies()).get(ADMIN_COOKIE)?.value === "demo-admin";
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new HttpError(403, "Admin access required.");
}
