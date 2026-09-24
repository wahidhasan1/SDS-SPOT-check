// A small scripting layer for demo data: scenarios describe what people did and when, and
// the engine replays every step through the real services in chronological order, so the
// seeded history, notifications and credit are exactly what the product would produce.

import type { AiMeta, DuplicateCheck, Frequency } from "../../core/types";
import type { ActionKey } from "../../core/workflow";
import type { ShotSpec } from "./screenshots";

export type Who = string; // person key from org.ts, or "@regression" for the current regression owner, "@reporter"

export interface FileSpec {
  kind: "shot" | "log";
  name: string;
  shot?: ShotSpec;
  text?: string;
}

export interface ReportSpec {
  by: Who;
  project: "sds" | "mob" | "sup";
  module: string;
  feature?: string;
  alsoAffects?: string[];
  title: string;
  description: string;
  steps: string[];
  expected: string;
  actual: string;
  severity: string;
  priority?: string;
  tags?: string[];
  frequency?: Frequency;
  env?: string;
  browser?: string;
  device?: string;
  os?: string;
  version?: string;
  url?: string;
  notes?: string;
  files?: FileSpec[];
  ai?: Omit<AiMeta, "drafted_at">;
  duplicateCheck?: Omit<DuplicateCheck, "checked_at" | "candidates"> & { candidates?: string[] };
}

export type StepSpec =
  | { at: Date; as: Who; action: ActionKey; input?: Record<string, unknown>; files?: FileSpec[] }
  | { at: Date; as: Who; comment: string; files?: FileSpec[] }
  | { at: Date; as: Who; assign: Who | null }
  | { at: Date; as: Who; collaborators: Who[] }
  | { at: Date; as: Who; severity: string; reason?: string }
  | { at: Date; as: Who; priority: string; reason?: string }
  | { at: Date; as: Who; alsoSeen: string; files?: FileSpec[] }
  | { at: Date; as: Who; link: string }
  | { at: Date; as: Who; reassignRegression: Who };

export interface Scenario {
  handle: string;
  number?: number;
  created: Date;
  report: ReportSpec;
  steps: StepSpec[];
}

/** Workspace-level events in the story (people leaving, changing teams). */
export type OrgEvent =
  | { at: Date; kind: "deactivate"; who: Who; by: Who }
  | { at: Date; kind: "change_team"; who: Who; team: string; by: Who };

export interface TimeHelpers {
  now: Date;
  /** n days ago at a local wall-clock time "HH:MM". */
  day(n: number, hhmm: string): Date;
  hoursAgo(h: number): Date;
  plusHours(d: Date, h: number): Date;
}

export function timeHelpers(now: Date): TimeHelpers {
  return {
    now,
    day(n, hhmm) {
      const [h, m] = hhmm.split(":").map(Number);
      const d = new Date(now.getTime());
      d.setDate(d.getDate() - n);
      d.setHours(h, m, Math.floor((h * 7 + m * 13) % 50), 0);
      return d;
    },
    hoursAgo(h) {
      return new Date(now.getTime() - h * 3_600_000);
    },
    plusHours(d, h) {
      return new Date(d.getTime() + h * 3_600_000);
    },
  };
}

/** Deterministic PRNG so the demo looks the same every time it is generated. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
