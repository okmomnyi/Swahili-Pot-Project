'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const logActivity = require('../utils/logActivity');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/users/instructors — supervisor only, own department
router.get('/instructors', verifyToken, requireRole('supervisor'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.is_active, u.created_at, d.name AS department_name
         FROM users u
         JOIN departments d ON d.id = u.department_id
        WHERE u.role = 'instructor' AND u.department_id = $1
        ORDER BY u.name`,
      [req.user.department_id]
    );
    return res.json({ instructors: rows });
  } catch (err) {
    return next(err);
  }
});

// POST /api/users/instructors — supervisor only
router.post('/instructors', verifyToken, requireRole('supervisor'), async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!email || !email.trim()) return res.status(400).json({ error: 'Email is required' });
    if (!EMAIL_RE.test(email.trim())) return res.status(400).json({ error: 'A valid email is required' });
    if (!password) return res.status(400).json({ error: 'Password is required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, department_id)
       VALUES ($1, $2, $3, 'instructor', $4)
       RETURNING id, name, email, role, department_id, is_active, created_at`,
      [name.trim(), normalizedEmail, passwordHash, req.user.department_id]
    );

    await logActivity({
      department_id: req.user.department_id,
      actor_id: req.user.id,
      actor_name: req.user.name,
      action_type: 'instructor_added',
      entity_type: 'user',
      entity_id: rows[0].id,
      description: `Supervisor ${req.user.name} added instructor ${rows[0].name} to the department`,
    });

    return res.status(201).json({ instructor: rows[0] });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/users/instructors/:id/toggle — supervisor only, same department
router.patch('/instructors/:id/toggle', verifyToken, requireRole('supervisor'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid instructor id' });

    const { rows } = await pool.query(
      `UPDATE users
          SET is_active = NOT is_active
        WHERE id = $1 AND role = 'instructor' AND department_id = $2
        RETURNING id, name, email, role, department_id, is_active, created_at`,
      [id, req.user.department_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Instructor not found in your department' });
    }

    return res.json({ instructor: rows[0] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
