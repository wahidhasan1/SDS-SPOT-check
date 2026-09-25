// The product map: every screen of a project, with where it lives, what is on it and how it must
// behave. QA leads, project managers and admins maintain it by hand or import it in bulk; the
// report assistant uses it to place a report and to phrase what should have happened.

import type { Page, PageImportance } from "../../core/types";
import { PAGE_IMPORTANCE } from "../../core/types";
import { workspaceCapabilities } from "../../core/permissions";
import type { AppContext } from "../context";
import { nowIso } from "../context";
import type { UserRow } from "../db/schema";
import { actorOf } from "./bugs";
import { recordEvent } from "./events";
import { badRequest, cleanText, forbidden, newId, notFound, requireText } from "./util";

function requireMapAccess(user: UserRow): void {
  if (!workspaceCapabilities(actorOf(user)).manage_product_map) throw forbidden("Only QA leads, project managers and admins can edit the product map.");
}

function list(v: unknown, label: string, maxItems: number, maxLen: number): string[] {
  if (v === undefined || v === null) return [];
  const raw = Array.isArray(v) ? v : typeof v === "string" ? v.split(/\n|;/) : null;
  if (!raw) throw badRequest(`${label} must be a list of text.`);
  const out = raw.map((x) => String(x ?? "").replace(/\s+/g, " ").trim()).filter(Boolean);
  if (out.length > maxItems) throw badRequest(`${label}: at most ${maxItems} entries.`);
  return [...new Set(out.map((x) => x.slice(0, maxLen)))];
}

function importance(v: unknown): PageImportance {
  if (v === undefined || v === null || v === "") return "normal";
  const s = String(v).toLowerCase();
  if (!(PAGE_IMPORTANCE as readonly string[]).includes(s)) throw badRequest(`Importance must be one of ${PAGE_IMPORTANCE.join(", ")}.`);
  return s as PageImportance;
}

function path(v: unknown): string | null {
  const s = cleanText(typeof v === "string" ? v : null, 300);
  return s || null;
}

export interface PageInput {
  module_id?: string;
  feature_id?: string | null;
  name?: string;
  path?: string | null;
  description?: string | null;
  elements?: string[] | string;
  rules?: string[] | string;
  keywords?: string[] | string;
  importance?: PageImportance;
  archived?: boolean;
}

export function savePage(ctx: AppContext, user: UserRow, id: string | null, input: PageInput): Page {
  requireMapAccess(user);
  const now = nowIso(ctx);
  const existing = id ? ctx.store.get("pages", id) : null;
  if (id && !existing) throw notFound("Page not found.");
  const moduleId = input.module_id ?? existing?.module_id;
  const mod = moduleId ? ctx.store.get("modules", moduleId) : null;
  if (!mod) throw badRequest("Choose a module.");
  let featureId = input.feature_id === undefined ? existing?.feature_id ?? null : input.feature_id || null;
  if (featureId) {
    const f = ctx.store.get("features", featureId);
    if (!f || f.module_id !== mod.id) throw badRequest("That feature belongs to another module.");
  }
  if (input.module_id && existing && input.module_id !== existing.module_id && input.feature_id === undefined) featureId = null;
  const patch = {
    project_id: mod.project_id,
    module_id: mod.id,
    feature_id: featureId,
    name: input.name !== undefined ? requireText(input.name, "Page name", 120) : existing!.name,
    path: input.path !== undefined ? path(input.path) : existing?.path ?? null,
    description: input.description !== undefined ? cleanText(input.description, 1000) || null : existing?.description ?? null,
    elements: input.elements !== undefined ? list(input.elements, "Elements", 60, 200) : existing?.elements ?? [],
    rules: input.rules !== undefined ? list(input.rules, "Rules", 40, 500) : existing?.rules ?? [],
    keywords: input.keywords !== undefined ? list(input.keywords, "Keywords", 30, 60) : existing?.keywords ?? [],
    importance: input.importance !== undefined ? importance(input.importance) : existing?.importance ?? "normal",
    archived: input.archived !== undefined ? !!input.archived : existing?.archived ?? false,
    updated_at: now,
  };
  return ctx.store.transaction(() => {
    const page = existing
      ? ctx.store.update("pages", existing.id, patch)
      : ctx.store.insert("pages", { id: newId("pg"), ...patch, created_at: now });
    recordEvent(ctx, { actorId: user.id, type: existing ? "page.updated" : "page.created", entityType: "page", entityId: page.id, data: { name: page.name } });
    return page;
  });
}

