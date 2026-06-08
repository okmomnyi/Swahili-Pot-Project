'use strict';

const express = require('express');
const pool = require('../db/pool');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const logActivity = require('../utils/logActivity');

const router = express.Router();

// Validate an optional program_id belongs to the user's department.
async function resolveProgramId(rawProgramId, departmentId) {
  if (rawProgramId === undefined || rawProgramId === null || rawProgramId === '') return null;
  const programId = parseInt(rawProgramId, 10);
  if (Number.isNaN(programId)) return null;
  const { rows } = await pool.query(
    'SELECT id FROM programs WHERE id = $1 AND department_id = $2',
    [programId, departmentId]
  );
  return rows.length ? programId : null;
}

// POST /api/attendance/sessions — instructor only
router.post('/sessions', verifyToken, requireRole('instructor'), async (req, res, next) => {
  try {
    const { session_label, program_id } = req.body || {};
    const label = session_label && session_label.trim() ? session_label.trim() : null;
    const programId = await resolveProgramId(program_id, req.user.department_id);

    const { rows } = await pool.query(
      `INSERT INTO attendance_sessions (instructor_id, department_id, session_label, program_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, instructor_id, department_id, token, session_label, program_id, created_at, expires_at`,
      [req.user.id, req.user.department_id, label, programId]
    );

    await logActivity({
      department_id: req.user.department_id,
      actor_id: req.user.id,
      actor_name: req.user.name,
      action_type: 'attendance_session_created',
      entity_type: 'attendance_session',
      entity_id: rows[0].id,
      description: `${req.user.name} generated an attendance QR for ${label || 'a session'}`,
    });

    return res.status(201).json({ session: rows[0] });
  } catch (err) {
    return next(err);
  }
});

