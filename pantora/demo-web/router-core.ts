// A tiny in-memory router for the hosted demo. It mirrors the parts of the
// Next.js App Router API that Pantora uses (push, replace, refresh, back,
// redirect, notFound) without touching the page URL, which the hosted
// viewer's frame doesn't allow us to change freely.

export interface Location {
  path: string;
  search: string;
  hash: string;
}

type Listener = () => void;

export class RedirectSignal extends Error {
  constructor(public to: string) {
    super(`Redirect to ${to}`);
  }
}

export class NotFoundSignal extends Error {
  constructor() {
    super("Not found");
  }
}

export function parseHref(href: string, base: Location): Location {
  const url = new URL(href, `https://pantora.demo${base.path}${base.search}`);
  return { path: url.pathname, search: url.search, hash: url.hash.slice(1) };
}

class RouterStore {
  location: Location = { path: "/", search: "", hash: "" };
  version = 0;
  private stack: Location[] = [];
  private listeners = new Set<Listener>();

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit() {
    for (const l of this.listeners) l();
  }

  push = (href: string) => {
    this.stack.push(this.location);
    this.location = parseHref(href, this.location);
    this.emit();
  };

  replace = (href: string) => {
    this.location = parseHref(href, this.location);
    this.emit();
  };

  back = () => {
    const prev = this.stack.pop();
    if (prev) {
      this.location = prev;
      this.emit();
    }
  };

  refresh = () => {
    this.version += 1;
    this.emit();
  };

  snapshot = () => `${this.location.path}${this.location.search}#${this.location.hash}@${this.version}`;
}

export const router = new RouterStore();
