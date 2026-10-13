import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from '../domain/types';
import { ActionError, type ActionResult, type AppEvent, type Env } from './actions';
import { DemoAuth } from './auth';
import { nowMs, todayKey } from './selectors';
import { LocalStorageAdapter, storageAvailable, type StorageAdapter } from './storage';
import { runSync } from './sync';
import { emptyUserData, loadUserData, saveUserData, type UserData } from './userData';

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

export interface Toast {
  id: number;
  kind: AppEvent['kind'];
  message: string;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type ActionFn<A extends unknown[]> = (data: UserData, env: Env, ...args: A) => ActionResult;

interface AppContextValue {
  user: User | null;
  data: UserData;
  today: string;
  now: () => number;
  storageOk: boolean;
  /** Run an action. Returns true on success; errors are shown as toasts. */
  run: <A extends unknown[]>(fn: ActionFn<A>, ...args: A) => boolean;
  auth: {
    signUp: (email: string, password: string, name: string) => Promise<User>;
    signIn: (email: string, password: string) => Promise<User>;
    guest: () => void;
    signOut: () => void;
    deleteAccount: () => void;
    rename: (name: string) => void;
  };
  toasts: Toast[];
  pushToast: (kind: Toast['kind'], message: string) => void;
  dismissToast: (id: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

let toastSeq = 1;

export function AppProvider({ children, adapter }: { children: ReactNode; adapter?: StorageAdapter }) {
  const store = useMemo(() => adapter ?? new LocalStorageAdapter(), [adapter]);
  const auth = useMemo(() => new DemoAuth(store), [store]);
  const [storageOk] = useState(() => (adapter ? true : storageAvailable()));
  const [user, setUser] = useState<User | null>(() => auth.currentUser());
  const [data, setData] = useState<UserData>(() => (user ? loadUserData(store, user.id) : emptyUserData()));
  const dataRef = useRef(data);
  dataRef.current = data;
  const userRef = useRef(user);
  userRef.current = user;
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((kind: Toast['kind'], message: string) => {
    const id = toastSeq++;
    setToasts((t) => [...t.slice(-3), { id, kind, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3800);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const envFor = useCallback((d: UserData): Env => {
    const ms = nowMs(d);
    return { nowIso: new Date(ms).toISOString(), today: todayKey(d), userId: userRef.current?.id ?? 'anon' };
  }, []);

  const commit = useCallback(
    (next: UserData, events: AppEvent[]) => {
      const u = userRef.current;
      if (!u) return;
      const synced = runSync(next, envFor(next));
      saveUserData(store, u.id, dataRef.current, synced.data);
      dataRef.current = synced.data;
      setData(synced.data);
      const all = [...events, ...synced.events];
      // Collapse many XP toasts into one to keep celebrations sparing.
      const xp = all.filter((e) => e.kind === 'xp');
      const rest = all.filter((e) => e.kind !== 'xp');
      for (const e of rest) pushToast(e.kind, e.message);
      if (xp.length === 1) pushToast('xp', xp[0].message);
      else if (xp.length > 1) {
        const total = xp.reduce((s, e) => s + Number(e.message.match(/\+(\d+)/)?.[1] ?? 0), 0);
        pushToast('xp', `+${total} XP earned`);
      }
    },
    [envFor, pushToast, store],
  );

  const run = useCallback(
    <A extends unknown[]>(fn: ActionFn<A>, ...args: A): boolean => {
      if (!userRef.current) {
        pushToast('error', 'Please sign in first.');
        return false;
      }
      try {
        const cur = dataRef.current;
        const res = fn(cur, envFor(cur), ...args);
        commit(res.data, res.events);
        return true;
      } catch (e) {
        if (e instanceof ActionError) pushToast('error', e.message);
        else {
          console.error(e);
          pushToast('error', 'Something went wrong. Your data is safe — please try again.');
        }
        return false;
      }
    },
    [commit, envFor, pushToast],
  );

  // Initial + periodic sync (accepts demo challenges, finalises battles, awards tokens…).
  useEffect(() => {
    if (!user) return;
    commit(dataRef.current, []);
    const t = window.setInterval(() => commit(dataRef.current, []), 10_000);
    return () => window.clearInterval(t);
  }, [user, commit]);

  // Keep multiple tabs consistent.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key?.startsWith('bq:v1:')) return;
      const u = auth.currentUser();
      setUser(u);
      if (u) {
        const d = loadUserData(store, u.id);
        dataRef.current = d;
        setData(d);
      }
    };
    const onErr = () => pushToast('error', 'Could not save to browser storage (it may be full or disabled). Recent changes may not persist.');
    window.addEventListener('storage', onStorage);
    window.addEventListener('bq-storage-error', onErr);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('bq-storage-error', onErr);
    };
  }, [auth, store, pushToast]);

  // Theme.
  useEffect(() => {
    const root = document.documentElement;
    if (data.settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', data.settings.theme);
    root.toggleAttribute('data-reduced-motion', data.settings.reducedMotion);
  }, [data.settings.theme, data.settings.reducedMotion]);

  const loadFor = useCallback(
    (u: User | null) => {
      setUser(u);
      userRef.current = u;
      const d = u ? loadUserData(store, u.id) : emptyUserData();
      dataRef.current = d;
      setData(d);
    },
    [store],
  );

  const authApi = useMemo(
    () => ({
      signUp: async (email: string, password: string, name: string) => {
        const u = await auth.signUp(email, password, name);
        loadFor(u);
        return u;
      },
      signIn: async (email: string, password: string) => {
        const u = await auth.signIn(email, password);
        loadFor(u);
        return u;
      },
      guest: () => loadFor(auth.continueAsGuest()),
      signOut: () => {
        auth.signOut();
        loadFor(null);
      },
      deleteAccount: () => {
        const u = userRef.current;
        if (!u) return;
        auth.deleteAccount(u.id);
        void import('./photos').then((m) => m.deleteAllPhotos(u.id)).catch(() => undefined);
        loadFor(null);
      },
      rename: (name: string) => {
        const u = userRef.current;
        if (!u) return;
        auth.updateDisplayName(u.id, name);
        setUser(auth.currentUser());
      },
    }),
    [auth, loadFor],
  );

  const value: AppContextValue = {
    user,
    data,
    today: todayKey(data),
    now: () => nowMs(dataRef.current),
    storageOk,
    run,
    auth: authApi,
    toasts,
    pushToast,
    dismissToast,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const v = useContext(AppContext);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