// ---------------------------------------------------------------------------
// Bulk import
// ---------------------------------------------------------------------------

export interface PageSpec {
  name: string;
  feature?: string;
  path?: string;
  description?: string;
  elements?: string[] | string;
  rules?: string[] | string;
  keywords?: string[] | string;
  importance?: string;
}

export interface ProductMap {
  modules: {
    name: string;
    description?: string;
    /** Email of the engineer who gets new bugs in this module. */
    owner?: string;
    features?: { name: string; description?: string; pages?: PageSpec[] }[];
    pages?: PageSpec[];
  }[];
}

export interface ImportResult {
  dry_run: boolean;
  modules_created: string[];
  features_created: string[];
  pages_created: string[];
  pages_updated: string[];
  warnings: string[];
}

const MAX_MAP_PAGES = 1000;

export function importProductMap(ctx: AppContext, user: UserRow, projectId: string, map: unknown, opts: { dryRun: boolean }): ImportResult {
  requireMapAccess(user);
  const project = ctx.store.get("projects", projectId);
  if (!project) throw notFound("Project not found.");
  const parsed = (typeof map === "string" ? safeJson(map) : map) as ProductMap | null;
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.modules)) {
    throw badRequest('The product map must be JSON with a "modules" list. Copy the template to start.');
  }
  const result: ImportResult = { dry_run: opts.dryRun, modules_created: [], features_created: [], pages_created: [], pages_updated: [], warnings: [] };
  const now = nowIso(ctx);
  let pageCount = 0;

  const apply = () => {
    const modules = ctx.store.find("modules", { where: { project_id: project.id } });
    let order = modules.reduce((m, x) => Math.max(m, x.sort_order), 0);
    for (const [mi, m] of parsed.modules.entries()) {
      const modName = typeof m?.name === "string" ? m.name.trim() : "";
      if (!modName) {
        result.warnings.push(`Module ${mi + 1} has no name and was skipped.`);
        continue;
      }
      let mod = modules.find((x) => x.name.toLowerCase() === modName.toLowerCase());
      if (!mod) {
        let ownerId: string | null = null;
        if (m.owner) {
          const owner = ctx.store.findOne("users", { email: String(m.owner).toLowerCase().trim() });
          if (owner && owner.role === "engineer" && owner.active) ownerId = owner.id;
          else result.warnings.push(`${modName}: owner ${m.owner} is not an active engineer, so the module has no default owner.`);
        }
        mod = ctx.store.insert("modules", {
          id: newId("mod"),
          project_id: project.id,
          name: modName.slice(0, 80),
          description: cleanText(m.description ?? null, 500) || null,
          owner_id: ownerId,
          sort_order: ++order,
          archived: false,
          created_at: now,
        });
        modules.push(mod);
        result.modules_created.push(modName);
      }
      const features = ctx.store.find("features", { where: { module_id: mod.id } });
      const featureFor = (name: string | undefined): string | null => {
        const n = (name ?? "").trim();
        if (!n) return null;
        let f = features.find((x) => x.name.toLowerCase() === n.toLowerCase());
        if (!f) {
          f = ctx.store.insert("features", {
            id: newId("feat"),
            module_id: mod!.id,
            name: n.slice(0, 80),
            description: null,
            sort_order: features.length + 1,
            archived: false,
            created_at: now,
          });
          features.push(f);
          result.features_created.push(`${mod!.name} › ${n}`);
        }
        return f.id;
      };
      const pageSpecs: { spec: PageSpec; featureId: string | null }[] = [];
      for (const f of Array.isArray(m.features) ? m.features : []) {
        if (!f?.name?.trim()) {
          result.warnings.push(`${modName}: a feature without a name was skipped.`);
          continue;
        }
        const fid = featureFor(f.name);
        if (fid && f.description) {
          const cur = features.find((x) => x.id === fid)!;
          if (!cur.description) ctx.store.update("features", fid, { description: cleanText(f.description, 500) || null });
        }
        for (const p of Array.isArray(f.pages) ? f.pages : []) pageSpecs.push({ spec: p, featureId: fid });
      }
      for (const p of Array.isArray(m.pages) ? m.pages : []) pageSpecs.push({ spec: p, featureId: featureFor(p?.feature) });

      const pages = ctx.store.find("pages", { where: { module_id: mod.id } });
      for (const { spec, featureId } of pageSpecs) {
        const name = typeof spec?.name === "string" ? spec.name.trim() : "";
        if (!name) {
          result.warnings.push(`${modName}: a page without a name was skipped.`);
          continue;
        }
        if (++pageCount > MAX_MAP_PAGES) throw badRequest(`A product map can hold at most ${MAX_MAP_PAGES} pages per import.`);
        let fields;
        try {
          fields = {
            feature_id: featureId,
            name: name.slice(0, 120),
            path: path(spec.path),
            description: cleanText(spec.description ?? null, 1000) || null,
            elements: list(spec.elements, `${name}: elements`, 60, 200),
            rules: list(spec.rules, `${name}: rules`, 40, 500),
            keywords: list(spec.keywords, `${name}: keywords`, 30, 60),
            importance: importance(spec.importance),
          };
        } catch (err) {
          result.warnings.push(err instanceof Error ? err.message : `${name} was skipped.`);
          continue;
        }
        const existing = pages.find((x) => x.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          ctx.store.update("pages", existing.id, { ...fields, archived: false, updated_at: now });
          result.pages_updated.push(`${mod.name} › ${name}`);
        } else {
          const page = ctx.store.insert("pages", {
            id: newId("pg"),
            project_id: project.id,
            module_id: mod.id,
            ...fields,
            archived: false,
            created_at: now,
            updated_at: now,
          });
          pages.push(page);
          result.pages_created.push(`${mod.name} › ${name}`);
        }
      }
    }
    if (!opts.dryRun) {
      recordEvent(ctx, {
        actorId: user.id,
        type: "product_map.imported",
        entityType: "project",
        entityId: project.id,
        data: {
          project: project.name,
          modules_created: result.modules_created.length,
          features_created: result.features_created.length,
          pages_created: result.pages_created.length,
          pages_updated: result.pages_updated.length,
        },
      });
    }
  };

  if (opts.dryRun) {
    // Run the real import and roll it back, so the preview reports exactly what would change.
    try {
      ctx.store.transaction(() => {
        apply();
        throw new DryRunRollback();
      });
    } catch (err) {
      if (!(err instanceof DryRunRollback)) throw err;
    }
  } else {
    ctx.store.transaction(apply);
  }
  return result;
}

class DryRunRollback extends Error {}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch (err) {
    throw badRequest(`The product map isn't valid JSON: ${err instanceof Error ? err.message : "parse error"}.`);
  }
}

/** A starting point for teams writing their own map. */
export const PRODUCT_MAP_TEMPLATE: ProductMap = {
  modules: [
    {
      name: "Members",
      owner: "engineer@example.com",
      features: [
        {
          name: "Edit member",
          pages: [
            {
              name: "Edit member",
              path: "/members/:id/edit",
              description: "Form for changing a member's details, role and site access.",
              elements: ["Name field", "Phone field", "Role dropdown", "Sites list", "Save button", "'Saved' confirmation toast"],
              rules: [
                "Saving keeps every changed field; reopening the member shows the new values.",
                "Only administrators can change a member's role.",
              ],
              keywords: ["member settings", "user profile"],
              importance: "high",
            },
          ],
        },
      ],
    },
  ],
};
