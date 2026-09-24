// The storage interface shared by the SQLite store (server) and the memory store (demo, tests).

import type { TableName, Tables } from "./schema";
import { SCHEMA } from "./schema";

export type Primitive = string | number | boolean | null;

export interface Condition {
  eq?: Primitive;
  ne?: Primitive;
  in?: Primitive[];
  nin?: Primitive[];
  gt?: string | number;
  gte?: string | number;
  lt?: string | number;
  lte?: string | number;
  /** Case-insensitive substring match. */
  like?: string;
  isNull?: boolean;
  /** JSON array column contains the value. */
  contains?: Primitive;
}

export type Where<T> = { [K in keyof T]?: Primitive | Condition } & {
  $or?: Where<T>[];
  $and?: Where<T>[];
};

export interface OrderBy<T> {
  column: keyof T & string;
  dir?: "asc" | "desc";
}

export interface FindOptions<T> {
  where?: Where<T>;
  orderBy?: OrderBy<T>[];
  limit?: number;
  offset?: number;
}

export interface Store {
  readonly kind: "sqlite" | "memory";
  get<N extends TableName>(table: N, pk: string): Tables[N] | undefined;
  find<N extends TableName>(table: N, opts?: FindOptions<Tables[N]>): Tables[N][];
  findOne<N extends TableName>(table: N, where: Where<Tables[N]>, orderBy?: OrderBy<Tables[N]>[]): Tables[N] | undefined;
  count<N extends TableName>(table: N, where?: Where<Tables[N]>): number;
  insert<N extends TableName>(table: N, row: Tables[N]): Tables[N];
  update<N extends TableName>(table: N, pk: string, patch: Partial<Tables[N]>): Tables[N];
  remove<N extends TableName>(table: N, pk: string): void;
  transaction<T>(fn: () => T): T;
  nextSequence(name: string, start?: number): number;
  close?(): void;
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

export function isCondition(v: unknown): v is Condition {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function columnType(table: TableName, column: string) {
  const def = SCHEMA[table].columns[column];
  if (!def) throw new Error(`Unknown column ${table}.${column}`);
  return def.type;
}

// ---------------------------------------------------------------------------
// In-memory evaluation (used by the memory store)
// ---------------------------------------------------------------------------

function cmp(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === "boolean") a = a ? 1 : 0;
  if (typeof b === "boolean") b = b ? 1 : 0;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function eqValue(a: unknown, b: unknown): boolean {
  if (typeof a === "boolean" || typeof b === "boolean") return Boolean(a) === Boolean(b) && a !== null && b !== null;
  return a === b;
}

function matchCondition(value: unknown, cond: Condition): boolean {
  if (cond.eq !== undefined && !(cond.eq === null ? value === null || value === undefined : eqValue(value, cond.eq))) return false;
  if (cond.ne !== undefined && (cond.ne === null ? value === null || value === undefined : eqValue(value, cond.ne))) return false;
  if (cond.in !== undefined && !cond.in.some((x) => eqValue(value, x))) return false;
  if (cond.nin !== undefined && (value === null || value === undefined || cond.nin.some((x) => eqValue(value, x)))) return false;
  if (cond.gt !== undefined && !(value !== null && value !== undefined && cmp(value, cond.gt) > 0)) return false;
  if (cond.gte !== undefined && !(value !== null && value !== undefined && cmp(value, cond.gte) >= 0)) return false;
  if (cond.lt !== undefined && !(value !== null && value !== undefined && cmp(value, cond.lt) < 0)) return false;
  if (cond.lte !== undefined && !(value !== null && value !== undefined && cmp(value, cond.lte) <= 0)) return false;
  if (cond.isNull !== undefined && cond.isNull !== (value === null || value === undefined)) return false;
  if (cond.like !== undefined) {
    if (value === null || value === undefined) return false;
    const hay = (typeof value === "string" ? value : JSON.stringify(value)).toLowerCase();
    if (!hay.includes(cond.like.toLowerCase())) return false;
  }
  if (cond.contains !== undefined && !(Array.isArray(value) && value.includes(cond.contains))) return false;
  return true;
}

export function matchesWhere<T>(row: T, where: Where<T> | undefined): boolean {
  if (!where) return true;
  for (const [key, spec] of Object.entries(where)) {
    if (spec === undefined) continue;
    if (key === "$or") {
      const list = spec as Where<T>[];
      if (list.length && !list.some((w) => matchesWhere(row, w))) return false;
      continue;
    }
    if (key === "$and") {
      if (!(spec as Where<T>[]).every((w) => matchesWhere(row, w))) return false;
      continue;
    }
    const value = (row as Record<string, unknown>)[key];
    if (isCondition(spec)) {
      if (!matchCondition(value, spec)) return false;
    } else if (spec === null) {
      if (value !== null && value !== undefined) return false;
    } else if (!eqValue(value, spec)) return false;
  }
  return true;
}

export function sortRows<T>(rows: T[], orderBy: OrderBy<T>[] | undefined): T[] {
  if (!orderBy?.length) return rows;
  return rows.sort((a, b) => {
    for (const o of orderBy) {
      const c = cmp((a as Record<string, unknown>)[o.column], (b as Record<string, unknown>)[o.column]);
      if (c !== 0) return o.dir === "desc" ? -c : c;
    }
    return 0;
  });
}
