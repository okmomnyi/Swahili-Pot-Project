'use strict';

const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { isConfigured } = require('../services/nimClient');
const { buildAttacheeContext, buildDepartmentContext } = require('../services/aiContextBuilder');
const {
  generateAttacheeProfile,
  generateReportNarrative,
  streamSupervisorAnswer,
} = require('../services/aiService');

const router = express.Router();

const NOT_CONFIGURED = 'The AI features are not configured yet. Set NVIDIA_NIM_API_KEY on the server.';

// Block AI-generation endpoints when no key is present (rest of app unaffected).
function requireAiConfigured(req, res, next) {
  if (!isConfigured()) return res.status(503).json({ error: NOT_CONFIGURED });
  return next();
}

// ── ATTACHEE INTELLIGENCE PROFILE ────────────────────────────────────────────

// GET /api/ai/attachees/:attacheeId/profile — cached, or generate + cache.
router.get(
  '/attachees/:attacheeId/profile',
  verifyToken,
  requireRole('instructor', 'supervisor'),
  async (req, res, next) => {
    try {
      const attacheeId = parseInt(req.params.attacheeId, 10);
      if (Number.isNaN(attacheeId)) return res.status(400).json({ error: 'Invalid attachee id' });
      const departmentId = req.user.department_id;

      // Verify ownership and grab the display name.
      const check = await pool.query(
        'SELECT id, name FROM trainees WHERE id = $1 AND department_id = $2',
        [attacheeId, departmentId]
      );
      if (!check.rows.length) return res.status(404).json({ error: 'Attachee not found' });
      const attacheeName = check.rows[0].name;

      // Serve cache if available.
      const cached = await pool.query(
        'SELECT * FROM attachee_ai_profiles WHERE attachee_id = $1',
        [attacheeId]
      );
      if (cached.rows.length) {
        const row = cached.rows[0];
        // Prefer the full rich object; fall back to legacy columns.
        const base = row.details && typeof row.details === 'object' ? row.details : row;
        return res.json({
          profile: { ...base, attachee_name: attacheeName, generated_at: row.generated_at },
          cached: true,
        });
      }

      // No cache → must generate, which needs a configured key.
      if (!isConfigured()) return res.status(503).json({ error: NOT_CONFIGURED });

      const context = await buildAttacheeContext(attacheeId, departmentId);
      const profile = await generateAttacheeProfile(context);
      const hash = crypto.createHash('sha256').update(context).digest('hex');

      await pool.query(
        `INSERT INTO attachee_ai_profiles
           (attachee_id, department_id, strengths, weaknesses, behavioral_patterns,
            skill_tags, career_paths, summary, details, raw_context_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (attachee_id) DO UPDATE SET
           strengths           = EXCLUDED.strengths,
           weaknesses          = EXCLUDED.weaknesses,
           behavioral_patterns = EXCLUDED.behavioral_patterns,
           skill_tags          = EXCLUDED.skill_tags,
           career_paths        = EXCLUDED.career_paths,
           summary             = EXCLUDED.summary,
           details             = EXCLUDED.details,
           raw_context_hash    = EXCLUDED.raw_context_hash,
           generated_at        = NOW()`,
        [
          attacheeId,
          departmentId,
          JSON.stringify(profile.strengths || []),
          JSON.stringify(profile.weaknesses || []),
          JSON.stringify(profile.behavioral_patterns || []),
          profile.skill_tags || [],
          JSON.stringify(profile.career_paths || []),
          profile.summary || '',
          JSON.stringify(profile),
          hash,
        ]
      );

      return res.json({
        profile: { ...profile, attachee_name: attacheeName, generated_at: new Date() },
        cached: false,
      });
    } catch (err) {
      console.error('[AI profile]', err.message);
      if (err.code === 'AI_NOT_CONFIGURED') return res.status(503).json({ error: NOT_CONFIGURED });
      return next(err);
    }
  }
);

// POST /api/ai/attachees/:attacheeId/profile/refresh — clear cache.
router.post(
  '/attachees/:attacheeId/profile/refresh',
  verifyToken,
  requireRole('instructor', 'supervisor'),
  async (req, res, next) => {
    try {
      const attacheeId = parseInt(req.params.attacheeId, 10);
      if (Number.isNaN(attacheeId)) return res.status(400).json({ error: 'Invalid attachee id' });
      // Department scope: only clear profiles for trainees in this department.
      await pool.query(
        `DELETE FROM attachee_ai_profiles
          WHERE attachee_id = $1 AND department_id = $2`,
        [attacheeId, req.user.department_id]
      );
      return res.json({ message: 'Cache cleared — fetch the profile again to regenerate.' });
    } catch (err) {
      return next(err);
    }
  }
);

// ── AI REPORTS ────────────────────────────────────────────────────────────────

