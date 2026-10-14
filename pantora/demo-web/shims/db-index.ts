// Browser replacement for src/server/db/index.ts.
import type { DatabaseSync } from "node:sqlite";
import { MIGRATIONS } from "@/server/db/migrations";
import { tx } from "@/server/db/sql";
import { currentDatabase } from "../browser-db";

export * from "@/server/db/sql";

export function databasePath(): string {
  return "This browser (SQLite in WebAssembly, saved to IndexedDB)";
}

export function getDb(): DatabaseSync {
  return currentDatabase() as unknown as DatabaseSync;
}

export function openDatabase(): DatabaseSync {
  return getDb();
}

export function migrate(db: DatabaseSync) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)");
  const applied = new Set((db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map((r) => r.version));
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    tx(db, () => {
      db.exec(m.sql);
      db.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)").run(m.version, m.name, new Date().toISOString());
    });
  }
}
