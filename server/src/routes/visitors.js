'use strict';

const express = require('express');
const pool = require('../db/pool');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

const SELECT = `v.id, v.department_id, v.logged_by, v.visitor_name, v.visitor_phone,
  v.purpose, v.person_visiting, v.time_in, v.time_out, v.created_at,
  u.name AS logged_by_name`;

// GET /api/visitors?date=YYYY-MM-DD — supervisor/admin (admin sees all depts)
router.get('/', verifyToken, requireRole('supervisor', 'admin'), async (req, res, next) => {
  try {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '')
      ? req.query.date
      : null; // null => today (EAT)

    const params = [];
    let where = `(v.time_in AT TIME ZONE 'Africa/Nairobi')::date = ` +
      (date ? `$1::date` : `(NOW() AT TIME ZONE 'Africa/Nairobi')::date`);
    if (date) params.push(date);

    // System admins see all departments; supervisors are scoped to theirs.
    if (req.user.role === 'supervisor') {
      params.push(req.user.department_id);
      where += ` AND v.department_id = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT ${SELECT}
         FROM visitor_log v
         JOIN users u ON u.id = v.logged_by
        WHERE ${where}
        ORDER BY v.time_in ASC`,
      params
    );
    return res.json({ visitors: rows });
  } catch (err) {
    return next(err);
  }
});

// POST /api/visitors — supervisor, instructor or admin
router.post('/', verifyToken, requireRole('supervisor', 'instructor', 'admin'), async (req, res, next) => {
  try {
    const { visitor_name, visitor_phone, purpose, person_visiting } = req.body || {};
    if (!visitor_name || !visitor_name.trim()) return res.status(400).json({ error: 'Visitor name is required' });
    if (!purpose || !purpose.trim()) return res.status(400).json({ error: 'Purpose is required' });

    // Admins may have no department; fall back to null is not allowed (NOT NULL).
    if (!req.user.department_id) {
      return res.status(400).json({ error: 'Your account is not attached to a department' });
    }

    const { rows } = await pool.query(
      `INSERT INTO visitor_log (department_id, logged_by, visitor_name, visitor_phone, purpose, person_visiting)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        req.user.department_id,
        req.user.id,
        visitor_name.trim(),
        visitor_phone && visitor_phone.trim() ? visitor_phone.trim() : null,
        purpose.trim(),
        person_visiting && person_visiting.trim() ? person_visiting.trim() : null,
      ]
    );

    const { rows: full } = await pool.query(
      `SELECT ${SELECT} FROM visitor_log v JOIN users u ON u.id = v.logged_by WHERE v.id = $1`,
      [rows[0].id]
    );
    return res.status(201).json({ visitor: full[0] });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/visitors/:id/checkout — department-scoped, sets time_out
router.patch('/:id/checkout', verifyToken, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid visitor id' });

    // Admins (no department) may check out any entry; others are dept-scoped.
    const params = [id];
    let scope = '';
    if (req.user.role !== 'admin') {
      params.push(req.user.department_id);
      scope = ' AND department_id = $2';
    }

    const { rows } = await pool.query(
      `UPDATE visitor_log SET time_out = NOW()
        WHERE id = $1${scope}
        RETURNING id, department_id, logged_by, visitor_name, visitor_phone,
                  purpose, person_visiting, time_in, time_out, created_at`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Visitor entry not found' });
    return res.json({ visitor: rows[0] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
