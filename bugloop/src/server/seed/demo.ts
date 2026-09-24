// Seeds a realistic demo workspace by replaying scripted stories through the real services
// on a virtual clock. The result reads like four months of real team activity.

import type { AppContext } from "../context";
import { ManualClock } from "../context";
import type { UserRow } from "../db/schema";
import type { Bug } from "../../core/types";
import { hashPassword } from "../services/auth";
import { performAction } from "../services/actions";
import { addComment, alsoSeen, assignBug, addLink, setCollaborators } from "../services/collab";
import { createBug, pendingRun, updateBug, type CreateBugInput } from "../services/bugs";
import { reassignRegression } from "../services/regression";
import { updateUser } from "../services/admin";
import { saveSetting } from "../services/lookups";
import { newId } from "../services/util";
import type { IncomingFile } from "../services/attachments";
import { ensureBaseConfig } from "./base";
import { PEOPLE, PROJECTS, TEAMS } from "./org";
import { DEFER_REASONS, ENGINEER_NOTES, NAB_FALLBACKS, QA_NOTES, TEMPLATES, type BugTemplate } from "./templates";
import { orgEvents, showcaseScenarios } from "./showcase";
import { logFile, screenshotFile, type ShotSpec } from "./screenshots";
import { mulberry32, timeHelpers, type FileSpec, type OrgEvent, type Scenario, type StepSpec, type Who } from "./script";

