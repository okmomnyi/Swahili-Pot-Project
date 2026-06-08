'use strict';

const express = require('express');
const pool = require('../db/pool');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { notifyUser } = require('../lib/notify');
const logActivity = require('../utils/logActivity');

const router = express.Router();

const PRIORITIES = ['low', 'medium', 'high'];
const STAFF = ['instructor', 'supervisor'];

const TASK_SELECT = `t.id, t.department_id, t.assigned_to, t.assigned_by, t.title,
  t.description, t.priority, t.due_date, t.status, t.program_id,
  t.feedback, t.feedback_by, t.feedback_at, t.reviewed_at, t.created_at, t.updated_at,
  a.name AS attachee_name, b.name AS assigned_by_name, c.name AS feedback_by_name`;

const TASK_FROM = `FROM tasks t
  JOIN users a ON a.id = t.assigned_to
  JOIN users b ON b.id = t.assigned_by
  LEFT JOIN users c ON c.id = t.feedback_by`;

// GET /api/tasks — role-aware
router.get('/', verifyToken, async (req, res, next) => {
  try {
    if (req.user.role === 'attachee') {
      const { rows } = await pool.query(
        `SELECT ${TASK_SELECT}
           ${TASK_FROM}
          WHERE t.assigned_to = $1
          ORDER BY (t.status IN ('completed', 'reviewed')), t.due_date NULLS LAST, t.created_at DESC`,
        [req.user.id]
      );
      return res.json({ tasks: rows });
    }

    if (STAFF.includes(req.user.role)) {
      const { rows } = await pool.query(
        `SELECT ${TASK_SELECT}
           ${TASK_FROM}
          WHERE t.department_id = $1
          ORDER BY (t.status IN ('completed', 'reviewed')), t.created_at DESC`,
        [req.user.department_id]
      );
      return res.json({ tasks: rows });
    }

    return res.status(403).json({ error: 'Forbidden' });
  } catch (err) {
    return next(err);
  }
});

