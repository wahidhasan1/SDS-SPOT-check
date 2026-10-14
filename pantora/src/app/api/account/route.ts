import { cookies } from "next/headers";
import { z } from "zod";
import { getDb, run } from "@/server/db";
import { ADMIN_COOKIE, USER_COOKIE } from "@/server/auth";
import { HttpError, apiUser, handler, ok, parseBody } from "@/server/http";

/** Permanently deletes the signed-in profile and everything linked to it. */
export const DELETE = handler(async (request: Request) => {
  const user = await apiUser();
  const { confirm } = await parseBody(request, z.object({ confirm: z.string() }));
  if (confirm.trim() !== user.displayName) throw new HttpError(400, "Type your display name exactly to confirm.");
  run(getDb(), "DELETE FROM users WHERE id = ?", user.id);
  const store = await cookies();
  store.delete(USER_COOKIE);
  store.delete(ADMIN_COOKIE);
  return ok({ deleted: true });
});
