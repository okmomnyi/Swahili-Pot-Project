'use strict';

const express = require('express');
const pool = require('../db/pool');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const logActivity = require('../utils/logActivity');

const router = express.Router();

const SELECT = `a.id, a.title, a.body, a.is_pinned, a.expires_at, a.created_at, a.updated_at,
  u.name AS posted_by_name, a.posted_by`;

// GET /api/announcements — everyone in the department, non-expired only
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${SELECT}
         FROM announcements a
         JOIN users u ON u.id = a.posted_by
        WHERE a.department_id = $1
          AND (a.expires_at IS NULL OR a.expires_at >= NOW())
        ORDER BY a.is_pinned DESC, a.created_at DESC`,
      [req.user.department_id]
    );
    return res.json({ announcements: rows });
  } catch (err) {
    return next(err);
  }
});

// POST /api/announcements — supervisor only
router.post('/', verifyToken, requireRole('supervisor'), async (req, res, next) => {
  try {
    const { title, body, is_pinned, expires_at } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
    if (!body || !body.trim()) return res.status(400).json({ error: 'Body is required' });

    let expiry = null;
    if (expires_at) {
      const parsed = new Date(expires_at);
      if (Number.isNaN(parsed.getTime())) return res.status(400).json({ error: 'Invalid expiry date' });
      expiry = parsed.toISOString();
    }

    const { rows } = await pool.query(
      `INSERT INTO announcements (department_id, posted_by, title, body, is_pinned, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [req.user.department_id, req.user.id, title.trim(), body.trim(), is_pinned === true, expiry]
    );

    const { rows: full } = await pool.query(
      `SELECT ${SELECT} FROM announcements a JOIN users u ON u.id = a.posted_by WHERE a.id = $1`,
      [rows[0].id]
    );

    await logActivity({
      department_id: req.user.department_id,
      actor_id: req.user.id,
      actor_name: req.user.name,
      action_type: 'announcement_posted',
      entity_type: 'announcement',
      entity_id: rows[0].id,
      description: `${req.user.name} posted an announcement: ${title.trim()}`,
    });

    return res.status(201).json({ announcement: full[0] });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/announcements/:id — supervisor in the same department
router.patch('/:id', verifyToken, requireRole('supervisor'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid announcement id' });

    const { title, body, is_pinned, expires_at } = req.body || {};

    let expiry; // undefined => leave unchanged
    if (expires_at !== undefined) {
      if (expires_at === null || expires_at === '') {
        expiry = null;
      } else {
        const parsed = new Date(expires_at);
        if (Number.isNaN(parsed.getTime())) return res.status(400).json({ error: 'Invalid expiry date' });
        expiry = parsed.toISOString();
      }
    }

    const { rows } = await pool.query(
      `UPDATE announcements
          SET title = COALESCE($1, title),
              body = COALESCE($2, body),
              is_pinned = COALESCE($3, is_pinned),
              expires_at = CASE WHEN $4::boolean THEN $5::timestamptz ELSE expires_at END,
              updated_at = NOW()
        WHERE id = $6 AND department_id = $7
        RETURNING id`,
      [
        title && title.trim() ? title.trim() : null,
        body && body.trim() ? body.trim() : null,
        typeof is_pinned === 'boolean' ? is_pinned : null,
        expires_at !== undefined,
        expiry ?? null,
        id,
        req.user.department_id,
      ]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Announcement not found in your department' });

    const { rows: full } = await pool.query(
      `SELECT ${SELECT} FROM announcements a JOIN users u ON u.id = a.posted_by WHERE a.id = $1`,
      [id]
    );
    return res.json({ announcement: full[0] });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/announcements/:id — supervisor in the same department
router.delete('/:id', verifyToken, requireRole('supervisor'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid announcement id' });

    const { rowCount } = await pool.query(
      'DELETE FROM announcements WHERE id = $1 AND department_id = $2',
      [id, req.user.department_id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Announcement not found in your department' });

    return res.json({ message: 'Announcement deleted' });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
