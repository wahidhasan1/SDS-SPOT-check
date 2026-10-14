// SQLite in the browser for the hosted demo: sql.js (SQLite compiled to
// WebAssembly) behind the small slice of the node:sqlite API Pantora uses,
// persisted to IndexedDB after every change.
import type { Database, SqlJsStatic, SqlValue } from "sql.js";

type Param = SqlValue | boolean | undefined;

function normalize(params: Param[]): SqlValue[] {
  return params.map((p) => (p === undefined ? null : typeof p === "boolean" ? (p ? 1 : 0) : p));
}

class Statement {
  constructor(
    private raw: Database,
    private sql: string,
  ) {}

  all(...params: Param[]) {
    const st = this.raw.prepare(this.sql);
    try {
      st.bind(normalize(params));
      const rows: Record<string, unknown>[] = [];
      while (st.step()) rows.push(st.getAsObject());
      return rows;
    } finally {
      st.free();
    }
  }

  get(...params: Param[]) {
    const st = this.raw.prepare(this.sql);
    try {
      st.bind(normalize(params));
      return st.step() ? st.getAsObject() : undefined;
    } finally {
      st.free();
    }
  }

  run(...params: Param[]) {
    this.raw.run(this.sql, normalize(params));
    const changes = this.raw.getRowsModified();
    markDirty();
    return { changes, lastInsertRowid: 0 };
  }
}

/** Implements the subset of node:sqlite's DatabaseSync used by Pantora. */
export class BrowserDatabase {
  constructor(public raw: Database) {}
  prepare(sql: string) {
    return new Statement(this.raw, sql);
  }
  exec(sql: string) {
    this.raw.exec(sql);
    markDirty();
  }
  close() {
    this.raw.close();
  }
}

// ---------- Persistence ----------

const DB_NAME = "pantora-demo";
const STORE = "files";
const FILE_KEY = "pantora.sqlite";

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadSaved(): Promise<Uint8Array | null> {
  try {
    const db = await idb();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(FILE_KEY);
      req.onsuccess = () => resolve(req.result instanceof Uint8Array ? req.result : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

let current: BrowserDatabase | null = null;
let dirty = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let persistenceAvailable = true;

function markDirty() {
  dirty = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void saveNow(), 400);
}

export async function saveNow() {
  if (!current || !dirty || !persistenceAvailable) return;
  dirty = false;
  try {
    const bytes = current.raw.export();
    // export() ends any open transaction state; foreign keys must be re-enabled.
    current.raw.exec("PRAGMA foreign_keys = ON;");
    const db = await idb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(bytes, FILE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    persistenceAvailable = false;
  }
}

export function isPersistent() {
  return persistenceAvailable;
}

export async function openBrowserDatabase(SQL: SqlJsStatic): Promise<BrowserDatabase> {
  const saved = await loadSaved();
  let raw: Database;
  try {
    raw = saved ? new SQL.Database(saved) : new SQL.Database();
  } catch {
    raw = new SQL.Database();
  }
  raw.exec("PRAGMA foreign_keys = ON;");
  current = new BrowserDatabase(raw);
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => void saveNow());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void saveNow();
    });
  }
  return current;
}

export function currentDatabase() {
  if (!current) throw new Error("Database not ready");
  return current;
}
