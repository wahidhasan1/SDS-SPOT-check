/**
 * Storage adapter. The local build persists to the browser's localStorage under a
 * versioned prefix. This is a development/prototype persistence layer only — it is not
 * synced across devices and is not a secure store.
 *
 * Production: replace this adapter with API calls to a server backed by a relational
 * database (see /docs/PRODUCTION.md), keeping the same repository interface.
 */

export interface StorageAdapter {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  keys(prefix: string): string[];
}

export const PREFIX = 'bq:v1:';

export class LocalStorageAdapter implements StorageAdapter {
  get<T>(key: string): T | undefined {
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch {
      return undefined;
    }
  }
  set<T>(key: string, value: T): void {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      // Quota exceeded or storage disabled — surface to the UI via a custom event.
      window.dispatchEvent(new CustomEvent('bq-storage-error', { detail: String(e) }));
    }
  }
  remove(key: string): void {
    try {
      window.localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  }
  keys(prefix: string): string[] {
    const out: string[] = [];
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(PREFIX + prefix)) out.push(k.slice(PREFIX.length));
      }
    } catch {
      /* ignore */
    }
    return out;
  }
}

export class MemoryAdapter implements StorageAdapter {
  private m = new Map<string, string>();
  get<T>(key: string): T | undefined {
    const raw = this.m.get(key);
    return raw === undefined ? undefined : (JSON.parse(raw) as T);
  }
  set<T>(key: string, value: T): void {
    this.m.set(key, JSON.stringify(value));
  }
  remove(key: string): void {
    this.m.delete(key);
  }
  keys(prefix: string): string[] {
    return [...this.m.keys()].filter((k) => k.startsWith(prefix));
  }
}

export function storageAvailable(): boolean {
  try {
    const k = PREFIX + '__test';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1e6;
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rnd}`;
}
