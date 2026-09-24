// Discussion and collaboration: comments, evidence, assignment, collaborators, watching,
// related links and "I'm seeing this too".

import type { Bug, Comment } from "../../core/types";
import { canAlsoSee, canAssign, canBeAssignee, canComment, isQa } from "../../core/permissions";
import { findMentions } from "../../core/text";
import type { AppContext } from "../context";
import { nowIso, atOneMoment } from "../context";
import type { UserRow } from "../db/schema";
import { insertAttachments, withStoredFiles, type IncomingFile } from "./attachments";
import { actorOf, resolveBug } from "./bugs";
import { addWatchers, notify, recordEvent, watcherIds } from "./events";
import { badRequest, cleanText, forbidden, newId, notFound, sortableId, uniq } from "./util";

const TRIAGE_ROLES = new Set(["engineer", "project_manager", "qa_lead", "admin"]);

function touch(ctx: AppContext, bug: Bug, extra: Partial<Bug> = {}): Bug {
  const now = nowIso(ctx);
  return ctx.store.update("bugs", bug.id, { ...extra, updated_at: now, last_activity_at: now });
}

export async function addComment(ctx: AppContext, user: UserRow, bug: Bug, body: string | null, files: IncomingFile[] = []): Promise<Comment> {
  ctx = atOneMoment(ctx);
  if (!canComment(actorOf(user), bug)) throw forbidden("You can't comment on this bug.");
  const text = cleanText(body, 20000);
  if (!text && !files.length) throw badRequest("Write a comment or attach a file.");
  const users = ctx.store.find("users", { where: { active: true } });
  const mentions = text ? findMentions(text, users).filter((id) => id !== user.id) : [];

  return withStoredFiles(ctx, files, (stored) => {
    const now = nowIso(ctx);
    const comment = ctx.store.insert("comments", {
      id: sortableId("cmt", now),
      bug_id: bug.id,
      author_id: user.id,
      kind: stored.length && !text ? "evidence" : "comment",
      body: text ?? `Added ${stored.length} attachment${stored.length === 1 ? "" : "s"}.`,
      mentions,
      created_at: now,
      edited_at: null,
    });
    const atts = insertAttachments(ctx, stored, { bugId: bug.id, uploaderId: user.id, context: "comment", commentId: comment.id });
    recordEvent(ctx, {
      bugId: bug.id,
      actorId: user.id,
      type: "comment.added",
      entityType: "comment",
      entityId: comment.id,
      data: { comment_id: comment.id, attachment_ids: atts.map((a) => a.id), mentions },
    });
    const firstResponse = !bug.first_response_at && user.id !== bug.reporter_id && TRIAGE_ROLES.has(user.role) ? { first_response_at: now } : {};
    touch(ctx, bug, firstResponse);
    addWatchers(ctx, bug.id, [user.id, ...mentions]);

    if (mentions.length) {
      notify(ctx, mentions, {
        type: "mentioned",
        category: "action",
        bugId: bug.id,
        actorId: user.id,
        title: `${user.name} mentioned you on ${bug.key}.`,
        body: text,
      });
    }
    if (atts.length && isQa(user) && bug.assignee_id) {
      notify(ctx, [bug.assignee_id].filter((id) => !mentions.includes(id)), {
        type: "evidence_added",
        category: "progress",
        bugId: bug.id,
        actorId: user.id,
        title: `QA added additional evidence to ${bug.key}.`,
        body: text,
      });
    }
    const others = watcherIds(ctx, bug.id).filter((id) => !mentions.includes(id) && !(atts.length && id === bug.assignee_id && isQa(user)));
    notify(ctx, others, {
      type: "comment",
      category: "discussion",
      bugId: bug.id,
      actorId: user.id,
      title: `${user.name} commented on ${bug.key}.`,
      body: text,
    });
    return comment;
  });
}

