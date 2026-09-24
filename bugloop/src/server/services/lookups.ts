// Settings, workflow configuration and small shared helpers.

import type { Level, PublicSettings, StatusConfig, StatusKey } from "../../core/types";
import { defaultStatusConfig } from "../../core/statuses";
import type { AppContext } from "../context";
import { nowIso } from "../context";
import type { UserRow } from "../db/schema";
import { badRequest, notFound } from "./util";

export const DEFAULT_SETTINGS: PublicSettings = {
  workspace_name: "Bugloop",
  bug_prefix: "BUG",
  auto_close_on_verify: true,
  escalate_after_reopens: 2,
};

export function getSettings(ctx: AppContext): PublicSettings {
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of ctx.store.find("settings")) {
    if (row.key in DEFAULT_SETTINGS) out[row.key] = row.value;
  }
  return out as unknown as PublicSettings;
}

export function saveSetting(ctx: AppContext, key: keyof PublicSettings, value: unknown, actorId: string | null): void {
  const existing = ctx.store.get("settings", key);
  const now = nowIso(ctx);
  if (existing) ctx.store.update("settings", key, { value, updated_at: now, updated_by_id: actorId });
  else ctx.store.insert("settings", { key, value, updated_at: now, updated_by_id: actorId });
}

export function statusConfigs(ctx: AppContext): StatusConfig[] {
  const rows = ctx.store.find("status_config", { orderBy: [{ column: "sort_order" }] });
  if (rows.length) return rows;
  return defaultStatusConfig();
}

export function statusEnabledFn(ctx: AppContext): (key: StatusKey) => boolean {
  const cfg = new Map(statusConfigs(ctx).map((s) => [s.key, s.enabled]));
  return (key) => cfg.get(key) ?? true;
}

export function statusLabel(ctx: AppContext, key: StatusKey): string {
  return statusConfigs(ctx).find((s) => s.key === key)?.label ?? key;
}

export function severities(ctx: AppContext): Level[] {
  return ctx.store.find("severity_levels", { orderBy: [{ column: "rank" }] });
}

export function priorities(ctx: AppContext): Level[] {
  return ctx.store.find("priority_levels", { orderBy: [{ column: "rank" }] });
}

export function levelLabel(levels: Level[], key: string): string {
  return levels.find((l) => l.key === key)?.label ?? key;
}

export function requireActiveLevel(levels: Level[], key: string, what: string): string {
  const l = levels.find((x) => x.key === key);
  if (!l || !l.active) throw badRequest(`Unknown ${what} "${key}".`);
  return l.key;
}

export function getUser(ctx: AppContext, id: string): UserRow {
  const u = ctx.store.get("users", id);
  if (!u) throw notFound("User not found.");
  return u;
}

export function userName(ctx: AppContext, id: string | null | undefined): string {
  if (!id) return "System";
  return ctx.store.get("users", id)?.name ?? "Unknown user";
}

export function formatBugKey(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(6, "0")}`;
}
