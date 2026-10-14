import { cookies } from "next/headers";
import { ADMIN_COOKIE, USER_COOKIE } from "@/server/auth";
import { handler, ok } from "@/server/http";

export const POST = handler(async () => {
  const store = await cookies();
  store.delete(USER_COOKIE);
  store.delete(ADMIN_COOKIE);
  return ok({ signedOut: true });
});