export async function addEvidence(ctx: AppContext, user: UserRow, bug: Bug, files: IncomingFile[], note: string | null): Promise<Comment> {
  if (!files.length) throw badRequest("Choose at least one file.");
  return addComment(ctx, user, bug, note, files);
}

export function assignBug(ctx: AppContext, user: UserRow, bug: Bug, assigneeId: string | null): Bug {
  if (!canAssign(actorOf(user))) throw forbidden("Your role can't assign bugs.");
  if (bug.archived_at) throw badRequest("This bug is archived.");
  if (assigneeId === bug.assignee_id) return bug;
  let assignee: UserRow | undefined;
  if (assigneeId) {
    assignee = ctx.store.get("users", assigneeId);
    if (!assignee || !assignee.active || !canBeAssignee(assignee.role)) throw badRequest("Choose an active engineer.");
  }
  return ctx.store.transaction(() => {
    const now = nowIso(ctx);
    const firstResponse = !bug.first_response_at && TRIAGE_ROLES.has(user.role) && user.id !== bug.reporter_id ? { first_response_at: now } : {};
    const updated = touch(ctx, bug, { assignee_id: assigneeId, ...firstResponse });
    recordEvent(ctx, { bugId: bug.id, actorId: user.id, type: "bug.assigned", data: { from: bug.assignee_id, to: assigneeId } });
    if (assignee) {
      addWatchers(ctx, bug.id, [assignee.id]);
      notify(ctx, [assignee.id], {
        type: "bug_assigned",
        category: "action",
        bugId: bug.id,
        actorId: user.id,
        title: bug.status === "new" ? `New bug ${bug.key} has been assigned to you.` : `${bug.key} has been assigned to you by ${user.name}.`,
        body: bug.title,
      });
    }
    notify(ctx, [bug.assignee_id], {
      type: "bug_unassigned",
      category: "progress",
      bugId: bug.id,
      actorId: user.id,
      title: assignee ? `${bug.key} was reassigned to ${assignee.name}.` : `You were unassigned from ${bug.key}.`,
    });
    return updated;
  });
}

export function setCollaborators(ctx: AppContext, user: UserRow, bug: Bug, userIds: string[]): Bug {
  if (!canAssign(actorOf(user))) throw forbidden("Your role can't change collaborators.");
  if (bug.archived_at) throw badRequest("This bug is archived.");
  const ids = uniq(userIds).filter((id) => id !== bug.assignee_id);
  for (const id of ids) {
    const u = ctx.store.get("users", id);
    if (!u || !u.active || !canBeAssignee(u.role)) throw badRequest("Collaborators must be active engineers.");
  }
  const added = ids.filter((id) => !bug.collaborator_ids.includes(id));
  const removed = bug.collaborator_ids.filter((id) => !ids.includes(id));
  if (!added.length && !removed.length) return bug;
  return ctx.store.transaction(() => {
    const updated = touch(ctx, bug, { collaborator_ids: ids });
    recordEvent(ctx, { bugId: bug.id, actorId: user.id, type: "bug.collaborators_changed", data: { added, removed } });
    addWatchers(ctx, bug.id, added);
    notify(ctx, added, {
      type: "collaborator_added",
      category: "progress",
      bugId: bug.id,
      actorId: user.id,
      title: `${user.name} added you as a collaborator on ${bug.key}.`,
      body: bug.title,
    });
    return updated;
  });
}

export function setWatching(ctx: AppContext, user: UserRow, bug: Bug, watching: boolean): void {
  const existing = ctx.store.findOne("watchers", { bug_id: bug.id, user_id: user.id });
  if (watching && !existing) addWatchers(ctx, bug.id, [user.id]);
  if (!watching && existing) ctx.store.remove("watchers", existing.id);
}

