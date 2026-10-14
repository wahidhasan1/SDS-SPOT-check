import { get, getDb, run } from "@/server/db";
import { HttpError, apiUser, handler, ok } from "@/server/http";
import { recordReview } from "@/server/services/gamification";

export const POST = handler(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  const db = getDb();
  const owned = get(
    db,
    `SELECT 1 FROM transcript_entries e JOIN transcripts t ON t.id = e.transcript_id JOIN sessions s ON s.id = t.session_id
     WHERE e.id = ? AND s.user_id = ?`,
    id,
    user.id,
  );
  if (!owned) throw new HttpError(404, "Transcript entry not found.");
  run(db, "UPDATE transcript_entries SET reviewed_at = COALESCE(reviewed_at, ?) WHERE id = ?", new Date().toISOString(), id);
  const result = recordReview(db, user.id, "entry", id);
  return ok({ reviewed: true, ...result });
});
