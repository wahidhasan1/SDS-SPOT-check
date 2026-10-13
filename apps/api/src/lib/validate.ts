import { z } from 'zod';
import { badRequest } from './errors';

/** Parse request input with zod and throw a readable 400 on failure. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (!r.success) {
    const issues = r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    const first = issues[0];
    throw badRequest(first ? (first.path ? `${first.path}: ${first.message}` : first.message) : 'Invalid input', issues);
  }
  return r.data;
}

export const uuidParam = z.object({ id: z.string().uuid('Invalid id') });
export const slugParam = z.object({ slug: z.string().min(1).max(200) });
