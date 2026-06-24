'use strict';

const express = require('express');
const PDFDocument = require('pdfkit');
const pool = require('../db/pool');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const {
  LOGO_PATH, LOGO_ASPECT, BRAND, GOLD, GOLD_LIGHT, INK, MUTED,
  longDate, drawLetterhead, drawSignatureFooter,
} = require('../lib/pdfBrand');
const registerDocument = require('../utils/registerDocument');
const { renderVerificationFooter } = require('../utils/addVerificationFooter');

const router = express.Router();

const TYPES = ['attachment_letter', 'completion_certificate'];

// Collect a PDFKit document built by `build(doc)` (which may be async) into a
// single Buffer. Used for the two-pass sign-then-render flow.
function pdfToBuffer(docOptions, build) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument(docOptions);
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    Promise.resolve(build(doc)).then(() => doc.end()).catch(reject);
  });
}

// ---------------------------------------------------------------------------
// Elegant landscape certificate (used for completion certificates + trainee
// certificates). Decorative double border, centred logo, serif typography and
// a drawn seal — inspired by classic completion-certificate layouts.
// ---------------------------------------------------------------------------
function drawSeal(doc, cx, cy, r) {
  doc.save();
  // ribbon tails
  doc.fillColor(BRAND);
  doc.polygon([cx - 7, cy + r - 4], [cx - 17, cy + r + 22], [cx - 3, cy + r + 12]).fill();
  doc.fillColor('#1e3a8a');
  doc.polygon([cx + 7, cy + r - 4], [cx + 17, cy + r + 22], [cx + 3, cy + r + 12]).fill();
  // medallion
  doc.circle(cx, cy, r).fill(GOLD);
  doc.circle(cx, cy, r - 4).fill(GOLD_LIGHT);
  doc.lineWidth(1.2).strokeColor('#ffffff').circle(cx, cy, r - 8).stroke();
  // simple star in the centre
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r - 11 : (r - 11) / 2.4;
    pts.push([cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]);
  }
  doc.fillColor('#ffffff').polygon(...pts).fill();
  doc.restore();
}

function drawCertificate(doc, { title, recipient, bodyLines, dept, leftSig, rightSig, dateStr, reserveFooter }) {
  const W = doc.page.width;
  const H = doc.page.height;

  // Decorative double border.
  doc.save();
  doc.lineWidth(3).strokeColor(BRAND).roundedRect(26, 26, W - 52, H - 52, 10).stroke();
  doc.lineWidth(1).strokeColor(GOLD).roundedRect(36, 36, W - 72, H - 72, 8).stroke();
  // corner accents
  doc.lineWidth(2).strokeColor(GOLD);
  [[36, 36, 1, 1], [W - 36, 36, -1, 1], [36, H - 36, 1, -1], [W - 36, H - 36, -1, -1]].forEach(([x, y, sx, sy]) => {
    doc.moveTo(x + sx * 6, y + sy * 26).lineTo(x + sx * 6, y + sy * 6).lineTo(x + sx * 26, y + sy * 6).stroke();
  });
  doc.restore();

  const cx = W / 2;

  // Logo, centred.
  const logoW = 210;
  const logoH = logoW / LOGO_ASPECT;
  try {
    doc.image(LOGO_PATH, cx - logoW / 2, 58, { width: logoW });
  } catch {
    doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(22).text('SwahiliPot Hub Foundation', 0, 64, { align: 'center', width: W });
  }
  let y = 58 + logoH + 14;

  doc.fillColor(MUTED).font('Helvetica').fontSize(9)
    .text('Swahilipot Hub Foundation · Mombasa, Kenya', 0, y, { align: 'center', width: W });
  y += 26;

  // Title.
  doc.fillColor(BRAND).font('Times-Bold').fontSize(30)
    .text(title.toUpperCase(), 0, y, { align: 'center', characterSpacing: 3, width: W });
  y += 42;

  doc.fillColor(MUTED).font('Times-Italic').fontSize(12)
    .text('This certificate is proudly presented to', 0, y, { align: 'center', width: W });
  y += 30;

  // Recipient name.
  doc.fillColor(INK).font('Times-BoldItalic').fontSize(34)
    .text(recipient, 0, y, { align: 'center', width: W });
  y = doc.y + 4;
  // underline under the name
  const nameW = Math.min(360, doc.widthOfString(recipient) + 80);
  doc.lineWidth(1).strokeColor(GOLD).moveTo(cx - nameW / 2, y).lineTo(cx + nameW / 2, y).stroke();
  y += 22;

  // Body.
  doc.fillColor(INK).font('Times-Roman').fontSize(13);
  for (const line of bodyLines) {
    doc.text(line, 110, y, { align: 'center', width: W - 220, lineGap: 3 });
    y = doc.y + 6;
  }

  // Seal.
  drawSeal(doc, cx, reserveFooter ? H - 200 : H - 150, 26);

  // Signatures (lifted up when a verification footer occupies the bottom band).
  const sigY = reserveFooter ? H - 138 : H - 96;
  const colW = 200;
  const leftX = 90;
  const rightX = W - 90 - colW;
  doc.lineWidth(0.8).strokeColor('#9ca3af');
  doc.moveTo(leftX, sigY).lineTo(leftX + colW, sigY).stroke();
  doc.moveTo(rightX, sigY).lineTo(rightX + colW, sigY).stroke();
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(leftSig.name, leftX, sigY + 6, { width: colW, align: 'center' });
  doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(leftSig.title, leftX, doc.y, { width: colW, align: 'center' });
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(rightSig.name, rightX, sigY + 6, { width: colW, align: 'center' });
  doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(rightSig.title, rightX, doc.y, { width: colW, align: 'center' });

  // The "dept · issued" line is replaced by the verification footer when signing.
  if (dept && !reserveFooter) {
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5)
      .text(`${dept} · Issued ${dateStr}`, 0, H - 50, { align: 'center', width: W });
  }
}

