import { cookies } from "next/headers";
import { z } from "zod";
import { getDb } from "@/server/db";
import { DEMO_USER_ID, resetDemoData } from "@/server/db/seed";
import { USER_COOKIE, userCookieOptions } from "@/server/auth";
import { requireAdmin } from "@/server/admin";
import { HttpError, handler, ok, parseBody } from "@/server/http";

/** Wipes all local data and restores the initial demo seed. Requires typing RESET. */
export const POST = handler(async (request: Request) => {
  await requireAdmin();
  const { confirm } = await parseBody(request, z.object({ confirm: z.string() }));
  if (confirm !== "RESET") throw new HttpError(400, 'Type "RESET" to confirm.');
  resetDemoData(getDb());
  (await cookies()).set(USER_COOKIE, DEMO_USER_ID, userCookieOptions);
  return ok({ reset: true, resetAt: new Date().toISOString() });
});