export function addLink(ctx: AppContext, user: UserRow, bug: Bug, targetRef: string): Bug {
  if (!canComment(actorOf(user), bug)) throw forbidden();
  const target = resolveBug(ctx, targetRef);
  if (target.id === bug.id) throw badRequest("A bug can't be linked to itself.");
  const exists =
    ctx.store.findOne("bug_links", { bug_id: bug.id, target_bug_id: target.id }) ??
    ctx.store.findOne("bug_links", { bug_id: target.id, target_bug_id: bug.id });
  if (exists) throw badRequest(`${bug.key} and ${target.key} are already linked.`);
  return ctx.store.transaction(() => {
    ctx.store.insert("bug_links", { id: newId("lnk"), bug_id: bug.id, target_bug_id: target.id, kind: "related", created_by_id: user.id, created_at: nowIso(ctx) });
    recordEvent(ctx, { bugId: bug.id, actorId: user.id, type: "bug.link_added", data: { target_bug_id: target.id, target_key: target.key } });
    recordEvent(ctx, { bugId: target.id, actorId: user.id, type: "bug.link_added", data: { target_bug_id: bug.id, target_key: bug.key } });
    return touch(ctx, bug);
  });
}

export function removeLink(ctx: AppContext, user: UserRow, bug: Bug, linkId: string): Bug {
  if (!canComment(actorOf(user), bug)) throw forbidden();
  const link = ctx.store.get("bug_links", linkId);
  if (!link || (link.bug_id !== bug.id && link.target_bug_id !== bug.id)) throw notFound("Link not found.");
  if (link.kind !== "related") throw badRequest("Duplicate links change through the Duplicate or Dispute actions.");
  return ctx.store.transaction(() => {
    ctx.store.remove("bug_links", link.id);
    const other = link.bug_id === bug.id ? link.target_bug_id : link.bug_id;
    const otherBug = ctx.store.get("bugs", other);
    recordEvent(ctx, { bugId: bug.id, actorId: user.id, type: "bug.link_removed", data: { target_bug_id: other, target_key: otherBug?.key ?? null } });
    return touch(ctx, bug);
  });
}

export async function alsoSeen(ctx: AppContext, user: UserRow, bug: Bug, note: string | null, files: IncomingFile[] = []): Promise<Bug> {
  ctx = atOneMoment(ctx);
  const already = !!ctx.store.findOne("co_reporters", { bug_id: bug.id, user_id: user.id });
  if (!canAlsoSee(actorOf(user), bug, already)) throw forbidden("You can't add yourself as a co-reporter on this bug.");
  const text = cleanText(note, 5000);
  return withStoredFiles(ctx, files, (stored) => {
    const now = nowIso(ctx);
    ctx.store.insert("co_reporters", { id: newId("crp"), bug_id: bug.id, user_id: user.id, via_bug_id: null, note: text, created_at: now });
    let commentId: string | null = null;
    if (text || stored.length) {
      const c = ctx.store.insert("comments", {
        id: sortableId("cmt", now),
        bug_id: bug.id,
        author_id: user.id,
        kind: "evidence",
        body: text ?? "I'm seeing this too.",
        mentions: [],
        created_at: now,
        edited_at: null,
      });
      commentId = c.id;
      insertAttachments(ctx, stored, { bugId: bug.id, uploaderId: user.id, context: "comment", commentId: c.id });
    }
    recordEvent(ctx, { bugId: bug.id, actorId: user.id, type: "bug.co_reporter_added", data: { user_id: user.id, note: text, comment_id: commentId } });
    addWatchers(ctx, bug.id, [user.id]);
    notify(ctx, [bug.assignee_id], {
      type: stored.length ? "evidence_added" : "also_seen",
      category: "progress",
      bugId: bug.id,
      actorId: user.id,
      title: stored.length ? `QA added additional evidence to ${bug.key}.` : `${user.name} is also seeing ${bug.key}.`,
      body: text,
    });
    return touch(ctx, bug);
  });
}

export function getBugForUser(ctx: AppContext, ref: string): Bug {
  return resolveBug(ctx, ref);
}
