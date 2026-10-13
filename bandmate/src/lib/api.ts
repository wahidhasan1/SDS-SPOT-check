export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

/** JSON fetch against our own API (cookie session). Throws ApiError with the server's friendly message. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method ?? (opts.body || opts.form ? 'POST' : 'GET'),
      credentials: 'same-origin',
      headers: opts.body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: opts.signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'offline', 'You seem to be offline. Check your connection and try again.')
  }
  const text = await res.text()
  const data = text ? (() => { try { return JSON.parse(text) } catch { return { raw: text } } })() : null
  if (!res.ok) {
    const err = data?.error ?? {}
    throw new ApiError(res.status, err.code ?? 'error', err.message ?? `Request failed (${res.status}).`, err)
  }
  return data as T
}

export const post = <T = unknown>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body })
export const patch = <T = unknown>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body })
export const del = <T = unknown>(path: string, body?: unknown) => api<T>(path, { method: 'DELETE', body })

export const errorMessage = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong.')
