import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { api } from '@/lib/api';
import { toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

interface AuthContextValue {
  session: Session | null;
  initializing: boolean;
  profile: Profile | null;
  profileLoading: boolean;
  profileError: Error | null;
  refreshProfile: () => Promise<unknown>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ needsVerification: boolean }>;
  signInWithProvider: (provider: 'google' | 'apple') => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
WebBrowser.maybeCompleteAuthSession();

function redirectUrl(path: string) {
  return Linking.createURL(path);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? null;

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setInitializing(false));
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') router.push('/(auth)/reset-password');
      if (event === 'SIGNED_OUT') queryClient.clear();
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  // Native deep links (email confirmation / recovery / OAuth) carry tokens or a PKCE code.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const handle = async (url: string | null) => {
      if (!url) return;
      const { queryParams } = Linking.parse(url);
      const fragment = url.includes('#') ? new URLSearchParams(url.split('#')[1]) : null;
      const code = queryParams?.code as string | undefined;
      if (code) await supabase.auth.exchangeCodeForSession(code);
      const access = fragment?.get('access_token');
      const refresh = fragment?.get('refresh_token');
      if (access && refresh) await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => { handle(url).catch(() => {}); });
    return () => sub.remove();
  }, []);

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => api.getProfile(userId!),
    enabled: !!userId,
  });

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw toAppError(error);
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { display_name: displayName.trim() }, emailRedirectTo: redirectUrl('/sign-in') },
    });
    if (error) throw toAppError(error);
    return { needsVerification: !data.session };
  }, []);

  const signInWithProvider = useCallback(async (provider: 'google' | 'apple') => {
    const redirectTo = redirectUrl('/');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider, options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
    });
    if (error) throw toAppError(error);
    if (Platform.OS !== 'web' && data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        const { queryParams } = Linking.parse(result.url);
        const code = queryParams?.code as string | undefined;
        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) throw toAppError(exErr);
        }
      }
    }
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirectUrl('/sign-in') } });
    if (error) throw toAppError(error);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl('/reset-password') });
    if (error) throw toAppError(error);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw toAppError(error);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => ({
    session, initializing,
    profile: profileQuery.data ?? null,
    profileLoading: !!userId && profileQuery.isPending,
    profileError: profileQuery.error,
    refreshProfile: () => queryClient.invalidateQueries({ queryKey: ['profile', userId] }),
    signIn, signUp, signInWithProvider, resendVerification, requestPasswordReset, updatePassword, signOut,
  }), [session, initializing, profileQuery.data, profileQuery.isPending, profileQuery.error, userId, queryClient,
    signIn, signUp, signInWithProvider, resendVerification, requestPasswordReset, updatePassword, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
