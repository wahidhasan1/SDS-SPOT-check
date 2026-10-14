import { z } from "zod";
import { get, getDb, run } from "@/server/db";
import { HttpError, apiUser, handler, ok, parseBody } from "@/server/http";

export const POST = handler(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  const { favorite } = await parseBody(request, z.object({ favorite: z.boolean() }));
  const db = getDb();
  if (!get(db, "SELECT 1 FROM topics WHERE id = ?", id)) throw new HttpError(404, "Topic not found.");
  if (favorite) run(db, "INSERT OR IGNORE INTO topic_favorites (user_id, topic_id, created_at) VALUES (?, ?, ?)", user.id, id, new Date().toISOString());
  else run(db, "DELETE FROM topic_favorites WHERE user_id = ? AND topic_id = ?", user.id, id);
  return ok({ topicId: id, favorite });
});
