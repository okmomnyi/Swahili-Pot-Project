'use strict';

// Authenticated document registry. Supervisors see/manage their department's
// issued documents; revocation is available to supervisors (own department) and
// system admins (any department). Unrevoke is admin-only.

const express = require('express');
const pool = require('../db/pool');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { audit } = require('../lib/auditLog');
const logActivity = require('../utils/logActivity');

const router = express.Router();

router.use(verifyToken);

const DOC_COLUMNS = `
  document_id, document_type, recipient_name, recipient_email,
  department_id, department_name, issued_by_name, issued_by_role,
  issued_at, content_hash, signature, is_revoked, revoked_by, revoked_at,
  revocation_reason, created_at`;

function buildFilters(query, params, startIndex) {
  const conditions = [];
  let i = startIndex;
  if (query.document_type) { params.push(query.document_type); conditions.push(`document_type = $${++i}`); }
  if (query.is_revoked === 'true') conditions.push('is_revoked = true');
  if (query.is_revoked === 'false') conditions.push('is_revoked = false');
  if (query.from) { params.push(query.from); conditions.push(`issued_at >= $${++i}`); }
  if (query.to) { params.push(query.to); conditions.push(`issued_at <= $${++i}`); }
  if (query.search) {
    params.push(`%${query.search.trim().toLowerCase()}%`);
    conditions.push(`LOWER(recipient_name) LIKE $${++i}`);
  }
  return { conditions, i };
}

// GET /api/documents — documents issued in the supervisor's department.
router.get('/', requireRole('supervisor'), async (req, res, next) => {
  try {
    const params = [req.user.department_id];
    const { conditions } = buildFilters(req.query, params, 1);
    const where = ['department_id = $1', ...conditions].join(' AND ');
    const { rows } = await pool.query(
      `SELECT ${DOC_COLUMNS} FROM documents WHERE ${where} ORDER BY issued_at DESC LIMIT 500`,
      params
    );
    return res.json({ documents: rows });
  } catch (err) {
    return next(err);
  }
});

// GET /api/documents/:document_id — single document (department-scoped).
router.get('/:document_id', requireRole('supervisor'), async (req, res, next) => {
  try {
    const { rows: [doc] } = await pool.query(
      `SELECT ${DOC_COLUMNS} FROM documents WHERE document_id = $1 AND department_id = $2`,
      [req.params.document_id, req.user.department_id]
    );
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    return res.json({ document: doc });
  } catch (err) {
    return next(err);
  }
});

// POST /api/documents/:document_id/revoke — supervisor (own dept) or admin.
router.post('/:document_id/revoke', requireRole('supervisor', 'admin'), async (req, res, next) => {
  try {
    const { reason } = req.body || {};
    if (!reason || reason.trim().length < 20) {
      return res.status(400).json({ error: 'A revocation reason of at least 20 characters is required.' });
    }

    // Supervisors are department-scoped; admins may revoke any document.
    const values = [reason.trim(), req.user.id, req.params.document_id];
    let where = 'document_id = $3';
    if (req.user.role !== 'admin') {
      values.push(req.user.department_id);
      where += ' AND department_id = $4';
    }

    const { rows } = await pool.query(
      `UPDATE documents
          SET is_revoked = true, revocation_reason = $1, revoked_by = $2, revoked_at = NOW()
        WHERE ${where} AND is_revoked = false
        RETURNING ${DOC_COLUMNS}`,
      values
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Document not found, already revoked, or not in your department.' });
    }

    const doc = rows[0];
    audit(req, 'document_revoked', {
      targetType: 'document',
      targetDescription: `${doc.document_id} (${doc.recipient_name})`,
    });
    await logActivity({
      department_id: doc.department_id,
      actor_id: req.user.id,
      actor_name: req.user.name,
      action_type: 'document_revoked',
      entity_type: 'document',
      description: `${req.user.name} revoked ${doc.document_id} for ${doc.recipient_name}`,
    });
    return res.json({ document: doc });
  } catch (err) {
    return next(err);
  }
});

// POST /api/documents/:document_id/unrevoke — admin only.
router.post('/:document_id/unrevoke', requireRole('admin'), async (req, res, next) => {
  try {
    const { reason } = req.body || {};
    if (!reason || reason.trim().length < 20) {
      return res.status(400).json({ error: 'A reason of at least 20 characters is required.' });
    }
    const { rows } = await pool.query(
      `UPDATE documents
          SET is_revoked = false, revoked_by = NULL, revoked_at = NULL, revocation_reason = NULL
        WHERE document_id = $1 AND is_revoked = true
        RETURNING ${DOC_COLUMNS}`,
      [req.params.document_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Document not found or not revoked.' });

    audit(req, 'document_unrevoked', {
      targetType: 'document',
      targetDescription: `${rows[0].document_id} — ${reason.trim().slice(0, 120)}`,
    });
    return res.json({ document: rows[0] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
