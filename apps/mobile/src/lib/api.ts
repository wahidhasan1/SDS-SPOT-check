import * as SecureStore from 'expo-secure-store';
import { API_URL } from './config';

const TOKEN_KEY = 'fp_session_token';
let token: string | null = null;

export async function loadToken() {
  token = await SecureStore.getItemAsync(TOKEN_KEY);
  return token;
}
export async function saveToken(t: string | null) {
  token = t;
  if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}
export function getToken() {
  return token;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

type Body = Record<string, unknown> | FormData | undefined;

async function request<T>(method: string, path: string, body?: Body): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['content-type'] = 'application/json';
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'network', `Cannot reach the FluentPath server at ${API_URL}. Check your connection.`);
  }
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return undefined; } })() : undefined;
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(res.status, e?.code ?? 'error', e?.message ?? `Request failed (${res.status})`, e?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: Body) => request<T>('POST', p, b ?? {}),
  put: <T>(p: string, b?: Body) => request<T>('PUT', p, b ?? {}),
  patch: <T>(p: string, b?: Body) => request<T>('PATCH', p, b ?? {}),
  del: <T>(p: string, b?: Body) => request<T>('DELETE', p, b),
};

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : 'Something went wrong.';
}

/** Absolute URL for media served by the API (audio files). Private media needs the auth header. */
export function mediaUrl(path: string) {
  return path.startsWith('http') ? path : `${API_URL}${path}`;
}
