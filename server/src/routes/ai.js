'use strict';

const express = require('express');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const pool = require('../db/pool');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { isConfigured } = require('../services/nimClient');
const { buildAttacheeContext, buildDepartmentContext } = require('../services/aiContextBuilder');
const {
  generateAttacheeProfile,
  generateReportNarrative,
  streamReportNarrative,
  streamSupervisorAnswer,
} = require('../services/aiService');
const logAIUsage = require('../services/aiUsage');
const { getSetting } = require('../lib/platformSettings');
const { drawLetterhead, drawSignatureFooter } = require('../lib/pdfBrand');

const router = express.Router();

const NOT_CONFIGURED = 'The AI features are not configured yet. Set NVIDIA_NIM_API_KEY on the server.';
const AI_DISABLED = 'AI features are currently disabled by the system administrator.';

// Block AI-generation endpoints when no key is present (rest of app unaffected).
function requireAiConfigured(req, res, next) {
  if (!isConfigured()) return res.status(503).json({ error: NOT_CONFIGURED });
  return next();
}

// Block AI-generation endpoints when the system admin has turned AI off.
async function requireAiEnabled(req, res, next) {
  try {
    const enabled = await getSetting('system_ai_enabled');
    if (enabled === false) return res.status(503).json({ error: AI_DISABLED });
    return next();
  } catch {
    return next(); // never let the gate itself break the request
  }
}

// ── ATTACHEE INTELLIGENCE PROFILE ────────────────────────────────────────────

// Persist (upsert) a generated profile for an attachee.
async function saveAttacheeProfile(attacheeId, departmentId, context, profile) {
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
}

