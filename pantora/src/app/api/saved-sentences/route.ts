import { getDb } from "@/server/db";
import { apiUser, handler, ok, parseBody } from "@/server/http";
import { evaluateAchievements } from "@/server/services/gamification";
import { saveSentence } from "@/server/services/practice";
import { saveSentenceSchema } from "@/lib/schemas";

export const POST = handler(async (request: Request) => {
  const user = await apiUser();
  const body = await parseBody(request, saveSentenceSchema);
  const db = getDb();
  const result = saveSentence(db, { userId: user.id, ...body, at: new Date() });
  const fresh = result.created ? evaluateAchievements(db, user.id, new Date()) : [];
  return ok({ ...result, alreadySaved: !result.created, newAchievements: fresh.map((a) => ({ id: a.id, name: a.name })) });
});
