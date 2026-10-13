import type { ApiErrorBody, AuthResponse, UserProfile } from './types';

export interface TokenStore {
  get(): Promise<{ accessToken: string | null; refreshToken: string | null }>;
  set(tokens: { accessToken: string; refreshToken: string }): Promise<void>;
  clear(): Promise<void>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  tokens: TokenStore;
  onAuthLost?: () => void;
  platform: 'web' | 'android' | 'ios';
}

/** Thin fetch-based client shared by web and mobile. Handles refresh-token rotation. */
export class ApiClient {
  private refreshing: Promise<boolean> | null = null;

  constructor(private opts: ApiClientOptions) {}

  get baseUrl() {
    return this.opts.baseUrl.replace(/\/$/, '');
  }

  /** WebSocket URL for realtime features. */
  get wsUrl() {
    return this.baseUrl.replace(/^http/, 'ws') + '/ws';
  }

  async accessToken(): Promise<string | null> {
    return (await this.opts.tokens.get()).accessToken;
  }

  private async rawRequest(method: string, path: string, body?: unknown, isForm = false): Promise<Response> {
    const { accessToken } = await this.opts.tokens.get();
    const headers: Record<string, string> = { 'X-Client-Platform': this.opts.platform };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    let payload: BodyInit | undefined;
    if (body !== undefined) {
      if (isForm) payload = body as FormData;
      else {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
      }
    }
    return fetch(this.baseUrl + path, { method, headers, body: payload });
  }

  async request<T>(method: string, path: string, body?: unknown, isForm = false): Promise<T> {
    let res: Response;
    try {
      res = await this.rawRequest(method, path, body, isForm);
    } catch {
      throw new ApiError(0, 'network_error', 'Cannot reach the server. Check your internet connection and try again.');
    }
    if (res.status === 401 && !path.startsWith('/auth/')) {
      const ok = await this.tryRefresh();
      if (ok) res = await this.rawRequest(method, path, body, isForm);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let json: unknown = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      /* non-JSON */
    }
    if (!res.ok) {
      const err = (json as ApiErrorBody | undefined)?.error;
      if (res.status === 401) this.opts.onAuthLost?.();
      throw new ApiError(res.status, err?.code ?? 'http_error', err?.message ?? `Request failed (${res.status})`, err?.details);
    }
    return json as T;
  }

  get<T>(path: string) {
    return this.request<T>('GET', path);
  }
  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body ?? {});
  }
  put<T>(path: string, body?: unknown) {
    return this.request<T>('PUT', path, body ?? {});
  }
  patch<T>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, body ?? {});
  }
  del<T>(path: string, body?: unknown) {
    return this.request<T>('DELETE', path, body);
  }
  upload<T>(path: string, form: FormData) {
    return this.request<T>('POST', path, form, true);
  }

  async tryRefresh(): Promise<boolean> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      const { refreshToken } = await this.opts.tokens.get();
      if (!refreshToken) return false;
      try {
        const res = await fetch(this.baseUrl + '/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Client-Platform': this.opts.platform },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          if (res.status === 401) await this.opts.tokens.clear();
          return false;
        }
        const data = (await res.json()) as AuthResponse;
        await this.opts.tokens.set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        return true;
      } catch {
        return false;
      }
    })();
    try {
      return await this.refreshing;
    } finally {
      this.refreshing = null;
    }
  }

  async login(email: string, password: string): Promise<UserProfile> {
    const data = await this.request<AuthResponse>('POST', '/auth/login', { email, password });
    await this.opts.tokens.set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.user;
  }

  async register(input: { email: string; password: string; displayName: string; birthYear: number; acceptTerms: true }) {
    const data = await this.request<AuthResponse>('POST', '/auth/register', input);
    await this.opts.tokens.set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.user;
  }

  async logout(): Promise<void> {
    const { refreshToken } = await this.opts.tokens.get();
    try {
      if (refreshToken) await this.request('POST', '/auth/logout', { refreshToken });
    } catch {
      /* ignore network errors on logout */
    }
    await this.opts.tokens.clear();
  }
}
