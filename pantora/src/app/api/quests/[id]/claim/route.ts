import { getDb, tx } from "@/server/db";
import { HttpError, apiUser, handler, ok } from "@/server/http";
import { QuestError, claimQuest } from "@/server/services/quests";

export const POST = handler(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  const db = getDb();
  try {
    const result = tx(db, () => claimQuest(db, user.id, id));
    return ok({ questId: id, ...result });
  } catch (error) {
    if (error instanceof QuestError) throw new HttpError(400, error.message);
    throw error;
  }
});
