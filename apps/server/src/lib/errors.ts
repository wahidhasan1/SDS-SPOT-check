export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, 'bad_request', msg, details);
export const unauthorized = (msg = 'Please sign in to continue.') => new HttpError(401, 'unauthorized', msg);
export const forbidden = (msg = 'You do not have permission to do that.') => new HttpError(403, 'forbidden', msg);
export const notFound = (msg = 'Not found.') => new HttpError(404, 'not_found', msg);
export const conflict = (msg: string, code = 'conflict') => new HttpError(409, code, msg);
export const limitReached = (msg: string, details?: unknown) => new HttpError(402, 'limit_reached', msg, details);
export const notConfigured = (msg: string) => new HttpError(503, 'not_configured', msg);
export const tooMany = (msg = 'Too many requests. Please slow down.') => new HttpError(429, 'rate_limited', msg);