export interface SeedSummary {
  bugs: number;
  users: number;
  projects: number;
  errors: string[];
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const HISTORY_DAYS = 112;
const AFTER_LAST_FIXED = 3;

// ---------------------------------------------------------------------------
// Organisation
// ---------------------------------------------------------------------------

async function seedOrganisation(ctx: AppContext, opts: { passwords: boolean }) {
  const now = ctx.clock.now().toISOString();
  const ids: Record<string, string> = {};
  const teamIds: Record<string, string> = {};
  const hashes: Record<string, string | null> = {};
  for (const p of PEOPLE) hashes[p.key] = opts.passwords ? await hashPassword("demo1234") : null;

  ctx.store.transaction(() => {
    for (const team of TEAMS) {
      teamIds[team.key] = newId("team");
      ctx.store.insert("teams", { id: teamIds[team.key], name: team.name, kind: team.kind, lead_id: null, description: team.description, created_at: now });
    }
    const palette = ["blue", "teal", "violet", "amber", "rose", "emerald", "indigo", "orange", "cyan", "pink", "sky", "lime", "purple", "red", "green", "yellow", "stone"] as const;
    PEOPLE.forEach((p, i) => {
      ids[p.key] = newId("usr");
      const email = `${p.name.toLowerCase().replace(/\s+/g, ".")}@bugloop.test`;
      ctx.store.insert("users", {
        id: ids[p.key],
        name: p.name,
        email,
        password_hash: hashes[p.key],
        role: p.role,
        // Erik starts on the platform team; the story moves him to mobile later.
        team_id: teamIds[p.key === "erik" ? "platform" : p.team],
        title: p.title,
        avatar_color: palette[i % palette.length],
        active: true,
        notification_prefs: { progress: true, discussion: true },
        created_at: now,
        updated_at: now,
        last_seen_at: null,
        deactivated_at: null,
      });
    });
    for (const team of TEAMS) ctx.store.update("teams", teamIds[team.key], { lead_id: ids[team.lead] });

    for (const project of PROJECTS) {
      const projectId = newId("prj");
      ids[`project:${project.key}`] = projectId;
      ctx.store.insert("projects", {
        id: projectId,
        key: project.code,
        name: project.name,
        description: project.description,
        qa_lead_id: ids[project.qaLead],
        pm_id: ids[project.pm],
        archived: false,
        created_at: now,
        updated_at: now,
      });
      for (const member of project.members) {
        ctx.store.insert("project_members", { id: newId("pmb"), project_id: projectId, user_id: ids[member], joined_at: now, left_at: null });
      }
      project.modules.forEach((m, mi) => {
        const moduleId = newId("mod");
        ids[`module:${project.key}:${m.key}`] = moduleId;
        ctx.store.insert("modules", {
          id: moduleId,
          project_id: projectId,
          name: m.name,
          description: m.description,
          owner_id: m.owner ? ids[m.owner] : null,
          sort_order: mi + 1,
          archived: false,
          created_at: now,
        });
        m.features.forEach((f, fi) => {
          const featureId = newId("feat");
          ids[`feature:${project.key}:${m.key}:${f}`] = featureId;
          ctx.store.insert("features", { id: featureId, module_id: moduleId, name: f, description: null, sort_order: fi + 1, archived: false, created_at: now });
        });
      });
    }
    saveSetting(ctx, "workspace_name", "Demo workspace", null);
  });
  return { ids, teamIds };
}

// ---------------------------------------------------------------------------
// Background bugs
// ---------------------------------------------------------------------------

type Outcome =
  | "closed"
  | "nab"
  | "duplicate"
  | "deferred"
  | "regression_required"
  | "fixed"
  | "regression_failed"
  | "in_progress"
  | "need_info"
  | "under_review"
  | "new";

function pickWeighted<T>(rng: () => number, entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[entries.length - 1][0];
}

function pickOutcome(rng: () => number, ageDays: number): Outcome {
  if (ageDays >= 56) {
    return pickWeighted<Outcome>(rng, [["closed", 72], ["nab", 9], ["deferred", 5], ["in_progress", 5], ["regression_failed", 2], ["under_review", 3], ["need_info", 2], ["regression_required", 2]]);
  }
  if (ageDays >= 21) {
    return pickWeighted<Outcome>(rng, [["closed", 55], ["nab", 8], ["deferred", 5], ["fixed", 3], ["regression_required", 7], ["regression_failed", 3], ["in_progress", 11], ["under_review", 4], ["need_info", 4]]);
  }
  if (ageDays >= 7) {
    return pickWeighted<Outcome>(rng, [["closed", 28], ["nab", 6], ["deferred", 3], ["regression_required", 12], ["fixed", 4], ["in_progress", 22], ["need_info", 7], ["under_review", 10], ["new", 8]]);
  }
  return pickWeighted<Outcome>(rng, [["closed", 4], ["regression_required", 8], ["in_progress", 24], ["need_info", 8], ["under_review", 22], ["new", 34]]);
}

const QUESTIONS: [string, string][] = [
  ["Which browser and version were you using?", "Chrome 128 on Windows 11. I could reproduce it in Edge as well."],
  ["Can you share the exact record you used (name or ID)?", "Test company 'Nordic Chem AS', product 'Aceton 1 L' (ID 88213)."],
  ["Does this happen for every user, or only some roles?", "Every role I tried: Viewer, Editor and Admin."],
  ["Is this on staging or production?", "Staging, today's build. I haven't checked production."],
  ["Could you attach a screen recording? I can't reproduce it locally.", "Recording attached. It happens on the second attempt."],
];

const VARIANT_PREFIXES = ["Again: ", "Customer report: ", "Seen on production: ", "Firefox: "];

function versionAt(project: string, date: Date, now: Date): string {
  const weeksAgo = Math.floor((now.getTime() - date.getTime()) / (7 * DAY));
  const step = Math.max(0, 16 - weeksAgo);
  if (project === "mob") return `3.${5 + Math.floor(step / 5)}.${step % 5}`;
  if (project === "sup") return `1.${8 + Math.floor(step / 6)}.${step % 6}`;
  return `2.${11 + Math.floor(step / 5)}.${step % 5}`;
}

function autoShot(t: BugTemplate): ShotSpec | null {
  const project = PROJECTS.find((p) => p.key === t.project)!;
  const mod = project.modules.find((m) => m.key === t.module)!;
  const crumbs = [mod.name, ...(t.feature ? [t.feature] : [])];
  const text = t.actual.length > 72 ? `${t.actual.slice(0, 70)}…` : t.actual;
  if (t.project === "mob") {
    return { app: "SDS Manager", nav: [], active: "", mobile: true, crumbs, heading: t.feature ?? mod.name, banner: { tone: "error", text: text.slice(0, 36) + (text.length > 36 ? "…" : "") }, note: "See report" };
  }
  const nav = t.project === "sup" ? ["Documents", "Products", "Account"] : ["Dashboard", "SDS Hub", "EHS", "Members", "Sites", "Reports", "Settings"];
  const active = t.project === "sup" ? (t.module === "upload" ? "Documents" : t.module === "catalogue" ? "Products" : "Account") : mod.name;
  return {
    app: t.project === "sup" ? "Supplier Portal" : "SDS Manager",
    nav,
    active,
    crumbs,
    heading: t.feature ?? mod.name,
    banner: { tone: t.severity === "critical" || t.severity === "major" ? "error" : "warning", text },
    note: "Expected: " + (t.expected.length > 40 ? `${t.expected.slice(0, 38)}…` : t.expected),
  };
}

interface Interval {
  start: number;
  end: number;
  count: number;
}

function planIntervals(showcase: Scenario[], now: Date): Interval[] {
  const fixed = showcase.filter((s) => s.number).sort((a, b) => a.number! - b.number!);
  const others = showcase.filter((s) => !s.number).map((s) => s.created.getTime());
  const out: Interval[] = [];
  let prevTime = now.getTime() - HISTORY_DAYS * DAY;
  let prevNumber = 0;
  for (const f of fixed) {
    const t = f.created.getTime();
    if (t <= prevTime) throw new Error(`Showcase bug #${f.number} is out of chronological order.`);
    const inside = others.filter((x) => x > prevTime && x < t).length;
    const count = f.number! - prevNumber - 1 - inside;
    if (count < 0) throw new Error(`Too many showcase bugs before #${f.number}.`);
    out.push({ start: prevTime, end: t, count });
    prevTime = t;
    prevNumber = f.number!;
  }
  out.push({ start: prevTime, end: now.getTime() - HOUR, count: AFTER_LAST_FIXED });
  return out;
}

function workingTime(rng: () => number, t: number): number {
  const d = new Date(t);
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2);
  if (day === 0) d.setDate(d.getDate() + 1);
  const h = d.getHours();
  if (h < 8 || h >= 17) {
    if (h >= 17) d.setDate(d.getDate() + 1);
    d.setHours(8 + Math.floor(rng() * 2), Math.floor(rng() * 60), Math.floor(rng() * 60), 0);
    const wd = d.getDay();
    if (wd === 6) d.setDate(d.getDate() + 2);
    if (wd === 0) d.setDate(d.getDate() + 1);
  }
  return d.getTime();
}

