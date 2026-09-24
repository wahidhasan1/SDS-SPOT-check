// In-memory store with transactional rollback. Used by the browser demo and by tests.

import type { TableName, Tables } from "./schema";
import { SCHEMA, TABLE_NAMES } from "./schema";
import type { FindOptions, OrderBy, Store, Where } from "./store";
import { NotFoundError, matchesWhere, sortRows } from "./store";

export type Snapshot = { version: 1; tables: Partial<Record<TableName, unknown[]>> };

type Row = Record<string, unknown>;

const clone = <T>(v: T): T => structuredClone(v);

export class MemoryStore implements Store {
  readonly kind = "memory" as const;
  private readonly tables = new Map<TableName, Map<string, Row>>();
  private journal: (() => void)[] | null = null;
  private depth = 0;
  /** Called after every committed write (outside transactions: after each write). */
  onCommit: (() => void) | null = null;

  constructor(snapshot?: Snapshot) {
    for (const name of TABLE_NAMES) this.tables.set(name, new Map());
    if (snapshot) this.load(snapshot);
  }

  private table(name: TableName): Map<string, Row> {
    const t = this.tables.get(name);
    if (!t) throw new Error(`Unknown table ${name}`);
    return t;
  }

  private pkOf(name: TableName, row: Row): string {
    const v = row[SCHEMA[name].pk];
    if (typeof v !== "string" || !v) throw new Error(`Row in ${name} is missing its primary key`);
    return v;
  }

  private committed(): void {
    if (this.depth === 0) this.onCommit?.();
  }

  get<N extends TableName>(table: N, pk: string): Tables[N] | undefined {
    const row = this.table(table).get(pk);
    return row ? (clone(row) as unknown as Tables[N]) : undefined;
  }

  find<N extends TableName>(table: N, opts: FindOptions<Tables[N]> = {}): Tables[N][] {
    let rows = [...this.table(table).values()].filter((r) => matchesWhere(r as unknown as Tables[N], opts.where));
    rows = sortRows(rows as unknown as Tables[N][], opts.orderBy) as unknown as Row[];
    const start = opts.offset ?? 0;
    const end = opts.limit !== undefined ? start + opts.limit : undefined;
    return rows.slice(start, end).map((r) => clone(r) as unknown as Tables[N]);
  }

  findOne<N extends TableName>(table: N, where: Where<Tables[N]>, orderBy?: OrderBy<Tables[N]>[]): Tables[N] | undefined {
    return this.find(table, { where, orderBy, limit: 1 })[0];
  }

  count<N extends TableName>(table: N, where?: Where<Tables[N]>): number {
    let n = 0;
    for (const r of this.table(table).values()) if (matchesWhere(r as unknown as Tables[N], where)) n++;
    return n;
  }

  insert<N extends TableName>(table: N, row: Tables[N]): Tables[N] {
    const t = this.table(table);
    const data = clone(row) as unknown as Row;
    for (const [col, def] of Object.entries(SCHEMA[table].columns)) {
      if (data[col] === undefined) {
        if (def.nullable) data[col] = null;
        else throw new Error(`Missing value for ${table}.${col}`);
      }
      if (def.unique && data[col] !== null) {
        for (const other of t.values()) {
          if (other[col] === data[col]) throw new Error(`UNIQUE constraint failed: ${table}.${col}`);
        }
      }
    }
    const pk = this.pkOf(table, data);
    if (t.has(pk)) throw new Error(`UNIQUE constraint failed: ${table}.${SCHEMA[table].pk}`);
    for (const idx of SCHEMA[table].indexes ?? []) {
      if (!idx.unique) continue;
      for (const other of t.values()) {
        if (idx.columns.every((c) => other[c] === data[c])) {
          throw new Error(`UNIQUE constraint failed: ${table}.${idx.columns.join(", ")}`);
        }
      }
    }
    t.set(pk, data);
    this.journal?.push(() => t.delete(pk));
    this.committed();
    return clone(data) as unknown as Tables[N];
  }

  update<N extends TableName>(table: N, pk: string, patch: Partial<Tables[N]>): Tables[N] {
    const t = this.table(table);
    const prev = t.get(pk);
    if (!prev) throw new NotFoundError(`${table} ${pk}`);
    const next: Row = { ...prev };
    for (const [k, v] of Object.entries(patch as Row)) {
      if (v === undefined) continue;
      if (!(k in SCHEMA[table].columns)) throw new Error(`Unknown column ${table}.${k}`);
      next[k] = clone(v);
    }
    t.set(pk, next);
    this.journal?.push(() => t.set(pk, prev));
    this.committed();
    return clone(next) as unknown as Tables[N];
  }

  remove<N extends TableName>(table: N, pk: string): void {
    const t = this.table(table);
    const prev = t.get(pk);
    if (!prev) return;
    t.delete(pk);
    this.journal?.push(() => t.set(pk, prev));
    this.committed();
  }

  transaction<T>(fn: () => T): T {
    const outer = this.depth === 0;
    if (outer) this.journal = [];
    const mark = this.journal!.length;
    this.depth++;
    try {
      const result = fn();
      this.depth--;
      if (outer) {
        this.journal = null;
        this.committed();
      }
      return result;
    } catch (err) {
      this.depth--;
      const journal = this.journal!;
      while (journal.length > mark) journal.pop()!();
      if (outer) this.journal = null;
      throw err;
    }
  }

  nextSequence(name: string, start = 1): number {
    return this.transaction(() => {
      const current = this.get("sequences", name);
      const value = current ? current.value + 1 : start;
      if (current) this.update("sequences", name, { value });
      else this.insert("sequences", { name, value });
      return value;
    });
  }

  snapshot(): Snapshot {
    const tables: Snapshot["tables"] = {};
    for (const name of TABLE_NAMES) tables[name] = [...this.table(name).values()].map((r) => clone(r));
    return { version: 1, tables };
  }

  load(snapshot: Snapshot): void {
    for (const name of TABLE_NAMES) {
      const t = this.table(name);
      t.clear();
      for (const row of (snapshot.tables[name] ?? []) as Row[]) t.set(this.pkOf(name, row), clone(row));
    }
  }

  isEmpty(): boolean {
    return this.table("users").size === 0;
  }
}
