/** Normalised error with a message that is safe to show to users. */
export class AppError extends Error {
  code: string | undefined;
  kind: 'quota' | 'rate_limit' | 'auth' | 'network' | 'not_found' | 'validation' | 'unknown';

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.kind =
      code === 'P0402' ? 'quota'
      : code === 'P0429' ? 'rate_limit'
      : code === '28000' || code === 'PGRST301' ? 'auth'
      : code === 'P0002' ? 'not_found'
      : code === '22023' || code === '23505' ? 'validation'
      : 'unknown';
  }
}

const NETWORK_PATTERNS = /network request failed|failed to fetch|load failed|networkerror|timeout/i;

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const e = error as { message?: string; code?: string } | undefined;
  const message = e?.message ?? 'Something went wrong.';
  if (NETWORK_PATTERNS.test(message)) {
    const err = new AppError('You appear to be offline. Check your connection and try again.');
    err.kind = 'network';
    return err;
  }
  // Database-raised messages from our RPCs are written for end users.
  if (e?.code && /^P0|^22|^23|^28|^42501/.test(e.code)) return new AppError(message, e.code);
  return new AppError(message, e?.code);
}

export function errorMessage(error: unknown): string {
  return toAppError(error).message;
}