function slotTimes(rng: () => number, iv: Interval, taken: Set<number>): number[] {
  const out: number[] = [];
  const span = iv.end - iv.start;
  for (let i = 0; i < iv.count; i++) {
    let attempt = 0;
    let t: number;
    do {
      const base = iv.start + span * ((i + 0.15 + rng() * 0.7) / Math.max(iv.count, 1));
      t = workingTime(rng, base);
      if (t >= iv.end || t <= iv.start) t = iv.start + span * ((i + 0.5) / Math.max(iv.count, 1));
      t = Math.floor(t / 1000) * 1000 + Math.floor(rng() * 900);
      attempt++;
    } while ((taken.has(t) || t >= iv.end || t <= iv.start) && attempt < 20);
    taken.add(t);
    out.push(t);
  }
  return out.sort((a, b) => a - b);
}

function backgroundScenarios(rng: () => number, showcase: Scenario[], now: Date): Scenario[] {
  const intervals = planIntervals(showcase, now);
  const taken = new Set(showcase.map((s) => s.created.getTime()));
  const times = intervals.flatMap((iv) => slotTimes(rng, iv, taken)).sort((a, b) => a - b);
  const total = times.length;

  // Order templates: originals shuffled, re-reports placed after their originals.
  const originals = TEMPLATES.filter((t) => !t.dupOf);
  const dups = TEMPLATES.filter((t) => t.dupOf);
  for (let i = originals.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [originals[i], originals[j]] = [originals[j], originals[i]];
  }
  const order: (BugTemplate & { variantOf?: string })[] = [...originals];
  const extra = Math.max(0, total - TEMPLATES.length);
  const variantSources = originals.slice(0, Math.floor(originals.length * 0.7)).filter((t) => !t.nab);
  for (let i = 0; i < extra && variantSources.length; i++) {
    const src = variantSources[Math.floor(rng() * variantSources.length)];
    variantSources.splice(variantSources.indexOf(src), 1);
    const variant = {
      ...src,
      id: `${src.id}-again`,
      title: `${VARIANT_PREFIXES[i % VARIANT_PREFIXES.length]}${/^[A-Z][a-z]/.test(src.title) ? src.title.charAt(0).toLowerCase() + src.title.slice(1) : src.title}`,
      dupOf: src.id,
    };
    const at = order.indexOf(src);
    const pos = at + 1 + Math.floor(rng() * (order.length - at));
    order.splice(pos, 0, variant);
  }
  for (const d of dups) {
    const at = order.findIndex((t) => t.id === d.dupOf);
    const pos = at + 1 + Math.floor(rng() * (order.length - at));
    order.splice(pos, 0, d);
  }
  const templates = order.slice(0, total);

  const scenarios: Scenario[] = [];
  const createdById = new Map<string, number>();
  templates.forEach((tpl, i) => {
    const created = times[i];
    createdById.set(tpl.id, created);
    scenarios.push(buildBackground(rng, tpl, created, now, createdById));
  });
  return scenarios;
}

