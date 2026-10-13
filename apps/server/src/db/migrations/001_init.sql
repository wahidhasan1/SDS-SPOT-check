-- Core schema. All client access goes through the API server, which scopes every
-- query to the authenticated user; clients never connect to Postgres directly.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Accounts ----------
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  anon_name text NOT NULL,
  avatar text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  birth_year int,
  failed_logins int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  suspended_until timestamptz,
  suspension_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE user_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  goals text[] NOT NULL DEFAULT '{}',
  test_type text NOT NULL DEFAULT 'none' CHECK (test_type IN ('academic','general','none')),
  target_band numeric(2,1) CHECK (target_band IS NULL OR (target_band >= 1 AND target_band <= 9)),
  interests text[] NOT NULL DEFAULT '{}',
  native_language text,
  translation_language text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  show_level_to_partners boolean NOT NULL DEFAULT true,
  show_on_leaderboard boolean NOT NULL DEFAULT true,
  notif_daily_reminder boolean NOT NULL DEFAULT true,
  notif_reminder_hour int NOT NULL DEFAULT 19 CHECK (notif_reminder_hour BETWEEN 0 AND 23),
  notif_vocab_review boolean NOT NULL DEFAULT true,
  notif_battle_invites boolean NOT NULL DEFAULT true,
  notif_streaks boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'UTC',
  cefr_level text CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  level_assessed_at timestamptz,
  streak_days int NOT NULL DEFAULT 0,
  last_active_date date,
  battle_rating int NOT NULL DEFAULT 1000,
  battle_games int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_hash text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'web',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  rotated_at timestamptz
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id);

CREATE TABLE password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Plans, subscriptions, usage ----------
CREATE TABLE plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  limits jsonb NOT NULL,
  price_display text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES plans(id),
  provider text NOT NULL CHECK (provider IN ('stripe','revenuecat','app_store','play_store','admin_grant')),
  provider_ref text NOT NULL,
  status text NOT NULL CHECK (status IN ('active','trialing','past_due','canceled','expired')),
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_ref)
);
CREATE INDEX subscriptions_user_idx ON subscriptions (user_id);

CREATE TABLE billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text,
  payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

CREATE TABLE usage_counters (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day date NOT NULL,
  key text NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, key)
);

CREATE TABLE app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Proficiency ----------
CREATE TABLE assessment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill text NOT NULL CHECK (skill IN ('vocabulary','grammar','reading','listening')),
  cefr text NOT NULL CHECK (cefr IN ('A1','A2','B1','B2','C1','C2')),
  difficulty numeric(3,2) NOT NULL,
  prompt text NOT NULL,
  passage text,
  audio_url text,
  options jsonb NOT NULL,
  answer text NOT NULL,
  explanation text,
  active boolean NOT NULL DEFAULT true,
  external_key text UNIQUE
);
CREATE INDEX assessment_items_skill_idx ON assessment_items (skill, difficulty) WHERE active;

CREATE TABLE assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'placement' CHECK (kind IN ('placement','reassessment')),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  theta numeric(4,2) NOT NULL DEFAULT 3.0,
  skill_theta jsonb NOT NULL DEFAULT '{}',
  answered int NOT NULL DEFAULT 0,
  current_item_id uuid REFERENCES assessment_items(id),
  result_level text,
  skill_results jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX assessments_user_idx ON assessments (user_id, started_at DESC);

CREATE TABLE assessment_responses (
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES assessment_items(id),
  answer text NOT NULL,
  correct boolean NOT NULL,
  theta_after numeric(4,2) NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assessment_id, item_id)
);

CREATE TABLE proficiency_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level text NOT NULL,
  theta numeric(4,2),
  skill_levels jsonb,
  source text NOT NULL,
  assessment_id uuid REFERENCES assessments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX proficiency_history_user_idx ON proficiency_history (user_id, created_at DESC);

-- ---------- Vocabulary & grammar ----------
CREATE TABLE vocabulary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL,
  ipa text,
  part_of_speech text NOT NULL,
  meaning text NOT NULL,
  examples text[] NOT NULL DEFAULT '{}',
  synonyms text[] NOT NULL DEFAULT '{}',
  antonyms text[] NOT NULL DEFAULT '{}',
  cefr text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  usage_note text,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','draft')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX vocabulary_word_key ON vocabulary (lower(word), part_of_speech);
CREATE INDEX vocabulary_tags_idx ON vocabulary USING gin (tags);

