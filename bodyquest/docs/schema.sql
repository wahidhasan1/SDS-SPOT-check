-- Suggested PostgreSQL schema for a production BODYQUEST backend.
-- Mirrors src/domain/types.ts. Every private table carries user_id and must be
-- accessed only through server-side authorisation (and ideally row-level security).

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext UNIQUE NOT NULL,
  display_name  text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 40),
  password_hash text,                       -- Argon2id, or NULL when using an external IdP
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE TABLE user_profiles (
  user_id        uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age            int  NOT NULL CHECK (age BETWEEN 13 AND 100),
  height_cm      numeric(5,1) NOT NULL CHECK (height_cm BETWEEN 120 AND 230),
  weight_kg      numeric(5,1) NOT NULL CHECK (weight_kg BETWEEN 30 AND 300),
  unit_system    text NOT NULL CHECK (unit_system IN ('metric','imperial')),
  sex            text NOT NULL DEFAULT 'unspecified',
  region         text NOT NULL,
  experience     text NOT NULL,
  activity_level text NOT NULL,
  sleep_hours    numeric(3,1) NOT NULL,
  daily_minutes  int NOT NULL CHECK (daily_minutes IN (15,20,30,45,60)),
  training_days  smallint[] NOT NULL,
  limitations    text[] NOT NULL DEFAULT '{}',
  limitation_notes text NOT NULL DEFAULT '',
  readiness      jsonb NOT NULL,            -- encrypted at rest (health data)
  diet           text NOT NULL,
  allergies      text[] NOT NULL DEFAULT '{}',
  primary_goal   text NOT NULL,
  secondary_goal text,
  body_goal      text NOT NULL,
  training_pattern text NOT NULL,
  timeline_months int NOT NULL CHECK (timeline_months IN (3,6,12,24)),
  avatar         jsonb NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE settings (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data    jsonb NOT NULL
);

CREATE TABLE training_plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern          text NOT NULL,
  recommended_pattern text NOT NULL,
  start_date       date NOT NULL,
  timeline_months  int NOT NULL,
  low_intensity_only boolean NOT NULL DEFAULT false,
  rationale        text[] NOT NULL DEFAULT '{}',
  version          int NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE training_phases (
  plan_id     uuid REFERENCES training_plans(id) ON DELETE CASCADE,
  idx         int,
  name        text NOT NULL,
  focus       text NOT NULL,
  start_week  int NOT NULL,
  end_week    int NOT NULL,
  difficulty_allowance int NOT NULL,
  set_modifier int NOT NULL,
  deload_every int NOT NULL,
  PRIMARY KEY (plan_id, idx)
);

-- Weekly template in force from a given date (keeps history when the schedule changes).
CREATE TABLE plan_schedules (
  plan_id      uuid REFERENCES training_plans(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  week_template jsonb NOT NULL,            -- {weekday: session_template_id}
  PRIMARY KEY (plan_id, effective_from)
);

CREATE TABLE exercises (                   -- reference data (seeded from src/data/exercises.ts)
  id text PRIMARY KEY,
  data jsonb NOT NULL
);

CREATE TABLE workout_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('planned','comeback','mobility')),
  planned_date  date NOT NULL,
  performed_date date,
  status        text NOT NULL,
  started_at    timestamptz,
  finished_at   timestamptz,
  active_ms     bigint NOT NULL DEFAULT 0,
  workout       jsonb NOT NULL,             -- snapshot of the generated workout
  symptom_report jsonb,
  completion_ratio numeric(4,3) NOT NULL DEFAULT 0,
  UNIQUE (user_id, kind, planned_date)
);

CREATE TABLE workout_sets (
  session_id     uuid REFERENCES workout_sessions(id) ON DELETE CASCADE,
  workout_exercise_id text NOT NULL,
  set_index      int NOT NULL,
  exercise_id    text NOT NULL REFERENCES exercises(id),
  reps_done      int CHECK (reps_done BETWEEN 0 AND 200),
  seconds_done   int CHECK (seconds_done BETWEEN 0 AND 1800),
  rating         smallint CHECK (rating BETWEEN 1 AND 5),
  completed_at   timestamptz NOT NULL,
  PRIMARY KEY (session_id, workout_exercise_id, set_index)
);

