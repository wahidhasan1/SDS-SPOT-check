import { ApiClient, RealtimeClient, resolveAppName, type TokenStore } from '@app/shared';

export const APP_NAME = resolveAppName(import.meta.env.VITE_APP_NAME);
export const API_URL: string =
  import.meta.env.VITE_API_URL ?? `${window.location.protocol}//${window.location.hostname}:4000`;

const KEY = 'fp.tokens';

const tokenStore: TokenStore = {
  async get() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* storage unavailable */
    }
    return { accessToken: null, refreshToken: null };
  },
  async set(t) {
    try {
      localStorage.setItem(KEY, JSON.stringify(t));
    } catch {
      /* ignore */
    }
  },
  async clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};

let authLostHandler: (() => void) | null = null;
export function onAuthLost(fn: () => void) {
  authLostHandler = fn;
}

export const api = new ApiClient({
  baseUrl: API_URL,
  tokens: tokenStore,
  platform: 'web',
  onAuthLost: () => authLostHandler?.(),
});

export const realtime = new RealtimeClient(api.wsUrl, () => api.accessToken(), () => api.tryRefresh());

export function mediaUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (/^https?:/.test(path)) return path;
  return API_URL + path;
}
