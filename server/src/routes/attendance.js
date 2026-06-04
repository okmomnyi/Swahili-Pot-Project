'use strict';

const express = require('express');
const pool = require('../db/pool');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

// POST /api/attendance/sessions — instructor only
router.post('/sessions', verifyToken, requireRole('instructor'), async (req, res, next) => {
  try {
    const { session_label } = req.body || {};
    const label = session_label && session_label.trim() ? session_label.trim() : null;

    const { rows } = await pool.query(
      `INSERT INTO attendance_sessions (instructor_id, department_id, session_label)
       VALUES ($1, $2, $3)
       RETURNING id, instructor_id, department_id, token, session_label, created_at, expires_at`,
      [req.user.id, req.user.department_id, label]
    );

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

// GET /api/attendance/sessions/supervisor-view — supervisor only, own department
router.get('/sessions/supervisor-view', verifyToken, requireRole('supervisor'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.session_label, s.created_at, s.expires_at,
              (s.expires_at < NOW()) AS is_expired,
              u.name AS instructor_name,
              COUNT(r.id)::int AS record_count
         FROM attendance_sessions s
         JOIN users u ON u.id = s.instructor_id
         LEFT JOIN attendance_records r ON r.session_id = s.id
        WHERE s.department_id = $1
        GROUP BY s.id, u.name
        ORDER BY s.created_at DESC`,
      [req.user.department_id]
    );
    return res.json({ sessions: rows });
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

    return res.json({ record: rows[0] });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/attendance/records/:id/checkout — PUBLIC, no auth
router.patch('/records/:id/checkout', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid record id' });

    const { check_out } = req.body || {};
    const checkOutTime = check_out ? new Date(check_out) : new Date();
    if (Number.isNaN(checkOutTime.getTime())) {
      return res.status(400).json({ error: 'Invalid check_out timestamp' });
    }

    const { rows } = await pool.query(
      `UPDATE attendance_records
          SET check_out = $2
        WHERE id = $1
        RETURNING id, session_id, trainee_name, trainee_phone, tasks_completed,
                  check_in, check_out, is_confirmed, created_at`,
      [id, checkOutTime.toISOString()]
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
