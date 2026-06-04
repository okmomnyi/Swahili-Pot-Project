'use strict';

// Public, unauthenticated attendance routes used by trainees scanning a QR code.
// These routes MUST NOT require any cookie or Authorization header.

const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/attend/:token — resolve a session by its public token
router.get('/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const { rows } = await pool.query(
      `SELECT s.id AS session_id, s.session_label, s.expires_at,
              d.name AS department_name, u.name AS instructor_name
         FROM attendance_sessions s
         JOIN departments d ON d.id = s.department_id
         JOIN users u ON u.id = s.instructor_id
        WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'This attendance link has expired or is invalid.' });
    }

    return res.json(rows[0]);
  } catch (err) {
    // Malformed UUID raises a PG error — treat as not found rather than 500.
    if (err && err.code === '22P02') {
      return res.status(404).json({ error: 'This attendance link has expired or is invalid.' });
    }
    return next(err);
  }
});

// POST /api/attend/:token — trainee checks in
router.post('/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    // Trainees enter only their name and phone — the check-in time is recorded
    // automatically by the server (East Africa Time on display).
    const { trainee_name, trainee_phone } = req.body || {};

    if (!trainee_name || !trainee_name.trim()) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    if (!trainee_phone || !trainee_phone.trim()) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const sessionResult = await pool.query(
      `SELECT id FROM attendance_sessions
        WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'This attendance link has expired or is invalid.' });
    }

    const sessionId = sessionResult.rows[0].id;

    const { rows } = await pool.query(
      `INSERT INTO attendance_records (session_id, trainee_name, trainee_phone, check_in)
       VALUES ($1, $2, $3, NOW())
       RETURNING id AS record_id, trainee_name, check_in`,
      [sessionId, trainee_name.trim(), trainee_phone.trim()]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err && err.code === '22P02') {
      return res.status(404).json({ error: 'This attendance link has expired or is invalid.' });
    }
    return next(err);
  }
});

module.exports = router;
