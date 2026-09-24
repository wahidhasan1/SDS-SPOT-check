// Administration: users and teams, projects → modules → features, environments, severity and
// priority levels, status labels, workspace settings, and the audit log.

import type { AuditResponse } from "../../core/api";
import type {
  Environment,
  EnvironmentKind,
  Feature,
  Level,
  Module,
  NotificationPrefs,
  PaletteColor,
  Project,
  PublicSettings,
  Role,
  StatusConfig,
  StatusKey,
  Team,
  TeamKind,
  User,
} from "../../core/types";
import { ENVIRONMENT_KINDS, PALETTE, ROLES, TEAM_KINDS } from "../../core/types";
import { STATUS_DEFS } from "../../core/statuses";
import { workspaceCapabilities } from "../../core/permissions";
import type { AppContext } from "../context";
import { nowIso } from "../context";
import type { UserRow } from "../db/schema";
import type { Where } from "../db/store";
import { actorOf, bugRef, resolveBug } from "./bugs";
import { recordEvent } from "./events";
import { avatarColorFor, hashPassword, validatePassword } from "./auth";
import { getSettings, saveSetting, statusConfigs } from "./lookups";
import { badRequest, cleanText, conflict, forbidden, newId, notFound, publicUser, randomToken, requireText } from "./util";

function requireCap(user: UserRow, cap: "manage_users" | "manage_config" | "manage_projects" | "view_audit"): void {
  if (!workspaceCapabilities(actorOf(user))[cap]) throw forbidden();
}

function color(v: unknown, fallback: PaletteColor): PaletteColor {
  if (v === undefined || v === null || v === "") return fallback;
  if (!(PALETTE as readonly string[]).includes(String(v))) throw badRequest("Choose a colour from the palette.");
  return v as PaletteColor;
}

function audit(ctx: AppContext, actor: UserRow, type: string, entityType: string, entityId: string, data: Record<string, unknown>) {
  recordEvent(ctx, { actorId: actor.id, type, entityType, entityId, data });
}

function diff<T extends object>(before: T, patch: Partial<T>): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const prev = (before as Record<string, unknown>)[k];
    if (JSON.stringify(prev) !== JSON.stringify(v)) out[k] = { from: prev, to: v };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Users and teams
// ---------------------------------------------------------------------------

export interface UserInput {
  name?: string;
  email?: string;
  role?: Role;
  team_id?: string | null;
  title?: string | null;
  active?: boolean;
  password?: string | null;
}

function validateRole(role: unknown): Role {
  if (!(ROLES as readonly string[]).includes(String(role))) throw badRequest("Choose a valid role.");
  return role as Role;
}

function validateTeam(ctx: AppContext, id: string | null | undefined): string | null {
  if (!id) return null;
  if (!ctx.store.get("teams", id)) throw badRequest("Unknown team.");
  return id;
}

export async function createUser(ctx: AppContext, actor: UserRow, input: UserInput): Promise<{ user: User; temporary_password: string | null }> {
  requireCap(actor, "manage_users");
  const name = requireText(input.name, "Name", 120);
  const email = requireText(input.email, "Email", 200).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest("Enter a valid email address.");
  if (ctx.store.findOne("users", { email })) throw conflict("A user with that email already exists.");
  const role = validateRole(input.role ?? "qa_analyst");
  let temporary: string | null = null;
  let password = input.password ?? null;
  if (!password) {
    temporary = randomToken(6);
    password = temporary;
  } else validatePassword(password);
  const hash = await hashPassword(password);
  const now = nowIso(ctx);
  const user = ctx.store.transaction(() => {
    const u = ctx.store.insert("users", {
      id: newId("usr"),
      name,
      email,
      password_hash: hash,
      role,
      team_id: validateTeam(ctx, input.team_id),
      title: cleanText(input.title, 120),
      avatar_color: avatarColorFor(email),
      active: true,
      notification_prefs: { progress: true, discussion: true },
      created_at: now,
      updated_at: now,
      last_seen_at: null,
      deactivated_at: null,
    });
    audit(ctx, actor, "user.created", "user", u.id, { name, email, role });
    return u;
  });
  return { user: publicUser(user) as User, temporary_password: temporary };
}

