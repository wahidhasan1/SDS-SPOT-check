// Ordered migrations. Never edit a shipped migration: append a new one.
// Access control: SQLite has no row-level security, so every query in the API layer is scoped
// by the authenticated user's id (see server/lib/auth.ts and the route handlers).

export const MIGRATIONS: string[] = [
  /* 1: core */ `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','banned')),
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER
  );

  CREATE TABLE profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    anon_name TEXT NOT NULL UNIQUE,
    avatar_color TEXT NOT NULL,
    avatar_icon TEXT NOT NULL,
    birth_year INTEGER,
    gender TEXT CHECK (gender IN ('female','male','other') OR gender IS NULL),
    native_language TEXT,
    goal TEXT CHECK (goal IN ('ielts','general','work') OR goal IS NULL),
    test_type TEXT CHECK (test_type IN ('academic','general_training') OR test_type IS NULL),
    target_band REAL CHECK (target_band IS NULL OR (target_band >= 4 AND target_band <= 9)),
    daily_minutes INTEGER,
    interests TEXT NOT NULL DEFAULT '[]',
    cefr_level TEXT CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2') OR cefr_level IS NULL),
    cefr_score REAL,
    onboarding_step TEXT NOT NULL DEFAULT 'goals',
    show_level_to_partners INTEGER NOT NULL DEFAULT 1,
    show_on_leaderboard INTEGER NOT NULL DEFAULT 1,
    reminder_hour INTEGER,
    reminders_enabled INTEGER NOT NULL DEFAULT 0,
    timezone_offset INTEGER NOT NULL DEFAULT 0,
    ai_consent INTEGER NOT NULL DEFAULT 0,
    voice_consent INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE sessions (
    id_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  CREATE TABLE password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    used_at INTEGER
  );

  CREATE TABLE proficiency_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level TEXT NOT NULL,
    score REAL NOT NULL,
    source TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX proficiency_user ON proficiency_history(user_id, created_at);

  CREATE TABLE assessments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
    started_at INTEGER NOT NULL,
    finished_at INTEGER
  );
  CREATE INDEX assessments_user ON assessments(user_id, status);

  CREATE TABLE activity_days (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    activities INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
  );

  CREATE TABLE app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `,

  /* 2: content + practice */ `
  CREATE TABLE content_items (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('reading','listening','writing','speaking','grammar','assessment','mock')),
    test_type TEXT CHECK (test_type IN ('academic','general_training','both') OR test_type IS NULL),
    title TEXT NOT NULL,
    level TEXT,
    premium INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','draft','pending_review','archived')),
    source TEXT NOT NULL DEFAULT 'seed' CHECK (source IN ('seed','admin','ai')),
    data TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX content_kind ON content_items(kind, status, test_type);

  CREATE TABLE attempts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL REFERENCES content_items(id),
    kind TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'practice' CHECK (mode IN ('practice','exam')),
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted')),
    answers TEXT NOT NULL DEFAULT '{}',
    flagged TEXT NOT NULL DEFAULT '[]',
    score INTEGER,
    max_score INTEGER,
    band REAL,
    results TEXT,
    time_spent_s INTEGER NOT NULL DEFAULT 0,
    started_at INTEGER NOT NULL,
    submitted_at INTEGER,
    mock_attempt_id TEXT
  );
  CREATE INDEX attempts_user ON attempts(user_id, kind, submitted_at);

  CREATE TABLE writing_submissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt_id TEXT NOT NULL REFERENCES content_items(id),
    text TEXT NOT NULL DEFAULT '',
    word_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
    checks TEXT,
    ai_feedback TEXT,
    ai_status TEXT,
    time_spent_s INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    submitted_at INTEGER,
    mock_attempt_id TEXT
  );
  CREATE INDEX writing_user ON writing_submissions(user_id, updated_at);

  CREATE TABLE writing_drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id TEXT NOT NULL REFERENCES writing_submissions(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    saved_at INTEGER NOT NULL
  );
  CREATE INDEX drafts_sub ON writing_drafts(submission_id, saved_at);

  CREATE TABLE speaking_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt_id TEXT REFERENCES content_items(id),
    part INTEGER,
    question TEXT NOT NULL,
    transcript TEXT NOT NULL,
    duration_s REAL NOT NULL,
    metrics TEXT NOT NULL,
    feedback TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    mock_attempt_id TEXT
  );
  CREATE INDEX speaking_user ON speaking_sessions(user_id, created_at);

  CREATE TABLE mock_attempts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mock_id TEXT NOT NULL REFERENCES content_items(id),
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
    section_index INTEGER NOT NULL DEFAULT 0,
    section_started_at INTEGER,
    results TEXT,
    started_at INTEGER NOT NULL,
    finished_at INTEGER
  );
  CREATE INDEX mock_user ON mock_attempts(user_id, started_at);
  `,

  /* 3: vocabulary */ `
  CREATE TABLE vocab_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pos TEXT,
    ipa TEXT,
    level TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    definition TEXT NOT NULL,
    examples TEXT NOT NULL DEFAULT '[]',
    synonyms TEXT NOT NULL DEFAULT '[]',
    antonyms TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'published'
  );

  CREATE TABLE saved_words (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word TEXT NOT NULL COLLATE NOCASE,
    meaning TEXT NOT NULL,
    context TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    box INTEGER NOT NULL DEFAULT 0,
    due_at INTEGER NOT NULL,
    correct INTEGER NOT NULL DEFAULT 0,
    wrong INTEGER NOT NULL DEFAULT 0,
    last_reviewed_at INTEGER,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, word)
  );
  CREATE INDEX saved_due ON saved_words(user_id, due_at);

  CREATE TABLE word_progress (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word_id INTEGER NOT NULL REFERENCES vocab_words(id) ON DELETE CASCADE,
    seen INTEGER NOT NULL DEFAULT 0,
    correct INTEGER NOT NULL DEFAULT 0,
    last_seen_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, word_id)
  );

  CREATE TABLE reading_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    confidence REAL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX reading_user ON reading_sessions(user_id, created_at);

  CREATE TABLE word_lookups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reading_session_id TEXT REFERENCES reading_sessions(id) ON DELETE CASCADE,
    word TEXT NOT NULL,
    sentence TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  `,

  /* 4: calls + safety */ `
  CREATE TABLE call_sessions (
    id TEXT PRIMARY KEY,
    user_a TEXT REFERENCES users(id) ON DELETE SET NULL,
    user_b TEXT REFERENCES users(id) ON DELETE SET NULL,
    mode TEXT NOT NULL,
    topic TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'connecting' CHECK (status IN ('connecting','active','ended')),
    created_at INTEGER NOT NULL,
    connected_at INTEGER,
    ended_at INTEGER,
    end_reason TEXT,
    ended_by TEXT,
    duration_s INTEGER,
    max_seconds INTEGER NOT NULL,
    anon_a TEXT NOT NULL,
    anon_b TEXT NOT NULL,
    level_a TEXT,
    level_b TEXT,
    role_a TEXT,
    role_b TEXT,
    prompts TEXT NOT NULL DEFAULT '{}',
    counted INTEGER NOT NULL DEFAULT 1,
    CHECK (user_a <> user_b)
  );
  CREATE INDEX calls_a ON call_sessions(user_a, created_at);
  CREATE INDEX calls_b ON call_sessions(user_b, created_at);
  -- A user can be in at most one live call: enforced in code and checked by these partial indexes' lookups.
  CREATE INDEX calls_live ON call_sessions(status) WHERE status <> 'ended';

  CREATE TABLE call_feedback (
    session_id TEXT NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    tags TEXT NOT NULL DEFAULT '[]',
    self_assessment TEXT,
    note TEXT,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (session_id, user_id)
  );

  CREATE TABLE blocks (
    blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (blocker_id, blocked_id)
  );
  CREATE INDEX blocks_blocked ON blocks(blocked_id);

  CREATE TABLE reports (
    id TEXT PRIMARY KEY,
    reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    reported_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT REFERENCES call_sessions(id) ON DELETE SET NULL,
    context TEXT NOT NULL DEFAULT 'call',
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','actioned','dismissed')),
    created_at INTEGER NOT NULL,
    resolved_at INTEGER,
    resolved_by TEXT,
    resolution TEXT
  );
  CREATE UNIQUE INDEX reports_once ON reports(reporter_id, reported_id, session_id);
  CREATE INDEX reports_status ON reports(status, created_at);

  CREATE TABLE moderation_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    actor TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER
  );
  CREATE INDEX moderation_user ON moderation_actions(user_id, created_at);
  `,

  /* 5: battles */ `
  CREATE TABLE battles (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('live','solo')),
    status TEXT NOT NULL CHECK (status IN ('active','finished','aborted')),
    questions TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    ended_at INTEGER
  );

  CREATE TABLE battle_participants (
    battle_id TEXT NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL DEFAULT 0,
    correct INTEGER NOT NULL DEFAULT 0,
    result TEXT,
    rating_before INTEGER,
    rating_after INTEGER,
    left_early INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (battle_id, user_id)
  );
  CREATE INDEX battle_part_user ON battle_participants(user_id);

  CREATE TABLE battle_answers (
    battle_id TEXT NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    q_index INTEGER NOT NULL,
    answer TEXT NOT NULL,
    correct INTEGER NOT NULL,
    points INTEGER NOT NULL,
    ms INTEGER NOT NULL,
    PRIMARY KEY (battle_id, user_id, q_index)
  );

  CREATE TABLE ratings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL DEFAULT 1000,
    games INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );
  `,

  /* 6: plans, notifications, admin */ `
  CREATE TABLE plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    limits TEXT NOT NULL,
    price_label TEXT,
    sort INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES plans(id),
    provider TEXT NOT NULL CHECK (provider IN ('stripe','revenuecat','admin','test')),
    provider_ref TEXT,
    status TEXT NOT NULL CHECK (status IN ('active','canceled','expired','past_due')),
    current_period_end INTEGER,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX subs_user ON subscriptions(user_id, status);
  CREATE UNIQUE INDEX subs_provider_ref ON subscriptions(provider, provider_ref) WHERE provider_ref IS NOT NULL;

  CREATE TABLE payment_events (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    type TEXT NOT NULL,
    received_at INTEGER NOT NULL
  );

  CREATE TABLE usage_counters (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric TEXT NOT NULL,
    day TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, metric, day)
  );

  CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,
    read_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX notif_user ON notifications(user_id, created_at);

  CREATE TABLE push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    keys TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id TEXT,
    action TEXT NOT NULL,
    target TEXT,
    details TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL
  );
  `,
]
