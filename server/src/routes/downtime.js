'use strict';

const express = require('express');
const pool = require('../db/pool');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { notifyUser, notifyDepartmentSupervisors } = require('../lib/notify');
const logActivity = require('../utils/logActivity');

const router = express.Router();

const SEVERITIES = ['low', 'medium', 'high'];

/**
 * Guard: only the Communication department (has_radio_report = true) may use
 * downtime reporting. Enforced at the SQL level against the user's department.
 */
async function requireRadioDepartment(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT has_radio_report FROM departments WHERE id = $1`,
      [req.user.department_id]
    );
    if (rows.length === 0 || !rows[0].has_radio_report) {
      return res
        .status(403)
        .json({ error: 'Downtime reporting is only available to the Communication department.' });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

// GET /api/downtime — role-aware
router.get('/', verifyToken, requireRadioDepartment, async (req, res, next) => {
  try {
    if (req.user.role === 'instructor') {
      const { rows } = await pool.query(
        `SELECT id, instructor_id, frequency_band, description, severity, status,
                resolved_by, resolution_note, reported_at, resolved_at,
                is_escalated, escalated_at
           FROM downtime_reports
          WHERE instructor_id = $1
          ORDER BY reported_at DESC`,
        [req.user.id]
      );
      return res.json({ reports: rows });
    }

    // supervisor — all reports filed by instructors in their department
    const { rows } = await pool.query(
      `SELECT dr.id, dr.instructor_id, dr.frequency_band, dr.description, dr.severity, dr.status,
              dr.resolved_by, dr.resolution_note, dr.reported_at, dr.resolved_at,
              dr.is_escalated, dr.escalated_at,
              u.name AS instructor_name
         FROM downtime_reports dr
         JOIN users u ON u.id = dr.instructor_id
        WHERE u.department_id = $1
        ORDER BY dr.reported_at DESC`,
      [req.user.department_id]
    );
    return res.json({ reports: rows });
  } catch (err) {
    return next(err);
  }
});

// POST /api/downtime — instructor only
router.post('/', verifyToken, requireRadioDepartment, requireRole('instructor'), async (req, res, next) => {
  try {
    const { frequency_band, description, severity } = req.body || {};

    if (!frequency_band || !frequency_band.trim()) {
      return res.status(400).json({ error: 'Frequency band is required' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }
    if (!severity || !SEVERITIES.includes(severity)) {
      return res.status(400).json({ error: 'Severity must be one of: low, medium, high' });
    }

    const { rows } = await pool.query(
      `INSERT INTO downtime_reports (instructor_id, frequency_band, description, severity)
       VALUES ($1, $2, $3, $4)
       RETURNING id, instructor_id, frequency_band, description, severity, status,
                 resolved_by, resolution_note, reported_at, resolved_at`,
      [req.user.id, frequency_band.trim(), description.trim(), severity]
    );

    const report = rows[0];
    await notifyDepartmentSupervisors({
      departmentId: req.user.department_id,
      type: 'downtime_reported',
      title: 'New downtime report',
      body: `${req.user.name} reported ${report.severity} downtime on ${report.frequency_band}.`,
      link: '/downtime',
    });

    await logActivity({
      department_id: req.user.department_id,
      actor_id: req.user.id,
      actor_name: req.user.name,
      action_type: 'downtime_reported',
      entity_type: 'downtime_report',
      entity_id: report.id,
      description: `${req.user.name} reported a ${report.severity} downtime on ${report.frequency_band}`,
    });

    return res.status(201).json({ report });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/downtime/:id/resolve — supervisor only, own department
router.patch('/:id/resolve', verifyToken, requireRadioDepartment, requireRole('supervisor'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid report id' });

    const { resolution_note } = req.body || {};
    if (!resolution_note || !resolution_note.trim()) {
      return res.status(400).json({ error: 'A resolution note is required' });
    }

    const { rows } = await pool.query(
      `UPDATE downtime_reports dr
          SET status = 'resolved', resolved_by = $2,
              resolution_note = $3, resolved_at = NOW()
         FROM users u
        WHERE dr.id = $1
          AND dr.instructor_id = u.id
          AND u.department_id = $4
        RETURNING dr.id, dr.instructor_id, dr.frequency_band, dr.description, dr.severity,
                  dr.status, dr.resolved_by, dr.resolution_note, dr.reported_at, dr.resolved_at`,
      [id, req.user.id, resolution_note.trim(), req.user.department_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Report not found in your department' });
    }

    const report = rows[0];
    await notifyUser({
      userId: report.instructor_id,
      type: 'downtime_resolved',
      title: 'Downtime report resolved',
      body: `Your report on ${report.frequency_band} was marked resolved.`,
      link: '/downtime',
    });

    await logActivity({
      department_id: req.user.department_id,
      actor_id: req.user.id,
      actor_name: req.user.name,
      action_type: 'downtime_resolved',
      entity_type: 'downtime_report',
      entity_id: report.id,
      description: `${req.user.name} resolved the downtime report for ${report.frequency_band}`,
    });

    return res.json({ report });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
