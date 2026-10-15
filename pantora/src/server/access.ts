import { createHash, timingSafeEqual } from "node:crypto";

// Access-code helpers for a private online test (PANTORA_ACCESS_CODE).
// The cookie stores a hash of the code, never the code itself.

export function accessCode(): string | null {
  return process.env.PANTORA_ACCESS_CODE?.trim() || null;
}

export function accessToken(code: string): string {
  return createHash("sha256").update(`pantora-access:v1:${code}`).digest("hex");
}

function equal(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** True when the cookie value proves the visitor entered the current code. */
export function hasAccess(cookieValue: string | undefined, code: string): boolean {
  return Boolean(cookieValue) && equal(cookieValue!, accessToken(code));
}

export function codeMatches(input: string, code: string): boolean {
  return equal(accessToken(input.trim()), accessToken(code));
}

// Simple in-memory limit on wrong guesses per client address.
const failures = new Map<string, { count: number; since: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

export function tooManyAttempts(client: string, now = Date.now()): boolean {
  const f = failures.get(client);
  if (!f || now - f.since > WINDOW_MS) return false;
  return f.count >= MAX_FAILURES;
}

export function recordFailure(client: string, now = Date.now()) {
  const f = failures.get(client);
  if (!f || now - f.since > WINDOW_MS) failures.set(client, { count: 1, since: now });
  else f.count += 1;
}

export function clearFailures(client: string) {
  failures.delete(client);
}
