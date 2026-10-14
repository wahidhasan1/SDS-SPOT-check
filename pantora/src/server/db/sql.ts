import type { DatabaseSync, SQLInputValue } from "node:sqlite";

export type DB = DatabaseSync;
export type Param = SQLInputValue;

let savepointCounter = 0;

/** Runs `fn` atomically. Uses savepoints so calls can be nested safely. */
export function tx<T>(db: DatabaseSync, fn: () => T): T {
  const name = `sp_${++savepointCounter}`;
  db.exec(`SAVEPOINT ${name}`);
  try {
    const result = fn();
    db.exec(`RELEASE ${name}`);
    return result;
  } catch (error) {
    db.exec(`ROLLBACK TO ${name}`);
    db.exec(`RELEASE ${name}`);
    throw error;
  }
}

export function all<T>(db: DatabaseSync, sql: string, ...params: Param[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function get<T>(db: DatabaseSync, sql: string, ...params: Param[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function run(db: DatabaseSync, sql: string, ...params: Param[]) {
  return db.prepare(sql).run(...params);
}

export function newId(): string {
  return crypto.randomUUID();
}

export function json<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