// GET /api/ai/attachees/:attacheeId/profile — cached profile only.
// Generation is done via the streaming endpoint below so it never hits the
// reverse-proxy read timeout.
router.get(
  '/attachees/:attacheeId/profile',
  verifyToken,
  requireRole('instructor', 'supervisor'),
  async (req, res, next) => {
    try {
      const attacheeId = parseInt(req.params.attacheeId, 10);
      if (Number.isNaN(attacheeId)) return res.status(400).json({ error: 'Invalid attachee id' });
      const departmentId = req.user.department_id;

      const check = await pool.query(
        "SELECT id, name FROM users WHERE id = $1 AND role = 'attachee' AND department_id = $2",
        [attacheeId, departmentId]
      );
      if (!check.rows.length) return res.status(404).json({ error: 'Attachee not found' });
      const attacheeName = check.rows[0].name;

      const cached = await pool.query(
        'SELECT * FROM attachee_ai_profiles WHERE attachee_id = $1',
        [attacheeId]
      );
      if (!cached.rows.length) {
        return res.status(404).json({ error: 'No profile generated yet.', generated: false });
      }
      const row = cached.rows[0];
      const base = row.details && typeof row.details === 'object' ? row.details : row;
      return res.json({
        profile: { ...base, attachee_name: attacheeName, generated_at: row.generated_at },
        cached: true,
      });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/ai/attachees/:attacheeId/profile/generate — generate (or
// regenerate) the profile over SSE. Keep-alive pings keep the connection
// flowing so nginx never returns a 504 on the long model call. The final
// profile is delivered in the `done` event.
router.post(
  '/attachees/:attacheeId/profile/generate',
  verifyToken,
  requireRole('instructor', 'supervisor'),
  async (req, res, next) => {
    try {
      const attacheeId = parseInt(req.params.attacheeId, 10);
      if (Number.isNaN(attacheeId)) return res.status(400).json({ error: 'Invalid attachee id' });
      const departmentId = req.user.department_id;

      const check = await pool.query(
        "SELECT id, name FROM users WHERE id = $1 AND role = 'attachee' AND department_id = $2",
        [attacheeId, departmentId]
      );
      if (!check.rows.length) return res.status(404).json({ error: 'Attachee not found' });
      const attacheeName = check.rows[0].name;

      if (!isConfigured()) return res.status(503).json({ error: NOT_CONFIGURED });
      if ((await getSetting('system_ai_enabled')) === false) {
        return res.status(503).json({ error: AI_DISABLED });
      }

      // Open SSE immediately so the proxy starts streaming.
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      res.write(': connected\n\n');
      const keepAlive = setInterval(() => {
        if (!res.writableEnded) res.write(': ping\n\n');
      }, 10000);

      const startedAt = Date.now();
      try {
        const context = await buildAttacheeContext(attacheeId, departmentId);
        const profile = await generateAttacheeProfile(context);
        await saveAttacheeProfile(attacheeId, departmentId, context, profile);
        logAIUsage({
          user_id: req.user.id,
          department_id: departmentId,
          feature: 'profile_generation',
          duration_ms: Date.now() - startedAt,
          success: true,
        });
        res.write(
          `data: ${JSON.stringify({
            done: true,
            profile: { ...profile, attachee_name: attacheeName, generated_at: new Date() },
          })}\n\n`
        );
      } catch (genErr) {
        console.error('[AI profile]', genErr.message);
        logAIUsage({
          user_id: req.user.id,
          department_id: departmentId,
          feature: 'profile_generation',
          duration_ms: Date.now() - startedAt,
          success: false,
          error_message: genErr.message,
        });
        const msg =
          genErr.code === 'AI_NOT_CONFIGURED'
            ? NOT_CONFIGURED
            : genErr.message && /unparseable|JSON/i.test(genErr.message)
            ? 'The AI returned an unreadable response. Please try again.'
            : 'Profile generation failed — please try again.';
        res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
      } finally {
        clearInterval(keepAlive);
      }
      return res.end();
    } catch (err) {
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: 'Profile generation failed — please try again.' })}\n\n`);
        return res.end();
      }
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
  requireAiEnabled,
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
        "SELECT id FROM users WHERE id = $1 AND role = 'attachee' AND department_id = $2",
        [attacheeId, departmentId]
      );
      if (!check.rows.length) return res.status(404).json({ error: 'Attachee not found' });

      const startedAt = Date.now();
      const context = await buildAttacheeContext(attacheeId, departmentId);
      let narrative;
      try {
        narrative = await generateReportNarrative(context, report_type);
      } catch (genErr) {
        logAIUsage({
          user_id: req.user.id,
          department_id: departmentId,
          feature: 'report_generation',
          duration_ms: Date.now() - startedAt,
          success: false,
          error_message: genErr.message,
        });
        throw genErr;
      }
      logAIUsage({
        user_id: req.user.id,
        department_id: departmentId,
        feature: 'report_generation',
        duration_ms: Date.now() - startedAt,
        success: true,
      });

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

// ── SUPERVISOR AI ASSISTANT (STREAMING SSE, THREADED CONVERSATIONS) ───────────

const CONV_HISTORY_CAP = 20; // messages of context sent to the model

// POST /api/ai/assistant — ask a question within (optionally) a conversation.
// Body: { question, conversation_id? }. A new conversation is created when no id
// is given; the returned `done` event carries the conversation_id.
router.post(
  '/assistant',
  verifyToken,
  requireRole('supervisor'),
  async (req, res, next) => {
    try {
      const { question } = req.body || {};
      let conversationId = req.body && req.body.conversation_id ? parseInt(req.body.conversation_id, 10) : null;
      if (Number.isNaN(conversationId)) conversationId = null;
      if (!question || !question.trim()) return res.status(400).json({ error: 'Question is required' });
      if (!isConfigured()) return res.status(503).json({ error: NOT_CONFIGURED });
      if ((await getSetting('system_ai_enabled')) === false) {
        return res.status(503).json({ error: AI_DISABLED });
      }

      const supervisorId = req.user.id;
      const departmentId = req.user.department_id;

      // Load the existing thread (ownership-scoped) if one was supplied.
      let priorMessages = [];
      if (conversationId) {
        const conv = await pool.query(
          'SELECT messages FROM ai_conversations WHERE id = $1 AND supervisor_id = $2',
          [conversationId, supervisorId]
        );
        if (!conv.rows.length) return res.status(404).json({ error: 'Conversation not found' });
        priorMessages = Array.isArray(conv.rows[0].messages) ? conv.rows[0].messages : [];
      }

      // Open the SSE pipe IMMEDIATELY (before any DB / model work) so reverse
      // proxies don't buffer and the client gets instant feedback.
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      res.write(': connected\n\n');

      const keepAlive = setInterval(() => {
        if (!res.writableEnded) res.write(': ping\n\n');
      }, 15000);

      // Stop pulling from the model if the client navigates away mid-stream.
      let aborted = false;
      req.on('close', () => {
        aborted = true;
      });

      const startedAt = Date.now();
      try {
        const departmentContext = await buildDepartmentContext(departmentId);

        let fullResponse = '';
        await streamSupervisorAnswer({
          question: question.trim(),
          departmentContext,
          chatHistory: priorMessages.slice(-CONV_HISTORY_CAP),
          onChunk: (chunk) => {
            if (aborted) return;
            fullResponse += chunk;
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
          },
        });

        // Persist the turn into the threaded conversation.
        const updatedMessages = [
          ...priorMessages,
          { role: 'user', content: question.trim() },
          { role: 'assistant', content: fullResponse },
        ].slice(-100); // hard cap stored history

        if (conversationId) {
          await pool.query(
            'UPDATE ai_conversations SET messages = $1::jsonb, updated_at = NOW() WHERE id = $2',
            [JSON.stringify(updatedMessages), conversationId]
          );
        } else {
          const title = question.trim().slice(0, 80);
          const ins = await pool.query(
            `INSERT INTO ai_conversations (supervisor_id, department_id, title, messages)
             VALUES ($1, $2, $3, $4::jsonb) RETURNING id`,
            [supervisorId, departmentId, title, JSON.stringify(updatedMessages)]
          );
          conversationId = ins.rows[0].id;
        }

        logAIUsage({
          user_id: supervisorId,
          department_id: departmentId,
          feature: 'assistant_chat',
          duration_ms: Date.now() - startedAt,
          success: true,
        });

        res.write(`data: ${JSON.stringify({ done: true, conversation_id: conversationId })}\n\n`);
      } catch (streamErr) {
        logAIUsage({
          user_id: supervisorId,
          department_id: departmentId,
          feature: 'assistant_chat',
          duration_ms: Date.now() - startedAt,
          success: false,
          error_message: streamErr.message,
        });
        throw streamErr;
      } finally {
        clearInterval(keepAlive);
      }
      return res.end();
    } catch (err) {
      console.error('[AI assistant]', err.message);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: 'AI assistant failed — check NVIDIA NIM API key and rate limits' })}\n\n`);
        return res.end();
      }
      return next(err);
    }
  }
);

