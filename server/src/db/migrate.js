'use strict';

const fs = require('fs');
const path = require('path');
const pool = require('./pool');

/**
 * Runs the schema file. Every statement uses CREATE TABLE IF NOT EXISTS,
 * so this is idempotent and safe to run on every boot.
 */
async function runOnce() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const client = await pool.connect();
  try {
    // gen_random_uuid() lives in pgcrypto on older Postgres builds.
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    await client.query(sql);

    // --- Idempotent upgrades for databases created before these features ---
    // Allow the 'admin' and 'attachee' roles; admins exist without a department.
    await client.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
    await client.query(
      "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('supervisor', 'instructor', 'admin', 'attachee'))"
    );
    await client.query('ALTER TABLE users ALTER COLUMN department_id DROP NOT NULL');

    // Submission storage driver + optional task link (added for attachees/uploads).
    await client.query(
      "ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS file_storage VARCHAR(10)"
    );
    await client.query('ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS task_id INTEGER');

    // Simplified QR attendance: trainees enter only name + phone, so the
    // "tasks completed" field is now optional.
    await client.query('ALTER TABLE attendance_records ALTER COLUMN tasks_completed DROP NOT NULL');

    // --- Part 2: task feedback / review workflow ---
    await client.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS feedback TEXT');
    await client.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS feedback_by INTEGER REFERENCES users(id)');
    await client.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ');
    await client.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ');
    // Widen the status check to a superset so existing rows (open/completed)
    // stay valid while the new 'pending'/'reviewed' states are also allowed.
    await client.query('ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check');
    await client.query(
      "ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('open', 'pending', 'in_progress', 'submitted', 'completed', 'reviewed'))"
    );

    // --- Part 8: downtime escalation flags ---
    await client.query('ALTER TABLE downtime_reports ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN NOT NULL DEFAULT false');
    await client.query('ALTER TABLE downtime_reports ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ');

    // --- AI intelligence: full rich profile blob (added after the table) ---
    await client.query('ALTER TABLE attachee_ai_profiles ADD COLUMN IF NOT EXISTS details JSONB');

    // --- Part 9: optional program links on existing tables ---
    await client.query('ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL');
    await client.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL');
    await client.query('ALTER TABLE session_logs ADD COLUMN IF NOT EXISTS program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL');

    // --- Delta 3: profile fields + system audit log + platform settings ---
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url VARCHAR(500)');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_storage VARCHAR(10)');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT');

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        actor_name VARCHAR(150),
        actor_role VARCHAR(20),
        action VARCHAR(100) NOT NULL,
        target_type VARCHAR(50),
        target_id INTEGER,
        target_description VARCHAR(255),
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id)');

    // Platform settings live in the existing site_settings table under a single
    // JSON row (key = 'platform'), so we reuse the CMS storage rather than add
    // a parallel table.
    await client.query(
      `INSERT INTO site_settings (key, value)
       VALUES ('platform', $1::jsonb)
       ON CONFLICT (key) DO NOTHING`,
      [
        JSON.stringify({
          maintenance_mode: false,
          attendance_expiry_hours: 3,
          max_file_size_mb: 10,
          downtime_escalation_hours: 2,
          org_name: 'Swahilipot Hub Foundation',
          org_email: 'info@swahilipothub.co.ke',
          system_ai_enabled: true,
        }),
      ]
    );

    // --- Delta 4: AI usage log + threaded supervisor conversations ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_usage_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
        feature VARCHAR(100) NOT NULL,
        tokens_used INTEGER,
        duration_ms INTEGER,
        success BOOLEAN NOT NULL DEFAULT true,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await client.query('CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage_log(created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON ai_usage_log(feature)');

    // Threaded supervisor assistant conversations (supersedes the flat
    // supervisor_ai_chats history; that table is left in place for back-compat).
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_conversations (
        id SERIAL PRIMARY KEY,
        supervisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
        title VARCHAR(160),
        messages JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await client.query('CREATE INDEX IF NOT EXISTS idx_ai_conversations_sup ON ai_conversations(supervisor_id, updated_at DESC)');

    // Add the global AI on/off switch to the platform settings JSON blob if the
    // row already exists without it (the INSERT above only seeds new databases).
    await client.query(`
      UPDATE site_settings
         SET value = value || '{"system_ai_enabled": true}'::jsonb
       WHERE key = 'platform' AND NOT (value ? 'system_ai_enabled')`);

    // --- Delta 5: trainee vs attachee separation ---
    // Formal attachment profile for attachee-role users. Columns are nullable so
    // the existing attachee accounts can be backfilled incrementally.
    await client.query(`
      CREATE TABLE IF NOT EXISTS attachee_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        university_name VARCHAR(255),
        course_of_study VARCHAR(255),
        student_id_number VARCHAR(100),
        attachment_start_date DATE,
        attachment_end_date DATE,
        supervisor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        instructor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        department_id INTEGER REFERENCES departments(id) ON DELETE RESTRICT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await client.query('CREATE INDEX IF NOT EXISTS idx_attachee_profiles_dept ON attachee_profiles(department_id)');

    // Repoint the AI tables from trainees -> attachee-role users. The AI layer
    // was built treating a trainees row as the "attachee"; the correct subject is
    // the attachee user account. Safe to flip the FK (no AI rows exist yet).
    await client.query('ALTER TABLE attachee_ai_profiles DROP CONSTRAINT IF EXISTS attachee_ai_profiles_attachee_id_fkey');
    await client.query('ALTER TABLE attachee_ai_profiles ADD CONSTRAINT attachee_ai_profiles_attachee_id_fkey FOREIGN KEY (attachee_id) REFERENCES users(id) ON DELETE CASCADE');
    await client.query('ALTER TABLE ai_reports DROP CONSTRAINT IF EXISTS ai_reports_attachee_id_fkey');
    await client.query('ALTER TABLE ai_reports ADD CONSTRAINT ai_reports_attachee_id_fkey FOREIGN KEY (attachee_id) REFERENCES users(id) ON DELETE CASCADE');

    // General (not task-bound) supervisor/instructor notes on an attachee.
    await client.query('ALTER TABLE task_comments ALTER COLUMN task_id DROP NOT NULL');
    await client.query('ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS is_general_note BOOLEAN NOT NULL DEFAULT false');
    await client.query('ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS attachee_id INTEGER REFERENCES users(id) ON DELETE CASCADE');

    // Attachee programme enrolment (separate from trainee course enrolment).
    await client.query(`
      CREATE TABLE IF NOT EXISTS attachee_program_enrollments (
        id SERIAL PRIMARY KEY,
        program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
        attachee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (program_id, attachee_id)
      )`);

    // Simple trainee (community learner) completion certificates.
    await client.query(`
      CREATE TABLE IF NOT EXISTS trainee_certificates (
        id SERIAL PRIMARY KEY,
        trainee_id INTEGER NOT NULL REFERENCES trainees(id) ON DELETE CASCADE,
        department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
        generated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        course_name VARCHAR(255) NOT NULL,
        completion_date DATE NOT NULL,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);

    // --- Delta 6: signed-document registry (fraud prevention) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        document_id VARCHAR(30) NOT NULL UNIQUE,
        document_type VARCHAR(50) NOT NULL
          CHECK (document_type IN (
            'attachment_letter', 'completion_certificate',
            'progress_report', 'completion_letter', 'trainee_certificate', 'general'
          )),
        recipient_name VARCHAR(150) NOT NULL,
        recipient_email VARCHAR(255),
        department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
        department_name VARCHAR(100) NOT NULL,
        issued_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        issued_by_name VARCHAR(150) NOT NULL,
        issued_by_role VARCHAR(30) NOT NULL,
        issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        content_hash VARCHAR(64) NOT NULL,
        signature VARCHAR(200) NOT NULL,
        file_url VARCHAR(500),
        is_revoked BOOLEAN NOT NULL DEFAULT false,
        revoked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        revoked_at TIMESTAMPTZ,
        revocation_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await client.query('CREATE INDEX IF NOT EXISTS idx_documents_document_id ON documents(document_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_documents_recipient ON documents(LOWER(recipient_name))');
    await client.query('CREATE INDEX IF NOT EXISTS idx_documents_department ON documents(department_id, issued_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_documents_issued_by ON documents(issued_by)');

    // Intentional startup logging.
    console.log('Database migration complete — all tables ensured.');
  } finally {
    client.release();
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Serverless Postgres (e.g. Neon) occasionally drops the very first
 * connection from a cold pooler. Retry a few times so boot is reliable.
 */
async function migrate(retries = 8) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      // Warm-up ping: serverless Postgres (Neon) may be suspended and return
      // ECONNREFUSED while it resumes (~3–5s). A cheap query wakes it first.
      await pool.query('SELECT 1');
      return await runOnce();
    } catch (err) {
      if (attempt > retries) throw err;
      console.error(
        `[${new Date().toISOString()}] Migration attempt ${attempt} failed (${err.code || err.message || 'connection issue'}); retrying…`
      );
      await sleep(Math.min(3000, 1000 * attempt));
    }
  }
}

// Allow running directly: `npm run migrate`
if (require.main === module) {
  require('dotenv').config({ override: true });
  migrate()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err.message);
      process.exit(1);
    });
}

module.exports = migrate;
