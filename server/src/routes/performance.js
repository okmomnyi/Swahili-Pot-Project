'use strict';

const express = require('express');
const pool = require('../db/pool');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

// Monday of a given ISO week number (UTC).
function isoWeekMonday(year, week) {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const monday = new Date(simple);
  if (dow <= 4) monday.setUTCDate(simple.getUTCDate() - dow + 1);
  else monday.setUTCDate(simple.getUTCDate() + 8 - dow);
  return monday;
}

function mondayOfCurrentWeek() {
  const now = new Date();
  const dow = now.getUTCDay() || 7; // 1..7, Monday=1
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - (dow - 1));
  return monday;
}

const iso = (d) => d.toISOString().slice(0, 10);

// Resolve [start, end) date bounds and a label from query params.
function resolveBounds({ period, month, week }) {
  const validMonth = /^\d{4}-\d{2}$/.test(month || '');
  const now = new Date();

  if (period === 'weekly') {
    const year = validMonth ? parseInt(month.slice(0, 4), 10) : now.getUTCFullYear();
    const wk = parseInt(week, 10);
    const monday = !Number.isNaN(wk) ? isoWeekMonday(year, wk) : mondayOfCurrentWeek();
    const end = new Date(monday);
    end.setUTCDate(monday.getUTCDate() + 7);
    return { start: iso(monday), end: iso(end), label: `week-${iso(monday)}` };
  }

  // monthly (default)
  const monthStr = validMonth ? month : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const [y, m] = monthStr.split('-').map((n) => parseInt(n, 10));
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start: iso(start), end: iso(end), label: monthStr };
}

// Core computation — one row per attachee, all in SQL (no JS loops).
async function computeSummary(departmentId, start, end) {
  const { rows } = await pool.query(
    `SELECT
       u.id,
       u.name,
       COALESCE(att.days_attended, 0) AS days_attended,
       COALESCE(tk.tasks_assigned, 0) AS tasks_assigned,
       COALESCE(tk.tasks_submitted, 0) AS tasks_submitted,
       COALESCE(tk.tasks_reviewed, 0) AS tasks_reviewed,
       CASE WHEN COALESCE(tk.tasks_assigned, 0) = 0 THEN NULL
            ELSE ROUND(tk.tasks_submitted::numeric / tk.tasks_assigned * 100, 1)
       END AS completion_rate
     FROM users u
     LEFT JOIN (
       SELECT c.attachee_id,
              COUNT(DISTINCT (c.check_in AT TIME ZONE 'Africa/Nairobi')::date) AS days_attended
         FROM attachee_checkins c
        WHERE (c.check_in AT TIME ZONE 'Africa/Nairobi')::date >= $2::date
          AND (c.check_in AT TIME ZONE 'Africa/Nairobi')::date < $3::date
        GROUP BY c.attachee_id
     ) att ON att.attachee_id = u.id
     LEFT JOIN (
       SELECT t.assigned_to,
              COUNT(*) AS tasks_assigned,
              COUNT(*) FILTER (WHERE t.status IN ('submitted', 'reviewed', 'completed')) AS tasks_submitted,
              COUNT(*) FILTER (WHERE t.status IN ('reviewed', 'completed')) AS tasks_reviewed
         FROM tasks t
        WHERE (t.created_at AT TIME ZONE 'Africa/Nairobi')::date >= $2::date
          AND (t.created_at AT TIME ZONE 'Africa/Nairobi')::date < $3::date
        GROUP BY t.assigned_to
     ) tk ON tk.assigned_to = u.id
     WHERE u.role = 'attachee' AND u.department_id = $1 AND u.is_active = true
     ORDER BY days_attended DESC, completion_rate DESC NULLS LAST, u.name`,
    [departmentId, start, end]
  );
  return rows;
}

// GET /api/performance/summary — supervisor only
router.get('/summary', verifyToken, requireRole('supervisor'), async (req, res, next) => {
  try {
    const { period, month, week } = req.query;
    const { start, end, label } = resolveBounds({ period, month, week });
    const summary = await computeSummary(req.user.department_id, start, end);
    return res.json({ period: period === 'weekly' ? 'weekly' : 'monthly', label, start, end, summary });
  } catch (err) {
    return next(err);
  }
});

// GET /api/performance/summary/export — supervisor only, CSV download
router.get('/summary/export', verifyToken, requireRole('supervisor'), async (req, res, next) => {
  try {
    const { period, month, week } = req.query;
    const { start, end, label } = resolveBounds({ period, month, week });
    const summary = await computeSummary(req.user.department_id, start, end);

    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const header = 'Name,Phone,Days Attended,Tasks Assigned,Tasks Submitted,Tasks Reviewed,Completion Rate (%)';
    const lines = summary.map((r) =>
      [
        esc(r.name),
        '', // attachee user accounts have no phone on record
        r.days_attended,
        r.tasks_assigned,
        r.tasks_submitted,
        r.tasks_reviewed,
        r.completion_rate == null ? '' : r.completion_rate,
      ].join(',')
    );
    const csv = [header, ...lines].join('\n');

    const deptSlug = (req.user.department_name || `dept${req.user.department_id}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="performance-${label}-${deptSlug}.csv"`);
    return res.send(csv);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
