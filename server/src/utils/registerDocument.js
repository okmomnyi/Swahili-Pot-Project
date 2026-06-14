'use strict';

// Signs a freshly generated PDF and records it in the documents table. Returns
// null when signing is not configured, so PDF routes can fall back to producing
// an unsigned document instead of failing.

const pool = require('../db/pool');
const logActivity = require('./logActivity');
const { isSigningConfigured, generateDocumentId, signDocument } = require('./documentSigner');

function verificationBaseUrl() {
  if (process.env.VERIFICATION_BASE_URL) return process.env.VERIFICATION_BASE_URL.replace(/\/$/, '');
  // Fall back to the client origin's /verify path.
  return `${(process.env.CLIENT_URL || '').replace(/\/$/, '')}/verify`;
}

/**
 * Register a newly generated PDF. Call AFTER producing the PDF bytes WITHOUT the
 * verification footer (the footer carries the document ID derived from these
 * bytes, so it cannot itself be part of the signed content).
 *
 * Returns { documentId, signature, issuedAt, verificationUrl, contentHash } or
 * null when signing is disabled.
 */
async function registerDocument({
  pdfBytes,
  documentType,
  recipientName,
  recipientEmail = null,
  departmentId,
  departmentName,
  issuedById,
  issuedByName,
  issuedByRole,
  fileUrl = null,
}) {
  if (!isSigningConfigured()) return null;

  const documentId = generateDocumentId(documentType);
  const issuedAt = new Date().toISOString();
  let contentHash;
  let signature;
  try {
    ({ contentHash, signature } = signDocument(pdfBytes, documentId, issuedAt));
  } catch (err) {
    // A signing failure must never break document generation — fall back to an
    // unsigned PDF and surface the reason in the logs.
    console.error(`[docsign] signing failed (${err.message}) — issuing UNSIGNED document. Check DOCUMENT_SIGNING_* in .env.`);
    return null;
  }

  await pool.query(
    `INSERT INTO documents (
       document_id, document_type, recipient_name, recipient_email,
       department_id, department_name, issued_by, issued_by_name, issued_by_role,
       issued_at, content_hash, signature, file_url
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12,$13)`,
    [
      documentId, documentType, recipientName, recipientEmail,
      departmentId, departmentName, issuedById, issuedByName, issuedByRole,
      issuedAt, contentHash, signature, fileUrl,
    ]
  );

  await logActivity({
    department_id: departmentId,
    actor_id: issuedById,
    actor_name: issuedByName,
    action_type: 'document_generated',
    entity_type: 'document',
    entity_id: null,
    description: `${issuedByName} generated a ${documentType.replace(/_/g, ' ')} for ${recipientName} (${documentId})`,
  });

  return {
    documentId,
    signature,
    issuedAt,
    contentHash,
    verificationUrl: `${verificationBaseUrl()}/${documentId}`,
  };
}

module.exports = registerDocument;
