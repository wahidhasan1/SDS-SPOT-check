// Ordered schema migrations for Pantora's SQLite database. Each migration runs
// once inside a transaction; the applied version is tracked in `schema_migrations`.
// To change the schema, append a new entry — never edit one that has shipped.

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    sql: `
CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  auth_subject TEXT UNIQUE,                       -- external auth identifier when real auth is configured
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 2 AND 24),
  avatar TEXT NOT NULL,
  proficiency TEXT NOT NULL CHECK (proficiency IN ('beginner','elementary','intermediate','upper-intermediate','advanced')),
  goals TEXT NOT NULL DEFAULT '[]',               -- JSON array of learning goals
  conversation_pref TEXT NOT NULL CHECK (conversation_pref IN ('free_talk','battles','both')),
  daily_goal_minutes INTEGER NOT NULL CHECK (daily_goal_minutes IN (5,10,15,30)),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  is_demo_account INTEGER NOT NULL DEFAULT 0,
  origin TEXT NOT NULL DEFAULT 'local' CHECK (origin IN ('seed','local')),
  created_at TEXT NOT NULL
);

CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  matching TEXT NOT NULL,                         -- JSON MatchingPrefs
  notifications TEXT NOT NULL,                    -- JSON NotificationPrefs
  privacy TEXT NOT NULL,                          -- JSON PrivacyPrefs
  accessibility TEXT NOT NULL,                    -- JSON AccessibilityPrefs
  updated_at TEXT NOT NULL
);

CREATE TABLE demo_partners (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  proficiency TEXT NOT NULL,
  interests TEXT NOT NULL,
  bio TEXT NOT NULL
);

CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','medium','challenging')),
  description TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  opening_question TEXT NOT NULL,
  follow_ups TEXT NOT NULL,                       -- JSON array
  tags TEXT NOT NULL                              -- JSON array
);

CREATE TABLE topic_favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, topic_id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('free_talk','battle','coach')),
  partner_id TEXT,                                -- demo partner id or user id
  partner_kind TEXT CHECK (partner_kind IN ('demo_partner','user')),
  partner_name TEXT,
  topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL,
  prompt_text TEXT,
  planned_seconds INTEGER,
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  practice_seconds INTEGER NOT NULL DEFAULT 0 CHECK (practice_seconds >= 0),
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  activity_date TEXT NOT NULL,                    -- local YYYY-MM-DD for the user
  status TEXT NOT NULL CHECK (status IN ('completed','incomplete')),
  end_reason TEXT,
  origin TEXT NOT NULL CHECK (origin IN ('seed','demo','live')),
  idempotency_key TEXT NOT NULL,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX idx_sessions_user_date ON sessions(user_id, started_at DESC);

CREATE TABLE transcripts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('available','unavailable','not_retained','failed')),
  source TEXT CHECK (source IN ('sample','browser_speech','stt_provider','typed')),
  note TEXT,
  retention TEXT NOT NULL DEFAULT 'keep',
  expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE transcript_entries (
  id TEXT PRIMARY KEY,
  transcript_id TEXT NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  speaker TEXT NOT NULL CHECK (speaker IN ('user','partner')),
  original TEXT NOT NULL,
  corrected TEXT,
  explanation TEXT,
  category TEXT,
  alternative TEXT,
  reviewed_at TEXT,
  UNIQUE (transcript_id, position)
);

CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('session','battle','coach')),
  analyzer TEXT NOT NULL CHECK (analyzer IN ('demo-rules','anthropic')),
  model TEXT,
  origin TEXT NOT NULL CHECK (origin IN ('seed','generated')),
  input_mode TEXT NOT NULL CHECK (input_mode IN ('typed','spoken')),
  prompt_text TEXT,
  analysis TEXT NOT NULL,                         -- JSON AnalysisResult
  scores TEXT,                                    -- JSON ScoreCard when scored
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_feedback_user ON feedback(user_id, created_at DESC);

CREATE TABLE battles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  prompt_id TEXT NOT NULL,
  topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL,
  prompt_text TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  prep_seconds INTEGER NOT NULL,
  speak_seconds INTEGER NOT NULL,
  opponent_id TEXT NOT NULL,
  opponent_kind TEXT NOT NULL CHECK (opponent_kind IN ('demo_partner','user')),
  opponent_name TEXT NOT NULL,
  user_response TEXT NOT NULL,
  user_input_mode TEXT NOT NULL CHECK (user_input_mode IN ('typed','spoken')),
  opponent_response TEXT NOT NULL,
  opponent_response_kind TEXT NOT NULL CHECK (opponent_response_kind IN ('sample','live')),
  evaluation_status TEXT NOT NULL CHECK (evaluation_status IN ('evaluated','failed')),
  result TEXT NOT NULL CHECK (result IN ('win','loss','draw','no_result')),
  user_score INTEGER,
  opponent_score INTEGER,
  evaluation TEXT,                                -- JSON BattleEvaluation
  origin TEXT NOT NULL CHECK (origin IN ('seed','demo','live')),
  created_at TEXT NOT NULL
);

CREATE TABLE saved_sentences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original TEXT NOT NULL,
  corrected TEXT NOT NULL,
  explanation TEXT,
  category TEXT,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('transcript','coach','battle')),
  source_id TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, original, corrected)
);

CREATE TABLE user_activity (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_date TEXT NOT NULL,
  practice_seconds INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  session_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, activity_date)
);

CREATE TABLE xp_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,                       -- makes every reward idempotent
  amount INTEGER NOT NULL CHECK (amount >= 0),
  reason TEXT NOT NULL,
  activity_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, source_key)
);

CREATE TABLE achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  metric TEXT NOT NULL,
  target INTEGER NOT NULL
);

CREATE TABLE user_achievements (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TEXT NOT NULL,
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  href TEXT,
  dedupe_key TEXT,                                -- prevents duplicate reminders/celebrations
  read_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, dedupe_key)
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE blocks (
  blocker_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL,
  blocked_kind TEXT NOT NULL CHECK (blocked_kind IN ('demo_partner','user')),
  blocked_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (blocker_user_id, blocked_id)
);

CREATE TABLE safety_reports (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reported_id TEXT NOT NULL,
  reported_kind TEXT NOT NULL CHECK (reported_kind IN ('demo_partner','user')),
  reported_name TEXT NOT NULL,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('harassment','hate','sexual_harassment','spam','impersonation','other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  admin_note TEXT,
  origin TEXT NOT NULL DEFAULT 'local' CHECK (origin IN ('seed','local')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE product_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('idea','problem','praise','other')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`,
  },
  {
    version: 2,
    name: "live_matching",
    sql: `
-- Same-server live matching (optional "live" mode). Rows are short-lived.
CREATE TABLE live_queue (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  proficiency TEXT NOT NULL,
  topic_id TEXT,
  duration_minutes INTEGER NOT NULL,
  joined_at TEXT NOT NULL,
  heartbeat_at TEXT NOT NULL
);

CREATE TABLE live_rooms (
  id TEXT PRIMARY KEY,
  caller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  callee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id TEXT,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','active','ended')),
  ended_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE live_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  from_user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('offer','answer','candidate','bye')),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_live_signals_room ON live_signals(room_id, id);
`,
  },
];
