// Authentication: PBKDF2 password hashes (Web Crypto, so it runs in Node and browsers),
// random session tokens stored only as SHA-256 hashes.

import type { AuthStatus, LoginResponse } from "../../core/api";
import type { PaletteColor, User } from "../../core/types";
import type { AppContext } from "../context";
import { nowIso } from "../context";
import type { UserRow } from "../db/schema";
import { recordEvent } from "./events";
import { getSettings, saveSetting } from "./lookups";
import { addDays, badRequest, conflict, forbidden, newId, publicUser, randomToken, requireText, sha256Hex, unauthorized } from "./util";

const ITERATIONS = 210_000;

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iterations = ITERATIONS): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await derive(password, salt, iterations);
  return `pbkdf2$${iterations}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, iter, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2" || !iter || !saltB64 || !hashB64) return false;
  const expected = fromB64(hashB64);
  const actual = await derive(password, fromB64(saltB64), Number(iter));
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export function validatePassword(password: string): void {
  if (password.length < 8) throw badRequest("Use at least 8 characters for the password.");
}

async function createSession(ctx: AppContext, user: UserRow): Promise<LoginResponse> {
  const token = randomToken();
  const now = nowIso(ctx);
  ctx.store.insert("sessions", {
    id: newId("ses"),
    token_hash: await sha256Hex(token),
    user_id: user.id,
    created_at: now,
    expires_at: addDays(now, ctx.config.sessionDays),
    last_used_at: now,
  });
  const updated = ctx.store.update("users", user.id, { last_seen_at: now });
  recordEvent(ctx, { actorId: user.id, type: "auth.login", entityType: "user", entityId: user.id, data: {} });
  return { token, user: publicUser(updated) as User };
}

export async function login(ctx: AppContext, email: string, password: string): Promise<LoginResponse> {
  const user = ctx.store.findOne("users", { email: email.trim().toLowerCase() });
  const ok = user ? await verifyPassword(password, user.password_hash) : false;
  if (!user || !ok) throw unauthorized("That email and password don't match an account.");
  if (!user.active) throw forbidden("This account is deactivated. Ask an administrator to reactivate it.");
  return createSession(ctx, user);
}

export async function demoLogin(ctx: AppContext, userId: string): Promise<LoginResponse> {
  if (!ctx.config.demoLogin) throw forbidden("Demo sign-in is turned off.");
  const user = ctx.store.get("users", userId);
  if (!user || !user.active) throw badRequest("Choose an active demo account.");
  return createSession(ctx, user);
}

export async function resolveSession(ctx: AppContext, token: string | null | undefined): Promise<UserRow | null> {
  if (!token) return null;
  const session = ctx.store.findOne("sessions", { token_hash: await sha256Hex(token) });
  if (!session) return null;
  const now = nowIso(ctx);
  if (session.expires_at < now) {
    ctx.store.remove("sessions", session.id);
    return null;
  }
  const user = ctx.store.get("users", session.user_id);
  if (!user || !user.active) return null;
  if (Date.parse(now) - Date.parse(session.last_used_at) > 5 * 60_000) {
    ctx.store.update("sessions", session.id, { last_used_at: now });
    ctx.store.update("users", user.id, { last_seen_at: now });
  }
  return user;
}

export async function logout(ctx: AppContext, token: string): Promise<void> {
  const session = ctx.store.findOne("sessions", { token_hash: await sha256Hex(token) });
  if (session) ctx.store.remove("sessions", session.id);
}

export function authStatus(ctx: AppContext): AuthStatus {
  const settings = getSettings(ctx);
  const needsSetup = ctx.store.count("users") === 0;
  return {
    mode: ctx.config.mode,
    demo_login: ctx.config.demoLogin && !needsSetup,
    needs_setup: needsSetup,
    workspace_name: settings.workspace_name,
    demo_accounts: ctx.config.demoLogin
      ? ctx.store
          .find("users", { where: { active: true }, orderBy: [{ column: "name" }] })
          .map((u) => ({ id: u.id, name: u.name, role: u.role, title: u.title, avatar_color: u.avatar_color }))
      : [],
  };
}

const COLORS: PaletteColor[] = ["blue", "teal", "violet", "amber", "rose", "emerald", "indigo", "orange", "cyan", "pink"];

export function avatarColorFor(seed: string): PaletteColor {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

/** First-run setup: create the first administrator when the workspace has no users. */
export async function setupWorkspace(
  ctx: AppContext,
  input: { name: string; email: string; password: string; workspace_name?: string },
): Promise<LoginResponse> {
  if (ctx.store.count("users") > 0) throw conflict("This workspace is already set up.");
  const name = requireText(input.name, "Name", 120);
  const email = requireText(input.email, "Email", 200).toLowerCase();
  validatePassword(input.password);
  const hash = await hashPassword(input.password);
  const now = nowIso(ctx);
  const user = ctx.store.transaction(() => {
    const u = ctx.store.insert("users", {
      id: newId("usr"),
      name,
      email,
      password_hash: hash,
      role: "admin",
      team_id: null,
      title: "Administrator",
      avatar_color: avatarColorFor(email),
      active: true,
      notification_prefs: { progress: true, discussion: true },
      created_at: now,
      updated_at: now,
      last_seen_at: null,
      deactivated_at: null,
    });
    if (input.workspace_name?.trim()) saveSetting(ctx, "workspace_name", input.workspace_name.trim(), u.id);
    recordEvent(ctx, { actorId: u.id, type: "user.created", entityType: "user", entityId: u.id, data: { role: "admin", setup: true } });
    return u;
  });
  return createSession(ctx, user);
}

export async function changePassword(ctx: AppContext, user: UserRow, current: string, next: string): Promise<void> {
  if (user.password_hash && !(await verifyPassword(current, user.password_hash))) throw badRequest("Your current password is incorrect.");
  validatePassword(next);
  const hash = await hashPassword(next);
  ctx.store.update("users", user.id, { password_hash: hash, updated_at: nowIso(ctx) });
  recordEvent(ctx, { actorId: user.id, type: "user.password_changed", entityType: "user", entityId: user.id, data: {} });
}
