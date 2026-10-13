import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Localization from 'expo-localization';
import { api, ApiError, loadToken, saveToken } from './api';
import { realtime } from './realtime';
import type { Me } from './types';

interface AuthState {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<Me | null>;
  setMe: (m: Me | null) => void;
  login: (email: string, password: string) => Promise<Me>;
  register: (d: { email: string; password: string; displayName: string }) => Promise<Me>;
  loginWithCode: (code: string) => Promise<Me>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await api.get<{ me: Me }>('/api/auth/me');
      setMe(r.me);
      return r.me;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await saveToken(null);
        setMe(null);
      }
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (await loadToken()) await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const signedIn = useCallback(async (r: { me: Me; token?: string }) => {
    if (r.token) await saveToken(r.token);
    setMe(r.me);
    return r.me;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      me,
      loading,
      refresh,
      setMe,
      login: async (email, password) => signedIn(await api.post('/api/auth/login', { email, password, client: 'mobile' })),
      register: async (d) => {
        let timezone = 'UTC';
        try {
          timezone = Localization.getCalendars()[0]?.timeZone ?? 'UTC';
        } catch {
          /* ignore */
        }
        return signedIn(await api.post('/api/auth/register', { ...d, client: 'mobile', timezone }));
      },
      loginWithCode: async (code) => signedIn(await api.post('/api/auth/mobile/exchange', { code })),
      logout: async () => {
        await api.post('/api/auth/logout').catch(() => {});
        realtime.disconnect();
        await saveToken(null);
        setMe(null);
      },
    }),
    [me, loading, refresh, signedIn],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
