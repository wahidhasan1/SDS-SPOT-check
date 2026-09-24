// Default workspace configuration: severity and priority levels, workflow labels and
// environments. Applied to every new workspace, seeded or empty.

import { defaultStatusConfig } from "../../core/statuses";
import type { AppContext } from "../context";
import { newId } from "../services/util";

export const DEFAULT_SEVERITIES = [
  { key: "critical", label: "Critical", color: "red", description: "Blocks core work, loses data or exposes information. No workaround." },
  { key: "major", label: "Major", color: "orange", description: "An important function is broken or shows wrong data. A workaround may exist." },
  { key: "minor", label: "Minor", color: "amber", description: "Limited impact. Inconvenient, but work can continue." },
  { key: "trivial", label: "Trivial", color: "slate", description: "Cosmetic: wording, alignment, styling." },
] as const;

export const DEFAULT_PRIORITIES = [
  { key: "urgent", label: "Urgent", color: "red", description: "Fix now, possibly as a hotfix." },
  { key: "high", label: "High", color: "orange", description: "Fix in the current sprint." },
  { key: "medium", label: "Medium", color: "blue", description: "Plan for an upcoming sprint." },
  { key: "low", label: "Low", color: "slate", description: "Fix when convenient." },
] as const;

export const DEFAULT_ENVIRONMENTS = [
  { name: "Production", kind: "production", description: "Live customer environment." },
  { name: "Staging", kind: "staging", description: "Release candidate builds before production." },
  { name: "QA", kind: "qa", description: "Nightly builds for QA testing." },
  { name: "Development", kind: "development", description: "Engineering's integration environment." },
] as const;

export function ensureBaseConfig(ctx: AppContext): void {
  ctx.store.transaction(() => {
    if (ctx.store.count("severity_levels") === 0) {
      DEFAULT_SEVERITIES.forEach((s, i) => ctx.store.insert("severity_levels", { ...s, rank: i + 1, active: true }));
    }
    if (ctx.store.count("priority_levels") === 0) {
      DEFAULT_PRIORITIES.forEach((p, i) => ctx.store.insert("priority_levels", { ...p, rank: i + 1, active: true }));
    }
    if (ctx.store.count("status_config") === 0) {
      for (const s of defaultStatusConfig()) ctx.store.insert("status_config", s);
    }
    if (ctx.store.count("environments") === 0) {
      DEFAULT_ENVIRONMENTS.forEach((e, i) => ctx.store.insert("environments", { id: newId("env"), ...e, sort_order: i + 1, active: true }));
    }
  });
}