// GET /api/ai/assistant/conversations — list the supervisor's threads
router.get(
  '/assistant/conversations',
  verifyToken,
  requireRole('supervisor'),
  async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, title, created_at, updated_at,
                jsonb_array_length(messages) AS message_count
           FROM ai_conversations
          WHERE supervisor_id = $1
          ORDER BY updated_at DESC
          LIMIT 100`,
        [req.user.id]
      );
      return res.json({ conversations: rows });
    } catch (err) {
      return next(err);
    }
  }
);

// GET /api/ai/assistant/conversations/:id — full thread
router.get(
  '/assistant/conversations/:id',
  verifyToken,
  requireRole('supervisor'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid conversation id' });
      const { rows } = await pool.query(
        'SELECT id, title, messages, created_at, updated_at FROM ai_conversations WHERE id = $1 AND supervisor_id = $2',
        [id, req.user.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Conversation not found' });
      return res.json({ conversation: rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

// DELETE /api/ai/assistant/conversations/:id — delete one thread
router.delete(
  '/assistant/conversations/:id',
  verifyToken,
  requireRole('supervisor'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid conversation id' });
      const { rowCount } = await pool.query(
        'DELETE FROM ai_conversations WHERE id = $1 AND supervisor_id = $2',
        [id, req.user.id]
      );
      if (rowCount === 0) return res.status(404).json({ error: 'Conversation not found' });
      return res.json({ message: 'Conversation deleted' });
    } catch (err) {
      return next(err);
    }
  }
);

// DELETE /api/ai/assistant/history — clear ALL threads (back-compat for the
// dashboard widget's "clear" button).
router.delete(
  '/assistant/history',
  verifyToken,
  requireRole('supervisor'),
  async (req, res, next) => {
    try {
      await pool.query('DELETE FROM ai_conversations WHERE supervisor_id = $1', [req.user.id]);
      // Also clear any legacy flat history.
      await pool.query('DELETE FROM supervisor_ai_chats WHERE supervisor_id = $1', [req.user.id]);
      return res.json({ message: 'Chat history cleared' });
    } catch (err) {
      return next(err);
    }
  }
);

// ── AI REPORT: STREAMING GENERATION (SSE) ────────────────────────────────────

// POST /api/ai/attachees/:attacheeId/reports/stream — generate a report draft
// token-by-token over SSE, saving it when complete. The `done` event carries
// the new report_id.
router.post(
  '/attachees/:attacheeId/reports/stream',
  verifyToken,
  requireRole('supervisor'),
  async (req, res, next) => {
    try {
      const attacheeId = parseInt(req.params.attacheeId, 10);
      if (Number.isNaN(attacheeId)) return res.status(400).json({ error: 'Invalid attachee id' });
      const { report_type } = req.body || {};
      const departmentId = req.user.department_id;

      if (!['progress', 'completion'].includes(report_type)) {
        return res.status(400).json({ error: 'report_type must be "progress" or "completion"' });
      }
      if (!isConfigured()) return res.status(503).json({ error: NOT_CONFIGURED });
      if ((await getSetting('system_ai_enabled')) === false) {
        return res.status(503).json({ error: AI_DISABLED });
      }

      const check = await pool.query(
        "SELECT id FROM users WHERE id = $1 AND role = 'attachee' AND department_id = $2",
        [attacheeId, departmentId]
      );
      if (!check.rows.length) return res.status(404).json({ error: 'Attachee not found' });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      res.write(': connected\n\n');

      const keepAlive = setInterval(() => {
        if (!res.writableEnded) res.write(': ping\n\n');
      }, 15000);

      let aborted = false;
      req.on('close', () => {
        aborted = true;
      });

      const startedAt = Date.now();
      try {
        const context = await buildAttacheeContext(attacheeId, departmentId);
        let fullText = '';
        await streamReportNarrative({
          attacheeContext: context,
          reportType: report_type,
          onChunk: (chunk) => {
            if (aborted) return;
            fullText += chunk;
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
          },
        });

        const saved = await pool.query(
          `INSERT INTO ai_reports (attachee_id, department_id, report_type, generated_by, ai_narrative)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [attacheeId, departmentId, report_type, req.user.id, fullText]
        );

        logAIUsage({
          user_id: req.user.id,
          department_id: departmentId,
          feature: 'report_generation',
          duration_ms: Date.now() - startedAt,
          success: true,
        });

        res.write(`data: ${JSON.stringify({ done: true, report_id: saved.rows[0].id })}\n\n`);
      } catch (streamErr) {
        logAIUsage({
          user_id: req.user.id,
          department_id: departmentId,
          feature: 'report_generation',
          duration_ms: Date.now() - startedAt,
          success: false,
          error_message: streamErr.message,
        });
        throw streamErr;
      } finally {
        clearInterval(keepAlive);
      }
      return res.end();
    } catch (err) {
      console.error('[AI report stream]', err.message);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: 'Report generation failed — please try again.' })}\n\n`);
        return res.end();
      }
      return next(err);
    }
  }
);

// ── AI REPORT: PDF EXPORT ────────────────────────────────────────────────────

const PDF_BRAND = '#1e40af';
const PDF_INK = '#374151';
const PDF_MUTED = '#6b7280';
const REPORT_TITLES = {
  progress: 'ATTACHMENT PROGRESS REPORT',
  completion: 'LETTER OF ATTACHMENT COMPLETION',
};

// GET /api/ai/reports/:reportId/export — supervisor downloads a formatted PDF.
// Uses supervisor_edits when present, otherwise the original AI draft.
router.get(
  '/reports/:reportId/export',
  verifyToken,
  requireRole('supervisor'),
  async (req, res, next) => {
    try {
      const reportId = parseInt(req.params.reportId, 10);
      if (Number.isNaN(reportId)) return res.status(400).json({ error: 'Invalid report id' });

      const { rows } = await pool.query(
        `SELECT r.*, t.name AS attachee_name, d.name AS department_name, u.name AS supervisor_name
           FROM ai_reports r
           JOIN users t ON t.id = r.attachee_id
           JOIN departments d ON d.id = r.department_id
           JOIN users u ON u.id = r.generated_by
          WHERE r.id = $1 AND r.department_id = $2`,
        [reportId, req.user.department_id]
      );
      const report = rows[0];
      if (!report) return res.status(404).json({ error: 'Report not found' });

      const body = (report.supervisor_edits && report.supervisor_edits.trim()) || report.ai_narrative || '';
      const safeName = String(report.attachee_name).replace(/[^a-z0-9]+/gi, '-');
      const dateStr = new Date().toISOString().slice(0, 10);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeName}-${report.report_type}-report-${dateStr}.pdf"`
      );

      const doc = new PDFDocument({ size: 'A4', margin: 72 });
      doc.on('error', next);
      doc.pipe(res);

      // Branded letterhead (real logo, rule below the address block).
      drawLetterhead(doc);

      // Title + subject
      doc.fillColor(PDF_BRAND).font('Helvetica-Bold').fontSize(14)
        .text(REPORT_TITLES[report.report_type] || 'ATTACHMENT REPORT', { align: 'center', characterSpacing: 1 });
      doc.moveDown(0.4);
      doc.fillColor(PDF_INK).font('Helvetica-Bold').fontSize(12).text(report.attachee_name, { align: 'center' });
      doc.fillColor(PDF_MUTED).font('Helvetica').fontSize(10).text(report.department_name, { align: 'center' });
      doc.moveDown(0.8);
      const y = doc.y;
      doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(72, y).lineTo(doc.page.width - 72, y).stroke();
      doc.moveDown(1);

      // Body — render UPPERCASE-heading lines in bold, paragraphs in regular.
      doc.fillColor(PDF_INK);
      const blocks = body.split(/\n\s*\n/);
      for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;
        const headingMatch = /^([A-Z][A-Z \/&]{3,}):?\s*$/.test(trimmed);
        if (headingMatch) {
          doc.font('Helvetica-Bold').fontSize(11).text(trimmed.replace(/:$/, ''));
          doc.moveDown(0.3);
        } else {
          doc.font('Helvetica').fontSize(10).text(trimmed, { align: 'justify', lineGap: 3 });
          doc.moveDown(0.7);
        }
      }

      drawSignatureFooter(doc, report.supervisor_name, 'Department Supervisor');

      doc.end();
    } catch (err) {
      return next(err);
    }
  }
);

