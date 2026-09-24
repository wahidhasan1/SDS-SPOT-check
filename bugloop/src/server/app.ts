// The HTTP API. Built on web-standard Request/Response, so the same app serves Node (server
// mode) and runs inside the page (demo mode).

import { Hono, type Context } from "hono";
import { z } from "zod";
import type { StatusKey } from "../core/types";
import { STATUS_KEYS } from "../core/types";
import { ACTION_KEYS, type ActionKey } from "../core/workflow";
import { BUG_VIEWS, SORT_OPTIONS, type BugViewKey, type SortKey } from "../core/views";
import type { AppContext } from "./context";
import type { UserRow } from "./db/schema";
import { HttpError, badRequest, forbidden, notFound, unauthorized } from "./services/util";
import type { IncomingFile } from "./services/attachments";
import { authStatus, changePassword, demoLogin, login, logout, resolveSession, setupWorkspace } from "./services/auth";
import { getWorkspace } from "./services/workspace";
import { createBug, findSimilar, getBugDetail, listBugs, resolveBug, updateBug, type BugQuery } from "./services/bugs";
import { performAction } from "./services/actions";
import { addComment, addEvidence, addLink, alsoSeen, assignBug, removeLink, setCollaborators, setWatching } from "./services/collab";
import { reassignRegression, regressionQueue } from "./services/regression";
import { actionItems, listNotifications, markNotificationsRead, viewCounts } from "./services/inbox";
import { contributions, dashboard, engineering, moduleHealth } from "./services/analytics";
import {
  auditLog,
  createUser,
  saveEnvironment,
  saveFeature,
  saveLevel,
  saveModule,
  saveProject,
  saveStatus,
  saveTeam,
  setProjectMembership,
  updateProfile,
  updateSettings,
  updateUser,
} from "./services/admin";
import { draftReport, regressionChecks, releaseRisk, summarizeBug } from "./services/ai";

type Env = { Variables: { user: UserRow; token: string } };

const SESSION_COOKIE = "bugloop_session";

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

async function readBody(c: Context<Env>): Promise<{ body: Record<string, unknown>; files: IncomingFile[] }> {
  const type = c.req.header("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await c.req.parseBody({ all: true });
    const files: IncomingFile[] = [];
    let body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(form)) {
      const values = Array.isArray(value) ? value : [value];
      for (const v of values) {
        if (typeof v !== "string") {
          files.push({ name: v.name || "file", type: v.type, size: v.size, blob: v });
        } else if (key === "payload") {
          try {
            body = { ...body, ...(JSON.parse(v) as Record<string, unknown>) };
          } catch {
            throw badRequest("Malformed payload.");
          }
        } else body[key] = v;
      }
    }
    return { body, files };
  }
  if (type.includes("application/json")) {
    try {
      return { body: ((await c.req.json()) ?? {}) as Record<string, unknown>, files: [] };
    } catch {
      throw badRequest("Malformed JSON.");
    }
  }
  return { body: {}, files: [] };
}

function list(c: Context<Env>, key: string): string[] | undefined {
  const values = c.req.queries(key) ?? [];
  const out = values.flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
  return out.length ? out : undefined;
}

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const createBugSchema = z.object({
  project_id: z.string().min(1, "Choose a project."),
  module_id: z.string().min(1, "Choose a module."),
  feature_id: z.string().nullish(),
  affected_module_ids: z.array(z.string()).optional(),
  title: z.string(),
  description: z.string().nullish(),
  steps: z.array(z.string()),
  expected_result: z.string(),
  actual_result: z.string(),
  environment_id: z.string().nullish(),
  browser: z.string().nullish(),
  device: z.string().nullish(),
  os: z.string().nullish(),
  app_version: z.string().nullish(),
  page_url: z.string().nullish(),
  frequency: z.string().nullish(),
  severity: z.string().min(1, "Choose a severity."),
  priority: z.string().nullish(),
  tags: z.array(z.string()).optional(),
  notes: z.string().nullish(),
  ai_meta: z.any().optional(),
  duplicate_check: z.any().optional(),
});

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    throw badRequest(first?.message && !first.message.startsWith("Invalid") ? first.message : `Invalid request: ${first?.path.join(".") ?? ""}`, r.error.issues);
  }
  return r.data;
}

