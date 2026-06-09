'use strict';

// Shared PDF branding for letters, reports and certificates: the real
// SwahiliPot logo, the house colours, a date helper, and a letterhead whose
// divider rule sits BELOW the address block (the old layout drew the rule at
// the right-aligned date's Y, so it struck through the address text).

const path = require('path');

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'sph-logo.png');
const LOGO_ASPECT = 2971 / 503; // ~5.907 (real PNG dimensions)

const BRAND = '#1e40af';
const BRAND_LIGHT = '#3b82f6';
const GOLD = '#b8860b';
const GOLD_LIGHT = '#d4af37';
const INK = '#374151';
const MUTED = '#6b7280';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function longDate(value) {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (m) return `${m[3]} ${MONTHS[parseInt(m[2], 10) - 1]} ${m[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Portrait letterhead: real logo top-left, address beneath it, date top-right,
 * and a brand rule UNDER the whole block. Leaves doc.y just below the rule.
 */
function drawLetterhead(doc) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const top = doc.y;

  const logoW = 196;
  const logoH = logoW / LOGO_ASPECT;
  let leftBottom = top + logoH;
  try {
    doc.image(LOGO_PATH, left, top, { width: logoW });
  } catch {
    doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(20).text('SwahiliPot', left, top, { continued: true });
    doc.fillColor(INK).font('Helvetica').fontSize(14).text(' Hub Foundation');
    leftBottom = doc.y;
  }

  doc.fillColor(MUTED).font('Helvetica').fontSize(9);
  doc.text('Swahili Cultural Centre, Sir Mbarak Hinawy Rd, Old Town, Mombasa', left, leftBottom + 9);
  doc.text('swahilipothub.co.ke   |   info@swahilipothub.co.ke');
  const textBottom = doc.y;

  // Date, right-aligned, level with the top of the logo.
  doc.fillColor(INK).font('Helvetica').fontSize(10)
    .text(longDate(new Date()), left, top + 6, { align: 'right', width: right - left });

  const ruleY = textBottom + 12;
  doc.strokeColor(BRAND).lineWidth(1.2).moveTo(left, ruleY).lineTo(right, ruleY).stroke();
  doc.x = left;
  doc.y = ruleY + 20;
}

/** Signature block + bottom brand rule for letters/reports (portrait). */
function drawSignatureFooter(doc, name, title) {
  const left = doc.page.margins.left;
  const bottom = doc.page.height - 140;
  if (doc.y < bottom) doc.y = bottom;
  doc.strokeColor('#9ca3af').lineWidth(1).moveTo(left, doc.y).lineTo(left + 180, doc.y).stroke();
  doc.moveDown(0.4);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(name || 'Department Supervisor', left, doc.y);
  doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(title || 'Department Supervisor');
  doc.fontSize(9).fillColor(MUTED).text('Swahilipot Hub Foundation · Mombasa, Kenya');

  const lineY = doc.page.height - 56;
  doc.strokeColor(BRAND).lineWidth(1).moveTo(left, lineY).lineTo(doc.page.width - left, lineY).stroke();
}

module.exports = {
  LOGO_PATH, LOGO_ASPECT, BRAND, BRAND_LIGHT, GOLD, GOLD_LIGHT, INK, MUTED,
  longDate, drawLetterhead, drawSignatureFooter,
};
