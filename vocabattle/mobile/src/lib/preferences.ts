import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/** Small per-device preferences (audio accent etc.). Not synced, not authoritative. */
export function useLocalPref<T extends string>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => { AsyncStorage.getItem(key).then((v) => { if (v) setValue(v as T); }).catch(() => {}); }, [key]);
  const update = useCallback((v: T) => { setValue(v); AsyncStorage.setItem(key, v).catch(() => {}); }, [key]);
  return [value, update] as const;
}

export const ACCENT_KEY = 'vocabattle.accent';
export async function getAccent(): Promise<string> {
  return (await AsyncStorage.getItem(ACCENT_KEY).catch(() => null)) ?? 'en-GB';
}