const REPORTER_WEIGHTS: Record<string, number> = { wahid: 24, tanvir: 20, sadia: 20, ingrid: 20, farhan: 11, nusrat: 5 };

function pickReporter(rng: () => number, project: string, created: number, now: Date): Who {
  const members = PROJECTS.find((p) => p.key === project)!.members;
  const farhanLeft = now.getTime() - 20 * DAY - 3 * HOUR;
  const entries: [Who, number][] = Object.entries(REPORTER_WEIGHTS)
    .filter(([k]) => members.includes(k))
    .filter(([k]) => k !== "farhan" || created < farhanLeft)
    .map(([k, w]) => [k, w]);
  if (rng() < 0.04) {
    const outsiders = members.filter((m) => ["hanne", "jonas", "lars", "maria"].includes(m));
    if (outsiders.length) return outsiders[Math.floor(rng() * outsiders.length)];
  }
  return pickWeighted(rng, entries);
}

function buildBackground(rng: () => number, tpl: BugTemplate & { variantOf?: string }, created: number, now: Date, createdById: Map<string, number>): Scenario {
  const project = PROJECTS.find((p) => p.key === tpl.project)!;
  const mod = project.modules.find((m) => m.key === tpl.module)!;
  const reporter = pickReporter(rng, tpl.project, created, now);
  const ageDays = (now.getTime() - created) / DAY;
  const handle = `bg:${tpl.id}`;
  const envPick = pickWeighted(rng, [["QA", 3], ["Staging", 5], ["Production", 2]] as [string, number][]);

  const files: FileSpec[] = [];
  if (rng() < 0.35) {
    const shot = autoShot(tpl);
    if (shot) files.push({ kind: "shot", name: `${tpl.id.split("-").slice(1).join("-") || "screenshot"}.png`, shot });
  }

  const steps: StepSpec[] = [];
  let cur = created;
  const cutoff = now.getTime() - 30 * 60_000;
  const advance = (minH: number, maxH: number) => {
    cur = workingTime(rng, cur + (minH + rng() * (maxH - minH)) * HOUR);
    return new Date(cur);
  };
  const push = (s: StepSpec) => {
    if (s.at.getTime() < cutoff) steps.push(s);
  };

  let engineer: Who | null = mod.owner;
  const triage = () => {
    if (!engineer) {
      engineer = pickWeighted<Who>(rng, [["maria", 1], ["imran", 1]]);
      push({ at: advance(1, 20), as: "lars", assign: engineer });
    }
  };
  const pm = project.pm;

  const isDup = !!tpl.dupOf && createdById.has(tpl.dupOf);
  let outcome: Outcome = isDup ? (rng() < 0.85 ? "duplicate" : "nab") : pickOutcome(rng, ageDays);
  if (outcome === "nab" && !tpl.nab && rng() < 0.5 && !isDup) outcome = "closed";

  const comment = (who: Who, pool: string[]) => {
    const text = pool[Math.floor(rng() * pool.length)].replace("{other}", ["Maria Olsen", "Imran Hossain", "Rafiq Chowdhury"][Math.floor(rng() * 3)]);
    push({ at: advance(1, 20), as: who, comment: text });
  };

  const regressionRound = (pass: boolean) => {
    if (pass) {
      push({ at: advance(3, 40), as: "@regression", action: "pass_regression", input: { notes: rng() < 0.4 ? "Verified on the latest build." : "" } });
    } else {
      push({
        at: advance(3, 30),
        as: "@regression",
        action: "fail_regression",
        input: { details: pickWeighted(rng, [["Still happens with a different record (ID 88214).", 1], ["Works on Chrome, still fails on Firefox.", 1], ["The fix works for new data, but existing records still show the problem.", 1]] as [string, number][]) },
      });
    }
  };

  const version = (d: Date) => versionAt(tpl.project, d, now);

  if (outcome !== "new") {
    triage();
    const eng = engineer!;
    switch (outcome) {
      case "under_review":
        push({ at: advance(1, 30), as: eng, action: "start_review" });
        if (rng() < 0.3) comment(eng, ENGINEER_NOTES);
        break;
      case "need_info": {
        if (rng() < 0.5) push({ at: advance(1, 24), as: eng, action: "start_review" });
        const [q] = QUESTIONS[Math.floor(rng() * QUESTIONS.length)];
        push({ at: advance(2, 30), as: eng, action: "request_info", input: { question: q } });
        break;
      }
      case "nab": {
        if (rng() < 0.5) push({ at: advance(1, 24), as: eng, action: "start_review" });
        const nab = tpl.nab ?? NAB_FALLBACKS[Math.floor(rng() * NAB_FALLBACKS.length)];
        push({ at: advance(2, 48), as: eng, action: "mark_not_a_bug", input: { reason: nab.reason, category: nab.category } });
        if (ageDays > 6 && rng() < 0.75) push({ at: advance(1, 30), as: "@reporter", action: "accept_decision" });
        break;
      }
      case "duplicate": {
        if (rng() < 0.3) push({ at: advance(1, 24), as: eng, action: "start_review" });
        push({ at: advance(1, 30), as: eng, action: "mark_duplicate", input: { duplicate_of: `{key:bg:${tpl.dupOf}}` } });
        if (ageDays > 6 && rng() < 0.6) push({ at: advance(1, 30), as: "@reporter", action: "accept_decision" });
        break;
      }
      case "deferred": {
        push({ at: advance(1, 24), as: eng, action: "start_review" });
        const r = DEFER_REASONS[Math.floor(rng() * DEFER_REASONS.length)];
        push({ at: advance(4, 72), as: pm, action: "defer", input: { reason: r.reason, target: r.target } });
        if (rng() < 0.5) push({ at: advance(1, 30), as: "@reporter", action: "accept_decision" });
        break;
      }
      default: {
        // Work-based outcomes share a common path and stop at the right stage.
        if (rng() < 0.4) push({ at: advance(1, 24), as: eng, action: "start_review" });
        const hasInfoRound = rng() < 0.25;
        if (hasInfoRound) {
          const [q, a] = QUESTIONS[Math.floor(rng() * QUESTIONS.length)];
          push({ at: advance(2, 30), as: eng, action: "request_info", input: { question: q } });
          push({ at: advance(1, 30), as: "@reporter", action: "provide_info", input: { answer: a } });
        }
        push({ at: advance(2, 60), as: eng, action: "start_work" });
        if (rng() < 0.35) comment(eng, ENGINEER_NOTES);
        if (rng() < 0.12) comment("@reporter", QA_NOTES);
        if (outcome === "in_progress") break;
        const fixedAt = advance(10, 110);
        const availableNow = outcome === "fixed" ? false : rng() < 0.8;
        push({ at: fixedAt, as: eng, action: "mark_fixed", input: { resolution: tpl.fix, fix_version: version(fixedAt), root_cause: tpl.rootCause, available_now: availableNow } });
        if (outcome === "fixed") break;
        if (!availableNow) push({ at: advance(2, 26), as: eng, action: "ready_for_regression", input: { build: version(fixedAt) } });
        if (outcome === "regression_required") break;
        const fails = outcome === "regression_failed" ? 1 : rng() < 0.18 ? 1 : 0;
        for (let i = 0; i < fails; i++) {
          regressionRound(false);
          if (outcome === "regression_failed") break;
          push({ at: advance(2, 24), as: eng, action: "start_work" });
          const refix = advance(8, 72);
          push({ at: refix, as: eng, action: "mark_fixed", input: { resolution: `${tpl.fix} Also covers the case QA found in regression.`, fix_version: version(refix), root_cause: tpl.rootCause } });
        }
        if (outcome === "closed") regressionRound(true);
      }
    }
  }

  return {
    handle,
    created: new Date(created),
    report: {
      by: reporter,
      project: tpl.project,
      module: tpl.module,
      feature: tpl.feature,
      title: tpl.title,
      description: tpl.description,
      steps: tpl.steps,
      expected: tpl.expected,
      actual: tpl.actual,
      severity: tpl.severity,
      priority: tpl.priority ?? (tpl.severity === "critical" ? "high" : tpl.severity === "trivial" ? "low" : "medium"),
      tags: tpl.tags,
      frequency: tpl.frequency,
      env: envPick,
      browser: tpl.browser ?? (tpl.project === "mob" ? undefined : pickWeighted(rng, [["Chrome 128", 5], ["Edge 128", 2], ["Firefox 130", 2], ["Safari 17", 1]] as [string, number][])),
      device: tpl.device,
      os: tpl.os,
      version: tpl.version,
      files,
    },
    steps,
  };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

function toIncoming(f: FileSpec): IncomingFile {
  if (f.kind === "log") return logFile(f.name.replace(/\.png$/, ".txt"), f.text ?? "");
  return screenshotFile(f.name.replace(/\.png$/, ".svg"), f.shot!);
}

export async function seedDemo(baseCtx: AppContext, opts: { passwords?: boolean; seed?: number } = {}): Promise<SeedSummary> {
  const now = baseCtx.clock.now();
  const clock = new ManualClock(now.getTime() - (HISTORY_DAYS + 7) * DAY);
  const ctx: AppContext = { ...baseCtx, clock };
  const rng = mulberry32(opts.seed ?? 20260924);
  const t = timeHelpers(now);
  const errors: string[] = [];

  ensureBaseConfig(ctx);
  const { ids, teamIds } = await seedOrganisation(ctx, { passwords: opts.passwords ?? ctx.config.mode === "server" });
  const envByName = new Map(ctx.store.find("environments").map((e) => [e.name, e.id]));

  const showcase = showcaseScenarios(t);
  const background = backgroundScenarios(rng, showcase, now);
  const scenarios = [...showcase, ...background];
  const handles = new Map<string, string>();

  const user = (key: string): UserRow => {
    const u = ctx.store.get("users", ids[key]);
    if (!u) throw new Error(`Unknown person ${key}`);
    return u;
  };
  const bugOf = (handle: string): Bug => {
    const id = handles.get(handle);
    const b = id ? ctx.store.get("bugs", id) : undefined;
    if (!b) throw new Error(`Bug ${handle} does not exist yet`);
    return b;
  };
  const interpolate = (v: unknown): unknown => {
    if (typeof v === "string") {
      if (/^@[a-z]+$/.test(v) && ids[v.slice(1)]) return ids[v.slice(1)];
      return v.replace(/\{key:([^}]+)\}/g, (_m, h: string) => bugOf(h).key);
    }
    return v;
  };

  type Op = { time: number; order: number; label: string; run: () => Promise<void> };
  const ops: Op[] = [];
  let order = 0;

  for (const ev of orgEvents(t)) {
    ops.push({
      time: ev.at.getTime(),
      order: order++,
      label: `org:${ev.kind}:${ev.who}`,
      run: async () => {
        const admin = user(ev.by);
        if (ev.kind === "deactivate") updateUser(ctx, admin, ids[ev.who], { active: false });
        else updateUser(ctx, admin, ids[ev.who], { team_id: teamIds[(ev as Extract<OrgEvent, { kind: "change_team" }>).team] });
      },
    });
  }

  for (const s of scenarios) {
    ops.push({
      time: s.created.getTime(),
      order: order++,
      label: `create:${s.handle}`,
      run: async () => {
        const r = s.report;
        const reporter = user(r.by);
        const input: CreateBugInput = {
          project_id: ids[`project:${r.project}`],
          module_id: ids[`module:${r.project}:${r.module}`],
          feature_id: r.feature ? ids[`feature:${r.project}:${r.module}:${r.feature}`] ?? null : null,
          affected_module_ids: (r.alsoAffects ?? []).map((m) => ids[`module:${r.project}:${m}`]),
          title: r.title,
          description: r.description,
          steps: r.steps,
          expected_result: r.expected,
          actual_result: r.actual,
          environment_id: r.env ? envByName.get(r.env) ?? null : null,
          browser: r.browser ?? null,
          device: r.device ?? null,
          os: r.os ?? null,
          app_version: r.version ?? null,
          page_url: r.url ?? null,
          frequency: r.frequency,
          severity: r.severity,
          priority: r.priority ?? "medium",
          tags: r.tags,
          notes: r.notes ?? null,
          ai_meta: r.ai ? { ...r.ai, drafted_at: new Date(s.created.getTime() - 4 * 60_000).toISOString() } : null,
          duplicate_check: r.duplicateCheck
            ? {
                checked_at: new Date(s.created.getTime() - 60_000).toISOString(),
                decision: r.duplicateCheck.decision,
                note: r.duplicateCheck.note,
                candidates: (r.duplicateCheck.candidates ?? []).map((h) => {
                  const b = bugOf(h);
                  return { bug_id: b.id, key: b.key, score: 0.61, level: "high" as const };
                }),
              }
            : null,
        };
        const bug = await createBug(ctx, reporter, input, (r.files ?? []).map(toIncoming));
        handles.set(s.handle, bug.id);
        if (s.number && bug.number !== s.number) errors.push(`${s.handle} was created as #${bug.number}, expected #${s.number}`);
      },
    });
    for (const step of s.steps) {
      ops.push({ time: step.at.getTime(), order: order++, label: `${s.handle}`, run: () => runStep(s.handle, step) });
    }
  }

  async function runStep(handle: string, step: StepSpec): Promise<void> {
    const bug = bugOf(handle);
    let actorId: string | null;
    if (step.as === "@regression") actorId = pendingRun(ctx, bug.id)?.assignee_id ?? null;
    else if (step.as === "@reporter") actorId = bug.reporter_id;
    else actorId = ids[step.as] ?? null;
    if (!actorId) return;
    const actor = ctx.store.get("users", actorId)!;
    if (!actor.active) {
      if (step.as.startsWith("@")) return; // e.g. the reporter has left; skip their optional steps
      throw new Error(`${actor.name} is inactive`);
    }
    const files = ("files" in step ? step.files ?? [] : []).map(toIncoming);
    if ("action" in step) {
      const input = Object.fromEntries(Object.entries(step.input ?? {}).map(([k, v]) => [k, interpolate(v)]));
      await performAction(ctx, actor, bug, step.action, input, files);
    } else if ("comment" in step) {
      await addComment(ctx, actor, bug, String(interpolate(step.comment)), files);
    } else if ("assign" in step) {
      assignBug(ctx, actor, bug, step.assign ? ids[step.assign] : null);
    } else if ("collaborators" in step) {
      setCollaborators(ctx, actor, bug, step.collaborators.map((k) => ids[k]));
    } else if ("severity" in step) {
      updateBug(ctx, actor, bug, { severity: step.severity, reason: step.reason ?? null });
    } else if ("priority" in step) {
      updateBug(ctx, actor, bug, { priority: step.priority, reason: step.reason ?? null });
    } else if ("alsoSeen" in step) {
      await alsoSeen(ctx, actor, bug, step.alsoSeen, files);
    } else if ("link" in step) {
      addLink(ctx, actor, bug, bugOf(step.link).key);
    } else if ("reassignRegression" in step) {
      reassignRegression(ctx, actor, bug, ids[step.reassignRegression]);
    }
  }

  ops.sort((a, b) => a.time - b.time || a.order - b.order);
  for (const op of ops) {
    clock.set(op.time);
    try {
      await op.run();
    } catch (err) {
      errors.push(`${op.label} @ ${new Date(op.time).toISOString()}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Older notifications have been read; the last couple of days are still unread.
  clock.set(now);
  const readBefore = now.getTime() - 60 * HOUR;
  ctx.store.transaction(() => {
    for (const n of ctx.store.find("notifications", { where: { read_at: null } })) {
      const created = Date.parse(n.created_at);
      if (created < readBefore) {
        ctx.store.update("notifications", n.id, { read_at: new Date(Math.min(created + (1 + rng() * 20) * HOUR, now.getTime())).toISOString() });
      }
    }
    for (const u of ctx.store.find("users", { where: { active: true } })) {
      ctx.store.update("users", u.id, { last_seen_at: new Date(now.getTime() - (0.5 + rng() * 40) * HOUR).toISOString() });
    }
  });

  return { bugs: ctx.store.count("bugs"), users: ctx.store.count("users"), projects: ctx.store.count("projects"), errors };
}