export function updateUser(ctx: AppContext, actor: UserRow, id: string, input: UserInput): User {
  requireCap(actor, "manage_users");
  const user = ctx.store.get("users", id);
  if (!user) throw notFound("User not found.");
  const patch: Partial<UserRow> = {};
  if (input.name !== undefined) patch.name = requireText(input.name, "Name", 120);
  if (input.email !== undefined) {
    const email = requireText(input.email, "Email", 200).toLowerCase();
    const other = ctx.store.findOne("users", { email });
    if (other && other.id !== id) throw conflict("Another user already has that email.");
    patch.email = email;
  }
  if (input.role !== undefined) patch.role = validateRole(input.role);
  if (input.team_id !== undefined) patch.team_id = validateTeam(ctx, input.team_id);
  if (input.title !== undefined) patch.title = cleanText(input.title, 120);
  if (input.active !== undefined) patch.active = !!input.active;

  const losingAdmin = user.role === "admin" && user.active && ((patch.role && patch.role !== "admin") || patch.active === false);
  if (losingAdmin && ctx.store.count("users", { role: "admin", active: true }) <= 1) {
    throw badRequest("Keep at least one active administrator.");
  }
  if (id === actor.id && patch.active === false) throw badRequest("You can't deactivate your own account.");

  const changes = diff(user, patch);
  if (!Object.keys(changes).length) return publicUser(user) as User;
  return ctx.store.transaction(() => {
    const now = nowIso(ctx);
    if (patch.active === false) {
      patch.deactivated_at = now;
      for (const s of ctx.store.find("sessions", { where: { user_id: id } })) ctx.store.remove("sessions", s.id);
    }
    if (patch.active === true) patch.deactivated_at = null;
    const updated = ctx.store.update("users", id, { ...patch, updated_at: now });
    const type =
      patch.active === false ? "user.deactivated" : patch.active === true ? "user.reactivated" : changes.role ? "user.role_changed" : "user.updated";
    audit(ctx, actor, type, "user", id, { changes, name: updated.name });
    return publicUser(updated) as User;
  });
}

export function updateProfile(ctx: AppContext, user: UserRow, input: { name?: string; title?: string | null; notification_prefs?: Partial<NotificationPrefs> }): User {
  const patch: Partial<UserRow> = {};
  if (input.name !== undefined) patch.name = requireText(input.name, "Name", 120);
  if (input.title !== undefined) patch.title = cleanText(input.title, 120);
  if (input.notification_prefs) {
    patch.notification_prefs = {
      progress: input.notification_prefs.progress ?? user.notification_prefs.progress,
      discussion: input.notification_prefs.discussion ?? user.notification_prefs.discussion,
    };
  }
  const updated = ctx.store.update("users", user.id, { ...patch, updated_at: nowIso(ctx) });
  return publicUser(updated) as User;
}

export interface TeamInput {
  name?: string;
  kind?: TeamKind;
  lead_id?: string | null;
  description?: string | null;
}

