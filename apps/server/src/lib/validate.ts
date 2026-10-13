import type { ZodType, ZodTypeDef } from 'zod';
import { HttpError } from './errors';

export function parse<T>(schema: ZodType<T, ZodTypeDef, unknown>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    const field = first?.path.join('.') || 'input';
    throw new HttpError(400, 'validation_error', `${field}: ${first?.message ?? 'Invalid input'}`, r.error.flatten());
  }
  return r.data;
}
