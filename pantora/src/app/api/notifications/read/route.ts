import { z } from "zod";
import { getDb, run } from "@/server/db";
import { apiUser, handler, ok, parseBody } from "@/server/http";

export const POST = handler(async (request: Request) => {
  const user = await apiUser();
  const { id } = await parseBody(request, z.object({ id: z.string().max(80).optional() }));
  const now = new Date().toISOString();
  const result = id
    ? run(getDb(), "UPDATE notifications SET read_at = ? WHERE user_id = ? AND id = ? AND read_at IS NULL", now, user.id, id)
    : run(getDb(), "UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL", now, user.id);
  return ok({ updated: Number(result.changes) });
});
