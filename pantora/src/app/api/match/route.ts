import { z } from "zod";
import { all, getDb } from "@/server/db";
import { apiUser, handler, ok, parseBody, HttpError } from "@/server/http";
import { getSettings } from "@/server/services/users";
import { blockedIds } from "@/server/queries";
import { DEMO_PARTNERS, getDemoPartner } from "@/content/partners";
import { getTopic } from "@/content/topics";
import { getBattlePrompt } from "@/content/battle-prompts";
import { selectPartner } from "@/lib/matching";
import { proficiencySchema } from "@/lib/schemas";

/** Demo matchmaking: picks a fictional partner using the same rules a live matcher would. */
export const POST = handler(async (request: Request) => {
  const user = await apiUser();
  const body = await parseBody(
    request,
    z.object({
      mode: z.enum(["free_talk", "battle"]),
      topicId: z.string().max(80).nullish(),
      promptId: z.string().max(80).nullish(),
      proficiencyRange: z.tuple([proficiencySchema, proficiencySchema]).optional(),
      excludeIds: z.array(z.string().max(80)).max(20).default([]),
    }),
  );
  const db = getDb();
  const settings = getSettings(db, user.id, user);
  const blocked = blockedIds(user.id);
  const recent = all<{ partner_id: string }>(
    db,
    "SELECT partner_id FROM sessions WHERE user_id = ? AND partner_id IS NOT NULL ORDER BY started_at DESC LIMIT 2",
    user.id,
  ).map((r) => r.partner_id);

  if (body.mode === "battle" && body.promptId) {
    const prompt = getBattlePrompt(body.promptId);
    if (!prompt) throw new HttpError(404, "Challenge not found.");
    const preferred = getDemoPartner(prompt.sampleResponse.partnerId);
    if (preferred && !blocked.includes(preferred.id) && !body.excludeIds.includes(preferred.id)) {
      return ok({ partner: preferred, reasons: ["Has a sample answer prepared for this challenge."], simulated: true });
    }
  }

  const topic = getTopic(body.topicId ?? undefined) ?? null;
  const match = selectPartner(
    DEMO_PARTNERS.filter((p) => !body.excludeIds.includes(p.id)),
    {
      proficiencyRange: body.proficiencyRange ?? settings.matching.proficiencyRange,
      topic,
      blockedIds: blocked,
      recentPartnerIds: recent,
    },
  );
  if (!match) {
    throw new HttpError(409, "No demo partners are available. You may have blocked all of them — unblock someone in the Safety Center.");
  }
  return ok({ partner: match.partner, reasons: match.reasons, simulated: true });
});
