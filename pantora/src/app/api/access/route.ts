import { cookies, headers } from "next/headers";
import { z } from "zod";
import { HttpError, handler, ok, parseBody } from "@/server/http";
import { accessCode, accessToken, clearFailures, codeMatches, recordFailure, tooManyAttempts } from "@/server/access";
import { ACCESS_COOKIE } from "@/lib/access";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export const POST = handler(async (request: Request) => {
  const code = accessCode();
  if (!code) return ok({ ok: true });
  const { code: input } = await parseBody(request, z.object({ code: z.string().max(200) }));
  const h = await headers();
  const client = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (tooManyAttempts(client)) throw new HttpError(429, "Too many wrong attempts. Wait 15 minutes and try again.");
  if (!codeMatches(input, code)) {
    recordFailure(client);
    throw new HttpError(401, "That code isn't right. Check it and try again.");
  }
  clearFailures(client);
  (await cookies()).set(ACCESS_COOKIE, accessToken(code), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
  return ok({ ok: true });
});
