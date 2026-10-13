import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Base URL of the FluentPath API. Android emulators reach the host machine at 10.0.2.2. */
export const API_URL: string = ((Constants.expoConfig?.extra?.apiUrl as string | null) ?? process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000')).replace(/\/$/, '');

export const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws';
