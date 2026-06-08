'use strict';

const pool = require('../db/pool');

/**
 * Append an entry to the department activity feed.
 *
 * Activity logging must never break the operation that triggered it, so any
 * failure here is swallowed and logged rather than thrown. Accepts an optional
 * pg client (`db`) to run inside an existing transaction; defaults to the pool.
 */
async function logActivity(
  {
    department_id,
    actor_id,
    actor_name,
    action_type,
    entity_type,
    entity_id,
    description,
  },
  db = pool
) {
  try {
    if (!department_id || !action_type || !description) return;
    await db.query(
      `INSERT INTO activity_log
         (department_id, actor_id, actor_name, action_type, entity_type, entity_id, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        department_id,
        actor_id || null,
        actor_name || null,
        action_type,
        entity_type || null,
        entity_id || null,
        description,
      ]
    );
  } catch (err) {
    // Never throw from activity logging — it must not break the main operation.
    console.error('Activity log write failed:', err.message);
  }
}

module.exports = logActivity;
