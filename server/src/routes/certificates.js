'use strict';

const express = require('express');
const PDFDocument = require('pdfkit');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

const BRAND = '#1e40af';
const INK = '#374151';
const MUTED = '#6b7280';

const TYPES = ['attachment_letter', 'completion_certificate'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Format a YYYY-MM-DD (or ISO) string as "dd Month yyyy" without TZ surprises.
function longDate(value) {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (m) {
    return `${m[3]} ${MONTHS[parseInt(m[2], 10) - 1]} ${m[1]}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function drawHeader(doc) {
  const top = doc.y;
  // Logo (text based)
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(20).text('SwahiliPot', { continued: true });
  doc.fillColor(INK).font('Helvetica').fontSize(14).text(' Hub Foundation');
  doc
    .fillColor(MUTED)
    .fontSize(9)
    .text('Swahili Cultural Centre, Sir Mbarak Hinaway Rd, Old Town, Mombasa');
  doc.text('swahilipothub.co.ke | info@swahilipothub.co.ke');

  // Right-aligned generation date
  doc
    .fillColor(INK)
    .fontSize(10)
    .text(longDate(new Date().toISOString()), 72, top, { align: 'right' });

  doc.moveDown(1);
  const y = doc.y;
  doc.strokeColor(BRAND).lineWidth(1).moveTo(72, y).lineTo(doc.page.width - 72, y).stroke();
  doc.moveDown(1.5);
}

function drawFooter(doc, supervisorName, supervisorTitle) {
  const bottom = doc.page.height - 130;
  doc.y = bottom;
  doc.strokeColor('#9ca3af').lineWidth(1).moveTo(72, doc.y).lineTo(72 + 150, doc.y).stroke();
  doc.moveDown(0.4);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(supervisorName, 72, doc.y);
  doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(supervisorTitle);
  doc
    .fontSize(10)
    .fillColor(INK)
    .text('Swahilipot Hub Foundation, Mombasa', 72, doc.y - 24, { align: 'right' });

  const lineY = doc.page.height - 60;
  doc.strokeColor(BRAND).lineWidth(1).moveTo(72, lineY).lineTo(doc.page.width - 72, lineY).stroke();
}

function attachmentLetterBody(doc, d) {
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text('TO WHOM IT MAY CONCERN', { align: 'center' });
  doc.moveDown(1.5);

  const idNo = d.attachee_id_number || 'N/A';
  doc.font('Helvetica').fontSize(11).fillColor(INK);
  doc.text(
    `This is to certify that ${d.attachee_name} (ID No: ${idNo}) has been an attachee at ` +
      `Swahilipot Hub Foundation, ${d.department_name}, from ${longDate(d.start_date)} to ` +
      `${longDate(d.end_date)}, where they undertook the ${d.program_name} program.`,
    { align: 'justify', lineGap: 3 }
  );
  doc.moveDown(1);
  doc.text(
    `During their attachment period, ${d.attachee_name} demonstrated commitment and actively ` +
      `participated in the program activities of the ${d.department_name} department.`,
    { align: 'justify', lineGap: 3 }
  );
  doc.moveDown(1);
  doc.text('We wish them well in their future endeavors.', { align: 'justify', lineGap: 3 });
}

function completionCertificateBody(doc, d) {
  doc.moveDown(1);
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(18).text('CERTIFICATE OF COMPLETION', { align: 'center' });
  doc.moveDown(2);
  doc.fillColor(INK).font('Helvetica').fontSize(11).text('This is to certify that', { align: 'center' });
  doc.moveDown(0.6);
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(16).text(d.attachee_name, { align: 'center', underline: true });
  doc.moveDown(0.6);
  doc.fillColor(INK).font('Helvetica').fontSize(11).text('has successfully completed the', { align: 'center' });
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(13).text(d.program_name, { align: 'center' });
  doc.moveDown(0.6);
  doc.font('Helvetica').fontSize(11).text(`at Swahilipot Hub Foundation, ${d.department_name}`, { align: 'center' });
  doc.moveDown(0.4);
  doc.text(`from ${longDate(d.start_date)} to ${longDate(d.end_date)}`, { align: 'center' });
}

// POST /api/certificates/generate — supervisor only, streams a PDF
router.post('/generate', verifyToken, requireRole('supervisor'), (req, res, next) => {
  try {
    const d = req.body || {};
    const required = [
      'attachee_name', 'department_name', 'program_name',
      'start_date', 'end_date', 'supervisor_name', 'supervisor_title', 'certificate_type',
    ];
    for (const field of required) {
      if (!d[field] || !String(d[field]).trim()) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }
    if (!TYPES.includes(d.certificate_type)) {
      return res.status(400).json({ error: 'Invalid certificate_type' });
    }

    const safeName = String(d.attachee_name).replace(/[^a-z0-9]+/gi, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeName}-${d.certificate_type}.pdf"`
    );

    const doc = new PDFDocument({ size: 'A4', margin: 72 });
    doc.on('error', next);
    doc.pipe(res);

    drawHeader(doc);
    if (d.certificate_type === 'completion_certificate') {
      completionCertificateBody(doc, d);
    } else {
      attachmentLetterBody(doc, d);
    }
    drawFooter(doc, d.supervisor_name, d.supervisor_title);

    doc.end();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