// POST /api/tasks — instructor/supervisor assigns a task to an attachee
router.post('/', verifyToken, requireRole('instructor', 'supervisor'), async (req, res, next) => {
  try {
    const { title, description, assigned_to, due_date, priority, program_id } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });

    const attacheeId = parseInt(assigned_to, 10);
    if (Number.isNaN(attacheeId)) return res.status(400).json({ error: 'An attachee must be selected' });

    const prio = priority && PRIORITIES.includes(priority) ? priority : 'medium';

    // The assignee must be an active attachee in the assigner's department.
    const target = await pool.query(
      `SELECT id, name FROM users
        WHERE id = $1 AND role = 'attachee' AND department_id = $2 AND is_active = true`,
      [attacheeId, req.user.department_id]
    );
    if (target.rows.length === 0) {
      return res.status(400).json({ error: 'Attachee not found in your department' });
    }

    // Optional program link, validated against the department.
    let programId = null;
    if (program_id !== undefined && program_id !== null && program_id !== '') {
      const pid = parseInt(program_id, 10);
      if (!Number.isNaN(pid)) {
        const prog = await pool.query(
          'SELECT id FROM programs WHERE id = $1 AND department_id = $2',
          [pid, req.user.department_id]
        );
        if (prog.rows.length) programId = pid;
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO tasks (department_id, assigned_to, assigned_by, title, description, priority, due_date, program_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        req.user.department_id,
        attacheeId,
        req.user.id,
        title.trim(),
        description && description.trim() ? description.trim() : null,
        prio,
        due_date || null,
        programId,
      ]
    );

    const { rows: full } = await pool.query(
      `SELECT ${TASK_SELECT} ${TASK_FROM} WHERE t.id = $1`,
      [rows[0].id]
    );

    await notifyUser({
      userId: attacheeId,
      type: 'task_assigned',
      title: 'New task assigned',
      body: `${req.user.name} assigned you: "${title.trim()}".`,
      link: '/tasks',
    });

    await logActivity({
      department_id: req.user.department_id,
      actor_id: req.user.id,
      actor_name: req.user.name,
      action_type: 'task_assigned',
      entity_type: 'task',
      entity_id: rows[0].id,
      description: `${req.user.name} assigned task '${title.trim()}' to ${target.rows[0].name}`,
    });

    return res.status(201).json({ task: full[0] });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/tasks/:id/status
router.patch('/:id/status', verifyToken, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid task id' });

    const { status } = req.body || {};
    const ALLOWED = ['open', 'pending', 'in_progress', 'submitted', 'completed'];
    if (!ALLOWED.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const { rows: existing } = await pool.query(
      'SELECT assigned_to, assigned_by, department_id, status AS current_status FROM tasks WHERE id = $1',
      [id]
    );
    const task = existing[0];
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Permissions: the attachee owner may move between pending/in_progress/submitted;
    // staff in the department may set any status (incl. completed).
    if (req.user.role === 'attachee') {
      if (task.assigned_to !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
      if (status === 'completed') {
        return res.status(403).json({ error: 'Only staff can mark a task completed' });
      }
      // A logical transition guard: cannot regress a submitted task back to pending.
      if (
        ['submitted', 'reviewed'].includes(task.current_status) &&
        ['open', 'pending', 'in_progress'].includes(status)
      ) {
        return res.status(400).json({ error: 'Cannot move a submitted task back to an earlier stage' });
      }
    } else if (STAFF.includes(req.user.role)) {
      if (task.department_id !== req.user.department_id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { rows } = await pool.query(
      `UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, assigned_to, assigned_by, status, title`,
      [status, id]
    );

    // Notify the other party of the change.
    const updated = rows[0];
    if (req.user.role === 'attachee') {
      await notifyUser({
        userId: task.assigned_by,
        type: 'task_updated',
        title: 'Task progress updated',
        body: `${req.user.name} marked "${updated.title}" as ${status.replace('_', ' ')}.`,
        link: '/tasks',
      });
    } else {
      await notifyUser({
        userId: task.assigned_to,
        type: 'task_updated',
        title: 'Task updated',
        body: `Your task "${updated.title}" was marked ${status.replace('_', ' ')}.`,
        link: '/tasks',
      });
    }

    await logActivity({
      department_id: task.department_id,
      actor_id: req.user.id,
      actor_name: req.user.name,
      action_type: 'task_status_updated',
      entity_type: 'task',
      entity_id: id,
      description: `${req.user.name} marked task '${updated.title}' as ${status.replace('_', ' ')}`,
    });

    return res.json({ task: updated });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/tasks/:id/review — instructor/supervisor leaves feedback + marks reviewed
router.patch('/:id/review', verifyToken, requireRole('instructor', 'supervisor'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid task id' });

    const { feedback } = req.body || {};
    if (!feedback || !feedback.trim()) {
      return res.status(400).json({ error: 'Feedback is required to submit a review' });
    }

    const { rows: existing } = await pool.query(
      'SELECT department_id, assigned_to, title FROM tasks WHERE id = $1',
      [id]
    );
    const task = existing[0];
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.department_id !== req.user.department_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await pool.query(
      `UPDATE tasks
          SET status = 'reviewed', feedback = $1, feedback_by = $2,
              feedback_at = NOW(), reviewed_at = NOW(), updated_at = NOW()
        WHERE id = $3`,
      [feedback.trim(), req.user.id, id]
    );

    const { rows: full } = await pool.query(
      `SELECT ${TASK_SELECT} ${TASK_FROM} WHERE t.id = $1`,
      [id]
    );

    await notifyUser({
      userId: task.assigned_to,
      type: 'task_reviewed',
      title: 'Task reviewed',
      body: `Your task "${task.title}" was reviewed with feedback.`,
      link: '/tasks',
    });

    await logActivity({
      department_id: task.department_id,
      actor_id: req.user.id,
      actor_name: req.user.name,
      action_type: 'task_reviewed',
      entity_type: 'task',
      entity_id: id,
      description: `${req.user.name} reviewed task '${task.title}'`,
    });

    return res.json({ task: full[0] });
  } catch (err) {
    return next(err);
  }
});

// Confirm the requester may access a task (same department).
async function taskInDepartment(taskId, departmentId) {
  const { rows } = await pool.query(
    'SELECT id FROM tasks WHERE id = $1 AND department_id = $2',
    [taskId, departmentId]
  );
  return rows.length > 0;
}

// GET /api/tasks/:id/comments — threaded comments, department-scoped
router.get('/:id/comments', verifyToken, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid task id' });
    if (!(await taskInDepartment(id, req.user.department_id))) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { rows } = await pool.query(
      `SELECT tc.id, tc.task_id, tc.author_id, tc.body, tc.created_at,
              u.name AS author_name, u.role AS author_role
         FROM task_comments tc
         JOIN users u ON u.id = tc.author_id
        WHERE tc.task_id = $1
        ORDER BY tc.created_at ASC`,
      [id]
    );
    return res.json({ comments: rows });
  } catch (err) {
    return next(err);
  }
});

// POST /api/tasks/:id/comments — add a comment, department-scoped
router.post('/:id/comments', verifyToken, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid task id' });

    const { body } = req.body || {};
    if (!body || !body.trim()) return res.status(400).json({ error: 'Comment body is required' });

    if (!(await taskInDepartment(id, req.user.department_id))) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { rows } = await pool.query(
      `INSERT INTO task_comments (task_id, author_id, body)
       VALUES ($1, $2, $3) RETURNING id`,
      [id, req.user.id, body.trim()]
    );

    const { rows: full } = await pool.query(
      `SELECT tc.id, tc.task_id, tc.author_id, tc.body, tc.created_at,
              u.name AS author_name, u.role AS author_role
         FROM task_comments tc JOIN users u ON u.id = tc.author_id
        WHERE tc.id = $1`,
      [rows[0].id]
    );
    return res.status(201).json({ comment: full[0] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
