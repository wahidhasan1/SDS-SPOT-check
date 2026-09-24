// HTTP client for the Bugloop API. The transport is either the network (server mode) or the
// in-page API (demo mode); everything above this file is identical in both.

import type { Attachment } from "../../core/types";

export type Transport = (req: Request) => Promise<Response>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ClientOptions {
  transport: Transport;
  base: string;
  mode: "server" | "demo";
  tokenKey: string;
}

type Query = Record<string, string | number | boolean | string[] | null | undefined>;

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, sandboxed frames); the session then lasts for this page load.
  }
}

export class ApiClient {
  readonly mode: "server" | "demo";
  private readonly transport: Transport;
  private readonly base: string;
  private readonly tokenKey: string;
  private tokenValue: string | null;
  private readonly blobCache = new Map<string, string>();
  onUnauthorized: (() => void) | null = null;

  constructor(opts: ClientOptions) {
    this.transport = opts.transport;
    this.base = opts.base.replace(/\/$/, "");
    this.mode = opts.mode;
    this.tokenKey = opts.tokenKey;
    this.tokenValue = safeGet(this.tokenKey);
  }

  get token(): string | null {
    return this.tokenValue;
  }

  setToken(token: string | null): void {
    this.tokenValue = token;
    safeSet(this.tokenKey, token);
  }

  url(path: string, query?: Query): string {
    const u = `${this.base}/api${path}`;
    if (!query) return u;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "" || v === false) continue;
      if (Array.isArray(v)) {
        if (v.length) params.set(k, v.join(","));
      } else params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `${u}?${qs}` : u;
  }

  async request<T>(method: string, path: string, opts: { query?: Query; json?: unknown; form?: FormData } = {}): Promise<T> {
    const headers = new Headers();
    if (this.tokenValue) headers.set("authorization", `Bearer ${this.tokenValue}`);
    let body: BodyInit | undefined;
    if (opts.json !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(opts.json);
    } else if (opts.form) {
      body = opts.form;
    }
    let res: Response;
    try {
      res = await this.transport(new Request(this.url(path, opts.query), { method, headers, body, credentials: "same-origin" }));
    } catch (err) {
      throw new ApiError(0, "network", "Can't reach the Bugloop server. Check your connection and try again.", err);
    }
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!res.ok) {
      const err = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
      if (res.status === 401 && path !== "/auth/login") {
        this.setToken(null);
        this.onUnauthorized?.();
      }
      throw new ApiError(res.status, err?.code ?? "error", err?.message ?? `Request failed (${res.status}).`, err?.details);
    }
    return data as T;
  }

  get<T>(path: string, query?: Query): Promise<T> {
    return this.request<T>("GET", path, { query });
  }

  post<T>(path: string, json?: unknown): Promise<T> {
    return this.request<T>("POST", path, { json: json ?? {} });
  }

  patch<T>(path: string, json: unknown): Promise<T> {
    return this.request<T>("PATCH", path, { json });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  /** POST a JSON payload plus files as multipart/form-data. */
  postWithFiles<T>(path: string, payload: unknown, files: File[]): Promise<T> {
    if (!files.length) return this.post<T>(path, payload);
    const form = new FormData();
    form.set("payload", JSON.stringify(payload ?? {}));
    for (const f of files) form.append("files", f, f.name);
    return this.request<T>("POST", path, { form });
  }

  /** A URL an <img>/<video> can load. The demo streams bytes through the in-page API. */
  async fileUrl(att: Pick<Attachment, "id" | "url">): Promise<string> {
    if (!att.url) throw new Error("Attachment has no URL");
    if (this.mode === "server") return `${this.base}${att.url}`;
    const cached = this.blobCache.get(att.id);
    if (cached) return cached;
    const headers = new Headers();
    if (this.tokenValue) headers.set("authorization", `Bearer ${this.tokenValue}`);
    const res = await this.transport(new Request(`${this.base}${att.url}`, { headers }));
    if (!res.ok) throw new ApiError(res.status, "file", "The file could not be loaded.");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    this.blobCache.set(att.id, url);
    return url;
  }
}
