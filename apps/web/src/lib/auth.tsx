import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Entitlements, UserProfile } from '@app/shared';
import { api, onAuthLost, realtime } from './api';

interface AuthCtx {
  user: UserProfile | null;
  entitlements: Entitlements | null;
  ready: boolean;
  setUser: (u: UserProfile) => void;
  refreshUser: () => Promise<void>;
  refreshEntitlements: () => Promise<void>;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (input: { email: string; password: string; displayName: string; birthYear: number; acceptTerms: true }) => Promise<UserProfile>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [entitlements, setEnt] = useState<Entitlements | null>(null);
  const [ready, setReady] = useState(false);

  const refreshEntitlements = useCallback(async () => {
    try {
      setEnt(await api.get<Entitlements>('/me/entitlements'));
    } catch {
      /* keep previous */
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const u = await api.get<UserProfile>('/me');
    setUser(u);
  }, []);

  useEffect(() => {
    onAuthLost(() => {
      setUser(null);
      realtime.close();
    });
    (async () => {
      const t = await api.accessToken();
      if (t) {
        try {
          await refreshUser();
          await refreshEntitlements();
          realtime.connect();
        } catch {
          setUser(null);
        }
      }
      setReady(true);
    })();
  }, [refreshUser, refreshEntitlements]);

  const login = async (email: string, password: string) => {
    const u = await api.login(email, password);
    setUser(u);
    realtime.connect();
    void refreshEntitlements();
    return u;
  };
  const register: AuthCtx['register'] = async (input) => {
    const u = await api.register(input);
    setUser(u);
    realtime.connect();
    void refreshEntitlements();
    return u;
  };
  const logout = async () => {
    realtime.close();
    await api.logout();
    setUser(null);
    setEnt(null);
  };

  return (
    <Ctx.Provider value={{ user, entitlements, ready, setUser, refreshUser, refreshEntitlements, login, register, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}
