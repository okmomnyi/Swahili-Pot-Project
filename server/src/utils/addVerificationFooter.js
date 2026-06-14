'use strict';

// Renders a compact "digitally signed" verification footer (document ID, issue
// date, partial signature, verify URL + QR code) at the bottom of the current
// PDF page. Called inline during the second pass of PDF generation — NOT a
// post-processor (PDFKit can't modify finished PDFs).

const QRCode = require('qrcode');

const BRAND_BLUE = '#1e40af';
const MUTED = '#6b7280';

/**
 * @param {PDFDocument} doc - active PDFKit document
 * @param {Object} footerData - { documentId, verificationUrl, issuedAt, signature }
 * @param {Object} [opts] - { y, qrSize } to override placement (e.g. for certificates)
 */
async function renderVerificationFooter(doc, { documentId, verificationUrl, issuedAt, signature }, opts = {}) {
  const pageWidth = doc.page.width;
  const margin = doc.page.margins.left;
  const qrSize = opts.qrSize || 46;
  const footerY = opts.y != null ? opts.y : doc.page.height - 64;
  const textWidth = pageWidth - margin * 2 - qrSize - 14;

  doc.save();

  // Top border line.
  doc.moveTo(margin, footerY)
    .lineTo(pageWidth - margin, footerY)
    .strokeColor(BRAND_BLUE)
    .lineWidth(1)
    .stroke();

  // QR code on the right.
  try {
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 128,
      margin: 0,
      color: { dark: '#1e40af', light: '#ffffff' },
    });
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    doc.image(qrBuffer, pageWidth - margin - qrSize, footerY + 6, { width: qrSize, height: qrSize });
  } catch {
    /* QR generation failed — render the text footer without it */
  }

  const x = margin;
  let y = footerY + 6;
  const issued = (() => {
    try {
      return new Date(issuedAt).toLocaleString('en-GB', {
        timeZone: 'Africa/Nairobi',
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return String(issuedAt);
    }
  })();

  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(BRAND_BLUE)
    .text('DIGITALLY SIGNED — SCAN THE QR CODE OR VISIT THE URL TO VERIFY', x, y, { width: textWidth, lineBreak: false });
  y += 11;
  doc.font('Helvetica').fontSize(7).fillColor(MUTED)
    .text(`Document ID: ${documentId}     Issued: ${issued} EAT`, x, y, { width: textWidth, lineBreak: false });
  y += 10;
  doc.text(`Signature: ${String(signature).substring(0, 34)}...`, x, y, { width: textWidth, lineBreak: false });
  y += 10;
  doc.font('Helvetica-Bold').fontSize(7).fillColor(BRAND_BLUE)
    .text(`Verify at: ${verificationUrl}`, x, y, { width: textWidth, lineBreak: false });

  doc.restore();
}

module.exports = { renderVerificationFooter };
