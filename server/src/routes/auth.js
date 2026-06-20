'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const pool = require('../db/pool');
const verifyToken = require('../middleware/auth');
const upload = require('../middleware/upload');
const { getS3, S3_BUCKET } = require('../lib/s3');
const { sendMail } = require('../lib/mailer');
const { renderEmail } = require('../lib/emailTemplate');
const { recordAudit, audit, clientIp } = require('../lib/auditLog');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_TTL_MINUTES = 60;

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 12 * 60 * 60 * 1000, // 12 hours — must match the JWT expiry below
};

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.department_id,
              u.is_active, d.name AS department_name
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    );

    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department_id: user.department_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.cookie('token', token, COOKIE_OPTS);

    // Record the sign-in (fire-and-forget): stamp last_login + an audit row.
    pool
      .query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id])
      .catch((e) => console.error(`[auth] last_login update failed: ${e.message}`));
    recordAudit({
      actor: { id: user.id, name: user.name, role: user.role },
      action: 'login',
      targetType: 'user',
      targetId: user.id,
      targetDescription: user.email,
      ip: clientIp(req),
    });

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department_id: user.department_id,
        department_name: user.department_name,
      },
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  // Best-effort audit: decode the cookie (no middleware here) to name the actor.
  try {
    const tok = req.cookies && req.cookies.token;
    if (tok) {
      const claims = jwt.verify(tok, process.env.JWT_SECRET);
      recordAudit({
        actor: { id: claims.id, name: claims.name, role: claims.role },
        action: 'logout',
        targetType: 'user',
        targetId: claims.id,
        ip: clientIp(req),
      });
    }
  } catch {
    /* expired/invalid token — nothing to audit */
  }
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
  return res.json({ message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.department_id, u.created_at,
              u.phone, u.bio, u.last_login,
              CASE WHEN u.profile_photo_url IS NOT NULL THEN '/api/auth/profile/photo/' || u.id END AS profile_photo,
              d.name AS department_name,
              COALESCE(d.has_trainees, false) AS has_trainees,
              COALESCE(d.has_radio_report, false) AS has_radio_report
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.id = $1`,
      [req.user.id]
    );

    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    return res.json({ user });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/auth/profile — update own display name, phone and bio
router.patch('/profile', verifyToken, async (req, res, next) => {
  try {
    const { name, phone, bio } = req.body || {};
    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }
    if (phone !== undefined && phone !== null && String(phone).trim()) {
      if (!/^\+?[0-9\s-]{7,20}$/.test(String(phone).trim())) {
        return res.status(400).json({ error: 'Enter a valid phone number' });
      }
    }
    if (bio !== undefined && bio !== null && String(bio).length > 500) {
      return res.status(400).json({ error: 'Bio must be 500 characters or fewer' });
    }

    const sets = [];
    const params = [];
    const add = (frag, val) => {
      params.push(val);
      sets.push(`${frag} = $${params.length}`);
    };
    if (name !== undefined) add('name', String(name).trim());
    if (phone !== undefined) add('phone', phone && String(phone).trim() ? String(phone).trim() : null);
    if (bio !== undefined) add('bio', bio && String(bio).trim() ? String(bio).trim() : null);
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    params.push(req.user.id);
    const { rows } = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}
       RETURNING id, name, email, role, department_id, phone, bio, created_at`,
      params
    );
    audit(req, 'profile_update', { targetType: 'user', targetId: req.user.id });
    return res.json({ user: rows[0] });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/auth/profile/photo — upload/replace own avatar (field "file")
router.put('/profile/photo', verifyToken, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'An image file is required' });
    const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
    if (!['jpg', 'jpeg', 'png'].includes(ext)) {
      return res.status(400).json({ error: 'Only JPG and PNG images are allowed' });
    }
    const fileUrl = req.file.key || req.file.filename;
    await pool.query(
      'UPDATE users SET profile_photo_url = $1, profile_photo_storage = $2 WHERE id = $3',
      [fileUrl, upload.STORAGE_DRIVER, req.user.id]
    );
    return res.json({ photo: `/api/auth/profile/photo/${req.user.id}` });
  } catch (err) {
    return next(err);
  }
});

