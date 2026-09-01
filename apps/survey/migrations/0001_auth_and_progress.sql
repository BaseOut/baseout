-- survey-resume: better-auth core tables + survey_progress.
-- Column names must stay in lockstep with src/lib/schema.ts.
-- Apply: pnpm --filter @baseout/survey db:migrate (local) / db:migrate:remote.

CREATE TABLE user (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  is_anonymous INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE session (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX session_user_id_idx ON session(user_id);

CREATE TABLE account (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at INTEGER,
  refresh_token_expires_at INTEGER,
  scope TEXT,
  password TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX account_user_id_idx ON account(user_id);

CREATE TABLE verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX verification_identifier_idx ON verification(identifier);

-- One respondent's in-flight survey. email is unverified at start; ownership
-- transfers to the verified user on the magic-link resume path (most-recent
-- row per email wins — see /api/progress).
CREATE TABLE survey_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  survey_version TEXT NOT NULL,
  answers TEXT NOT NULL DEFAULT '{}',
  step_idx INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE INDEX survey_progress_user_idx ON survey_progress(user_id);
CREATE INDEX survey_progress_email_idx ON survey_progress(email, survey_version);
