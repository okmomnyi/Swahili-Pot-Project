-- SwahiliPot IMS — Database schema
-- All timestamps are stored in UTC (TIMESTAMPTZ).

CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  has_trainees BOOLEAN NOT NULL DEFAULT true,
  has_radio_report BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('supervisor', 'instructor', 'admin', 'attachee')),
  -- NULL for system admins, who are not bound to a single department.
  department_id INTEGER REFERENCES departments(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trainees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  added_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id SERIAL PRIMARY KEY,
  instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  session_label VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '3 hours')
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  trainee_name VARCHAR(150) NOT NULL,
  trainee_phone VARCHAR(20) NOT NULL,
  tasks_completed TEXT,
  check_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out TIMESTAMPTZ,
  is_confirmed BOOLEAN NOT NULL DEFAULT false,
  confirmed_by INTEGER REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS form_submissions (
  id SERIAL PRIMARY KEY,
  instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  form_type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url VARCHAR(500),
  file_original_name VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'acknowledged', 'returned')),
  supervisor_note TEXT,
  file_storage VARCHAR(10),
  task_id INTEGER,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS downtime_reports (
  id SERIAL PRIMARY KEY,
  instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  frequency_band VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_by INTEGER REFERENCES users(id),
  resolution_note TEXT,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  link VARCHAR(300),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS password_resets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets (token_hash);

-- ---- Attachment / internship programme ----

-- Tasks & assignments allocated to attachees by instructors/supervisors.
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  assigned_to INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'submitted', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks (assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tasks_department ON tasks (department_id);

-- Personal reminders an attachee sets for themselves.
CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  note TEXT,
  remind_at TIMESTAMPTZ NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders (user_id, remind_at);

-- Simple click-to-check-in attendance for attachees (no QR session).
CREATE TABLE IF NOT EXISTS attachee_checkins (
  id SERIAL PRIMARY KEY,
  attachee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  check_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkins_attachee ON attachee_checkins (attachee_id, check_in DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_department ON attachee_checkins (department_id, check_in DESC);

-- Inquiries from attachees to their instructors / supervisors (threaded).
CREATE TABLE IF NOT EXISTS inquiries (
  id SERIAL PRIMARY KEY,
  attachee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  subject VARCHAR(200) NOT NULL,
  audience VARCHAR(20) NOT NULL DEFAULT 'both' CHECK (audience IN ('instructors', 'supervisors', 'both')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiries_attachee ON inquiries (attachee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_department ON inquiries (department_id, created_at DESC);

CREATE TABLE IF NOT EXISTS inquiry_messages (
  id SERIAL PRIMARY KEY,
  inquiry_id INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiry_messages_inquiry ON inquiry_messages (inquiry_id, created_at);

-- ---- Public website (admin-editable) ----

-- Editable landing-page content, one JSON document per section key.
CREATE TABLE IF NOT EXISTS site_settings (
  key VARCHAR(60) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partner organisations shown on the landing page.
CREATE TABLE IF NOT EXISTS partners (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  website VARCHAR(300),
  logo_url VARCHAR(500),
  logo_storage VARCHAR(10),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partners_active ON partners (is_active, sort_order);

-- Uploaded landing-page imagery (hero, about), keyed by slot.
CREATE TABLE IF NOT EXISTS site_media (
  key VARCHAR(60) PRIMARY KEY,
  file_url VARCHAR(500) NOT NULL,
  file_storage VARCHAR(10),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- Additive feature set: announcements, task feedback, session logs,
-- activity feed, programs/cohorts and the visitor log.
-- =====================================================================

-- ---- Part 1: Announcements / notice board ----
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  posted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_department
  ON announcements (department_id, is_pinned DESC, created_at DESC);

-- ---- Part 2: Threaded task comments ----
CREATE TABLE IF NOT EXISTS task_comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments (task_id, created_at);

-- ---- Part 3: Session / daily logs ----
CREATE TABLE IF NOT EXISTS session_logs (
  id SERIAL PRIMARY KEY,
  instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  session_date DATE NOT NULL,
  topics_covered TEXT NOT NULL,
  challenges TEXT,
  next_session_plan TEXT,
  attendance_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_logs_dept ON session_logs (department_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_session_logs_instructor ON session_logs (instructor_id, session_date DESC);

-- ---- Part 4: Department activity feed ----
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_name VARCHAR(150),
  action_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_department ON activity_log (department_id, created_at DESC);

-- ---- Part 9: Programs / cohorts ----
CREATE TABLE IF NOT EXISTS programs (
  id SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_programs_department ON programs (department_id, is_active DESC, start_date DESC);

CREATE TABLE IF NOT EXISTS program_enrollments (
  id SERIAL PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  trainee_id INTEGER NOT NULL REFERENCES trainees(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (program_id, trainee_id)
);

-- =====================================================================
-- AI Attachee Intelligence Layer (NVIDIA NIM / Kimi K2).
-- Attachee = a trainees row. IDs are integers (SERIAL), matching the
-- rest of the schema (the AI spec's UUID/extra-column shape does not).
-- =====================================================================

-- Cached per-trainee AI intelligence profiles (regenerated on demand).
CREATE TABLE IF NOT EXISTS attachee_ai_profiles (
  id                  SERIAL PRIMARY KEY,
  attachee_id         INTEGER NOT NULL REFERENCES trainees(id) ON DELETE CASCADE,
  department_id       INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  strengths           TEXT,            -- JSON array string
  weaknesses          TEXT,            -- JSON array string
  behavioral_patterns TEXT,            -- JSON array string
  skill_tags          TEXT[],
  career_paths        JSONB,           -- [{title, confidence, reasoning, next_steps}]
  summary             TEXT,
  details             JSONB,           -- full rich profile object (all sections)
  raw_context_hash    TEXT,            -- SHA-256 of the context used (stale-cache detection)
  UNIQUE (attachee_id)
);

-- Supervisor AI chat history (last 10 messages used as context).
CREATE TABLE IF NOT EXISTS supervisor_ai_chats (
  id            SERIAL PRIMARY KEY,
  supervisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  role          VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant')),
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supervisor_chats_sup ON supervisor_ai_chats (supervisor_id, created_at DESC);

-- AI-generated report drafts (supervisor edits before PDF export).
CREATE TABLE IF NOT EXISTS ai_reports (
  id               SERIAL PRIMARY KEY,
  attachee_id      INTEGER NOT NULL REFERENCES trainees(id) ON DELETE CASCADE,
  department_id    INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  report_type      VARCHAR(32) NOT NULL CHECK (report_type IN ('progress', 'completion')),
  generated_by     INTEGER NOT NULL REFERENCES users(id),
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ai_narrative     TEXT NOT NULL,
  supervisor_edits TEXT,
  status           VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized'))
);

CREATE INDEX IF NOT EXISTS idx_ai_reports_attachee ON ai_reports (attachee_id);

-- ---- Part 10: Visitor / walk-in log ----
CREATE TABLE IF NOT EXISTS visitor_log (
  id SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  logged_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  visitor_name VARCHAR(150) NOT NULL,
  visitor_phone VARCHAR(20),
  purpose TEXT NOT NULL,
  person_visiting VARCHAR(150),
  time_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_out TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitor_log_dept_date ON visitor_log (department_id, time_in DESC);
