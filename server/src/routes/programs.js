'use strict';

const express = require('express');
const pool = require('../db/pool');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

const SELECT = `p.id, p.department_id, p.created_by, p.name, p.description,
  p.start_date, p.end_date, p.is_active, p.created_at,
  (SELECT COUNT(*)::int FROM program_enrollments pe WHERE pe.program_id = p.id) AS enrolled_count`;

// GET /api/programs — everyone in the department
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${SELECT}
         FROM programs p
        WHERE p.department_id = $1
        ORDER BY p.is_active DESC, p.start_date DESC`,
      [req.user.department_id]
    );
    return res.json({ programs: rows });
  } catch (err) {
    return next(err);
  }
});

// POST /api/programs — supervisor only
router.post('/', verifyToken, requireRole('supervisor'), async (req, res, next) => {
  try {
    const { name, description, start_date, end_date } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!start_date) return res.status(400).json({ error: 'Start date is required' });

    const { rows } = await pool.query(
      `INSERT INTO programs (department_id, created_by, name, description, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        req.user.department_id,
        req.user.id,
        name.trim(),
        description && description.trim() ? description.trim() : null,
        start_date,
        end_date || null,
      ]
    );

    const { rows: full } = await pool.query(`SELECT ${SELECT} FROM programs p WHERE p.id = $1`, [rows[0].id]);
    return res.status(201).json({ program: full[0] });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/programs/:id — supervisor only, department-scoped
router.patch('/:id', verifyToken, requireRole('supervisor'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid program id' });

    const { name, description, start_date, end_date, is_active } = req.body || {};

    const { rows } = await pool.query(
      `UPDATE programs
          SET name = COALESCE($1, name),
              description = CASE WHEN $2::boolean THEN $3 ELSE description END,
              start_date = COALESCE($4, start_date),
              end_date = CASE WHEN $5::boolean THEN $6 ELSE end_date END,
              is_active = COALESCE($7, is_active)
        WHERE id = $8 AND department_id = $9
        RETURNING id`,
      [
        name && name.trim() ? name.trim() : null,
        description !== undefined,
        description && description.trim() ? description.trim() : null,
        start_date || null,
        end_date !== undefined,
        end_date || null,
        typeof is_active === 'boolean' ? is_active : null,
        id,
        req.user.department_id,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Program not found' });

    const { rows: full } = await pool.query(`SELECT ${SELECT} FROM programs p WHERE p.id = $1`, [id]);
    return res.json({ program: full[0] });
  } catch (err) {
    return next(err);
  }
});

// Confirm a program belongs to the requester's department.
async function programInDept(id, departmentId) {
  const { rows } = await pool.query(
    'SELECT id FROM programs WHERE id = $1 AND department_id = $2',
    [id, departmentId]
  );
  return rows.length > 0;
}

// POST /api/programs/:id/enroll — supervisor or instructor
router.post('/:id/enroll', verifyToken, requireRole('supervisor', 'instructor'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid program id' });
    if (!(await programInDept(id, req.user.department_id))) {
      return res.status(404).json({ error: 'Program not found' });
    }

    const { trainee_ids } = req.body || {};
    if (!Array.isArray(trainee_ids) || trainee_ids.length === 0) {
      return res.status(400).json({ error: 'trainee_ids must be a non-empty array' });
    }

    // Only trainees in the same department may be enrolled.
    const { rows: valid } = await pool.query(
      `SELECT id FROM trainees WHERE id = ANY($1::int[]) AND department_id = $2`,
      [trainee_ids.map((t) => parseInt(t, 10)).filter((n) => !Number.isNaN(n)), req.user.department_id]
    );

    let enrolled = 0;
    for (const t of valid) {
      const r = await pool.query(
        `INSERT INTO program_enrollments (program_id, trainee_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, t.id]
      );
      enrolled += r.rowCount;
    }

    return res.json({ enrolled });
  } catch (err) {
    return next(err);
  }
});

// GET /api/programs/:id/enrollments — department-scoped
router.get('/:id/enrollments', verifyToken, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid program id' });
    if (!(await programInDept(id, req.user.department_id))) {
      return res.status(404).json({ error: 'Program not found' });
    }

    const { rows } = await pool.query(
      `SELECT pe.id, pe.trainee_id, pe.enrolled_at, t.name, t.phone
         FROM program_enrollments pe
         JOIN trainees t ON t.id = pe.trainee_id
        WHERE pe.program_id = $1
        ORDER BY t.name`,
      [id]
    );
    return res.json({ enrollments: rows });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/programs/:id/enrollments/:trainee_id — supervisor only
router.delete('/:id/enrollments/:trainee_id', verifyToken, requireRole('supervisor'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const traineeId = parseInt(req.params.trainee_id, 10);
    if (Number.isNaN(id) || Number.isNaN(traineeId)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    if (!(await programInDept(id, req.user.department_id))) {
      return res.status(404).json({ error: 'Program not found' });
    }

    await pool.query(
      'DELETE FROM program_enrollments WHERE program_id = $1 AND trainee_id = $2',
      [id, traineeId]
    );
    return res.json({ message: 'Enrollment removed' });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
