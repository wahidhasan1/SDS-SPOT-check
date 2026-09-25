// SQLite store built on Node's built-in node:sqlite module (no native build step).

import { DatabaseSync, type StatementSync } from "node:sqlite";
import type { TableName, Tables } from "./schema";
import { SCHEMA, schemaDDL } from "./schema";
import type { Condition, FindOptions, OrderBy, Primitive, Store, Where } from "./store";
import { NotFoundError, columnType, isCondition } from "./store";

type SqlValue = string | number | null;
type Row = Record<string, unknown>;

export class SqliteStore implements Store {
  readonly kind = "sqlite" as const;
  private readonly db: DatabaseSync;
  private readonly stmts = new Map<string, StatementSync>();
  private depth = 0;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec("PRAGMA busy_timeout = 5000;");
    this.db.exec("PRAGMA synchronous = NORMAL;");
    this.db.exec(schemaDDL());
    this.addMissingColumns();
  }

  /** Databases created by an older version gain new (nullable or JSON) columns in place. */
  private addMissingColumns(): void {
    for (const [table, def] of Object.entries(SCHEMA)) {
      const existing = new Set((this.db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map((c) => c.name));
      for (const [col, c] of Object.entries(def.columns)) {
        if (existing.has(col)) continue;
        const type = c.type === "json" || c.type === "text" ? "TEXT" : c.type === "real" ? "REAL" : "INTEGER";
        const fallback = c.nullable ? "" : c.type === "json" ? " NOT NULL DEFAULT '[]'" : c.type === "text" ? " NOT NULL DEFAULT ''" : " NOT NULL DEFAULT 0";
        this.db.exec(`ALTER TABLE "${table}" ADD COLUMN "${col}" ${type}${fallback}`);
      }
    }
  }

  close(): void {
    this.db.close();
  }

  private stmt(sql: string): StatementSync {
    let s = this.stmts.get(sql);
    if (!s) {
      s = this.db.prepare(sql);
      this.stmts.set(sql, s);
    }
    return s;
  }

  private encode(table: TableName, column: string, value: unknown): SqlValue {
    if (value === undefined || value === null) return null;
    const type = columnType(table, column);
    if (type === "json") return JSON.stringify(value);
    if (type === "boolean") return value ? 1 : 0;
    return value as SqlValue;
  }

  /** Encode a comparison operand (JSON columns compare against their scalar elements). */
  private operand(table: TableName, column: string, value: Primitive | string | number): SqlValue {
    if (value === null) return null;
    const type = columnType(table, column);
    if (type === "boolean") return value ? 1 : 0;
    if (typeof value === "boolean") return value ? 1 : 0;
    return value as SqlValue;
  }

  private decode<N extends TableName>(table: N, row: Row | undefined): Tables[N] | undefined {
    if (!row) return undefined;
    const out: Row = {};
    for (const [col, def] of Object.entries(SCHEMA[table].columns)) {
      const v = row[col];
      if (v === null || v === undefined) out[col] = null;
      else if (def.type === "json") out[col] = JSON.parse(v as string);
      else if (def.type === "boolean") out[col] = v === 1 || v === true;
      else out[col] = v;
    }
    return out as unknown as Tables[N];
  }

  private compileWhere(table: TableName, where: Where<unknown> | undefined, params: SqlValue[]): string {
    if (!where) return "";
    const clauses: string[] = [];
    for (const [key, spec] of Object.entries(where)) {
      if (spec === undefined) continue;
      if (key === "$or" || key === "$and") {
        const list = spec as Where<unknown>[];
        if (!list.length) continue;
        const parts = list.map((w) => this.compileWhere(table, w, params) || "1=1");
        clauses.push(`(${parts.map((p) => `(${p})`).join(key === "$or" ? " OR " : " AND ")})`);
        continue;
      }
      const col = `"${key}"`;
      columnType(table, key); // validates the column name
      if (!isCondition(spec)) {
        if (spec === null) clauses.push(`${col} IS NULL`);
        else {
          clauses.push(`${col} = ?`);
          params.push(this.operand(table, key, spec as unknown as Primitive));
        }
        continue;
      }
      const c = spec as Condition;
      if (c.eq !== undefined) {
        if (c.eq === null) clauses.push(`${col} IS NULL`);
        else {
          clauses.push(`${col} = ?`);
          params.push(this.operand(table, key, c.eq));
        }
      }
      if (c.ne !== undefined) {
        if (c.ne === null) clauses.push(`${col} IS NOT NULL`);
        else {
          clauses.push(`(${col} IS NULL OR ${col} <> ?)`);
          params.push(this.operand(table, key, c.ne));
        }
      }
      if (c.in !== undefined) {
        if (!c.in.length) clauses.push("0");
        else {
          clauses.push(`${col} IN (${c.in.map(() => "?").join(", ")})`);
          for (const v of c.in) params.push(this.operand(table, key, v));
        }
      }
      if (c.nin !== undefined && c.nin.length) {
        clauses.push(`(${col} IS NOT NULL AND ${col} NOT IN (${c.nin.map(() => "?").join(", ")}))`);
        for (const v of c.nin) params.push(this.operand(table, key, v));
      } else if (c.nin !== undefined) {
        clauses.push(`${col} IS NOT NULL`);
      }
      for (const [op, sym] of [
        ["gt", ">"],
        ["gte", ">="],
        ["lt", "<"],
        ["lte", "<="],
      ] as const) {
        const v = c[op];
        if (v !== undefined) {
          clauses.push(`${col} ${sym} ?`);
          params.push(this.operand(table, key, v));
        }
      }
      if (c.isNull !== undefined) clauses.push(`${col} IS ${c.isNull ? "" : "NOT "}NULL`);
      if (c.like !== undefined) {
        clauses.push(`${col} LIKE ? ESCAPE '\\'`);
        params.push(`%${c.like.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
      }
      if (c.contains !== undefined) {
        clauses.push(`EXISTS (SELECT 1 FROM json_each(${col}) WHERE json_each.value = ?)`);
        params.push(typeof c.contains === "boolean" ? (c.contains ? 1 : 0) : c.contains);
      }
    }
    return clauses.join(" AND ");
  }

  private orderSql(table: TableName, orderBy: OrderBy<unknown>[] | undefined): string {
    if (!orderBy?.length) return "";
    return ` ORDER BY ${orderBy
      .map((o) => {
        columnType(table, o.column);
        return `"${o.column}" ${o.dir === "desc" ? "DESC" : "ASC"}`;
      })
      .join(", ")}`;
  }

  get<N extends TableName>(table: N, pk: string): Tables[N] | undefined {
    const row = this.stmt(`SELECT * FROM "${table}" WHERE "${SCHEMA[table].pk}" = ?`).get(pk) as Row | undefined;
    return this.decode(table, row);
  }

  find<N extends TableName>(table: N, opts: FindOptions<Tables[N]> = {}): Tables[N][] {
    const params: SqlValue[] = [];
    const where = this.compileWhere(table, opts.where as Where<unknown>, params);
    let sql = `SELECT * FROM "${table}"${where ? ` WHERE ${where}` : ""}${this.orderSql(table, opts.orderBy as OrderBy<unknown>[])}`;
    if (opts.limit !== undefined) {
      sql += " LIMIT ?";
      params.push(opts.limit);
    }
    if (opts.offset) {
      if (opts.limit === undefined) sql += " LIMIT -1";
      sql += " OFFSET ?";
      params.push(opts.offset);
    }
    const rows = this.stmt(sql).all(...params) as Row[];
    return rows.map((r) => this.decode(table, r)!);
  }

  findOne<N extends TableName>(table: N, where: Where<Tables[N]>, orderBy?: OrderBy<Tables[N]>[]): Tables[N] | undefined {
    return this.find(table, { where, orderBy, limit: 1 })[0];
  }

  count<N extends TableName>(table: N, where?: Where<Tables[N]>): number {
    const params: SqlValue[] = [];
    const w = this.compileWhere(table, where as Where<unknown>, params);
    const row = this.stmt(`SELECT COUNT(*) AS n FROM "${table}"${w ? ` WHERE ${w}` : ""}`).get(...params) as { n: number };
    return Number(row.n);
  }

  insert<N extends TableName>(table: N, row: Tables[N]): Tables[N] {
    const cols = Object.keys(SCHEMA[table].columns);
    const values = cols.map((c) => this.encode(table, c, (row as unknown as Row)[c]));
    this.stmt(`INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(
      ...values,
    );
    return this.get(table, (row as unknown as Row)[SCHEMA[table].pk] as string)!;
  }

  update<N extends TableName>(table: N, pk: string, patch: Partial<Tables[N]>): Tables[N] {
    const entries = Object.entries(patch as Row).filter(([, v]) => v !== undefined);
    if (entries.length) {
      const sets = entries.map(([k]) => {
        columnType(table, k);
        return `"${k}" = ?`;
      });
      const params = entries.map(([k, v]) => this.encode(table, k, v));
      const res = this.stmt(`UPDATE "${table}" SET ${sets.join(", ")} WHERE "${SCHEMA[table].pk}" = ?`).run(...params, pk);
      if (Number(res.changes) === 0) throw new NotFoundError(`${table} ${pk}`);
    }
    const out = this.get(table, pk);
    if (!out) throw new NotFoundError(`${table} ${pk}`);
    return out;
  }

  remove<N extends TableName>(table: N, pk: string): void {
    this.stmt(`DELETE FROM "${table}" WHERE "${SCHEMA[table].pk}" = ?`).run(pk);
  }

  transaction<T>(fn: () => T): T {
    const depth = this.depth++;
    const sp = `sp_${depth}`;
    this.db.exec(depth === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${sp}`);
    try {
      const result = fn();
      this.db.exec(depth === 0 ? "COMMIT" : `RELEASE ${sp}`);
      return result;
    } catch (err) {
      this.db.exec(depth === 0 ? "ROLLBACK" : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
      throw err;
    } finally {
      this.depth--;
    }
  }

  nextSequence(name: string, start = 1): number {
    const row = this.stmt(
      `INSERT INTO "sequences" ("name", "value") VALUES (?, ?) ON CONFLICT("name") DO UPDATE SET "value" = "value" + 1 RETURNING "value"`,
    ).get(name, start) as { value: number };
    return Number(row.value);
  }

  isEmpty(): boolean {
    return this.count("users") === 0;
  }
}