// ── AI USAGE STATS (SYSTEM ADMIN) ────────────────────────────────────────────

// GET /api/ai/usage/enabled — any authenticated user; drives UI visibility.
router.get('/usage/enabled', verifyToken, async (req, res, next) => {
  try {
    const settingEnabled = (await getSetting('system_ai_enabled')) !== false;
    return res.json({ enabled: settingEnabled && isConfigured(), configured: isConfigured() });
  } catch (err) {
    return next(err);
  }
});

// GET /api/ai/usage — admin only; aggregated AI usage statistics.
router.get('/usage', verifyToken, requireRole('admin'), async (req, res, next) => {
  try {
    const conditions = [];
    const params = [];
    if (req.query.from) {
      params.push(req.query.from);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (req.query.to) {
      params.push(req.query.to);
      conditions.push(`created_at <= $${params.length}`);
    }
    if (req.query.feature) {
      params.push(req.query.feature);
      conditions.push(`feature = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const totals = await pool.query(
      `SELECT
         COUNT(*)::int AS total_calls,
         COUNT(CASE WHEN success THEN 1 END)::int AS successful_calls,
         COUNT(CASE WHEN NOT success THEN 1 END)::int AS failed_calls,
         COALESCE(SUM(tokens_used), 0)::int AS total_tokens
       FROM ai_usage_log ${where}`,
      params
    );

    const byFeature = await pool.query(
      `SELECT feature,
              COUNT(*)::int AS calls,
              COUNT(CASE WHEN success THEN 1 END)::int AS successful,
              COALESCE(SUM(tokens_used), 0)::int AS tokens,
              ROUND(AVG(duration_ms))::int AS avg_duration_ms
         FROM ai_usage_log ${where}
        GROUP BY feature
        ORDER BY calls DESC`,
      params
    );

    const byDay = await pool.query(
      `SELECT TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS date,
              COUNT(*)::int AS calls,
              COALESCE(SUM(tokens_used), 0)::int AS tokens
         FROM ai_usage_log ${where}
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)`,
      params
    );

    const enabled = (await getSetting('system_ai_enabled')) !== false;

    return res.json({
      ...totals.rows[0],
      ai_enabled: enabled,
      configured: isConfigured(),
      by_feature: byFeature.rows,
      by_day: byDay.rows,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
