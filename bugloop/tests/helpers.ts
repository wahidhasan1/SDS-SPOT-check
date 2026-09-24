import { createApp } from "../src/server/app";
import { ManualClock, type AppContext } from "../src/server/context";
import { MemoryStore } from "../src/server/db/memory";
import { MemoryFileStore } from "../src/server/files/memory";
import { OfflineProvider } from "../src/server/ai/heuristic";
import { ensureBaseConfig } from "../src/server/seed/base";
import type { Role } from "../src/core/types";
import { newId } from "../src/server/services/util";

export function makeContext(start = "2026-09-20T08:00:00.000Z") {
  const clock = new ManualClock(start);
  const ctx: AppContext = {
    store: new MemoryStore(),
    files: new MemoryFileStore(),
    ai: new OfflineProvider(),
    clock,
    config: { mode: "demo", demoLogin: true, maxUploadBytes: 10 * 1_048_576, sessionDays: 30 },
  };
  ensureBaseConfig(ctx);
  return { ctx, clock };
}

export function addUser(ctx: AppContext, name: string, role: Role, extra: Partial<{ active: boolean; email: string }> = {}) {
  const now = ctx.clock.now().toISOString();
  return ctx.store.insert("users", {
    id: newId("usr"),
    name,
    email: extra.email ?? `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    password_hash: null,
    role,
    team_id: null,
    title: null,
    avatar_color: "blue",
    active: extra.active ?? true,
    notification_prefs: { progress: true, discussion: true },
    created_at: now,
    updated_at: now,
    last_seen_at: null,
    deactivated_at: null,
  });
}

export function basicWorkspace() {
  const { ctx, clock } = makeContext();
  const wahid = addUser(ctx, "Wahid Hasan", "qa_analyst");
  const sara = addUser(ctx, "Sara Qa", "qa_analyst");
  const rafiq = addUser(ctx, "Rafiq Eng", "engineer");
  const maria = addUser(ctx, "Maria Eng", "engineer");
  const nusrat = addUser(ctx, "Nusrat Lead", "qa_lead");
  const hanne = addUser(ctx, "Hanne Pm", "project_manager");
  const admin = addUser(ctx, "Ada Admin", "admin");
  const now = clock.now().toISOString();
  const project = ctx.store.insert("projects", {
    id: newId("prj"),
    key: "SDS",
    name: "SDS Manager",
    description: null,
    qa_lead_id: nusrat.id,
    pm_id: hanne.id,
    archived: false,
    created_at: now,
    updated_at: now,
  });
  const members = ctx.store.insert("modules", {
    id: newId("mod"),
    project_id: project.id,
    name: "Members",
    description: null,
    owner_id: rafiq.id,
    sort_order: 1,
    archived: false,
    created_at: now,
  });
  const sites = ctx.store.insert("modules", {
    id: newId("mod"),
    project_id: project.id,
    name: "Sites",
    description: null,
    owner_id: null,
    sort_order: 2,
    archived: false,
    created_at: now,
  });
  const editMember = ctx.store.insert("features", {
    id: newId("feat"),
    module_id: members.id,
    name: "Edit member",
    description: null,
    sort_order: 1,
    archived: false,
    created_at: now,
  });
  const envs = ctx.store.find("environments");
  return { ctx, clock, users: { wahid, sara, rafiq, maria, nusrat, hanne, admin }, project, members, sites, editMember, envs };
}

export function client(ctx: AppContext) {
  const app = createApp(ctx);
  const tokens = new Map<string, string>();

  async function login(userId: string): Promise<string> {
    const cached = tokens.get(userId);
    if (cached) return cached;
    const res = await app.request("/api/auth/demo-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    if (res.status !== 200) throw new Error(`login failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { token: string };
    tokens.set(userId, body.token);
    return body.token;
  }

  async function call<T = any>(
    as: string | null,
    method: string,
    path: string,
    opts: { json?: unknown; form?: FormData } = {},
  ): Promise<{ status: number; body: T }> {
    const headers: Record<string, string> = {};
    if (as) headers.authorization = `Bearer ${await login(as)}`;
    let body: BodyInit | undefined;
    if (opts.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(opts.json);
    } else if (opts.form) body = opts.form;
    const res = await app.request(`/api${path}`, { method, headers, body });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // non-JSON body
    }
    return { status: res.status, body: parsed as T };
  }

  return { app, call, login };
}

export const png = () => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13])], "evidence.png", { type: "image/png" });
