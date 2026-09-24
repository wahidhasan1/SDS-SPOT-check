// The append-only event log behind the bug timeline and the audit log, plus notifications.

import type { EventRecord, Notification, NotificationCategory } from "../../core/types";
import type { AppContext } from "../context";
import { nowIso } from "../context";
import { newId, sortableId, uniq } from "./util";

export interface EventInput {
  bugId?: string | null;
  actorId: string | null;
  type: string;
  entityType?: string;
  entityId?: string | null;
  data?: Record<string, unknown>;
}

export function recordEvent(ctx: AppContext, e: EventInput): EventRecord {
  const now = nowIso(ctx);
  return ctx.store.insert("events", {
    id: sortableId("evt", now),
    bug_id: e.bugId ?? null,
    actor_id: e.actorId,
    type: e.type,
    entity_type: e.entityType ?? (e.bugId ? "bug" : "workspace"),
    entity_id: e.entityId ?? e.bugId ?? null,
    data: e.data ?? {},
    created_at: now,
  });
}

export interface NotifySpec {
  type: string;
  category: NotificationCategory;
  bugId: string | null;
  actorId: string | null;
  title: string;
  body?: string | null;
}

/**
 * Deliver an in-app notification. The actor never notifies themselves; inactive users are
 * skipped; "progress" and "discussion" respect each person's preferences.
 */
export function notify(ctx: AppContext, recipients: (string | null | undefined)[], spec: NotifySpec): Notification[] {
  const ids = uniq(recipients.filter((x): x is string => !!x && x !== spec.actorId));
  const created: Notification[] = [];
  for (const id of ids) {
    const user = ctx.store.get("users", id);
    if (!user || !user.active) continue;
    if (spec.category === "progress" && user.notification_prefs?.progress === false) continue;
    if (spec.category === "discussion" && user.notification_prefs?.discussion === false) continue;
    created.push(
      ctx.store.insert("notifications", {
        id: sortableId("ntf", nowIso(ctx)),
        user_id: id,
        type: spec.type,
        category: spec.category,
        bug_id: spec.bugId,
        actor_id: spec.actorId,
        title: spec.title,
        body: spec.body ?? null,
        created_at: nowIso(ctx),
        read_at: null,
      }),
    );
  }
  return created;
}

export function addWatchers(ctx: AppContext, bugId: string, userIds: (string | null | undefined)[]): void {
  for (const userId of uniq(userIds.filter((x): x is string => !!x))) {
    if (ctx.store.count("watchers", { bug_id: bugId, user_id: userId }) > 0) continue;
    ctx.store.insert("watchers", { id: newId("wch"), bug_id: bugId, user_id: userId, created_at: nowIso(ctx) });
  }
}

export function watcherIds(ctx: AppContext, bugId: string): string[] {
  return ctx.store.find("watchers", { where: { bug_id: bugId } }).map((w) => w.user_id);
}