export function saveTeam(ctx: AppContext, actor: UserRow, id: string | null, input: TeamInput): Team {
  requireCap(actor, "manage_users");
  if (input.kind !== undefined && !(TEAM_KINDS as readonly string[]).includes(input.kind)) throw badRequest("Unknown team type.");
  if (input.lead_id && !ctx.store.get("users", input.lead_id)) throw badRequest("Unknown team lead.");
  return ctx.store.transaction(() => {
    if (!id) {
      const team = ctx.store.insert("teams", {
        id: newId("team"),
        name: requireText(input.name, "Team name", 80),
        kind: input.kind ?? "qa",
        lead_id: input.lead_id ?? null,
        description: cleanText(input.description, 500),
        created_at: nowIso(ctx),
      });
      audit(ctx, actor, "team.created", "team", team.id, { name: team.name });
      return team;
    }
    const team = ctx.store.get("teams", id);
    if (!team) throw notFound("Team not found.");
    const patch: Partial<Team> = {};
    if (input.name !== undefined) patch.name = requireText(input.name, "Team name", 80);
    if (input.kind !== undefined) patch.kind = input.kind;
    if (input.lead_id !== undefined) patch.lead_id = input.lead_id;
    if (input.description !== undefined) patch.description = cleanText(input.description, 500);
    const updated = ctx.store.update("teams", id, patch);
    audit(ctx, actor, "team.updated", "team", id, { changes: diff(team, patch), name: updated.name });
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Projects, modules, features, membership
// ---------------------------------------------------------------------------

export interface ProjectInput {
  key?: string;
  name?: string;
  description?: string | null;
  qa_lead_id?: string | null;
  pm_id?: string | null;
  archived?: boolean;
}

export function saveProject(ctx: AppContext, actor: UserRow, id: string | null, input: ProjectInput): Project {
  requireCap(actor, "manage_projects");
  for (const [field, uid] of [["QA lead", input.qa_lead_id], ["Project manager", input.pm_id]] as const) {
    if (uid && !ctx.store.get("users", uid)) throw badRequest(`Unknown ${field.toLowerCase()}.`);
  }
  return ctx.store.transaction(() => {
    const now = nowIso(ctx);
    if (!id) {
      const key = requireText(input.key, "Project key", 8).toUpperCase();
      if (!/^[A-Z][A-Z0-9]{1,7}$/.test(key)) throw badRequest("Use 2–8 letters or digits for the project key, starting with a letter.");
      if (ctx.store.findOne("projects", { key })) throw conflict("Another project already uses that key.");
      const p = ctx.store.insert("projects", {
        id: newId("prj"),
        key,
        name: requireText(input.name, "Project name", 120),
        description: cleanText(input.description, 2000),
        qa_lead_id: input.qa_lead_id ?? null,
        pm_id: input.pm_id ?? null,
        archived: false,
        created_at: now,
        updated_at: now,
      });
      audit(ctx, actor, "project.created", "project", p.id, { name: p.name, key });
      return p;
    }
    const project = ctx.store.get("projects", id);
    if (!project) throw notFound("Project not found.");
    const patch: Partial<Project> = {};
    if (input.name !== undefined) patch.name = requireText(input.name, "Project name", 120);
    if (input.description !== undefined) patch.description = cleanText(input.description, 2000);
    if (input.qa_lead_id !== undefined) patch.qa_lead_id = input.qa_lead_id;
    if (input.pm_id !== undefined) patch.pm_id = input.pm_id;
    if (input.archived !== undefined) patch.archived = !!input.archived;
    const updated = ctx.store.update("projects", id, { ...patch, updated_at: now });
    audit(ctx, actor, input.archived === true ? "project.archived" : "project.updated", "project", id, { changes: diff(project, patch), name: updated.name });
    return updated;
  });
}

export interface ModuleInput {
  project_id?: string;
  name?: string;
  description?: string | null;
  owner_id?: string | null;
  archived?: boolean;
  sort_order?: number;
}

export function saveModule(ctx: AppContext, actor: UserRow, id: string | null, input: ModuleInput): Module {
  requireCap(actor, "manage_projects");
  if (input.owner_id) {
    const owner = ctx.store.get("users", input.owner_id);
    if (!owner || !["engineer", "admin"].includes(owner.role)) throw badRequest("The default owner must be an engineer.");
  }
  return ctx.store.transaction(() => {
    if (!id) {
      const project = ctx.store.get("projects", String(input.project_id));
      if (!project) throw badRequest("Choose a project.");
      const name = requireText(input.name, "Module name", 80);
      if (ctx.store.find("modules", { where: { project_id: project.id } }).some((m) => m.name.toLowerCase() === name.toLowerCase())) {
        throw conflict(`${project.name} already has a module called ${name}.`);
      }
      const m = ctx.store.insert("modules", {
        id: newId("mod"),
        project_id: project.id,
        name,
        description: cleanText(input.description, 1000),
        owner_id: input.owner_id ?? null,
        sort_order: input.sort_order ?? ctx.store.count("modules", { project_id: project.id }) + 1,
        archived: false,
        created_at: nowIso(ctx),
      });
      audit(ctx, actor, "module.created", "module", m.id, { name, project_id: project.id });
      return m;
    }
    const mod = ctx.store.get("modules", id);
    if (!mod) throw notFound("Module not found.");
    const patch: Partial<Module> = {};
    if (input.name !== undefined) patch.name = requireText(input.name, "Module name", 80);
    if (input.description !== undefined) patch.description = cleanText(input.description, 1000);
    if (input.owner_id !== undefined) patch.owner_id = input.owner_id;
    if (input.archived !== undefined) patch.archived = !!input.archived;
    if (input.sort_order !== undefined) patch.sort_order = Number(input.sort_order);
    const updated = ctx.store.update("modules", id, patch);
    audit(ctx, actor, "module.updated", "module", id, { changes: diff(mod, patch), name: updated.name });
    return updated;
  });
}

export interface FeatureInput {
  module_id?: string;
  name?: string;
  description?: string | null;
  archived?: boolean;
}

export function saveFeature(ctx: AppContext, actor: UserRow, id: string | null, input: FeatureInput): Feature {
  requireCap(actor, "manage_projects");
  return ctx.store.transaction(() => {
    if (!id) {
      const mod = ctx.store.get("modules", String(input.module_id));
      if (!mod) throw badRequest("Choose a module.");
      const f = ctx.store.insert("features", {
        id: newId("feat"),
        module_id: mod.id,
        name: requireText(input.name, "Feature name", 80),
        description: cleanText(input.description, 1000),
        sort_order: ctx.store.count("features", { module_id: mod.id }) + 1,
        archived: false,
        created_at: nowIso(ctx),
      });
      audit(ctx, actor, "feature.created", "feature", f.id, { name: f.name, module_id: mod.id });
      return f;
    }
    const feature = ctx.store.get("features", id);
    if (!feature) throw notFound("Feature not found.");
    const patch: Partial<Feature> = {};
    if (input.name !== undefined) patch.name = requireText(input.name, "Feature name", 80);
    if (input.description !== undefined) patch.description = cleanText(input.description, 1000);
    if (input.archived !== undefined) patch.archived = !!input.archived;
    const updated = ctx.store.update("features", id, patch);
    audit(ctx, actor, "feature.updated", "feature", id, { changes: diff(feature, patch), name: updated.name });
    return updated;
  });
}

export function setProjectMembership(ctx: AppContext, actor: UserRow, projectId: string, userId: string, member: boolean): void {
  requireCap(actor, "manage_projects");
  if (!ctx.store.get("projects", projectId)) throw notFound("Project not found.");
  if (!ctx.store.get("users", userId)) throw notFound("User not found.");
  const now = nowIso(ctx);
  const current = ctx.store.find("project_members", { where: { project_id: projectId, user_id: userId, left_at: null } })[0];
  ctx.store.transaction(() => {
    if (member && !current) {
      ctx.store.insert("project_members", { id: newId("pmb"), project_id: projectId, user_id: userId, joined_at: now, left_at: null });
      audit(ctx, actor, "project.member_added", "project", projectId, { user_id: userId });
    } else if (!member && current) {
      ctx.store.update("project_members", current.id, { left_at: now });
      audit(ctx, actor, "project.member_removed", "project", projectId, { user_id: userId });
    }
  });
}

// ---------------------------------------------------------------------------
// Workflow configuration and settings
// ---------------------------------------------------------------------------

export interface EnvironmentInput {
  name?: string;
  kind?: EnvironmentKind;
  description?: string | null;
  active?: boolean;
  sort_order?: number;
}

export function saveEnvironment(ctx: AppContext, actor: UserRow, id: string | null, input: EnvironmentInput): Environment {
  requireCap(actor, "manage_config");
  if (input.kind !== undefined && !(ENVIRONMENT_KINDS as readonly string[]).includes(input.kind)) throw badRequest("Unknown environment type.");
  return ctx.store.transaction(() => {
    if (!id) {
      const env = ctx.store.insert("environments", {
        id: newId("env"),
        name: requireText(input.name, "Environment name", 60),
        kind: input.kind ?? "other",
        description: cleanText(input.description, 500),
        sort_order: input.sort_order ?? ctx.store.count("environments") + 1,
        active: true,
      });
      audit(ctx, actor, "config.environment_created", "environment", env.id, { name: env.name });
      return env;
    }
    const env = ctx.store.get("environments", id);
    if (!env) throw notFound("Environment not found.");
    const patch: Partial<Environment> = {};
    if (input.name !== undefined) patch.name = requireText(input.name, "Environment name", 60);
    if (input.kind !== undefined) patch.kind = input.kind;
    if (input.description !== undefined) patch.description = cleanText(input.description, 500);
    if (input.active !== undefined) patch.active = !!input.active;
    if (input.sort_order !== undefined) patch.sort_order = Number(input.sort_order);
    const updated = ctx.store.update("environments", id, patch);
    audit(ctx, actor, "config.environment_updated", "environment", id, { changes: diff(env, patch), name: updated.name });
    return updated;
  });
}

export interface LevelInput {
  key?: string;
  label?: string;
  description?: string | null;
  color?: PaletteColor;
  active?: boolean;
  rank?: number;
}

export function saveLevel(ctx: AppContext, actor: UserRow, kind: "severity" | "priority", key: string | null, input: LevelInput): Level {
  requireCap(actor, "manage_config");
  const table = kind === "severity" ? "severity_levels" : "priority_levels";
  return ctx.store.transaction(() => {
    if (!key) {
      const newKey = requireText(input.key, "Key", 30).toLowerCase().replace(/[^a-z0-9_]+/g, "_");
      if (ctx.store.get(table, newKey)) throw conflict("That key is already used.");
      const level = ctx.store.insert(table, {
        key: newKey,
        label: requireText(input.label, "Label", 40),
        description: cleanText(input.description, 500),
        color: color(input.color, "slate"),
        rank: input.rank ?? ctx.store.count(table) + 1,
        active: true,
      });
      audit(ctx, actor, `config.${kind}_created`, kind, newKey, { label: level.label });
      return level;
    }
    const level = ctx.store.get(table, key);
    if (!level) throw notFound("Level not found.");
    const patch: Partial<Level> = {};
    if (input.label !== undefined) patch.label = requireText(input.label, "Label", 40);
    if (input.description !== undefined) patch.description = cleanText(input.description, 500);
    if (input.color !== undefined) patch.color = color(input.color, level.color);
    if (input.rank !== undefined) patch.rank = Number(input.rank);
    if (input.active !== undefined) {
      if (!input.active && ctx.store.count(table, { active: true }) <= 1) throw badRequest("Keep at least one active level.");
      patch.active = !!input.active;
    }
    const updated = ctx.store.update(table, key, patch);
    audit(ctx, actor, `config.${kind}_updated`, kind, key, { changes: diff(level, patch), label: updated.label });
    return updated;
  });
}

export interface StatusInput {
  label?: string;
  description?: string;
  color?: PaletteColor;
  enabled?: boolean;
  attention_hours?: number | null;
}

export function saveStatus(ctx: AppContext, actor: UserRow, key: StatusKey, input: StatusInput): StatusConfig {
  requireCap(actor, "manage_config");
  const def = STATUS_DEFS[key];
  if (!def) throw notFound("Unknown status.");
  if (input.enabled === false && !def.optional) throw badRequest(`${def.defaults.label} is part of the core lifecycle and can't be turned off.`);
  const current = statusConfigs(ctx).find((s) => s.key === key)!;
  const patch: Partial<StatusConfig> = {};
  if (input.label !== undefined) patch.label = requireText(input.label, "Label", 40);
  if (input.description !== undefined) patch.description = requireText(input.description, "Description", 300);
  if (input.color !== undefined) patch.color = color(input.color, current.color);
  if (input.enabled !== undefined) patch.enabled = !!input.enabled;
  if (input.attention_hours !== undefined) {
    const h = input.attention_hours === null ? null : Number(input.attention_hours);
    if (h !== null && (!Number.isFinite(h) || h < 1 || h > 24 * 90)) throw badRequest("Attention time must be between 1 hour and 90 days.");
    patch.attention_hours = h;
  }
  return ctx.store.transaction(() => {
    const exists = ctx.store.get("status_config", key);
    const updated = exists ? ctx.store.update("status_config", key, patch) : ctx.store.insert("status_config", { ...current, ...patch });
    audit(ctx, actor, "config.status_updated", "status", key, { changes: diff(current, patch) });
    return updated;
  });
}

export function updateSettings(ctx: AppContext, actor: UserRow, input: Partial<PublicSettings>): PublicSettings {
  requireCap(actor, "manage_config");
  const before = getSettings(ctx);
  const patch: Partial<PublicSettings> = {};
  if (input.workspace_name !== undefined) patch.workspace_name = requireText(input.workspace_name, "Workspace name", 60);
  if (input.bug_prefix !== undefined) {
    const p = requireText(input.bug_prefix, "Bug ID prefix", 6).toUpperCase();
    if (!/^[A-Z]{2,6}$/.test(p)) throw badRequest("Use 2–6 letters for the bug ID prefix.");
    patch.bug_prefix = p;
  }
  if (input.auto_close_on_verify !== undefined) patch.auto_close_on_verify = !!input.auto_close_on_verify;
  if (input.escalate_after_reopens !== undefined) {
    const n = Number(input.escalate_after_reopens);
    if (!Number.isInteger(n) || n < 1 || n > 10) throw badRequest("Escalate after 1 to 10 reopens.");
    patch.escalate_after_reopens = n;
  }
  ctx.store.transaction(() => {
    for (const [k, v] of Object.entries(patch)) saveSetting(ctx, k as keyof PublicSettings, v, actor.id);
    audit(ctx, actor, "settings.updated", "settings", "workspace", { changes: diff(before, patch) });
  });
  return getSettings(ctx);
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export interface AuditQuery {
  actor_id?: string;
  type?: string;
  bug?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

export function auditLog(ctx: AppContext, actor: UserRow, q: AuditQuery): AuditResponse {
  requireCap(actor, "view_audit");
  const where: Where<import("../../core/types").EventRecord> = {};
  if (q.actor_id) where.actor_id = q.actor_id === "system" ? null : q.actor_id;
  if (q.type) where.type = { like: q.type };
  if (q.bug) where.bug_id = resolveBug(ctx, q.bug).id;
  if (q.from || q.to) where.created_at = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: `${q.to.slice(0, 10)}T23:59:59.999Z` } : {}) };
  const pageSize = Math.min(Math.max(q.page_size ?? 50, 1), 200);
  const page = Math.max(q.page ?? 1, 1);
  const total = ctx.store.count("events", where);
  const items = ctx.store.find("events", {
    where,
    orderBy: [{ column: "created_at", dir: "desc" }, { column: "id", dir: "desc" }],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  const bugIds = [...new Set(items.map((e) => e.bug_id).filter((x): x is string => !!x))];
  const bugs = bugIds.map((id) => ctx.store.get("bugs", id)).filter((b): b is NonNullable<typeof b> => !!b).map(bugRef);
  return { items, total, page, page_size: pageSize, bugs };
}
