import { get, getDb, run } from "@/server/db";
import { HttpError, apiUser, handler, ok } from "@/server/http";
import { recordReview } from "@/server/services/gamification";

export const POST = handler(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  const db = getDb();
  if (!get(db, "SELECT 1 FROM feedback WHERE id = ? AND user_id = ?", id, user.id)) throw new HttpError(404, "Feedback not found.");
  run(db, "UPDATE feedback SET reviewed_at = COALESCE(reviewed_at, ?) WHERE id = ?", new Date().toISOString(), id);
  const result = recordReview(db, user.id, "feedback", id);
  return ok({ reviewed: true, ...result });
});
