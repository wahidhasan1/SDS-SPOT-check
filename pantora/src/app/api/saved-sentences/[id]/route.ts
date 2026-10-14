import { get, getDb, run } from "@/server/db";
import { HttpError, apiUser, handler, ok } from "@/server/http";
import { recordReview } from "@/server/services/gamification";

export const DELETE = handler(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  const result = run(getDb(), "DELETE FROM saved_sentences WHERE id = ? AND user_id = ?", id, user.id);
  if (!result.changes) throw new HttpError(404, "Saved sentence not found.");
  return ok({ deleted: true });
});

/** Marks a saved sentence as reviewed. */
export const POST = handler(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  const db = getDb();
  if (!get(db, "SELECT 1 FROM saved_sentences WHERE id = ? AND user_id = ?", id, user.id)) throw new HttpError(404, "Saved sentence not found.");
  run(db, "UPDATE saved_sentences SET reviewed_at = COALESCE(reviewed_at, ?) WHERE id = ?", new Date().toISOString(), id);
  return ok({ reviewed: true, ...recordReview(db, user.id, "saved", id) });
});
