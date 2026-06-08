'use strict';

const cron = require('node-cron');
const pool = require('../db/pool');
const { notifyUser } = require('../lib/notify');
const logActivity = require('../utils/logActivity');

/**
 * Escalate open downtime reports that have stayed unresolved for over 2 hours.
 *
 * downtime_reports has no department_id column, so the owning department is
 * resolved through the reporting instructor. Notifications reuse the existing
 * `notifications` table (no separate system_notifications table needed).
 */
async function runEscalationPass() {
  const { rows: stale } = await pool.query(`
    SELECT
      dr.id,
      dr.frequency_band,
      dr.instructor_id,
      u.name AS instructor_name,
      u.department_id
    FROM downtime_reports dr
    JOIN users u ON dr.instructor_id = u.id
    WHERE dr.status = 'open'
      AND dr.is_escalated = false
      AND dr.reported_at < NOW() - INTERVAL '2 hours'
  `);

  for (const report of stale) {
    await pool.query(
      `UPDATE downtime_reports
          SET is_escalated = true, escalated_at = NOW()
        WHERE id = $1`,
      [report.id]
    );

    // Notify every active system admin.
    const { rows: admins } = await pool.query(
      "SELECT id FROM users WHERE role = 'admin' AND is_active = true"
    );
    for (const admin of admins) {
      await notifyUser({
        userId: admin.id,
        type: 'downtime_escalated',
        title: 'Downtime Report Escalated',
        body: `A downtime report for ${report.frequency_band} filed by ${report.instructor_name} has been open for over 2 hours and requires attention.`,
        link: '/downtime',
      });
    }

    // Notify the department's supervisor(s).
    const { rows: supervisors } = await pool.query(
      "SELECT id FROM users WHERE role = 'supervisor' AND department_id = $1 AND is_active = true",
      [report.department_id]
    );
    for (const sup of supervisors) {
      await notifyUser({
        userId: sup.id,
        type: 'downtime_escalated',
        title: 'Downtime Report Unresolved',
        body: `The downtime report for ${report.frequency_band} has not been resolved after 2 hours.`,
        link: '/downtime',
      });
    }

    await logActivity({
      department_id: report.department_id,
      actor_id: null,
      actor_name: 'System',
      action_type: 'downtime_escalated',
      entity_type: 'downtime_report',
      entity_id: report.id,
      description: `Downtime report for ${report.frequency_band} was automatically escalated after 2 hours`,
    });
  }
}

function startEscalationJob() {
  // Runs every 30 minutes.
  cron.schedule('*/30 * * * *', async () => {
    try {
      await runEscalationPass();
    } catch (err) {
      console.error('Escalation job error:', err.message);
    }
  });
}

module.exports = startEscalationJob;
