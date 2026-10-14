import { cookies } from "next/headers";
import { getDb } from "@/server/db";
import { USER_COOKIE, userCookieOptions } from "@/server/auth";
import { handler, ok, parseBody } from "@/server/http";
import { createUser } from "@/server/services/users";
import { notify } from "@/server/services/gamification";
import { onboardingSchema } from "@/lib/schemas";
import { isValidTimeZone } from "@/lib/dates";

export const POST = handler(async (request: Request) => {
  const body = await parseBody(request, onboardingSchema);
  const db = getDb();
  const profile = createUser(db, {
    displayName: body.displayName,
    avatar: body.avatar,
    proficiency: body.proficiency,
    goals: body.goals,
    conversationPref: body.conversationPref,
    dailyGoalMinutes: body.dailyGoalMinutes,
    timezone: isValidTimeZone(body.timezone) ? body.timezone : "UTC",
  });
  notify(db, profile.id, {
    kind: "welcome",
    title: `Welcome to Pantora, ${profile.displayName}!`,
    body: "Start with a short Free Talk or a 30-second Speaking Battle. Every conversation counts.",
    href: "/free-talk",
    dedupeKey: "welcome",
  });
  (await cookies()).set(USER_COOKIE, profile.id, userCookieOptions);
  return ok({ user: { id: profile.id, displayName: profile.displayName } }, { status: 201 });
});
