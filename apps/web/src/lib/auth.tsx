import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from './api';
import type { Integrations, Me } from './types';
import { applyTheme } from './theme';

interface AuthState {
  me: Me | null;
  loading: boolean;
  integrations: Integrations | null;
  refresh: () => Promise<Me | null>;
  setMe: (me: Me | null) => void;
  login: (email: string, password: string) => Promise<Me>;
  register: (data: { email: string; password: string; displayName: string }) => Promise<Me>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMeState] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<Integrations | null>(null);

  const setMe = useCallback((m: Me | null) => {
    setMeState(m);
    if (m) applyTheme(m.settings.theme);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await api.get<{ me: Me | null }>('/api/auth/session');
      setMe(r.me);
      return r.me;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setMe(null);
      return null;
    }
  }, [setMe]);

  useEffect(() => {
    Promise.all([refresh(), api.get<{ integrations: Integrations }>('/api/config').then((r) => setIntegrations(r.integrations)).catch(() => {})]).finally(() =>
      setLoading(false),
    );
  }, [refresh]);

  const value = useMemo<AuthState>(
    () => ({
      me,
      loading,
      integrations,
      refresh,
      setMe,
      login: async (email, password) => {
        const r = await api.post<{ me: Me }>('/api/auth/login', { email, password, client: 'web' });
        setMe(r.me);
        return r.me;
      },
      register: async (data) => {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const r = await api.post<{ me: Me }>('/api/auth/register', { ...data, client: 'web', timezone });
        setMe(r.me);
        return r.me;
      },
      logout: async () => {
        await api.post('/api/auth/logout').catch(() => {});
        setMe(null);
      },
    }),
    [me, loading, integrations, refresh, setMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** For pages inside protected routes: the user is guaranteed to exist. */
export function useMe(): Me {
  const { me } = useAuth();
  if (!me) throw new Error('useMe used outside a protected route');
  return me;
}
