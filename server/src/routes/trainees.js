'use strict';

const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const pool = require('../db/pool');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const logActivity = require('../utils/logActivity');

const router = express.Router();

const KENYAN_PHONE_RE = /^0(7|1)\d{8}$/;

// In-memory CSV upload (small files only) for the bulk-import endpoint.
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

// GET /api/trainees — instructor or supervisor, own department
router.get('/', verifyToken, requireRole('instructor', 'supervisor'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, phone, department_id, added_by, is_active, created_at
         FROM trainees
        WHERE department_id = $1
        ORDER BY name`,
      [req.user.department_id]
    );
    return res.json({ trainees: rows });
  } catch (err) {
    return next(err);
  }
});

// POST /api/trainees — instructor only
router.post('/', verifyToken, requireRole('instructor'), async (req, res, next) => {
  try {
    const { name, phone } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!phone || !phone.trim()) return res.status(400).json({ error: 'Phone is required' });
    if (!KENYAN_PHONE_RE.test(phone.trim())) {
      return res.status(400).json({ error: 'Phone must be a valid Kenyan number (e.g. 07XXXXXXXX or 01XXXXXXXX)' });
    }

    const { rows } = await pool.query(
      `INSERT INTO trainees (name, phone, department_id, added_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, phone, department_id, added_by, is_active, created_at`,
      [name.trim(), phone.trim(), req.user.department_id, req.user.id]
    );

    await logActivity({
      department_id: req.user.department_id,
      actor_id: req.user.id,
      actor_name: req.user.name,
      action_type: 'attachee_added',
      entity_type: 'trainee',
      entity_id: rows[0].id,
      description: `${req.user.name} registered attachee ${rows[0].name}`,
    });

    return res.status(201).json({ trainee: rows[0] });
  } catch (err) {
    return next(err);
  }
});

// POST /api/trainees/bulk-import — supervisor only, CSV upload (field: csv_file)
router.post(
  '/bulk-import',
  verifyToken,
  requireRole('supervisor', 'instructor'),
  csvUpload.single('csv_file'),
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      if (!req.file) return res.status(400).json({ error: 'A CSV file is required' });

      let records;
      try {
        records = parse(req.file.buffer.toString('utf8'), {
          columns: (header) => header.map((h) => h.trim().toLowerCase()),
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
        });
      } catch (parseErr) {
        return res.status(400).json({ error: `Could not parse CSV: ${parseErr.message}` });
      }

      // Existing phones in this department are skipped, not errored.
      const existing = await client.query(
        'SELECT phone FROM trainees WHERE department_id = $1',
        [req.user.department_id]
      );
      const existingPhones = new Set(existing.rows.map((r) => r.phone));

      const seenInCsv = new Set();
      const errors = [];
      const valid = [];
      let skipped = 0;

      records.forEach((row, i) => {
        const rowNum = i + 2; // +1 for header, +1 for 1-based
        const name = (row.name || '').trim();
        const phone = (row.phone || '').trim();

        if (!name) {
          errors.push({ row: rowNum, name, phone, reason: 'Missing name' });
          return;
        }
        if (!KENYAN_PHONE_RE.test(phone)) {
          errors.push({ row: rowNum, name, phone, reason: 'Invalid phone (must be 07xxxxxxxx or 01xxxxxxxx)' });
          return;
        }
        if (seenInCsv.has(phone)) {
          errors.push({ row: rowNum, name, phone, reason: 'Duplicate phone within the CSV' });
          return;
        }
        seenInCsv.add(phone);
        if (existingPhones.has(phone)) {
          skipped += 1;
          return;
        }
        valid.push({ name, phone });
      });

      let imported = 0;
      if (valid.length > 0) {
        await client.query('BEGIN');
        try {
          for (const v of valid) {
            await client.query(
              `INSERT INTO trainees (name, phone, department_id, added_by)
               VALUES ($1, $2, $3, $4)`,
              [v.name, v.phone, req.user.department_id, req.user.id]
            );
            imported += 1;
          }
          await client.query('COMMIT');
        } catch (txErr) {
          await client.query('ROLLBACK');
          throw txErr;
        }
      }

      if (imported > 0) {
        await logActivity({
          department_id: req.user.department_id,
          actor_id: req.user.id,
          actor_name: req.user.name,
          action_type: 'bulk_import',
          entity_type: 'trainee',
          entity_id: null,
          description: `${req.user.name} bulk imported ${imported} attachees`,
        });
      }

      return res.json({ imported, skipped, errors });
    } catch (err) {
      return next(err);
    } finally {
      client.release();
    }
  }
);

// DELETE /api/trainees/:id — soft delete, same department only
router.delete('/:id', verifyToken, requireRole('instructor'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid trainee id' });

    const { rows } = await pool.query(
      `UPDATE trainees
          SET is_active = false
        WHERE id = $1 AND department_id = $2
        RETURNING id, name, phone, department_id, added_by, is_active, created_at`,
      [id, req.user.department_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Trainee not found in your department' });
    }

    return res.json({ trainee: rows[0] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
