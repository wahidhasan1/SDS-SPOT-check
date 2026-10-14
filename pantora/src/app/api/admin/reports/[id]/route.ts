import { z } from "zod";
import { getDb, run } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import { HttpError, handler, ok, parseBody } from "@/server/http";

export const PATCH = handler(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = await parseBody(
    request,
    z.object({ status: z.enum(["open", "reviewing", "resolved", "dismissed"]), note: z.string().max(500).optional() }),
  );
  const result = run(
    getDb(),
    "UPDATE safety_reports SET status = ?, admin_note = COALESCE(?, admin_note), updated_at = ? WHERE id = ?",
    body.status,
    body.note?.trim() || null,
    new Date().toISOString(),
    id,
  );
  if (!result.changes) throw new HttpError(404, "Report not found.");
  return ok({ id, status: body.status });
});
