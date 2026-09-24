import type { Role } from "../../core/types";
import type { UserRow } from "../db/schema";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, "bad_request", message, details);
export const unauthorized = (message = "Sign in to continue.") => new HttpError(401, "unauthorized", message);
export const forbidden = (message = "You don't have permission to do that.") => new HttpError(403, "forbidden", message);
export const notFound = (message = "Not found.") => new HttpError(404, "not_found", message);
export const conflict = (message: string) => new HttpError(409, "conflict", message);

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function newId(prefix: string): string {
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % 36];
  return `${prefix}_${s}`;
}

let counter = 0;

/**
 * An id that sorts by creation time and, within the same millisecond, by creation order in
 * this process. Used for events, comments and notifications so timelines keep their order.
 */
export function sortableId(prefix: string, iso: string): string {
  counter = (counter + 1) % 1_679_616; // 36^4
  const ms = Date.parse(iso).toString(36).padStart(9, "0");
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let rand = "";
  for (const b of bytes) rand += ALPHABET[b % 36];
  return `${prefix}_${ms}${counter.toString(36).padStart(4, "0")}${rand}`;
}

export function randomToken(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function publicUser(u: UserRow): Omit<UserRow, "password_hash"> {
  const { password_hash: _omit, ...rest } = u;
  return rest;
}

export function requireRole(user: { role: Role; active: boolean }, roles: Role[], message?: string): void {
  if (!user.active || !roles.includes(user.role)) throw forbidden(message);
}

export function cleanText(v: unknown, max = 20000): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/\r\n/g, "\n").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

export function requireText(v: unknown, label: string, max = 20000): string {
  const s = cleanText(v, max);
  if (!s) throw badRequest(`${label} is required.`);
  return s;
}

export function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString();
}
