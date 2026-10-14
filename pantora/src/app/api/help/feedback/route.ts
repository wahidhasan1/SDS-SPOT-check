import { z } from "zod";
import { getDb, newId, run } from "@/server/db";
import { apiUser, handler, ok, parseBody } from "@/server/http";

export const POST = handler(async (request: Request) => {
  const user = await apiUser();
  const body = await parseBody(
    request,
    z.object({
      category: z.enum(["idea", "problem", "praise", "other"]),
      message: z.string().trim().min(10, "Please write at least 10 characters.").max(2000),
    }),
  );
  run(getDb(), "INSERT INTO product_feedback (id, user_id, category, message, created_at) VALUES (?, ?, ?, ?, ?)", newId(), user.id, body.category, body.message, new Date().toISOString());
  return ok({ received: true }, { status: 201 });
});