// ---------------------------------------------------------------------------
// Portrait attachment letter (formal letter, not a certificate).
// ---------------------------------------------------------------------------
function attachmentLetterBody(doc, d) {
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text('TO WHOM IT MAY CONCERN', { align: 'center' });
  doc.moveDown(1.5);
  const idNo = d.attachee_id_number || 'N/A';
  doc.font('Helvetica').fontSize(11).fillColor(INK);
  doc.text(
    `This is to certify that ${d.attachee_name} (ID No: ${idNo}) has undertaken an industrial ` +
      `attachment at Swahilipot Hub Foundation, ${d.department_name}, from ${longDate(d.start_date)} ` +
      `to ${longDate(d.end_date)}, in the ${d.program_name} programme.`,
    { align: 'justify', lineGap: 3 }
  );
  doc.moveDown(1);
  doc.text(
    `During this period, ${d.attachee_name} demonstrated commitment and actively participated in the ` +
      `activities of the ${d.department_name} department, gaining practical, hands-on experience.`,
    { align: 'justify', lineGap: 3 }
  );
  doc.moveDown(1);
  doc.text('We wish them every success in their future endeavours.', { align: 'justify', lineGap: 3 });
}

// POST /api/certificates/generate — supervisor only, streams a PDF.
router.post('/generate', verifyToken, requireRole('supervisor'), async (req, res, next) => {
  try {
    const d = { ...(req.body || {}) };

    if (d.attachee_id) {
      const { rows } = await pool.query(
        `SELECT u.name, d.name AS department_name,
                ap.university_name, ap.course_of_study,
                ap.attachment_start_date, ap.attachment_end_date
           FROM users u
           JOIN departments d ON d.id = u.department_id
           LEFT JOIN attachee_profiles ap ON ap.user_id = u.id
          WHERE u.id = $1 AND u.role = 'attachee' AND u.department_id = $2`,
        [parseInt(d.attachee_id, 10), req.user.department_id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Attachee not found' });
      const att = rows[0];
      d.attachee_name = d.attachee_name || att.name;
      d.department_name = d.department_name || att.department_name;
      d.program_name = d.program_name || att.course_of_study || 'Industrial Attachment';
      d.start_date = d.start_date || att.attachment_start_date;
      d.end_date = d.end_date || att.attachment_end_date;
    }

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

    const isCert = d.certificate_type === 'completion_certificate';
    const docOptions = isCert
      ? { size: 'A4', layout: 'landscape', margin: 40 }
      : { size: 'A4', margin: 72 };

    // Draws the document; renders the verification footer only when footerData
    // is supplied (pass 2).
    const render = (footerData) =>
      pdfToBuffer(docOptions, async (doc) => {
        if (isCert) {
          const H = doc.page.height;
          drawCertificate(doc, {
            title: 'Certificate of Completion',
            recipient: d.attachee_name,
            dept: d.department_name,
            bodyLines: [
              `has successfully completed the ${d.program_name} attachment programme`,
              `at Swahilipot Hub Foundation, ${d.department_name},`,
              `from ${longDate(d.start_date)} to ${longDate(d.end_date)}.`,
            ],
            leftSig: { name: d.supervisor_name, title: d.supervisor_title },
            rightSig: { name: 'Swahilipot Hub Foundation', title: 'Mombasa, Kenya' },
            dateStr: longDate(new Date()),
            reserveFooter: !!footerData,
          });
          if (footerData) await renderVerificationFooter(doc, footerData, { y: H - 95, qrSize: 38 });
        } else {
          drawLetterhead(doc);
          doc.moveDown(1);
          doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(15)
            .text('LETTER OF ATTACHMENT', { align: 'center', characterSpacing: 1 });
          doc.moveDown(1.5);
          attachmentLetterBody(doc, d);
          drawSignatureFooter(doc, d.supervisor_name, d.supervisor_title, { skipBottomRule: !!footerData });
          if (footerData) await renderVerificationFooter(doc, footerData);
        }
      });

    // Pass 1: unsigned bytes → register/sign → Pass 2: re-render with footer.
    const pass1 = await render(null);
    const reg = await registerDocument({
      pdfBytes: pass1,
      documentType: d.certificate_type,
      recipientName: d.attachee_name,
      recipientEmail: d.recipient_email || null,
      departmentId: req.user.department_id,
      departmentName: d.department_name,
      issuedById: req.user.id,
      issuedByName: req.user.name,
      issuedByRole: req.user.role,
    });
    const finalBytes = reg
      ? await render({
          documentId: reg.documentId,
          verificationUrl: reg.verificationUrl,
          issuedAt: reg.issuedAt,
          signature: reg.signature,
        })
      : pass1;

    const safeName = String(d.attachee_name).replace(/[^a-z0-9]+/gi, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-${d.certificate_type}.pdf"`);
    return res.send(finalBytes);
  } catch (err) {
    return next(err);
  }
});

// POST /api/certificates/trainee — instructor/supervisor. Clean completion
// certificate for a community learner (trainee), no AI narrative.
router.post('/trainee', verifyToken, requireRole('instructor', 'supervisor'), async (req, res, next) => {
  try {
    const { trainee_id, course_name, completion_date } = req.body || {};
    if (!trainee_id) return res.status(400).json({ error: 'trainee_id is required' });
    if (!course_name || !course_name.trim()) return res.status(400).json({ error: 'course_name is required' });
    if (!completion_date) return res.status(400).json({ error: 'completion_date is required' });

    const { rows } = await pool.query(
      `SELECT t.id, t.name, d.name AS department_name
         FROM trainees t JOIN departments d ON d.id = t.department_id
        WHERE t.id = $1 AND t.department_id = $2`,
      [parseInt(trainee_id, 10), req.user.department_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Trainee not found' });
    const tr = rows[0];

    await pool.query(
      `INSERT INTO trainee_certificates (trainee_id, department_id, generated_by, course_name, completion_date)
       VALUES ($1, $2, $3, $4, $5)`,
      [tr.id, req.user.department_id, req.user.id, course_name.trim(), completion_date]
    );

    const render = (footerData) =>
      pdfToBuffer({ size: 'A4', layout: 'landscape', margin: 40 }, async (doc) => {
        const H = doc.page.height;
        drawCertificate(doc, {
          title: 'Certificate of Completion',
          recipient: tr.name,
          dept: tr.department_name,
          bodyLines: [
            `has successfully completed the ${course_name.trim()} course`,
            `at Swahilipot Hub Foundation, ${tr.department_name},`,
            `on ${longDate(completion_date)}.`,
          ],
          leftSig: { name: req.user.name, title: 'Department Instructor' },
          rightSig: { name: 'Swahilipot Hub Foundation', title: 'Mombasa, Kenya' },
          dateStr: longDate(new Date()),
          reserveFooter: !!footerData,
        });
        if (footerData) await renderVerificationFooter(doc, footerData, { y: H - 95, qrSize: 38 });
      });

    const pass1 = await render(null);
    const reg = await registerDocument({
      pdfBytes: pass1,
      documentType: 'trainee_certificate',
      recipientName: tr.name,
      departmentId: req.user.department_id,
      departmentName: tr.department_name,
      issuedById: req.user.id,
      issuedByName: req.user.name,
      issuedByRole: req.user.role,
    });
    const finalBytes = reg
      ? await render({
          documentId: reg.documentId,
          verificationUrl: reg.verificationUrl,
          issuedAt: reg.issuedAt,
          signature: reg.signature,
        })
      : pass1;

    const safeName = String(tr.name).replace(/[^a-z0-9]+/gi, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-completion-certificate.pdf"`);
    return res.send(finalBytes);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
