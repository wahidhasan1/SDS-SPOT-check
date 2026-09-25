// The bootstrap payload: everything the UI needs to resolve ids to names and decide what to show.

import type { User, Workspace } from "../../core/types";
import { workspaceCapabilities } from "../../core/permissions";
import type { AppContext } from "../context";
import type { UserRow } from "../db/schema";
import { actorOf } from "./bugs";
import { getSettings, priorities, severities, statusConfigs } from "./lookups";
import { publicUser } from "./util";

export function getWorkspace(ctx: AppContext, user: UserRow): Workspace {
  const users = ctx.store.find("users", { orderBy: [{ column: "name" }] }).map((u) => publicUser(u) as User);
  return {
    mode: ctx.config.mode,
    demo_login: ctx.config.demoLogin,
    me: publicUser(user) as User,
    users,
    teams: ctx.store.find("teams", { orderBy: [{ column: "name" }] }),
    projects: ctx.store.find("projects", { orderBy: [{ column: "name" }] }),
    project_members: ctx.store.find("project_members"),
    modules: ctx.store.find("modules", { orderBy: [{ column: "project_id" }, { column: "sort_order" }, { column: "name" }] }),
    features: ctx.store.find("features", { orderBy: [{ column: "module_id" }, { column: "sort_order" }, { column: "name" }] }),
    pages: ctx.store.find("pages", { orderBy: [{ column: "module_id" }, { column: "name" }] }),
    environments: ctx.store.find("environments", { orderBy: [{ column: "sort_order" }] }),
    severities: severities(ctx),
    priorities: priorities(ctx),
    statuses: statusConfigs(ctx),
    settings: getSettings(ctx),
    ai: ctx.ai.status(),
    capabilities: workspaceCapabilities(actorOf(user)),
  };
}