// GET /api/auth/profile/photo/:id — stream a user's avatar (auth required)
router.get('/profile/photo/:id', verifyToken, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(404).end();
    const { rows } = await pool.query(
      'SELECT profile_photo_url, profile_photo_storage FROM users WHERE id = $1',
      [id]
    );
    const u = rows[0];
    if (!u || !u.profile_photo_url) return res.status(404).end();

    if ((u.profile_photo_storage || 's3') === 'local') {
      const dir = path.resolve(process.env.UPLOADS_DIR || './uploads');
      const fp = path.join(dir, path.basename(u.profile_photo_url));
      if (!fs.existsSync(fp)) return res.status(404).end();
      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.sendFile(fp);
    }
    try {
      const obj = await getS3().send(
        new GetObjectCommand({ Bucket: S3_BUCKET, Key: u.profile_photo_url })
      );
      res.setHeader('Content-Type', obj.ContentType || 'image/jpeg');
      if (obj.ContentLength != null) res.setHeader('Content-Length', obj.ContentLength);
      res.setHeader('Cache-Control', 'private, max-age=300');
      obj.Body.on('error', next);
      return obj.Body.pipe(res);
    } catch (e) {
      if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) return res.status(404).end();
      throw e;
    }
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/change-password — change own password (requires current)
router.post('/change-password', verifyToken, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body || {};
    if (!current_password) return res.status(400).json({ error: 'Current password is required' });
    if (!new_password) return res.status(400).json({ error: 'New password is required' });
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [
      req.user.id,
    ]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const match = await bcrypt.compare(current_password, user.password_hash);
    if (!match) return res.status(400).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);

    return res.json({ message: 'Password updated' });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/forgot-password — email a reset link
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    const normalized = email.toLowerCase().trim();

    const { rows } = await pool.query(
      'SELECT id, name, is_active FROM users WHERE email = $1',
      [normalized]
    );
    const user = rows[0];

    // Always respond the same way so we never reveal which emails exist.
    if (user && user.is_active) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);

      // Invalidate any prior unused tokens, then store the new one.
      await pool.query(
        'UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
        [user.id]
      );
      await pool.query(
        'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [user.id, tokenHash, expiresAt.toISOString()]
      );

      const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${rawToken}`;
      // Always log the link so it's recoverable from the server logs even if
      // email delivery is unavailable.
      console.log(`[reset] link for ${normalized}: ${resetUrl}`);

      const { html, text } = renderEmail({
        heading: 'Reset your password',
        name: user.name,
        intro: `We received a request to reset your SwahiliPot IMS password. Click the button below to choose a new one. This link is valid for ${RESET_TTL_MINUTES} minutes.`,
        ctaLabel: 'Reset Your Password',
        ctaUrl: resetUrl,
        outro: "If you didn't request this, you can safely ignore this email — your password won't change.",
      });

      // Fire-and-forget: never block the HTTP response on email delivery, so
      // the request can't hang if the mail provider is slow or unreachable.
      sendMail({ to: normalized, subject: 'Reset your SwahiliPot IMS password', text, html }).catch(
        (mailErr) => {
          console.error(`[${new Date().toISOString()}] [reset] email send failed:`, mailErr.message);
        }
      );
    }

    return res.json({ message: 'If that account exists, a reset link has been sent.' });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/reset-password — set a new password using a reset token
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Reset token is required' });
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { rows } = await pool.query(
      `SELECT id, user_id FROM password_resets
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [tokenHash]
    );
    const reset = rows[0];
    if (!reset) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, reset.user_id]);
    await pool.query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [reset.id]);

    return res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