// GET /api/attendance/sessions — instructor only, own sessions
router.get('/sessions', verifyToken, requireRole('instructor'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.instructor_id, s.department_id, s.token, s.session_label,
              s.created_at, s.expires_at,
              (s.expires_at < NOW()) AS is_expired,
              COUNT(r.id)::int AS record_count
         FROM attendance_sessions s
         LEFT JOIN attendance_records r ON r.session_id = s.id
        WHERE s.instructor_id = $1
        GROUP BY s.id
        ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    return res.json({ sessions: rows });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/attendance/sessions/:id — rename a session (instructor owner)
router.patch('/sessions/:id', verifyToken, requireRole('instructor'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid session id' });

    const { session_label } = req.body || {};
    const label = session_label && session_label.trim() ? session_label.trim() : null;

    const { rows } = await pool.query(
      `UPDATE attendance_sessions SET session_label = $1
        WHERE id = $2 AND instructor_id = $3
        RETURNING id, instructor_id, department_id, token, session_label, created_at, expires_at`,
      [label, id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    return res.json({ session: rows[0] });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/attendance/sessions/:id — instructor owner (cascades records)
router.delete('/sessions/:id', verifyToken, requireRole('instructor'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid session id' });

    const { rowCount } = await pool.query(
      'DELETE FROM attendance_sessions WHERE id = $1 AND instructor_id = $2',
      [id, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Session not found' });
    return res.json({ message: 'Session deleted' });
  } catch (err) {
    return next(err);
  }
});

// GET /api/attendance/records-range?period=week|month — instructor: all attendance
// across this instructor's sessions within the current week or month (EAT).
router.get('/records-range', verifyToken, requireRole('instructor'), async (req, res, next) => {
  try {
    const period = req.query.period === 'month' ? 'month' : 'week';
    const trunc = period === 'month' ? 'month' : 'week';

    const { rows } = await pool.query(
      `SELECT r.id, r.trainee_name, r.trainee_phone, r.check_in,
              s.session_label, s.id AS session_id
         FROM attendance_records r
         JOIN attendance_sessions s ON s.id = r.session_id
        WHERE s.instructor_id = $1
          AND (r.check_in AT TIME ZONE 'Africa/Nairobi')
              >= date_trunc('${trunc}', (NOW() AT TIME ZONE 'Africa/Nairobi'))
        ORDER BY r.check_in ASC`,
      [req.user.id]
    );

    return res.json({
      period,
      department_name: req.user.department_name || null,
      records: rows,
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/attendance/sessions/supervisor-view — supervisor only, own department.
// Returns every attendance record (with check-in/check-out) across the
// department so supervisors can see all attendance regardless of confirmation.
router.get('/sessions/supervisor-view', verifyToken, requireRole('supervisor'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         ar.id,
         ar.trainee_name,
         ar.trainee_phone,
         ar.tasks_completed,
         ar.check_in,
         ar.check_out,
         ar.is_confirmed,
         ar.confirmed_at,
         ar.created_at,
         ats.id AS session_id,
         ats.session_label,
         ats.created_at AS session_date,
         ats.expires_at,
         u.name AS instructor_name,
         u.id AS instructor_id
       FROM attendance_records ar
       JOIN attendance_sessions ats ON ar.session_id = ats.id
       JOIN users u ON ats.instructor_id = u.id
       WHERE ats.department_id = $1
       ORDER BY ar.check_in DESC NULLS LAST`,
      [req.user.department_id]
    );
    return res.json({ records: rows });
  } catch (err) {
    return next(err);
  }
});

// GET /api/attendance/sessions/:id/records — instructor (own) or supervisor (dept)
router.get('/sessions/:id/records', verifyToken, requireRole('instructor', 'supervisor'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid session id' });

    // Scope the session by role.
    let sessionQuery;
    let params;
    if (req.user.role === 'instructor') {
      sessionQuery = `SELECT id, session_label, created_at, expires_at, instructor_id, department_id
                        FROM attendance_sessions
                       WHERE id = $1 AND instructor_id = $2`;
      params = [id, req.user.id];
    } else {
      sessionQuery = `SELECT id, session_label, created_at, expires_at, instructor_id, department_id
                        FROM attendance_sessions
                       WHERE id = $1 AND department_id = $2`;
      params = [id, req.user.department_id];
    }

    const sessionResult = await pool.query(sessionQuery, params);
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const { rows } = await pool.query(
      `SELECT id, session_id, trainee_name, trainee_phone, tasks_completed,
              check_in, check_out, is_confirmed, confirmed_by, confirmed_at, created_at
         FROM attendance_records
        WHERE session_id = $1
        ORDER BY check_in ASC`,
      [id]
    );

    return res.json({ session: sessionResult.rows[0], records: rows });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/attendance/records/:id/confirm — instructor only, own session
router.patch('/records/:id/confirm', verifyToken, requireRole('instructor'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid record id' });

    const { rows } = await pool.query(
      `UPDATE attendance_records r
          SET is_confirmed = true, confirmed_by = $2, confirmed_at = NOW()
         FROM attendance_sessions s
        WHERE r.id = $1
          AND r.session_id = s.id
          AND s.instructor_id = $2
        RETURNING r.id, r.session_id, r.trainee_name, r.trainee_phone, r.tasks_completed,
                  r.check_in, r.check_out, r.is_confirmed, r.confirmed_by, r.confirmed_at, r.created_at`,
      [id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Record not found in your sessions' });
    }

    await logActivity({
      department_id: req.user.department_id,
      actor_id: req.user.id,
      actor_name: req.user.name,
      action_type: 'attendance_confirmed',
      entity_type: 'attendance_record',
      entity_id: rows[0].id,
      description: `${req.user.name} confirmed attendance record for ${rows[0].trainee_name}`,
    });

    return res.json({ record: rows[0] });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/attendance/records/:id/checkout — PUBLIC, no auth.
// Called from the attachee check-out flow. Accepts an optional ISO 8601
// `check_out`; defaults to NOW() server-side when omitted.
router.patch('/records/:id/checkout', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid record id' });

    const { check_out } = req.body || {};
    let checkOutIso = null;
    if (check_out) {
      const parsed = new Date(check_out);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'Invalid check_out timestamp' });
      }
      checkOutIso = parsed.toISOString();
    }

    const { rows } = await pool.query(
      `UPDATE attendance_records
          SET check_out = COALESCE($1::timestamptz, NOW())
        WHERE id = $2
        RETURNING id, trainee_name, trainee_phone, tasks_completed,
                  check_in, check_out, is_confirmed, session_id`,
      [checkOutIso, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    return res.json({ record: rows[0] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