// POST /api/ai/attachees/:attacheeId/reports — supervisor generates a report.
router.post(
  '/attachees/:attacheeId/reports',
  verifyToken,
  requireRole('supervisor'),
  requireAiConfigured,
  async (req, res, next) => {
    try {
      const attacheeId = parseInt(req.params.attacheeId, 10);
      if (Number.isNaN(attacheeId)) return res.status(400).json({ error: 'Invalid attachee id' });
      const { report_type } = req.body || {};
      const departmentId = req.user.department_id;

      if (!['progress', 'completion'].includes(report_type)) {
        return res.status(400).json({ error: 'report_type must be "progress" or "completion"' });
      }

      // Ownership check.
      const check = await pool.query(
        'SELECT id FROM trainees WHERE id = $1 AND department_id = $2',
        [attacheeId, departmentId]
      );
      if (!check.rows.length) return res.status(404).json({ error: 'Attachee not found' });

      const context = await buildAttacheeContext(attacheeId, departmentId);
      const narrative = await generateReportNarrative(context, report_type);

      const result = await pool.query(
        `INSERT INTO ai_reports (attachee_id, department_id, report_type, generated_by, ai_narrative)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [attacheeId, departmentId, report_type, req.user.id, narrative]
      );

      return res.json({ report: result.rows[0] });
    } catch (err) {
      console.error('[AI report]', err.message);
      if (err.code === 'AI_NOT_CONFIGURED') return res.status(503).json({ error: NOT_CONFIGURED });
      return next(err);
    }
  }
);

// PATCH /api/ai/reports/:reportId — supervisor saves edits / finalizes.
router.patch(
  '/reports/:reportId',
  verifyToken,
  requireRole('supervisor'),
  async (req, res, next) => {
    try {
      const reportId = parseInt(req.params.reportId, 10);
      if (Number.isNaN(reportId)) return res.status(400).json({ error: 'Invalid report id' });
      const { supervisor_edits, status } = req.body || {};
      if (status && !['draft', 'finalized'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const result = await pool.query(
        `UPDATE ai_reports
            SET supervisor_edits = $1, status = COALESCE($2, status)
          WHERE id = $3 AND generated_by = $4 AND department_id = $5
          RETURNING *`,
        [supervisor_edits ?? null, status || null, reportId, req.user.id, req.user.department_id]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Report not found' });
      return res.json({ report: result.rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

// GET /api/ai/attachees/:attacheeId/reports — list reports for an attachee.
router.get(
  '/attachees/:attacheeId/reports',
  verifyToken,
  requireRole('instructor', 'supervisor'),
  async (req, res, next) => {
    try {
      const attacheeId = parseInt(req.params.attacheeId, 10);
      if (Number.isNaN(attacheeId)) return res.status(400).json({ error: 'Invalid attachee id' });
      const result = await pool.query(
        `SELECT r.*, u.name AS generated_by_name
           FROM ai_reports r JOIN users u ON u.id = r.generated_by
          WHERE r.attachee_id = $1 AND r.department_id = $2
          ORDER BY r.generated_at DESC`,
        [attacheeId, req.user.department_id]
      );
      return res.json({ reports: result.rows });
    } catch (err) {
      return next(err);
    }
  }
);

// ── SUPERVISOR AI ASSISTANT (STREAMING SSE) ──────────────────────────────────

// POST /api/ai/assistant
router.post(
  '/assistant',
  verifyToken,
  requireRole('supervisor'),
  async (req, res, next) => {
    try {
      const { question } = req.body || {};
      if (!question || !question.trim()) return res.status(400).json({ error: 'Question is required' });
      if (!isConfigured()) return res.status(503).json({ error: NOT_CONFIGURED });

      const supervisorId = req.user.id;
      const departmentId = req.user.department_id;

      const historyResult = await pool.query(
        `SELECT role, content FROM supervisor_ai_chats
          WHERE supervisor_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [supervisorId]
      );
      const chatHistory = historyResult.rows.reverse();

      const departmentContext = await buildDepartmentContext(departmentId);

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      let fullResponse = '';
      await streamSupervisorAnswer({
        question: question.trim(),
        departmentContext,
        chatHistory,
        onChunk: (chunk) => {
          fullResponse += chunk;
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        },
      });

      await pool.query(
        `INSERT INTO supervisor_ai_chats (supervisor_id, department_id, role, content)
         VALUES ($1,$2,'user',$3), ($1,$2,'assistant',$4)`,
        [supervisorId, departmentId, question.trim(), fullResponse]
      );

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      return res.end();
    } catch (err) {
      console.error('[AI assistant]', err.message);
      // If headers already sent (streaming started), surface the error over SSE.
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: 'AI assistant failed — check NVIDIA NIM API key and rate limits' })}\n\n`);
        return res.end();
      }
      return next(err);
    }
  }
);

// DELETE /api/ai/assistant/history
router.delete(
  '/assistant/history',
  verifyToken,
  requireRole('supervisor'),
  async (req, res, next) => {
    try {
      await pool.query('DELETE FROM supervisor_ai_chats WHERE supervisor_id = $1', [req.user.id]);
      return res.json({ message: 'Chat history cleared' });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
