import { getDb, newId, run, get } from "@/server/db";
import { HttpError, apiUser, handler, ok, parseBody } from "@/server/http";
import { reportSchema } from "@/lib/schemas";

export const POST = handler(async (request: Request) => {
  const user = await apiUser();
  const body = await parseBody(request, reportSchema);
  const db = getDb();
  if (body.sessionId && !get(db, "SELECT 1 FROM sessions WHERE id = ? AND user_id = ?", body.sessionId, user.id)) {
    throw new HttpError(404, "Session not found.");
  }
  const id = newId();
  const now = new Date().toISOString();
  run(
    db,
    `INSERT INTO safety_reports (id, reporter_user_id, reported_id, reported_kind, reported_name, session_id, reason, details, status, origin, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', 'local', ?, ?)`,
    id,
    user.id,
    body.reportedId,
    body.reportedKind,
    body.reportedName,
    body.sessionId ?? null,
    body.reason,
    body.details.trim() || null,
    now,
    now,
  );
  return ok({ id, status: "open" }, { status: 201 });
});
