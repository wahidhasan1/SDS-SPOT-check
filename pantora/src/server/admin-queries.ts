import "server-only";
import { all, get, getDb } from "./db";

export function adminOverview() {
  const db = getDb();
  const n = (sql: string) => get<{ n: number }>(db, sql)?.n ?? 0;
  return {
    users: n("SELECT COUNT(*) AS n FROM users"),
    localUsers: n("SELECT COUNT(*) AS n FROM users WHERE origin = 'local'"),
    sessions: n("SELECT COUNT(*) AS n FROM sessions"),
    seedSessions: n("SELECT COUNT(*) AS n FROM sessions WHERE origin = 'seed'"),
    liveSessions: n("SELECT COUNT(*) AS n FROM sessions WHERE origin = 'live'"),
    battles: n("SELECT COUNT(*) AS n FROM battles"),
    feedback: n("SELECT COUNT(*) AS n FROM feedback"),
    aiFeedback: n("SELECT COUNT(*) AS n FROM feedback WHERE analyzer = 'anthropic'"),
    openReports: n("SELECT COUNT(*) AS n FROM safety_reports WHERE status IN ('open','reviewing')"),
    blocks: n("SELECT COUNT(*) AS n FROM blocks"),
    productFeedback: n("SELECT COUNT(*) AS n FROM product_feedback"),
    seededAt: get<{ value: string }>(db, "SELECT value FROM app_meta WHERE key = 'seeded_at'")?.value ?? null,
    schemaVersion: get<{ v: number }>(db, "SELECT MAX(version) AS v FROM schema_migrations")?.v ?? 0,
  };
}

export function adminUsers() {
  return all<{ id: string; display_name: string; avatar: string; proficiency: string; origin: string; is_demo_account: number; created_at: string; sessions: number; xp: number; minutes: number }>(
    getDb(),
    `SELECT u.id, u.display_name, u.avatar, u.proficiency, u.origin, u.is_demo_account, u.created_at,
       (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id) AS sessions,
       (SELECT COALESCE(SUM(amount), 0) FROM xp_events x WHERE x.user_id = u.id) AS xp,
       (SELECT COALESCE(SUM(practice_seconds), 0) / 60 FROM sessions s WHERE s.user_id = u.id) AS minutes
     FROM users u ORDER BY u.created_at DESC`,
  );
}

export function adminDemoPartners() {
  return all<{ id: string; display_name: string; avatar: string; proficiency: string; interests: string; bio: string; blocked_by: number; reported: number }>(
    getDb(),
    `SELECT p.*, (SELECT COUNT(*) FROM blocks b WHERE b.blocked_id = p.id) AS blocked_by,
       (SELECT COUNT(*) FROM safety_reports r WHERE r.reported_id = p.id) AS reported
     FROM demo_partners p ORDER BY p.display_name`,
  );
}

export function adminSessions(limit = 40) {
  return all<{ id: string; user_name: string; type: string; topic: string | null; prompt_text: string | null; partner_name: string | null; duration_seconds: number; status: string; origin: string; started_at: string; xp_awarded: number }>(
    getDb(),
    `SELECT s.id, u.display_name AS user_name, s.type, t.title AS topic, s.prompt_text, s.partner_name, s.duration_seconds, s.status, s.origin, s.started_at, s.xp_awarded
     FROM sessions s JOIN users u ON u.id = s.user_id LEFT JOIN topics t ON t.id = s.topic_id ORDER BY s.started_at DESC LIMIT ?`,
    limit,
  );
}

export function adminBattles(limit = 40) {
  return all<{ id: string; user_name: string; prompt_text: string; opponent_name: string; result: string; user_score: number | null; opponent_score: number | null; user_input_mode: string; origin: string; created_at: string; evaluation_status: string }>(
    getDb(),
    `SELECT b.id, u.display_name AS user_name, b.prompt_text, b.opponent_name, b.result, b.user_score, b.opponent_score, b.user_input_mode, b.origin, b.created_at, b.evaluation_status
     FROM battles b JOIN users u ON u.id = b.user_id ORDER BY b.created_at DESC LIMIT ?`,
    limit,
  );
}

export function adminReports() {
  return all<{ id: string; reporter_name: string | null; reported_name: string; reported_kind: string; reason: string; details: string | null; status: string; admin_note: string | null; origin: string; created_at: string; session_id: string | null }>(
    getDb(),
    `SELECT r.id, u.display_name AS reporter_name, r.reported_name, r.reported_kind, r.reason, r.details, r.status, r.admin_note, r.origin, r.created_at, r.session_id
     FROM safety_reports r LEFT JOIN users u ON u.id = r.reporter_user_id ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, r.created_at DESC`,
  );
}

export function adminFeedback(limit = 40) {
  return all<{ id: string; user_name: string; kind: string; analyzer: string; model: string | null; origin: string; input_mode: string; prompt_text: string | null; reviewed_at: string | null; created_at: string; analysis: string }>(
    getDb(),
    `SELECT f.id, u.display_name AS user_name, f.kind, f.analyzer, f.model, f.origin, f.input_mode, f.prompt_text, f.reviewed_at, f.created_at, f.analysis
     FROM feedback f JOIN users u ON u.id = f.user_id ORDER BY f.created_at DESC LIMIT ?`,
    limit,
  ).map((f) => {
    let issues = 0;
    let summary = "";
    try {
      const a = JSON.parse(f.analysis) as { issues: { minor?: boolean }[]; summary: string };
      issues = a.issues.filter((i) => !i.minor).length;
      summary = a.summary;
    } catch {
      /* ignore */
    }
    return { ...f, analysis: undefined, issues, summary };
  });
}

export function adminProductFeedback() {
  return all<{ id: string; user_name: string | null; category: string; message: string; created_at: string }>(
    getDb(),
    "SELECT p.id, u.display_name AS user_name, p.category, p.message, p.created_at FROM product_feedback p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC",
  );
}
