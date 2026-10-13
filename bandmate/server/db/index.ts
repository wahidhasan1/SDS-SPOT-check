import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { env } from '../env.ts'
import { MIGRATIONS } from './schema.ts'

export type Row = Record<string, unknown>

/**
 * Thin synchronous wrapper around SQLite. The server is a single Node process, so a synchronous
 * transaction is a true critical section: matching, scoring and entitlement checks rely on this
 * (no other request can interleave inside `tx`). Scaling to several processes needs Postgres
 * row locks (SELECT … FOR UPDATE SKIP LOCKED) instead; see README.
 */
export class Db {
  readonly raw: DatabaseSync
  private cache = new Map<string, ReturnType<DatabaseSync['prepare']>>()
  private depth = 0

  constructor(file: string) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true })
    this.raw = new DatabaseSync(file)
    this.raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;')
    this.migrate()
  }

  private stmt(sql: string) {
    let s = this.cache.get(sql)
    if (!s) {
      s = this.raw.prepare(sql)
      this.cache.set(sql, s)
    }
    return s
  }

  one<T = Row>(sql: string, ...params: SQLInputValue[]): T | undefined {
    return this.stmt(sql).get(...params) as T | undefined
  }

  all<T = Row>(sql: string, ...params: SQLInputValue[]): T[] {
    return this.stmt(sql).all(...params) as T[]
  }

  run(sql: string, ...params: SQLInputValue[]) {
    return this.stmt(sql).run(...params)
  }

  /** Runs fn atomically. Nested calls join the outer transaction. */
  tx<T>(fn: () => T): T {
    if (this.depth > 0) return fn()
    this.raw.exec('BEGIN IMMEDIATE')
    this.depth++
    try {
      const out = fn()
      this.raw.exec('COMMIT')
      return out
    } catch (e) {
      this.raw.exec('ROLLBACK')
      throw e
    } finally {
      this.depth--
    }
  }

  private migrate() {
    const current = (this.raw.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
    for (let v = current; v < MIGRATIONS.length; v++) {
      this.raw.exec('BEGIN')
      try {
        this.raw.exec(MIGRATIONS[v])
        this.raw.exec(`PRAGMA user_version = ${v + 1}`)
        this.raw.exec('COMMIT')
      } catch (e) {
        this.raw.exec('ROLLBACK')
        throw new Error(`Migration ${v + 1} failed: ${(e as Error).message}`)
      }
    }
  }
}

let instance: Db | null = null
export const db = () => (instance ??= new Db(env.dbPath))
/** Tests use an isolated in-memory database. */
export const setDb = (d: Db) => (instance = d)

export const json = <T>(s: unknown, fallback: T): T => {
  if (typeof s !== 'string') return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}
