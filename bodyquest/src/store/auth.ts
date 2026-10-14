import type { User } from '../domain/types';
import { newId, type StorageAdapter } from './storage';

/**
 * DEMO AUTHENTICATION — LOCAL DEVICE ONLY.
 *
 * Accounts live in this browser's storage. Passwords are hashed with PBKDF2 (Web Crypto)
 * so they are not stored in plain text, but this is NOT production-grade authentication:
 * anyone with access to this browser profile can read or modify the stored data, there is
 * no server-side authorization, and nothing syncs between devices.
 *
 * Production: use a real identity provider (e.g. an OAuth/OIDC service or a server with
 * Argon2/bcrypt password hashing, HTTP-only session cookies, rate limiting and email
 * verification) and enforce authorization on the server for every private record.
 */

const USERS_KEY = 'users';
const SESSION_KEY = 'session';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required.';
  if (!EMAIL_RE.test(email.trim())) return 'Enter a valid email address.';
  return null;
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Use at least one letter and one number.';
  if (pw.length > 128) return 'Password is too long.';
  return null;
}

export function validateDisplayName(name: string): string | null {
  const n = name.trim();
  if (n.length < 2) return 'Name must be at least 2 characters.';
  if (n.length > 40) return 'Name must be 40 characters or fewer.';
  if (/[<>]/.test(n)) return 'Name contains invalid characters.';
  return null;
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, key, 256);
  return toHex(bits);
}

function randomSalt(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return toHex(a.buffer);
}

export class DemoAuth {
  constructor(private store: StorageAdapter) {}

  private users(): User[] {
    return this.store.get<User[]>(USERS_KEY) ?? [];
  }

  private saveUsers(u: User[]) {
    this.store.set(USERS_KEY, u);
  }

  currentUser(): User | null {
    const s = this.store.get<{ userId: string }>(SESSION_KEY);
    if (!s) return null;
    return this.users().find((u) => u.id === s.userId) ?? null;
  }

  async signUp(email: string, password: string, displayName: string): Promise<User> {
    const e = validateEmail(email) ?? validatePassword(password) ?? validateDisplayName(displayName);
    if (e) throw new Error(e);
    const norm = email.trim().toLowerCase();
    if (this.users().some((u) => u.email === norm)) throw new Error('An account with this email already exists on this device. Sign in instead.');
    const salt = randomSalt();
    const user: User = {
      id: newId('usr'),
      email: norm,
      displayName: displayName.trim(),
      passwordHash: await hashPassword(password, salt),
      salt,
      isGuest: false,
      createdAt: new Date().toISOString(),
    };
    this.saveUsers([...this.users(), user]);
    this.store.set(SESSION_KEY, { userId: user.id });
    return user;
  }

  async signIn(email: string, password: string): Promise<User> {
    const norm = email.trim().toLowerCase();
    const user = this.users().find((u) => u.email === norm && !u.isGuest);
    // Same message for unknown email and wrong password (no account enumeration).
    const fail = new Error('Email or password is incorrect.');
    if (!user || !user.salt || !user.passwordHash) throw fail;
    const h = await hashPassword(password, user.salt);
    if (h !== user.passwordHash) throw fail;
    this.store.set(SESSION_KEY, { userId: user.id });
    return user;
  }

  continueAsGuest(displayName = 'Guest', isDemo = false): User {
    const user: User = { id: newId(isDemo ? 'demo' : 'guest'), email: '', displayName, isGuest: true, isDemo, createdAt: new Date().toISOString() };
    this.saveUsers([...this.users(), user]);
    this.store.set(SESSION_KEY, { userId: user.id });
    return user;
  }

  updateDisplayName(userId: string, name: string) {
    const err = validateDisplayName(name);
    if (err) throw new Error(err);
    this.saveUsers(this.users().map((u) => (u.id === userId ? { ...u, displayName: name.trim() } : u)));
  }

  signOut() {
    this.store.remove(SESSION_KEY);
  }

  /** Permanently delete the account and every record stored for it on this device. */
  deleteAccount(userId: string) {
    for (const k of this.store.keys(`u:${userId}:`)) this.store.remove(k);
    this.saveUsers(this.users().filter((u) => u.id !== userId));
    this.signOut();
  }
}
