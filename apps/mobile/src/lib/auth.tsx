import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Entitlements, UserProfile } from '@app/shared';
import { api, onAuthLost, realtime } from './api';
import { registerForPush } from './push';

interface Ctx {
  user: UserProfile | null;
  entitlements: Entitlements | null;
  ready: boolean;
  setUser: (u: UserProfile) => void;
  refreshUser: () => Promise<void>;
  refreshEntitlements: () => Promise<void>;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (i: { email: string; password: string; displayName: string; birthYear: number; acceptTerms: true }) => Promise<UserProfile>;
  logout: () => Promise<void>;
}

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [entitlements, setEnt] = useState<Entitlements | null>(null);
  const [ready, setReady] = useState(false);
  const refreshEntitlements = useCallback(async () => {
    try {
      setEnt(await api.get<Entitlements>('/me/entitlements'));
    } catch {
      /* keep */
    }
  }, []);
  const refreshUser = useCallback(async () => setUser(await api.get<UserProfile>('/me')), []);
  const afterLogin = (u: UserProfile) => {
    setUser(u);
    realtime.connect();
    void refreshEntitlements();
    void registerForPush();
    return u;
  };
  useEffect(() => {
    onAuthLost(() => {
      setUser(null);
      realtime.close();
    });
    (async () => {
      if (await api.accessToken()) {
        try {
          afterLogin(await api.get<UserProfile>('/me'));
        } catch {
          setUser(null);
        }
      }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <AuthCtx.Provider
      value={{
        user,
        entitlements,
        ready,
        setUser,
        refreshUser,
        refreshEntitlements,
        login: async (e, p) => afterLogin(await api.login(e, p)),
        register: async (i) => afterLogin(await api.register(i)),
        logout: async () => {
          realtime.close();
          await api.logout();
          setUser(null);
          setEnt(null);
        },
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}
