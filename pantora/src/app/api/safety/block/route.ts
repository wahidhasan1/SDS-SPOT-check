import { z } from "zod";
import { getDb, run } from "@/server/db";
import { HttpError, apiUser, handler, ok, parseBody } from "@/server/http";
import { blockSchema } from "@/lib/schemas";

export const POST = handler(async (request: Request) => {
  const user = await apiUser();
  const body = await parseBody(request, blockSchema);
  if (body.blockedId === user.id) throw new HttpError(400, "You can't block yourself.");
  run(
    getDb(),
    "INSERT OR IGNORE INTO blocks (blocker_user_id, blocked_id, blocked_kind, blocked_name, created_at) VALUES (?, ?, ?, ?, ?)",
    user.id,
    body.blockedId,
    body.blockedKind,
    body.blockedName,
    new Date().toISOString(),
  );
  return ok({ blocked: true, blockedId: body.blockedId });
});

export const DELETE = handler(async (request: Request) => {
  const user = await apiUser();
  const { blockedId } = await (async () => {
    const parsed = z.object({ blockedId: z.string().min(1).max(80) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "blockedId is required.");
    return parsed.data;
  })();
  run(getDb(), "DELETE FROM blocks WHERE blocker_user_id = ? AND blocked_id = ?", user.id, blockedId);
  return ok({ blocked: false, blockedId });
});
