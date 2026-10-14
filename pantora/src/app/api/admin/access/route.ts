import { cookies } from "next/headers";
import { z } from "zod";
import { ADMIN_COOKIE } from "@/server/auth";
import { adminAccessMode, expectedAdminCookie, verifyAdminToken } from "@/server/admin";
import { HttpError, handler, ok, parseBody } from "@/server/http";

export const POST = handler(async (request: Request) => {
  const { token } = await parseBody(request, z.object({ token: z.string().max(200).optional() }));
  if (adminAccessMode() === "disabled") throw new HttpError(403, "The admin area is disabled. Set PANTORA_ADMIN_TOKEN to enable it.");
  if (!verifyAdminToken(token)) throw new HttpError(401, "That admin token is not correct.");
  (await cookies()).set(ADMIN_COOKIE, expectedAdminCookie()!, { httpOnly: true, sameSite: "strict", path: "/", maxAge: 60 * 60 * 8, secure: process.env.NODE_ENV === "production" });
  return ok({ granted: true });
});

export const DELETE = handler(async () => {
  (await cookies()).delete(ADMIN_COOKIE);
  return ok({ granted: false });
});