CREATE TABLE exercise_progressions (
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  exercise_id text REFERENCES exercises(id),
  variation_id text REFERENCES exercises(id),
  rep_bonus   int NOT NULL DEFAULT 0,
  suggestion  jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, exercise_id)
);

CREATE TABLE day_overrides (
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  date       date NOT NULL,
  resolution text NOT NULL CHECK (resolution IN ('rescheduled','comeback','token','unwell','acknowledged-missed')),
  moved_to   date,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE TABLE recovery_tokens (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason    text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  used_on   date,
  UNIQUE (user_id, reason)
);

CREATE TABLE xp_events (                   -- server-computed only
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  key     text NOT NULL,                   -- idempotency key, e.g. workout:2026-10-14
  amount  int NOT NULL CHECK (amount > 0 AND amount <= 500),
  reason  text NOT NULL,
  at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

CREATE TABLE user_achievements (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE foods (                        -- verified/licensed food data with provenance
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  source text NOT NULL,
  source_version text
);

CREATE TABLE meal_plan_days (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  date    date NOT NULL,
  selections jsonb NOT NULL DEFAULT '{}',
  eaten      jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_id, date)
);

CREATE TABLE food_log (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date      date NOT NULL,
  slot      text NOT NULL,
  food_id   text REFERENCES foods(id),
  servings  numeric(4,2) CHECK (servings > 0 AND servings <= 10),
  custom_name text,
  custom_nutrition jsonb,
  from_meal_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (food_id IS NOT NULL OR custom_name IS NOT NULL)
);

CREATE TABLE hydration_log (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date     date NOT NULL,
  ml       int NOT NULL CHECK (ml BETWEEN 10 AND 1000),
  beverage text NOT NULL,
  at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hydration_settings (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  custom_target_ml int CHECK (custom_target_ml BETWEEN 500 AND 6000),
  medical_limit_ml int CHECK (medical_limit_ml BETWEEN 500 AND 6000),
  hot_climate boolean NOT NULL DEFAULT false,
  reminders_enabled boolean NOT NULL DEFAULT false,
  reminder_interval_min int NOT NULL DEFAULT 90
);

CREATE TABLE progress_entries (             -- private; never exposed to other users
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date      date NOT NULL,
  measurements jsonb NOT NULL DEFAULT '{}',
  performance  jsonb NOT NULL DEFAULT '{}',
  sleep_hours  numeric(3,1),
  note      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE progress_photos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key text NOT NULL,                  -- private bucket, signed URLs only
  date       date NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE battles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status        text NOT NULL,
  initiated_by  uuid NOT NULL REFERENCES users(id),
  shared_goal   text NOT NULL,
  duration_days int NOT NULL CHECK (duration_days IN (7,14)),
  start_date    date,
  end_date      date,
  result        jsonb,                       -- frozen, server-computed
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE battle_participants (
  battle_id uuid REFERENCES battles(id) ON DELETE CASCADE,
  user_id   uuid REFERENCES users(id) ON DELETE CASCADE,
  accepted_at timestamptz,
  PRIMARY KEY (battle_id, user_id)
);

CREATE TABLE battle_events (                -- derived from verified activity, idempotent
  battle_id uuid REFERENCES battles(id) ON DELETE CASCADE,
  user_id   uuid REFERENCES users(id) ON DELETE CASCADE,
  key       text NOT NULL,
  kind      text NOT NULL,
  date      date NOT NULL,
  PRIMARY KEY (battle_id, user_id, key)
);

CREATE TABLE notifications (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key       text NOT NULL,
  kind      text NOT NULL,
  title     text NOT NULL,
  body      text NOT NULL,
  link      text,
  read      boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
