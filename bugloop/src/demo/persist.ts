// Keeps a viewer's demo sandbox in their own browser (IndexedDB), so reports they file and actions
// they take survive a reload. Best-effort: when storage is unavailable the demo runs in memory.

import type { Snapshot } from "../server/db/memory";

const DB_NAME = "bugloop-demo";
const STATE = "state";
const FILES = "files";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STATE)) db.createObjectStore(STATE);
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB is blocked"));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface SavedDemo {
  snapshot: Snapshot;
  files: [string, Blob][];
  savedAt: string;
}

export class DemoPersistence {
  private db: IDBDatabase | null = null;

  static async connect(): Promise<DemoPersistence | null> {
    try {
      if (typeof indexedDB === "undefined") return null;
      const p = new DemoPersistence();
      p.db = await open();
      return p;
    } catch {
      return null;
    }
  }

  async load(version: string): Promise<SavedDemo | null> {
    if (!this.db) return null;
    try {
      const tx = this.db.transaction([STATE, FILES], "readonly");
      const state = (await request(tx.objectStore(STATE).get("current"))) as { version: string; snapshot: Snapshot; savedAt: string } | undefined;
      if (!state || state.version !== version) return null;
      const keys = (await request(tx.objectStore(FILES).getAllKeys())) as string[];
      const blobs = (await request(tx.objectStore(FILES).getAll())) as Blob[];
      return { snapshot: state.snapshot, files: keys.map((k, i) => [k, blobs[i]]), savedAt: state.savedAt };
    } catch {
      return null;
    }
  }

  async saveSnapshot(version: string, snapshot: Snapshot): Promise<void> {
    if (!this.db) return;
    try {
      const tx = this.db.transaction(STATE, "readwrite");
      tx.objectStore(STATE).put({ version, snapshot, savedAt: new Date().toISOString() }, "current");
      await done(tx);
    } catch {
      // Storage full or revoked: the demo keeps working in memory.
    }
  }

  async saveFile(key: string, blob: Blob): Promise<void> {
    if (!this.db) return;
    try {
      const tx = this.db.transaction(FILES, "readwrite");
      tx.objectStore(FILES).put(blob, key);
      await done(tx);
    } catch {
      // Best-effort.
    }
  }

  async clear(): Promise<void> {
    if (!this.db) return;
    try {
      const tx = this.db.transaction([STATE, FILES], "readwrite");
      tx.objectStore(STATE).clear();
      tx.objectStore(FILES).clear();
      await done(tx);
    } catch {
      // Best-effort.
    }
  }
}
