import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env, isBackendConfigured } from './env';

// When the backend is not configured the app renders a setup screen instead
// of making requests; the placeholder only keeps createClient from throwing.
export const supabase = createClient(
  isBackendConfigured ? env.supabaseUrl : 'http://localhost:54321',
  isBackendConfigured ? env.supabaseAnonKey : 'not-configured',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  },
);

// Refresh tokens only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
