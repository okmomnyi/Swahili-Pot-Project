'use strict';

const express = require('express');
const pool = require('../db/pool');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const logActivity = require('../utils/logActivity');

const router = express.Router();

const SELECT = `sl.id, sl.instructor_id, sl.department_id, sl.session_date, sl.topics_covered,
  sl.challenges, sl.next_session_plan, sl.attendance_count, sl.program_id,
  sl.created_at, sl.updated_at, u.name AS instructor_name`;

// Build an optional "?month=YYYY-MM" filter clause.
function monthFilter(month, params) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return '';
  params.push(`${month}-01`);
  const idx = params.length;
  return ` AND date_trunc('month', sl.session_date) = date_trunc('month', $${idx}::date)`;
}

// GET /api/session-logs — instructor (own) or supervisor (department)
router.get('/', verifyToken, requireRole('instructor', 'supervisor'), async (req, res, next) => {
  try {
    const params = [];
    let where;
    if (req.user.role === 'instructor') {
      params.push(req.user.id);
      where = 'sl.instructor_id = $1';
    } else {
      params.push(req.user.department_id);
      where = 'sl.department_id = $1';
    }
    where += monthFilter(req.query.month, params);

    const { rows } = await pool.query(
      `SELECT ${SELECT}
         FROM session_logs sl
         JOIN users u ON u.id = sl.instructor_id
        WHERE ${where}
        ORDER BY sl.session_date DESC`,
      params
    );
    return res.json({ logs: rows });
  } catch (err) {
    return next(err);
  }
});

// POST /api/session-logs — instructor only
router.post('/', verifyToken, requireRole('instructor'), async (req, res, next) => {
  try {
    const { session_date, topics_covered, challenges, next_session_plan, attendance_count, program_id } =
      req.body || {};

    if (!session_date) return res.status(400).json({ error: 'Session date is required' });
    if (!topics_covered || !topics_covered.trim()) {
      return res.status(400).json({ error: 'Topics covered is required' });
    }
    const when = new Date(session_date);
    if (Number.isNaN(when.getTime())) return res.status(400).json({ error: 'Invalid session date' });

    // One log per instructor per date.
    const dup = await pool.query(
      'SELECT id FROM session_logs WHERE instructor_id = $1 AND session_date = $2',
      [req.user.id, session_date]
    );
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: 'A log already exists for this date. Edit the existing one instead.' });
    }

    let programId = null;
    if (program_id) {
      const pid = parseInt(program_id, 10);
      if (!Number.isNaN(pid)) {
        const prog = await pool.query(
          'SELECT id FROM programs WHERE id = $1 AND department_id = $2',
          [pid, req.user.department_id]
        );
        if (prog.rows.length) programId = pid;
      }
    }

    const count =
      attendance_count === undefined || attendance_count === null || attendance_count === ''
        ? null
        : parseInt(attendance_count, 10);

    const { rows } = await pool.query(
      `INSERT INTO session_logs
         (instructor_id, department_id, session_date, topics_covered, challenges, next_session_plan, attendance_count, program_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        req.user.id,
        req.user.department_id,
        session_date,
        topics_covered.trim(),
        challenges && challenges.trim() ? challenges.trim() : null,
        next_session_plan && next_session_plan.trim() ? next_session_plan.trim() : null,
        Number.isNaN(count) ? null : count,
        programId,
      ]
    );

    const { rows: full } = await pool.query(
      `SELECT ${SELECT} FROM session_logs sl JOIN users u ON u.id = sl.instructor_id WHERE sl.id = $1`,
      [rows[0].id]
    );

    await logActivity({
      department_id: req.user.department_id,
      actor_id: req.user.id,
      actor_name: req.user.name,
      action_type: 'session_log_posted',
      entity_type: 'session_log',
      entity_id: rows[0].id,
      description: `${req.user.name} posted a session log for ${session_date}`,
    });

    return res.status(201).json({ log: full[0] });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/session-logs/:id — instructor, own logs only
router.patch('/:id', verifyToken, requireRole('instructor'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid log id' });

    const { topics_covered, challenges, next_session_plan, attendance_count } = req.body || {};

    let count;
    if (attendance_count !== undefined) {
      count =
        attendance_count === null || attendance_count === ''
          ? null
          : parseInt(attendance_count, 10);
      if (Number.isNaN(count)) count = null;
    }

    const { rows } = await pool.query(
      `UPDATE session_logs
          SET topics_covered = COALESCE($1, topics_covered),
              challenges = CASE WHEN $2::boolean THEN $3 ELSE challenges END,
              next_session_plan = CASE WHEN $4::boolean THEN $5 ELSE next_session_plan END,
              attendance_count = CASE WHEN $6::boolean THEN $7 ELSE attendance_count END,
              updated_at = NOW()
        WHERE id = $8 AND instructor_id = $9
        RETURNING id`,
      [
        topics_covered && topics_covered.trim() ? topics_covered.trim() : null,
        challenges !== undefined,
        challenges && challenges.trim() ? challenges.trim() : null,
        next_session_plan !== undefined,
        next_session_plan && next_session_plan.trim() ? next_session_plan.trim() : null,
        attendance_count !== undefined,
        count ?? null,
        id,
        req.user.id,
      ]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Log not found' });

    const { rows: full } = await pool.query(
      `SELECT ${SELECT} FROM session_logs sl JOIN users u ON u.id = sl.instructor_id WHERE sl.id = $1`,
      [id]
    );
    return res.json({ log: full[0] });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/session-logs/:id — instructor, own logs only
router.delete('/:id', verifyToken, requireRole('instructor'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid log id' });

    const { rowCount } = await pool.query(
      'DELETE FROM session_logs WHERE id = $1 AND instructor_id = $2',
      [id, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Log not found' });
    return res.json({ message: 'Log deleted' });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
