import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { MIGRATIONS } from "./migrations";
import { seedIfEmpty } from "./seed";
import { tx } from "./sql";

export * from "./sql";


declare global {
  var __pantoraDb: DatabaseSync | undefined;
}

export function databasePath(): string {
  return process.env.PANTORA_DB_PATH || path.join(process.cwd(), ".data", "pantora.db");
}

export function openDatabase(file = databasePath()): DatabaseSync {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  migrate(db);
  return db;
}

export function migrate(db: DatabaseSync) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)");
  const applied = new Set(
    (db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map((r) => r.version),
  );
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    tx(db, () => {
      db.exec(m.sql);
      db.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)").run(
        m.version,
        m.name,
        new Date().toISOString(),
      );
    });
  }
}

/** Shared connection for the running server. Seeds demo data on first use. */
export function getDb(): DatabaseSync {
  if (!globalThis.__pantoraDb) {
    const db = openDatabase();
    seedIfEmpty(db);
    globalThis.__pantoraDb = db;
  }
  return globalThis.__pantoraDb;
}

