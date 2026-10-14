import "server-only";
import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import { ADMIN_COOKIE } from "./auth";
import { config } from "./config";
import { HttpError } from "./http";

// Admin access for the demo. With PANTORA_ADMIN_TOKEN set, the token is
// required; without it, the admin area is only available in demo mode.

function digest(value: string) {
  return createHash("sha256").update(`pantora-admin:${value}`).digest("hex");
}

export function adminAccessMode(): "token" | "demo" | "disabled" {
  if (config.adminToken) return "token";
  return config.demoMode ? "demo" : "disabled";
}

export function expectedAdminCookie(): string | null {
  const mode = adminAccessMode();
  if (mode === "token") return digest(config.adminToken!);
  if (mode === "demo") return digest("demo-mode");
  return null;
}

export function verifyAdminToken(token: string | undefined): boolean {
  const mode = adminAccessMode();
  if (mode === "demo") return true;
  if (mode !== "token" || !token) return false;
  const a = Buffer.from(digest(token));
  const b = Buffer.from(digest(config.adminToken!));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  const expected = expectedAdminCookie();
  if (!expected) return false;
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  return value === expected;
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new HttpError(403, "Admin access required.");
}
