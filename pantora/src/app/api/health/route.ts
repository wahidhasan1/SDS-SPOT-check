import { getDb } from "@/server/db";

// Health check for the hosting platform: confirms the server is up and the
// database file can be opened and queried. Reveals no data or paths.
export const dynamic = "force-dynamic";

export function GET() {
  try {
    getDb().prepare("SELECT COUNT(*) AS n FROM schema_migrations").get();
    return Response.json({ status: "ok", database: "ok" });
  } catch {
    return Response.json({ status: "error", database: "unavailable" }, { status: 503 });
  }
}