export function createApp(ctx: AppContext) {
  const app = new Hono<Env>().basePath("/api");

  app.onError((err, c) => {
    if (err instanceof HttpError) {
      return c.json({ error: { code: err.code, message: err.message, details: err.details ?? null } }, err.status as 400);
    }
    const message = err instanceof Error ? err.message : String(err);
    if (/UNIQUE constraint/i.test(message)) return c.json({ error: { code: "conflict", message: "That already exists." } }, 409);
    console.error("[bugloop] unexpected error", err);
    return c.json({ error: { code: "internal", message: "Something went wrong on the server." } }, 500);
  });

  app.notFound((c) => c.json({ error: { code: "not_found", message: "No such endpoint." } }, 404));

  // -------------------------------------------------------------------------
  // Public endpoints
  // -------------------------------------------------------------------------

  app.get("/health", (c) => c.json({ ok: true, mode: ctx.config.mode, ai: ctx.ai.status().provider }));
  app.get("/auth/status", (c) => c.json(authStatus(ctx)));

  const sessionCookie = (c: Context<Env>, token: string | null) => {
    if (ctx.config.mode !== "server") return;
    const secure = (c.req.header("x-forwarded-proto") ?? new URL(c.req.url).protocol).startsWith("https");
    const attrs = token
      ? `Max-Age=${ctx.config.sessionDays * 86400}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`
      : "Max-Age=0; Path=/; HttpOnly; SameSite=Lax";
    c.header("Set-Cookie", `${SESSION_COOKIE}=${token ? encodeURIComponent(token) : ""}; ${attrs}`);
  };

  app.post("/auth/login", async (c) => {
    const { body } = await readBody(c);
    const res = await login(ctx, String(body.email ?? ""), String(body.password ?? ""));
    sessionCookie(c, res.token);
    return c.json(res);
  });

  app.post("/auth/demo-login", async (c) => {
    const { body } = await readBody(c);
    const res = await demoLogin(ctx, String(body.user_id ?? ""));
    sessionCookie(c, res.token);
    return c.json(res);
  });

  app.post("/auth/setup", async (c) => {
    const { body } = await readBody(c);
    const res = await setupWorkspace(ctx, {
      name: String(body.name ?? ""),
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
      workspace_name: typeof body.workspace_name === "string" ? body.workspace_name : undefined,
    });
    sessionCookie(c, res.token);
    return c.json(res);
  });

  // -------------------------------------------------------------------------
  // Authenticated endpoints
  // -------------------------------------------------------------------------

  app.use("*", async (c, next) => {
    const auth = c.req.header("authorization");
    let token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
    // Cookies authenticate reads only (images, downloads), never mutations.
    if (!token && c.req.method === "GET") token = readCookie(c.req.header("cookie"), SESSION_COOKIE);
    const user = await resolveSession(ctx, token);
    if (!user) throw unauthorized();
    c.set("user", user);
    c.set("token", token!);
    await next();
  });

  app.post("/auth/logout", async (c) => {
    await logout(ctx, c.get("token"));
    sessionCookie(c, null);
    return c.json({ ok: true });
  });

  app.get("/workspace", (c) => c.json(getWorkspace(ctx, c.get("user"))));
  app.get("/me/counts", (c) => c.json(viewCounts(ctx, c.get("user"))));

  app.patch("/me", async (c) => {
    const { body } = await readBody(c);
    return c.json(updateProfile(ctx, c.get("user"), body as Parameters<typeof updateProfile>[2]));
  });

  app.post("/me/password", async (c) => {
    const { body } = await readBody(c);
    await changePassword(ctx, c.get("user"), String(body.current ?? ""), String(body.next ?? ""));
    return c.json({ ok: true });
  });

  // Bugs ---------------------------------------------------------------------

  app.get("/bugs", (c) => {
    const q = c.req.query();
    const view = (BUG_VIEWS.some((v) => v.key === q.view) ? q.view : "open") as BugViewKey;
    const sort = (SORT_OPTIONS.some((s) => s.key === q.sort) ? q.sort : "updated") as SortKey;
    const query: BugQuery = {
      view,
      q: q.q,
      project_id: q.project || undefined,
      module_id: q.module || undefined,
      feature_id: q.feature || undefined,
      status: list(c, "status")?.filter((s): s is StatusKey => (STATUS_KEYS as readonly string[]).includes(s)),
      severity: list(c, "severity"),
      priority: list(c, "priority"),
      reporter_id: q.reporter || undefined,
      assignee_id: q.assignee || undefined,
      tag: q.tag || undefined,
      from: q.from || undefined,
      to: q.to || undefined,
      sort,
      dir: q.dir === "asc" ? "asc" : q.dir === "desc" ? "desc" : undefined,
      page: num(q.page, 1),
      page_size: num(q.page_size, 50),
    };
    return c.json(listBugs(ctx, c.get("user"), query));
  });

  app.post("/bugs", async (c) => {
    const { body, files } = await readBody(c);
    const input = parse(createBugSchema, body);
    const bug = await createBug(ctx, c.get("user"), input as Parameters<typeof createBug>[2], files);
    return c.json(getBugDetail(ctx, c.get("user"), bug), 201);
  });

  app.post("/similar", async (c) => {
    const { body } = await readBody(c);
    const title = String(body.title ?? "");
    const text = [body.description, body.actual_result].filter((x) => typeof x === "string").join(" ");
    if (title.trim().length + text.trim().length < 8) return c.json({ items: [] });
    const items = findSimilar(
      ctx,
      {
        project_id: typeof body.project_id === "string" ? body.project_id : null,
        title,
        description: typeof body.description === "string" ? body.description : null,
        actual_result: typeof body.actual_result === "string" ? body.actual_result : null,
        steps: Array.isArray(body.steps) ? body.steps.map(String) : [],
        module_id: typeof body.module_id === "string" ? body.module_id : null,
        feature_id: typeof body.feature_id === "string" ? body.feature_id : null,
      },
      { limit: 5, excludeIds: typeof body.exclude_id === "string" ? [body.exclude_id] : [] },
    );
    return c.json({ items });
  });

  app.get("/search", (c) => {
    const q = (c.req.query("q") ?? "").trim();
    if (!q) return c.json({ items: [] });
    const res = listBugs(ctx, c.get("user"), { view: "all", q, sort: "updated", page_size: 8 });
    return c.json({ items: res.items, total: res.total });
  });

  app.get("/bugs/:ref", (c) => {
    const user = c.get("user");
    const bug = resolveBug(ctx, c.req.param("ref"));
    if (bug.archived_at && !(user.role === "qa_lead" || user.role === "admin" || user.id === bug.reporter_id)) {
      throw notFound("This bug was archived.");
    }
    return c.json(getBugDetail(ctx, user, bug));
  });

  app.patch("/bugs/:ref", async (c) => {
    const { body } = await readBody(c);
    const user = c.get("user");
    const bug = resolveBug(ctx, c.req.param("ref"));
    const updated = updateBug(ctx, user, bug, {
      fields: (body.fields ?? {}) as Parameters<typeof updateBug>[3]["fields"],
      severity: typeof body.severity === "string" ? body.severity : undefined,
      priority: typeof body.priority === "string" ? body.priority : undefined,
      reason: typeof body.reason === "string" ? body.reason : null,
    });
    return c.json(getBugDetail(ctx, user, updated));
  });

  app.post("/bugs/:ref/actions/:action", async (c) => {
    const action = c.req.param("action") as ActionKey;
    if (!(ACTION_KEYS as readonly string[]).includes(action)) throw notFound("Unknown action.");
    const { body, files } = await readBody(c);
    const user = c.get("user");
    const bug = await performAction(ctx, user, c.req.param("ref"), action, body, files);
    return c.json(getBugDetail(ctx, user, bug));
  });

  app.post("/bugs/:ref/assign", async (c) => {
    const { body } = await readBody(c);
    const user = c.get("user");
    const bug = assignBug(ctx, user, resolveBug(ctx, c.req.param("ref")), typeof body.assignee_id === "string" && body.assignee_id ? body.assignee_id : null);
    return c.json(getBugDetail(ctx, user, bug));
  });

  app.post("/bugs/:ref/collaborators", async (c) => {
    const { body } = await readBody(c);
    const user = c.get("user");
    const ids = Array.isArray(body.user_ids) ? body.user_ids.map(String) : [];
    const bug = setCollaborators(ctx, user, resolveBug(ctx, c.req.param("ref")), ids);
    return c.json(getBugDetail(ctx, user, bug));
  });

  app.post("/bugs/:ref/regression/assignee", async (c) => {
    const { body } = await readBody(c);
    const user = c.get("user");
    const bug = reassignRegression(ctx, user, resolveBug(ctx, c.req.param("ref")), String(body.user_id ?? ""));
    return c.json(getBugDetail(ctx, user, bug));
  });

  app.post("/bugs/:ref/comments", async (c) => {
    const { body, files } = await readBody(c);
    const user = c.get("user");
    const bug = resolveBug(ctx, c.req.param("ref"));
    await addComment(ctx, user, bug, typeof body.body === "string" ? body.body : null, files);
    return c.json(getBugDetail(ctx, user, resolveBug(ctx, bug.id)));
  });

  app.post("/bugs/:ref/attachments", async (c) => {
    const { body, files } = await readBody(c);
    const user = c.get("user");
    const bug = resolveBug(ctx, c.req.param("ref"));
    await addEvidence(ctx, user, bug, files, typeof body.note === "string" ? body.note : null);
    return c.json(getBugDetail(ctx, user, resolveBug(ctx, bug.id)));
  });

  app.post("/bugs/:ref/watch", (c) => {
    const user = c.get("user");
    const bug = resolveBug(ctx, c.req.param("ref"));
    setWatching(ctx, user, bug, true);
    return c.json(getBugDetail(ctx, user, bug));
  });

  app.delete("/bugs/:ref/watch", (c) => {
    const user = c.get("user");
    const bug = resolveBug(ctx, c.req.param("ref"));
    setWatching(ctx, user, bug, false);
    return c.json(getBugDetail(ctx, user, bug));
  });

  app.post("/bugs/:ref/also-seen", async (c) => {
    const { body, files } = await readBody(c);
    const user = c.get("user");
    const bug = await alsoSeen(ctx, user, resolveBug(ctx, c.req.param("ref")), typeof body.note === "string" ? body.note : null, files);
    return c.json(getBugDetail(ctx, user, bug));
  });

  app.post("/bugs/:ref/links", async (c) => {
    const { body } = await readBody(c);
    const user = c.get("user");
    const bug = addLink(ctx, user, resolveBug(ctx, c.req.param("ref")), String(body.target ?? ""));
    return c.json(getBugDetail(ctx, user, bug));
  });

  app.delete("/bugs/:ref/links/:linkId", (c) => {
    const user = c.get("user");
    const bug = removeLink(ctx, user, resolveBug(ctx, c.req.param("ref")), c.req.param("linkId"));
    return c.json(getBugDetail(ctx, user, bug));
  });

  app.get("/bugs/:ref/similar", (c) => {
    const bug = resolveBug(ctx, c.req.param("ref"));
    const items = findSimilar(ctx, { ...bug, project_id: bug.project_id }, { excludeIds: [bug.id], limit: 5 });
    return c.json({ items });
  });

  app.post("/bugs/:ref/ai/summary", async (c) => {
    const bug = resolveBug(ctx, c.req.param("ref"));
    return c.json(await summarizeBug(ctx, c.get("user"), bug, c.req.query("offline") === "1"));
  });

  app.post("/bugs/:ref/ai/regression-checks", async (c) => {
    const bug = resolveBug(ctx, c.req.param("ref"));
    return c.json(await regressionChecks(ctx, c.get("user"), bug, c.req.query("offline") === "1"));
  });

  app.get("/attachments/:id/content", async (c) => {
    const att = ctx.store.get("attachments", c.req.param("id"));
    if (!att) throw notFound("Attachment not found.");
    const blob = await ctx.files.get(att.storage_key);
    if (!blob) throw notFound("The file for this attachment is missing.");
    const inline = /^(image\/(png|jpeg|gif|webp|svg\+xml)|video\/|application\/pdf|text\/plain|application\/json)/.test(att.mime_type);
    const filename = encodeURIComponent(att.filename);
    return new Response(blob, {
      headers: {
        "Content-Type": att.mime_type,
        "Content-Length": String(blob.size),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${filename}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'",
        "Cache-Control": "private, max-age=3600",
      },
    });
  });

  // Work queues ----------------------------------------------------------------

  app.get("/action-items", (c) => c.json(actionItems(ctx, c.get("user"))));

  app.get("/regression", (c) => {
    const user = c.get("user");
    const scope = c.req.query("scope") === "all" ? "all" : "mine";
    if (scope === "all" && !(user.role === "qa_lead" || user.role === "admin" || user.role === "project_manager")) {
      throw forbidden("Only QA leads, project managers and admins can see every regression.");
    }
    return c.json({ items: regressionQueue(ctx, user, scope) });
  });

  app.get("/notifications", (c) =>
    c.json(listNotifications(ctx, c.get("user"), { unreadOnly: c.req.query("unread") === "1", limit: num(c.req.query("limit"), 100) })),
  );

  app.post("/notifications/read", async (c) => {
    const { body } = await readBody(c);
    const ids = body.all ? "all" : Array.isArray(body.ids) ? body.ids.map(String) : [];
    const count = markNotificationsRead(ctx, c.get("user"), ids, body.read !== false);
    return c.json({ ok: true, count });
  });

  // Dashboard and analytics ----------------------------------------------------

  app.get("/dashboard", (c) =>
    c.json(dashboard(ctx, c.get("user"), { projectId: c.req.query("project") || null, days: num(c.req.query("days"), 90) })),
  );
  app.get("/analytics/contributions", (c) =>
    c.json(contributions(ctx, c.get("user"), { projectId: c.req.query("project") || null, weeks: num(c.req.query("weeks"), 12) })),
  );
  app.get("/analytics/engineering", (c) =>
    c.json(engineering(ctx, c.get("user"), { projectId: c.req.query("project") || null, days: num(c.req.query("days"), 90) })),
  );
  app.get("/analytics/modules", (c) => c.json(moduleHealth(ctx, { projectId: c.req.query("project") || null })));

  // AI ---------------------------------------------------------------------------

  app.get("/ai/status", (c) => c.json(ctx.ai.status()));

  app.post("/ai/draft", async (c) => {
    const { body, files } = await readBody(c);
    const result = await draftReport(ctx, c.get("user"), {
      text: String(body.text ?? ""),
      project_id: typeof body.project_id === "string" ? body.project_id : null,
      module_id: typeof body.module_id === "string" ? body.module_id : null,
      feature_id: typeof body.feature_id === "string" ? body.feature_id : null,
      environment_id: typeof body.environment_id === "string" ? body.environment_id : null,
      fields: (body.fields ?? {}) as Parameters<typeof draftReport>[2]["fields"],
      answers: Array.isArray(body.answers) ? (body.answers as { question: string; answer: string }[]) : [],
      images: files,
      offline: body.offline === true || body.offline === "true",
    });
    return c.json(result);
  });

  app.post("/ai/release-risk", async (c) => {
    const { body } = await readBody(c);
    return c.json(await releaseRisk(ctx, c.get("user"), String(body.project_id ?? ""), body.offline === true));
  });

  // Administration -----------------------------------------------------------------

  app.post("/admin/users", async (c) => {
    const { body } = await readBody(c);
    return c.json(await createUser(ctx, c.get("user"), body as Parameters<typeof createUser>[2]), 201);
  });
  app.patch("/admin/users/:id", async (c) => {
    const { body } = await readBody(c);
    return c.json(updateUser(ctx, c.get("user"), c.req.param("id"), body as Parameters<typeof updateUser>[3]));
  });
  app.post("/admin/teams", async (c) => {
    const { body } = await readBody(c);
    return c.json(saveTeam(ctx, c.get("user"), null, body as Parameters<typeof saveTeam>[3]), 201);
  });
  app.patch("/admin/teams/:id", async (c) => {
    const { body } = await readBody(c);
    return c.json(saveTeam(ctx, c.get("user"), c.req.param("id"), body as Parameters<typeof saveTeam>[3]));
  });
  app.post("/admin/projects", async (c) => {
    const { body } = await readBody(c);
    return c.json(saveProject(ctx, c.get("user"), null, body as Parameters<typeof saveProject>[3]), 201);
  });
  app.patch("/admin/projects/:id", async (c) => {
    const { body } = await readBody(c);
    return c.json(saveProject(ctx, c.get("user"), c.req.param("id"), body as Parameters<typeof saveProject>[3]));
  });
  app.post("/admin/projects/:id/members", async (c) => {
    const { body } = await readBody(c);
    setProjectMembership(ctx, c.get("user"), c.req.param("id"), String(body.user_id ?? ""), body.member !== false);
    return c.json({ ok: true });
  });
  app.post("/admin/modules", async (c) => {
    const { body } = await readBody(c);
    return c.json(saveModule(ctx, c.get("user"), null, body as Parameters<typeof saveModule>[3]), 201);
  });
  app.patch("/admin/modules/:id", async (c) => {
    const { body } = await readBody(c);
    return c.json(saveModule(ctx, c.get("user"), c.req.param("id"), body as Parameters<typeof saveModule>[3]));
  });
  app.post("/admin/features", async (c) => {
    const { body } = await readBody(c);
    return c.json(saveFeature(ctx, c.get("user"), null, body as Parameters<typeof saveFeature>[3]), 201);
  });
  app.patch("/admin/features/:id", async (c) => {
    const { body } = await readBody(c);
    return c.json(saveFeature(ctx, c.get("user"), c.req.param("id"), body as Parameters<typeof saveFeature>[3]));
  });
  app.post("/admin/environments", async (c) => {
    const { body } = await readBody(c);
    return c.json(saveEnvironment(ctx, c.get("user"), null, body as Parameters<typeof saveEnvironment>[3]), 201);
  });
  app.patch("/admin/environments/:id", async (c) => {
    const { body } = await readBody(c);
    return c.json(saveEnvironment(ctx, c.get("user"), c.req.param("id"), body as Parameters<typeof saveEnvironment>[3]));
  });
  app.post("/admin/levels/:kind", async (c) => {
    const kind = c.req.param("kind");
    if (kind !== "severity" && kind !== "priority") throw notFound();
    const { body } = await readBody(c);
    return c.json(saveLevel(ctx, c.get("user"), kind, null, body as Parameters<typeof saveLevel>[4]), 201);
  });
  app.patch("/admin/levels/:kind/:key", async (c) => {
    const kind = c.req.param("kind");
    if (kind !== "severity" && kind !== "priority") throw notFound();
    const { body } = await readBody(c);
    return c.json(saveLevel(ctx, c.get("user"), kind, c.req.param("key"), body as Parameters<typeof saveLevel>[4]));
  });
  app.patch("/admin/statuses/:key", async (c) => {
    const key = c.req.param("key");
    if (!(STATUS_KEYS as readonly string[]).includes(key)) throw notFound();
    const { body } = await readBody(c);
    return c.json(saveStatus(ctx, c.get("user"), key as StatusKey, body as Parameters<typeof saveStatus>[3]));
  });
  app.patch("/admin/settings", async (c) => {
    const { body } = await readBody(c);
    return c.json(updateSettings(ctx, c.get("user"), body as Parameters<typeof updateSettings>[2]));
  });
  app.get("/admin/audit", (c) => {
    const q = c.req.query();
    return c.json(
      auditLog(ctx, c.get("user"), {
        actor_id: q.actor || undefined,
        type: q.type || undefined,
        bug: q.bug || undefined,
        from: q.from || undefined,
        to: q.to || undefined,
        page: num(q.page, 1),
        page_size: num(q.page_size, 50),
      }),
    );
  });

  return app;
}

export type BugloopApp = ReturnType<typeof createApp>;
