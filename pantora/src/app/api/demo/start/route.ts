import { cookies } from "next/headers";
import { getDb } from "@/server/db";
import { DEMO_USER_ID } from "@/server/db/seed";
import { USER_COOKIE, userCookieOptions } from "@/server/auth";
import { config } from "@/server/config";
import { HttpError, handler, ok } from "@/server/http";
import { getProfile } from "@/server/services/users";

export const POST = handler(async () => {
  if (!config.demoMode) throw new HttpError(403, "The demo account is disabled on this server.");
  const profile = getProfile(getDb(), DEMO_USER_ID);
  if (!profile) throw new HttpError(409, "The demo account was deleted. Restore it from Demo admin → Reset demo data.");
  (await cookies()).set(USER_COOKIE, profile.id, userCookieOptions);
  return ok({ user: { id: profile.id, displayName: profile.displayName } });
});
