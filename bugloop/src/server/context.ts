// The dependency container every service receives.

import type { Store } from "./db/store";
import type { FileStore } from "./files/types";
import type { AiProvider } from "./ai/provider";

export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** A controllable clock used for seeding history and for tests. */
export class ManualClock implements Clock {
  private t: number;
  constructor(start: Date | string | number = Date.now()) {
    this.t = new Date(start).getTime();
  }
  now(): Date {
    return new Date(this.t);
  }
  set(d: Date | string | number): void {
    this.t = new Date(d).getTime();
  }
  advance(ms: number): void {
    this.t += ms;
  }
}

/**
 * The same context with time stopped at this moment. One user action (a transition, a new report,
 * a comment) records all of its events, notifications and rows with a single timestamp, so the
 * timeline can group them however long the work takes.
 */
export function atOneMoment(ctx: AppContext): AppContext {
  const t = ctx.clock.now().getTime();
  return { ...ctx, clock: { now: () => new Date(t) } };
}

export interface AppConfig {
  mode: "server" | "demo";
  demoLogin: boolean;
  maxUploadBytes: number;
  sessionDays: number;
}

export interface AppContext {
  store: Store;
  files: FileStore;
  ai: AiProvider;
  clock: Clock;
  config: AppConfig;
}

export function nowIso(ctx: Pick<AppContext, "clock">): string {
  return ctx.clock.now().toISOString();
}
