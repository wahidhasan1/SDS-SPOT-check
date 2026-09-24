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