CREATE TABLE saved_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vocabulary_id uuid REFERENCES vocabulary(id) ON DELETE SET NULL,
  word text NOT NULL,
  meaning text,
  example text,
  context text,
  source text NOT NULL,
  ease_factor numeric(4,2) NOT NULL DEFAULT 2.5,
  interval_days int NOT NULL DEFAULT 0,
  repetitions int NOT NULL DEFAULT 0,
  due_at timestamptz NOT NULL DEFAULT now(),
  last_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX saved_words_user_word_key ON saved_words (user_id, lower(word));
CREATE INDEX saved_words_due_idx ON saved_words (user_id, due_at);

CREATE TABLE word_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_word_id uuid NOT NULL REFERENCES saved_words(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quality int NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE grammar_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  cefr text NOT NULL,
  topic text NOT NULL,
  summary text NOT NULL,
  body text NOT NULL,
  examples jsonb NOT NULL DEFAULT '[]',
  order_index int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published'
);

CREATE TABLE grammar_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES grammar_lessons(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('mcq','gap')),
  prompt text NOT NULL,
  options jsonb,
  answers text[] NOT NULL,
  explanation text NOT NULL,
  order_index int NOT NULL DEFAULT 0
);

CREATE TABLE grammar_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES grammar_lessons(id) ON DELETE CASCADE,
  score int NOT NULL,
  total int NOT NULL,
  details jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX grammar_attempts_user_idx ON grammar_attempts (user_id, created_at DESC);

CREATE TABLE quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  questions jsonb NOT NULL,
  answers jsonb,
  score int,
  total int NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);

-- ---------- IELTS ----------
CREATE TABLE ielts_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  skill text NOT NULL CHECK (skill IN ('reading','listening')),
  test_type text NOT NULL CHECK (test_type IN ('academic','general','both')),
  title text NOT NULL,
  description text,
  difficulty text,
  time_limit_sec int NOT NULL,
  content jsonb NOT NULL,      -- passages / sections / question groups WITHOUT answers
  answer_key jsonb NOT NULL,   -- { questionId: { accepted: [...], explanation, maxWords } }
  question_count int NOT NULL,
  is_premium boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE practice_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  set_id uuid NOT NULL REFERENCES ielts_sets(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('practice','timed','mock')),
  mock_attempt_id uuid,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted')),
  answers jsonb NOT NULL DEFAULT '{}',
  flagged jsonb NOT NULL DEFAULT '[]',
  audio_plays int NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  deadline timestamptz,
  submitted_at timestamptz,
  elapsed_sec int NOT NULL DEFAULT 0,
  score int,
  total int,
  band numeric(2,1),
  result jsonb
);
CREATE INDEX practice_attempts_user_idx ON practice_attempts (user_id, started_at DESC);

CREATE TABLE writing_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  test_type text NOT NULL CHECK (test_type IN ('academic','general','both')),
  task int NOT NULL CHECK (task IN (1,2)),
  kind text NOT NULL,
  title text NOT NULL,
  prompt text NOT NULL,
  instructions text NOT NULL,
  visual jsonb,
  min_words int NOT NULL,
  time_limit_sec int NOT NULL,
  is_premium boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'published'
);

CREATE TABLE writing_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES writing_prompts(id) ON DELETE CASCADE,
  mock_attempt_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','evaluated')),
  text text NOT NULL DEFAULT '',
  word_count int NOT NULL DEFAULT 0,
  elapsed_sec int NOT NULL DEFAULT 0,
  metrics jsonb,
  feedback jsonb,
  feedback_source text,
  band_estimate numeric(2,1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);
CREATE INDEX writing_submissions_user_idx ON writing_submissions (user_id, updated_at DESC);

CREATE TABLE writing_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES writing_submissions(id) ON DELETE CASCADE,
  text text NOT NULL,
  word_count int NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX writing_drafts_sub_idx ON writing_drafts (submission_id, saved_at DESC);

CREATE TABLE speaking_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  part int NOT NULL CHECK (part IN (1,2,3)),
  topic text NOT NULL,
  text text NOT NULL,
  bullets text[] NOT NULL DEFAULT '{}',
  questions text[] NOT NULL DEFAULT '{}',
  group_key text,
  status text NOT NULL DEFAULT 'published'
);

CREATE TABLE speaking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt_id uuid REFERENCES speaking_prompts(id) ON DELETE SET NULL,
  mock_attempt_id uuid,
  part int NOT NULL,
  question text NOT NULL,
  transcript text NOT NULL,
  transcript_source text NOT NULL,
  duration_sec numeric(6,1) NOT NULL,
  metrics jsonb NOT NULL,
  feedback jsonb,
  feedback_source text NOT NULL,
  band_estimate numeric(2,1),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX speaking_sessions_user_idx ON speaking_sessions (user_id, created_at DESC);

