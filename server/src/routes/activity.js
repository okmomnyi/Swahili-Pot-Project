'use strict';

const express = require('express');
const pool = require('../db/pool');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

// GET /api/activity — supervisor only, recent activity in their department
router.get('/', verifyToken, requireRole('supervisor'), async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);

    const { rows } = await pool.query(
      `SELECT id, actor_name, action_type, entity_type, entity_id, description, created_at
         FROM activity_log
        WHERE department_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [req.user.department_id, limit]
    );

    return res.json({ activity: rows });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
