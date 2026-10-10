import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { toAppError } from '@/lib/errors';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retry transient failures, but never business-rule errors from the server.
        retry: (count, error) => toAppError(error).kind === 'network' || toAppError(error).kind === 'unknown' ? count < 2 : false,
      },
      mutations: { retry: false },
    },
  }));

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const update = () => onlineManager.setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