CREATE TABLE mock_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  test_type text NOT NULL CHECK (test_type IN ('academic','general')),
  description text,
  sections jsonb NOT NULL,
  is_premium boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'published'
);

CREATE TABLE mock_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mock_test_id uuid NOT NULL REFERENCES mock_tests(id) ON DELETE CASCADE,
  strict boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  current_section int NOT NULL DEFAULT 0,
  sections jsonb NOT NULL,
  results jsonb,
  overall_band numeric(2,1),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX mock_attempts_user_idx ON mock_attempts (user_id, started_at DESC);

-- ---------- Voice calling ----------
CREATE TABLE match_queue (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mode text NOT NULL,
  topic_id text NOT NULL,
  level_idx int,
  level_preference text NOT NULL DEFAULT 'similar',
  priority boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL,
  topic_id text NOT NULL,
  status text NOT NULL DEFAULT 'matched' CHECK (status IN ('matched','connected','ended','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  connected_at timestamptz,
  ended_at timestamptz,
  end_reason text,
  ended_by uuid REFERENCES users(id) ON DELETE SET NULL,
  duration_sec int NOT NULL DEFAULT 0,
  max_duration_sec int NOT NULL,
  warned_at timestamptz,
  ielts_script jsonb
);
CREATE INDEX call_sessions_active_idx ON call_sessions (status) WHERE status IN ('matched','connected');

CREATE TABLE call_participants (
  call_id uuid NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('offerer','answerer')),
  anon_name text NOT NULL,
  avatar text NOT NULL,
  level text,
  platform text,
  media_connected_at timestamptz,
  left_at timestamptz,
  feedback_rating int CHECK (feedback_rating BETWEEN 1 AND 5),
  feedback_comment text,
  ws_disconnected_at timestamptz,
  muted boolean NOT NULL DEFAULT false,
  PRIMARY KEY (call_id, role)
);
CREATE INDEX call_participants_user_idx ON call_participants (user_id);

-- One active call per user, enforced by the primary key.
CREATE TABLE user_active_calls (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  call_id uuid NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE
);

CREATE TABLE user_blocks (
  blocker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  call_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX user_blocks_blocked_idx ON user_blocks (blocked_id);

CREATE TABLE user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reported_id uuid REFERENCES users(id) ON DELETE SET NULL,
  call_id uuid,
  battle_id uuid,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','actioned','dismissed')),
  resolution_note text,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_reports_status_idx ON user_reports (status, created_at DESC);
CREATE INDEX user_reports_reported_idx ON user_reports (reported_id);
CREATE UNIQUE INDEX user_reports_once_per_call ON user_reports (reporter_id, call_id) WHERE call_id IS NOT NULL;

-- ---------- Battles ----------
CREATE TABLE battle_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_type text NOT NULL,
  ranked boolean NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
  questions jsonb NOT NULL,
  seconds_per_question int NOT NULL,
  current_index int NOT NULL DEFAULT -1,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE TABLE battle_participants (
  battle_id uuid NOT NULL REFERENCES battle_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  seat int NOT NULL,
  anon_name text NOT NULL,
  avatar text NOT NULL,
  score int NOT NULL DEFAULT 0,
  correct_count int NOT NULL DEFAULT 0,
  rating_before int,
  rating_after int,
  result text,
  left_at timestamptz,
  PRIMARY KEY (battle_id, seat)
);
CREATE INDEX battle_participants_user_idx ON battle_participants (user_id);

CREATE TABLE battle_answers (
  battle_id uuid NOT NULL REFERENCES battle_sessions(id) ON DELETE CASCADE,
  seat int NOT NULL,
  q_index int NOT NULL,
  answer text NOT NULL,
  correct boolean NOT NULL,
  points int NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (battle_id, seat, q_index)
);

-- ---------- AI reading ----------
CREATE TABLE ai_reading_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  ocr_text text NOT NULL,
  corrected_text text,
  ocr_confidence numeric(5,2),
  low_confidence_words jsonb NOT NULL DEFAULT '[]',
  image_meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_reading_sessions_user_idx ON ai_reading_sessions (user_id, created_at DESC);

CREATE TABLE word_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES ai_reading_sessions(id) ON DELETE CASCADE,
  word text NOT NULL,
  sentence text,
  result jsonb NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Engagement ----------
CREATE TABLE activity_log (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  ref_id uuid,
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_log_user_idx ON activity_log (user_id, created_at DESC);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE UNIQUE INDEX notifications_dedupe_key ON notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE TABLE push_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Admin ----------
CREATE TABLE content_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('vocabulary','grammar_exercise','assessment_item')),
  payload jsonb NOT NULL,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE TABLE admin_audit_log (
  id bigserial PRIMARY KEY,
  admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
