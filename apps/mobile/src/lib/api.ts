import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { ApiClient, RealtimeClient, resolveAppName, type TokenStore } from '@app/shared';

export const APP_NAME = resolveAppName(process.env.EXPO_PUBLIC_APP_NAME);

/**
 * API base URL. Set EXPO_PUBLIC_API_URL for devices; the Android emulator reaches the
 * host machine at 10.0.2.2.
 */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:4000` : 'http://localhost:4000');

const KEY = 'fp.tokens';

const tokenStore: TokenStore = {
  async get() {
    try {
      const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* unavailable */
    }
    return { accessToken: null, refreshToken: null };
  },
  async set(t) {
    const v = JSON.stringify(t);
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, v);
    else await SecureStore.setItemAsync(KEY, v);
  },
  async clear() {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  },
};

let authLost: (() => void) | null = null;
export const onAuthLost = (fn: () => void) => {
  authLost = fn;
};

export const api = new ApiClient({
  baseUrl: API_URL,
  tokens: tokenStore,
  platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
  onAuthLost: () => authLost?.(),
});

export const realtime = new RealtimeClient(api.wsUrl, () => api.accessToken(), () => api.tryRefresh());

export const mediaUrl = (p?: string | null) => (!p ? '' : /^https?:/.test(p) ? p : API_URL + p);

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.';
}
