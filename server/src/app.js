'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const multer = require('multer');

const authRoutes = require('./routes/auth');
const departmentRoutes = require('./routes/departments');
const userRoutes = require('./routes/users');
const traineeRoutes = require('./routes/trainees');
const attendanceRoutes = require('./routes/attendance');
const attendPublicRoutes = require('./routes/attend');
const submissionRoutes = require('./routes/submissions');
const downtimeRoutes = require('./routes/downtime');
const dashboardRoutes = require('./routes/dashboard');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const taskRoutes = require('./routes/tasks');
const attacheeRoutes = require('./routes/attachee');
const attacheesRoutes = require('./routes/attachees');
const verificationRoutes = require('./routes/verification');
const documentsRoutes = require('./routes/documents');
const inquiryRoutes = require('./routes/inquiries');
const siteRoutes = require('./routes/site');
const chatRoutes = require('./routes/chat');
const announcementRoutes = require('./routes/announcements');
const sessionLogRoutes = require('./routes/sessionLogs');
const activityRoutes = require('./routes/activity');
const performanceRoutes = require('./routes/performance');
const certificateRoutes = require('./routes/certificates');
const programRoutes = require('./routes/programs');
const aiRoutes = require('./routes/ai');

const maintenanceGuard = require('./middleware/maintenance');

const app = express();

// CORS — allow only the configured React frontend origin, with credentials.
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Platform maintenance mode — blocks non-admin API traffic when enabled.
app.use(maintenanceGuard);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/trainees', traineeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/attend', attendPublicRoutes); // public, no auth
app.use('/api/submissions', submissionRoutes);
app.use('/api/downtime', downtimeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/attachee', attacheeRoutes);
app.use('/api/attachees', attacheesRoutes);
app.use('/api/verify', verificationRoutes); // public, no auth
app.use('/api/documents', documentsRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/site', siteRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/session-logs', sessionLogRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/ai', aiRoutes);

// 404 fallback for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler — MUST be last.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error:`, err.message);

  // Multer-specific errors get a 400 with a clear message.
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: err.message });
  }

  // File-filter rejections surface as plain Errors from the upload middleware.
  if (err.message && err.message.startsWith('Unsupported file type')) {
    return res.status(400).json({ error: err.message });
  }

  // S3 / AWS storage failures — surface a clear message instead of an opaque 500.
  const isS3Error =
    err.$metadata ||
    /credential|s3|region|endpoint|getaddrinfo|ENOTFOUND|EAI_AGAIN/i.test(
      `${err.name} ${err.code} ${err.message}`
    );
  if (isS3Error && req.path && req.path.includes('/submissions')) {
    return res.status(502).json({
      error:
        'File storage error — the S3 bucket, region, or credentials look misconfigured. ' +
        'Check AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and S3_BUCKET.',
    });
  }

  const status = err.status || 500;
  const message = status === 500 ? 'Something went wrong on the server.' : err.message;
  return res.status(status).json({ error: message });
});

module.exports = app;
