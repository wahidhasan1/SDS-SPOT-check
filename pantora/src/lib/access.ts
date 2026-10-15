// Private-test access gate: path rules shared by the proxy and the access page.
// Hashing lives in src/server/access.ts so this file stays dependency-free.

export const ACCESS_COOKIE = "pantora_access";

/** Paths reachable without the access code: the code form itself, the health check, and static assets. */
const OPEN_PATHS = new Set(["/access", "/api/access", "/api/health", "/robots.txt", "/icon.svg", "/favicon.ico"]);

export function isOpenPath(pathname: string): boolean {
  return OPEN_PATHS.has(pathname) || pathname.startsWith("/_next/");
}

/** Only same-site relative paths are allowed as the post-login destination. */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  if (raw.startsWith("/access")) return "/";
  return raw;
}
